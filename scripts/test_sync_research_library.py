import copy
import json
import tempfile
import unittest
import test_onedrive_minutes as fixtures
from import_onedrive_minutes import read
from sync_research_library import sync


class BatchReleaseTests(unittest.TestCase):
    def batch(self, directory):
        catalog_path, source_path, root, catalog, sources = fixtures.OneDriveMinutesTests().fixture(directory)
        storage = catalog['items'][0]['storage']
        metadata = {**sources['items'][0]['metadata'], 'name': catalog['items'][0]['originalName'],
                    'parent_reference': {'drive_id': storage['driveId']}}
        permission = {'id': 'checked-permission', 'roles': ['read'], 'expiration_date_time': None,
                      'link': {'scope': 'anonymous', 'type': 'view', 'prevents_download': False,
                               'web_url': 'https://1drv.ms/w/example-checked-share'}}
        receipt = {'assetId': 'onedrive-docx-' + 'a'*20, 'driveId': storage['driveId'],
                   'itemId': storage['itemId'], 'metadata': metadata, 'permission': permission}
        (catalog_path.parent / 'source-texts.json').write_text(json.dumps(sources), encoding='utf-8')
        receipt_path = catalog_path.parent / 'sharing-receipts.json'
        receipt_path.write_text(json.dumps({'verifiedAt': '2026-10-08', 'items': [receipt]}), encoding='utf-8')
        return catalog_path.parent, root, receipt, receipt_path

    def test_single_entry_publishes_verified_link_and_no_cloud_mapping(self):
        with tempfile.TemporaryDirectory() as directory:
            batch, root, _, _ = self.batch(directory)
            result = sync(batch, root, with_summaries=True)
            self.assertEqual(result['customerDownloads'], 1)
            record = read(root / 'data/research/library.json')['records'][0]
            self.assertEqual(record['storage']['audience'], 'public')
            self.assertTrue(record['storage']['downloadAllowed'])
            self.assertEqual(read(root / record['processing']['contentPath'])['originalAccess'], 'public')
            public = '\n'.join(p.read_text(encoding='utf-8') for p in root.rglob('*.json'))
            for private in ['PRIVATE_ITEM_ID', 'PRIVATE_DRIVE_ID', 'PRIVATE_OWNER_ID', 'checked-permission']:
                self.assertNotIn(private, public)
            self.assertTrue((batch / '入库结果.json').exists())

    def test_edit_links_blocked_downloads_wrong_originals_and_expiry_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            batch, root, receipt, path = self.batch(directory)
            for case in ['write', 'blocked', 'hash', 'expired', 'scope']:
                broken = copy.deepcopy(receipt)
                if case == 'write': broken['permission']['roles'] = ['write']
                if case == 'blocked': broken['permission']['link']['prevents_download'] = True
                if case == 'hash': broken['metadata']['file']['hashes']['sha256Hash'] = 'b'*64
                if case == 'expired': broken['permission']['expiration_date_time'] = '2000-01-01T00:00:00Z'
                if case == 'scope': broken['permission']['link']['scope'] = 'organization'
                path.write_text(json.dumps({'verifiedAt': '2026-10-08', 'items': [broken]}), encoding='utf-8')
                with self.assertRaises(ValueError): sync(batch, root, with_summaries=True)
                self.assertFalse((root / 'data/research/library.json').exists())

    def test_reimport_preserves_customer_downloads_and_review_state(self):
        with tempfile.TemporaryDirectory() as directory:
            batch, root, _, receipt_path = self.batch(directory)
            sync(batch, root, with_summaries=True)
            library_path = root / 'data/research/library.json'
            library = read(library_path)
            library['records'][0]['processing']['status'] = 'reviewed'
            library_path.write_text(json.dumps(library), encoding='utf-8')
            receipt_path.unlink()
            result = sync(batch, root, with_summaries=True)
            record = read(library_path)['records'][0]
            self.assertEqual(result['customerDownloads'], 1)
            self.assertEqual(record['processing']['status'], 'reviewed')
            self.assertEqual(record['storage']['openUrl'], 'https://1drv.ms/w/example-checked-share')


if __name__ == '__main__': unittest.main()

