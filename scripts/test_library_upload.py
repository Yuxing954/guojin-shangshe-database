import base64
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from apply_library_upload import apply, git_sha, merge_metadata


class UploadTests(unittest.TestCase):
    def test_delta_preserves_manual_fields(self):
        old = {'records': [{'fileId':'1','sectors':['manual'],'contentRead':True,'format':'audio',
                           'processing':{'status':'done'},'name':'old.mp3',
                           'metadata':{'manual':'keep'},'sourceTopics':['100'],
                           'occurrences':[]}, {'id':'manual-document','title':'Keep'}],
               'coverage':{'from':'2024-01-01'},'workSync':{'manual':True}}
        f = {'file_id':'1','topicId':'101','name':'new.mp3','size':2,'download_count':7,
             'create_time':'2026-11-24T12:00:00+08:00','topicCreatedAt':'2026-11-24T12:00:00+08:00'}
        g = {**f,'file_id':'2','topicId':'102','name':'doc.pdf'}
        scan = {'windowStart':'2026-11-24T00:00:00+08:00','windowEndDate':'2026-11-26',
                'observedAt':'2026-11-26T12:00:00+08:00','latest':f['topicCreatedAt'],
                'boundaryReachedBeforeWindow':True,'pages':2,'topicsScanned':60,'topics':40,
                'attachments':2,'unique':2,'files':[['1',[f]],['2',[g]]]}
        result = merge_metadata(old,scan)
        first = result['records'][0]
        self.assertEqual(first['sectors'],['manual'])
        self.assertTrue(first['contentRead'])
        self.assertEqual(first['processing'],{'status':'done'})
        self.assertEqual(first['metadata']['manual'],'keep')
        self.assertEqual(first['downloadCount'],7)
        self.assertEqual(result['records'][1],{'id':'manual-document','title':'Keep'})
        self.assertEqual(result['attachmentScan']['newRecords'],1)
        self.assertEqual(result['attachmentScan']['existingRecordsRefreshed'],1)
        self.assertEqual(merge_metadata(result,scan)['attachmentScan']['existingRecordsRefreshed'],0)

    def fixture(self, root):
        p = Path(root) / 'data/research'
        p.mkdir(parents=True)
        old = b'{"records":[{"fileId":"1","sectors":["manual"]}]}'
        (p / 'library.json').write_bytes(old)
        new = {'records': [{'fileId': '1', 'sectors': ['manual']}, {'fileId': '2'}],
               'attachmentScan': {'windowComplete': True}, 'coverage': {'completeArchive': False}}
        payload = json.dumps(new).encode()
        packed = gzip.compress(payload)
        folder = p / 'library-pending/test'
        folder.mkdir(parents=True)
        (folder / 'part-000.b64').write_bytes(base64.b64encode(packed))
        spec = {'schemaVersion': 1, 'batchId': 'test', 'baseBlobSha': git_sha(old),
                'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest(),
                'compressedBytes': len(packed), 'recordCount': 2,
                'chunks': [{'name': 'part-000.b64', 'sha256': hashlib.sha256(packed).hexdigest()}]}
        (folder / 'manifest.json').write_text(json.dumps(spec))
        return p, old, payload

    def test_verified_apply_and_receipt(self):
        with tempfile.TemporaryDirectory() as root:
            p, _, payload = self.fixture(root)
            apply(root)
            self.assertEqual((p / 'library.json').read_bytes(), payload)
            self.assertTrue((p / 'library-sync-receipt.json').exists())
            self.assertFalse((p / 'library-pending/test').exists())

    def test_corrupt_chunk_keeps_library_and_checkpoint(self):
        with tempfile.TemporaryDirectory() as root:
            p, old, _ = self.fixture(root)
            (p / 'library-pending/test/part-000.b64').write_text('AAAA')
            with self.assertRaises(ValueError):
                apply(root)
            self.assertEqual((p / 'library.json').read_bytes(), old)
            self.assertTrue((p / 'library-pending/test/manifest.json').exists())

    def test_concurrent_edit_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as root:
            p, _, _ = self.fixture(root)
            changed = b'{"records":[{"fileId":"3"}]}'
            (p / 'library.json').write_bytes(changed)
            with self.assertRaises(ValueError):
                apply(root)
            self.assertEqual((p / 'library.json').read_bytes(), changed)


if __name__ == '__main__':
    unittest.main()
