import copy
import json
import tempfile
import unittest
from pathlib import Path
from build_research_library import ROOT, build
from import_onedrive_minutes import import_catalog

class OneDriveMinutesTests(unittest.TestCase):
    def fixture(self, directory):
        private, root = Path(directory) / 'private', Path(directory) / 'site'
        private.mkdir(); root.mkdir()
        storage = {'sha256': 'a'*64, 'size': 12, 'itemId': 'PRIVATE_ITEM_ID', 'driveId': 'PRIVATE_DRIVE_ID',
                   'ownerUrl': 'https://onedrive.live.com/?cid=PRIVATE_OWNER_ID', 'audience': 'private',
                   'permissionsReviewed': True, 'moveIntegrityVerified': True}
        item = {'id': 'private-source', 'storage': storage, 'originalName': '20260918 金陵体育.docx',
                'company': '金陵体育', 'sector': '体育消费', 'documentType': '公司交流', 'filenameDate': '20260918',
                'headerDate': '20260918', 'eventDate': '2026-09-18', 'dateStatus': 'filename_header_consistent',
                'summary': '订单需区分收入确认', 'followUp': '观察回款', 'qualityIssues': [],
                'evidence': [{'line': 2, 'anchor': '观察回款'}]}
        catalog = {'uniqueDocumentCount': 1, 'items': [item], 'processedAt': '2026-10-08', 'batchId': 'sample', 'duplicateCount': 1}
        source = {'items': [{'metadata': {'id': 'PRIVATE_ITEM_ID', 'size': 12, 'file': {'hashes': {'sha256Hash': 'A'*64}}}, 'text': '会议\n订单需区分收入确认，观察回款'}]}
        catalog_path, source_path = private / 'catalog.json', private / 'sources.json'
        catalog_path.write_text(json.dumps(catalog, ensure_ascii=False), encoding='utf-8')
        source_path.write_text(json.dumps(source, ensure_ascii=False), encoding='utf-8')
        return catalog_path, source_path, root, catalog, source

    def test_import_is_idempotent_and_does_not_publish_private_mapping(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog_path, source_path, root, _, _ = self.fixture(directory)
            import_catalog(catalog_path, source_path, root); import_catalog(catalog_path, source_path, root)
            library = json.loads((root / 'data/research/library.json').read_text(encoding='utf-8'))
            self.assertEqual(len(library['records']), 1)
            self.assertEqual(library['ingestedBatch']['duplicateCopiesExcluded'], 1)
            public = '\n'.join(p.read_text(encoding='utf-8') for p in root.rglob('*.json'))
            for secret in ['PRIVATE_ITEM_ID', 'PRIVATE_DRIVE_ID', 'PRIVATE_OWNER_ID', 'private-source']:
                self.assertNotIn(secret, public)
            self.assertIn('PRIVATE_ITEM_ID', (catalog_path.parent / 'website-import-map.json').read_text(encoding='utf-8'))

    def test_unresolved_date_is_not_a_confirmed_meeting_date(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog_path, source_path, root, catalog, _ = self.fixture(directory)
            catalog['items'][0].update(eventDate=None, headerDate='20260919', dateStatus='needs_review')
            catalog_path.write_text(json.dumps(catalog), encoding='utf-8')
            import_catalog(catalog_path, source_path, root)
            record = json.loads((root / 'data/research/library.json').read_text(encoding='utf-8'))['records'][0]
            self.assertEqual(record['date'], '')
            self.assertEqual(record['dateCandidates'], ['20260918', '20260919'])

    def test_bad_checksum_or_evidence_is_rejected_before_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog_path, source_path, root, catalog, _ = self.fixture(directory)
            for change in ['checksum', 'evidence']:
                broken = copy.deepcopy(catalog)
                if change == 'checksum': broken['items'][0]['storage']['sha256'] = 'b'*64
                else: broken['items'][0]['evidence'][0]['line'] = 99
                catalog_path.write_text(json.dumps(broken), encoding='utf-8')
                with self.assertRaises(ValueError): import_catalog(catalog_path, source_path, root)
                self.assertFalse((root / 'data/research/library.json').exists())

    def test_reviewed_summary_is_not_downgraded_by_same_import(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog_path, source_path, root, catalog, _ = self.fixture(directory)
            import_catalog(catalog_path, source_path, root)
            path = root / 'data/research/library.json'
            library = json.loads(path.read_text(encoding='utf-8')); library['records'][0]['processing']['status'] = 'reviewed'
            path.write_text(json.dumps(library), encoding='utf-8')
            import_catalog(catalog_path, source_path, root)
            self.assertEqual(json.loads(path.read_text(encoding='utf-8'))['records'][0]['processing']['status'], 'reviewed')
            catalog['items'][0]['summary'] = '发生了新的口径变化'
            catalog_path.write_text(json.dumps(catalog), encoding='utf-8')
            import_catalog(catalog_path, source_path, root)
            self.assertEqual(json.loads(path.read_text(encoding='utf-8'))['records'][0]['processing']['status'], 'summary_draft')

    def test_topic_refresh_preserves_manual_sectors_and_summary_content(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog_path, source_path, root, _, _ = self.fixture(directory)
            import_catalog(catalog_path, source_path, root)
            topics = root / 'topics'; topics.mkdir()
            (topics / 'page-1.json').write_text(json.dumps([{'topic_id': '1', 'create_time': '2026-10-07T12:00:00', 'group': {'group_id': '88888142214212'}, 'files': []}]))
            refreshed = build(topics, root)
            record = refreshed['records'][0]
            self.assertEqual(refreshed['ingestedBatch']['originals'], 1)
            self.assertEqual(record['sectors'], ['sports'])
            self.assertTrue(record['processing']['textAvailable'])
            self.assertEqual(record['sourceTopics'], [])

    def test_real_ingested_records_have_matching_safe_summary_files(self):
        library = json.loads((ROOT / 'data/research/library.json').read_text(encoding='utf-8'))
        records = [r for r in library['records'] if r.get('batchId') == library['ingestedBatch']['id']]
        self.assertEqual(len(records), library['ingestedBatch']['originals'])
        self.assertEqual(sum(r['processing']['qualityIssueCount'] for r in records), library['ingestedBatch']['qualityIssues'])
        for record in records:
            content = json.loads((ROOT / record['processing']['contentPath']).read_text(encoding='utf-8'))
            self.assertEqual(content['assetId'], record['id'])
            self.assertEqual(content['type'], 'meeting_summary')
            self.assertEqual(content['reviewed'], record['processing']['status'] == 'reviewed')
            self.assertTrue(content['evidence'])
            self.assertEqual(record['storage']['audience'], 'private')
            self.assertNotIn('openUrl', record['storage'])

if __name__ == '__main__': unittest.main()
