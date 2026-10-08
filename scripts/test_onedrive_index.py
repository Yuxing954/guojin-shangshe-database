import copy
import json
import tempfile
import unittest
from pathlib import Path
from import_onedrive_minutes import read
from sync_research_library import sync


class OriginalIndexTests(unittest.TestCase):
    def fixture(self, directory, sha='a'*64):
        private, root = Path(directory)/'private', Path(directory)/'site'
        private.mkdir()
        receipt = {'driveId': 'PRIVATE_DRIVE', 'itemId': 'PRIVATE_ITEM',
                   'metadata': {'id': 'PRIVATE_ITEM', 'parent_reference': {'drive_id': 'PRIVATE_DRIVE'},
                                'name': '20261008 酒店交流.pdf', 'size': 42, 'e_tag': 'PRIVATE_VERSION',
                                'file': {'mimeType': 'application/pdf', 'hashes': {'sha256Hash': sha}}},
                   'permission': {'id': 'PRIVATE_PERMISSION', 'roles': ['read'],
                                  'link': {'scope': 'anonymous', 'type': 'view', 'prevents_download': False,
                                           'web_url': 'https://1drv.ms/b/verified-file'}}}
        path = private/'sharing-receipts.json'
        path.write_text(json.dumps({'verifiedAt': '2026-10-08', 'items': [receipt]}), encoding='utf-8')
        return private, root, receipt, path

    def test_default_import_needs_no_catalog_text_or_summary(self):
        with tempfile.TemporaryDirectory() as d:
            private, root, receipt, path = self.fixture(d)
            path.write_text(json.dumps({'verifiedAt': '2026-10-08', 'items': [receipt, receipt]}), encoding='utf-8')
            result = sync(private, root)
            self.assertEqual(result, {'mode': 'originals', 'indexed': 1, 'excludedDuplicates': 1,
                                      'added': 1, 'updated': 0, 'unchanged': 0, 'websiteChanged': True,
                                      'summariesGenerated': 0, 'filesExtracted': 0})
            sync(private, root)
            data = read(root/'data/research/library.json')
            self.assertEqual(len(data['records']), 1)
            record = data['records'][0]
            self.assertEqual(record['dateStatus'], 'filename')
            self.assertFalse(record['processing']['textAvailable'])
            self.assertFalse((root/'data/research/processed').exists())
            public = json.dumps(data)
            for secret in ['PRIVATE_ITEM', 'PRIVATE_DRIVE', 'PRIVATE_VERSION', 'PRIVATE_PERMISSION']:
                self.assertNotIn(secret, public)

    def test_metadata_update_preserves_existing_summary_and_flags(self):
        with tempfile.TemporaryDirectory() as d:
            private, root, _, _ = self.fixture(d)
            sync(private, root)
            path = root/'data/research/library.json'
            library = read(path)
            processing = {'status': 'needs_review', 'textAvailable': True, 'summary': '已有摘要',
                          'contentPath': 'data/research/processed/example.json', 'qualityIssueCount': 1}
            library['records'][0]['processing'] = processing
            library['records'][0]['dateStatus'] = 'needs_review'
            library['records'][0]['date'] = ''
            path.write_text(json.dumps(library), encoding='utf-8')
            content = root/'data/research/processed/example.json'
            content.parent.mkdir()
            content.write_text('Existing review evidence', encoding='utf-8')
            sync(private, root)
            record = read(path)['records'][0]
            self.assertEqual(record['processing'], processing)
            self.assertEqual(record['dateStatus'], 'needs_review')
            self.assertEqual(content.read_text(encoding='utf-8'), 'Existing review evidence')

    def test_provider_without_sha_uses_version_and_changed_original_resets_summary(self):
        with tempfile.TemporaryDirectory() as d:
            private, root, receipt, path = self.fixture(d, sha='')
            sync(private, root)
            original = read(root/'data/research/library.json')['records'][0]
            self.assertEqual(original['sha256'], '')
            self.assertEqual(original['storage']['verificationMethod'], 'provider_metadata_version')
            receipt['metadata']['e_tag'] = 'new-version'
            path.write_text(json.dumps({'verifiedAt': '2026-10-08', 'items': [receipt]}), encoding='utf-8')
            sync(private, root)
            records = read(root/'data/research/library.json')['records']
            self.assertEqual(len(records), 1)
            self.assertNotEqual(records[0]['id'], original['id'])
            self.assertIn(original['id'], records[0]['aliases'])
            self.assertFalse(records[0]['processing']['textAvailable'])

    def test_invalid_permission_or_file_binding_leaves_site_untouched(self):
        with tempfile.TemporaryDirectory() as d:
            private, root, receipt, path = self.fixture(d)
            for case in ['edit', 'blocked', 'expired', 'wrong-item', 'unsafe-link', 'private']:
                broken = copy.deepcopy(receipt)
                if case == 'edit': broken['permission']['roles'] = ['write']
                if case == 'blocked': broken['permission']['link']['prevents_download'] = True
                if case == 'expired': broken['permission']['expiration_date_time'] = '2000-01-01T00:00:00Z'
                if case == 'wrong-item': broken['metadata']['id'] = 'OTHER_ITEM'
                if case == 'unsafe-link': broken['permission']['link']['web_url'] = 'https://evil.example/file'
                if case == 'private': broken['permission']['link']['scope'] = 'organization'
                path.write_text(json.dumps({'verifiedAt': '2026-10-08', 'items': [receipt, broken]}), encoding='utf-8')
                with self.assertRaises(ValueError): sync(private, root)
                self.assertFalse((root/'data/research/library.json').exists())

    def test_repeat_check_keeps_public_bytes_and_mtime_but_records_private_check(self):
        with tempfile.TemporaryDirectory() as d:
            private, root, receipt, path = self.fixture(d)
            sync(private, root)
            library = root/'data/research/library.json'
            before, modified = library.read_bytes(), library.stat().st_mtime_ns
            path.write_text(json.dumps({'verifiedAt': '2026-10-09', 'items': [receipt]}), encoding='utf-8')
            result = sync(private, root)
            self.assertEqual((result['added'], result['updated'], result['unchanged']), (0, 0, 1))
            self.assertFalse(result['websiteChanged'])
            self.assertEqual(library.read_bytes(), before)
            self.assertEqual(library.stat().st_mtime_ns, modified)
            self.assertEqual(next(iter(read(private/'website-import-map.json').values()))['permissionCheckedAt'], '2026-10-09')
            receipt['permission']['link']['prevents_download'] = True
            path.write_text(json.dumps({'verifiedAt': '2026-10-10', 'items': [receipt]}), encoding='utf-8')
            with self.assertRaises(ValueError): sync(private, root)
            self.assertEqual(library.read_bytes(), before)

    def test_link_rotation_updates_only_the_existing_record(self):
        with tempfile.TemporaryDirectory() as d:
            private, root, receipt, path = self.fixture(d)
            sync(private, root)
            receipt['permission']['link']['web_url'] = 'https://1drv.ms/b/rotated-share'
            path.write_text(json.dumps({'verifiedAt': '2026-10-09', 'items': [receipt]}), encoding='utf-8')
            result = sync(private, root)
            self.assertEqual((result['added'], result['updated'], result['unchanged']), (0, 1, 0))
            records = read(root/'data/research/library.json')['records']
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0]['storage']['openUrl'], 'https://1drv.ms/b/rotated-share')


if __name__ == '__main__': unittest.main()


