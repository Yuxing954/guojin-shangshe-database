import base64
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from apply_library_upload import apply, git_sha


class UploadTests(unittest.TestCase):
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
