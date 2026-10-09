import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape
from sync_work_minutes import prepare, acknowledge, read, sha

def document(text):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + escape(text) + '</w:t></w:r></w:p></w:body></w:document>')
    return buffer.getvalue()

class SyncTests(unittest.TestCase):
    def fixture(self, directory):
        base = Path(directory)
        source, private, root = base / 'source', base / 'private', base / 'repo'
        source.mkdir()
        (root / 'data/research').mkdir(parents=True)
        (root / 'data/research/library.json').write_text(json.dumps({'schemaVersion':1,'records':[],'counts':{}}), encoding='utf-8')
        return source, private, root

    def ack(self, private, root, batch):
        receipt = private / 'verification.json'
        receipt.write_text(json.dumps({'commit':'a'*40,'verified':True,'files':{p:sha((root/p).read_bytes()) for p in batch['changedPaths']}}), encoding='utf-8')
        return acknowledge(private, root, 'a'*40, receipt)

    def test_duplicate_then_noop_and_update_same_mtime(self):
        with tempfile.TemporaryDirectory() as directory:
            source, private, root = self.fixture(directory)
            path = source/'20261007 中国中免.docx'
            data = document('真实原文' * 30)
            path.write_bytes(data)
            (source/'20261007 中国中免 - 副本.docx').write_bytes(data)
            first = prepare(source, private, root)
            self.assertEqual(first['counts']['added'],1)
            self.assertEqual(first['counts']['duplicates'],1)
            self.assertFalse((private/'state.json').exists())
            self.ack(private,root,first)
            self.assertEqual(prepare(source,private,root)['changedPaths'],[])
            (source/'20261007 中国中免 - 副本.docx').unlink()
            old_id = read(root/'data/research/library.json')['records'][0]['id']
            path.write_bytes(document('真实更新' * 30))
            changed = prepare(source,private,root)
            self.assertEqual(changed['counts']['updated'],1)
            self.assertEqual(read(root/'data/research/library.json')['records'][0]['id'],old_id)

    def test_invalid_source_retried_without_checkpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            source, private, root = self.fixture(directory)
            (source/'bad.docx').write_bytes(b'not word')
            first = prepare(source,private,root)
            self.assertEqual(first['counts']['failed'],1)
            self.assertEqual(first['files'],{})
            self.assertEqual(prepare(source,private,root)['counts']['failed'],1)

    def test_editing_a_duplicate_keeps_the_canonical_source(self):
        with tempfile.TemporaryDirectory() as directory:
            source, private, root = self.fixture(directory)
            first=source/'20261007 中国中免.docx'
            duplicate=source/'copy.docx'
            data=document('真实原文' * 30)
            first.write_bytes(data);duplicate.write_bytes(data)
            batch=prepare(source,private,root);self.ack(private,root,batch)
            duplicate.write_bytes(document('另一场交流原文' * 30))
            next_batch=prepare(source,private,root)
            self.assertEqual(next_batch['counts']['added'],1)
            self.assertEqual(len(read(root/'data/research/library.json')['records']),2)
            self.assertTrue(any(r['sha256']==sha(data) for r in read(root/'data/research/library.json')['records']))

    def test_prior_summary_downloads_and_date_issues_survive(self):
        with tempfile.TemporaryDirectory() as directory:
            source, private, root = self.fixture(directory)
            data = document('真实原文' * 30)
            name='20261007 中国中免.docx'
            (source/name).write_bytes(data)
            old={'id':'onedrive-docx-test','name':name,'company':'中国中免','format':'document','extension':'docx','sha256':sha(data),'published':'2026-10-07','date':'','dateStatus':'needs_review','storage':{'openUrl':'https://1drv.ms/w/example'},'processing':{'summary':'旧摘要','status':'needs_review','qualityIssueCount':1,'contentPath':'data/research/processed/onedrive-docx-test.json'}}
            (root/'data/research/library.json').write_text(json.dumps({'records':[old]}),encoding='utf-8')
            (root/'data/research/processed').mkdir()
            (root/'data/research/processed/onedrive-docx-test.json').write_text(json.dumps({'qualityIssues':[{'detail':'旧疑点'}],'summary':'旧摘要'}),encoding='utf-8')
            prepare(source,private,root)
            current=read(root/'data/research/library.json')['records'][0]
            self.assertEqual(current['storage'],old['storage'])
            self.assertEqual(current['processing']['summary'],'旧摘要')
            self.assertEqual(current['dateStatus'],'needs_review')
            self.assertEqual(read(root/current['processing']['contentPath'])['qualityIssues'],[{'detail':'旧疑点'}])

    def test_ack_rejects_missing_or_mismatched_remote_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            source, private, root = self.fixture(directory)
            (source/'20261007 中国中免.docx').write_bytes(document('真实原文' * 30))
            batch=prepare(source,private,root)
            receipt=private/'verification.json'
            receipt.write_text(json.dumps({'commit':'a'*40,'verified':True,'files':{}}),encoding='utf-8')
            with self.assertRaises(ValueError): acknowledge(private,root,'a'*40,receipt)
            self.assertFalse((private/'state.json').exists())

    def test_zip_duplicates_and_database_exclusion(self):
        with tempfile.TemporaryDirectory() as directory:
            source, private, root = self.fixture(directory)
            data=document('真实原文' * 30)
            (source/'20261007 中国中免.docx').write_bytes(data)
            with zipfile.ZipFile(source/'batch.zip','w') as archive: archive.writestr('会议/20261007 中国中免.docx',data)
            (source/'数据库').mkdir()
            (source/'数据库/表格.pdf').write_bytes(b'excluded')
            batch=prepare(source,private,root)
            self.assertEqual(batch['counts']['added'],1)
            self.assertEqual(batch['counts']['duplicates'],1)
            self.assertTrue(any(e['status']=='excluded' for e in batch['events']))

if __name__=='__main__': unittest.main()
