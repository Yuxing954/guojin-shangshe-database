import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from build_research_library import ROOT, build, sector_ids
from import_research_attachment import import_asset, read_transcript


class LibraryTests(unittest.TestCase):
    def test_filename_classification(self):
        self.assertEqual(sector_ids('食品饮料中秋动销.pdf'), ['food'])
        self.assertIn('commerce', sector_ids('AI-电商-从技术叙事到业绩兑现.pdf'))
        self.assertEqual(sector_ids('消费电子产业链.pdf'), [])
        self.assertNotIn('gold', sector_ids('黄金周旅游.mp3'))
        for name in ['新能源汽车周报-零售订单.pdf', 'Power Transformer Export Total.pdf', '消费级AI金融服务.pdf', '全栈AI-阿里字节.pdf', 'Nyota technology.pdf', '阿里巴巴云栖大会.pdf', '消费者信心与油价.mp3']:
            self.assertEqual(sector_ids(name), [], name)
        self.assertIn('travel', sector_ids('OTA酒店预订.pdf'))

    def test_mixed_topic_deduplicates_each_file_and_strips_urls(self):
        with tempfile.TemporaryDirectory() as directory:
            topic = {'topic_id': '123', 'create_time': '2026-10-01T12:00:00', 'group': {'group_id': '88888142214212'}, 'talk': {'files': [
                {'file_id': '1', 'name': '酒店数据.pdf', 'download_url': 'https://example.com/?token=private', 'duration': 0},
                {'file_id': '2', 'name': '古茗交流.mp3', 'duration': 60},
                {'file_id': '3', 'name': '半导体.pdf'}]}}
            path = Path(directory) / 'page-001.json'
            path.write_text(json.dumps([topic, topic]), encoding='utf-8')
            catalog = build(directory, Path(directory))
            self.assertEqual(len(catalog['records']), 2)
            self.assertNotIn('token=', json.dumps(catalog))
            self.assertEqual(catalog['counts'], {'audio': 1, 'document': 1})

    def test_real_text_layer_extraction_and_sha_guard(self):
        from reportlab.pdfgen import canvas
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pdf = root / 'source.pdf'
            painter = canvas.Canvas(str(pdf))
            painter.drawString(40, 700, 'Revenue increased by 5% in the source quarter.')
            painter.showPage()
            painter.drawString(40, 700, 'Second page: forecast is not an actual result.')
            painter.save()
            library = root / 'library.json'
            library.write_text(json.dumps({'records': [{'id': 'zsxq-file-123', 'extension': 'pdf', 'sourceUrl': 'https://wx.zsxq.com/group/1/topic/2', 'sha256': hashlib.sha256(pdf.read_bytes()).hexdigest()}]}), encoding='utf-8')
            result = import_asset(library, 'zsxq-file-123', pdf, root=root)
            content = json.loads((root / result['contentPath']).read_text())
            self.assertEqual([p['page'] for p in content['pages']], [1, 2])
            self.assertIn('5%', content['pages'][0]['text'])
            self.assertEqual(result['status'], 'extracted')
            pdf.write_bytes(b'wrong original')
            with self.assertRaises(ValueError):
                import_asset(library, 'zsxq-file-123', pdf, root=root)

    def test_refresh_preserves_verified_processing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data/research').mkdir(parents=True)
            old = {'records': [{'id': 'zsxq-file-1', 'sha256': 'source-hash', 'processing': {'status': 'reviewed', 'textAvailable': True}}]}
            (root / 'data/research/library.json').write_text(json.dumps(old), encoding='utf-8')
            topic = {'topic_id': '123', 'create_time': '2026-10-01T12:00:00', 'group': {'group_id': '88888142214212'}, 'files': [{'file_id': '1', 'name': '酒店.pdf', 'hash': 'source-hash'}]}
            (root / 'page-001.json').write_text(json.dumps([topic]), encoding='utf-8')
            refreshed = build(root, root)
            self.assertEqual(refreshed['records'][0]['processing']['status'], 'reviewed')
            topic['files'][0]['hash'] = 'replaced-original'
            (root / 'page-001.json').write_text(json.dumps([topic]), encoding='utf-8')
            self.assertEqual(build(root, root)['records'][0]['processing']['status'], 'awaiting_file')

    def test_reposts_share_one_file_and_keep_source_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            topics = [{'topic_id': str(i), 'create_time': f'2026-10-0{i}T12:00:00', 'group': {'group_id': '88888142214212'}, 'files': [{'file_id': str(i), 'name': '古茗.mp3', 'hash': 'identical-content'}]} for i in [1, 2]]
            (root / 'page-001.json').write_text(json.dumps(topics), encoding='utf-8')
            data = build(root, root)
            self.assertEqual(len(data['records']), 1)
            self.assertEqual(set(data['records'][0]['sourceTopics']), {'1', '2'})
            self.assertEqual(set(data['records'][0]['aliases']), {'zsxq-file-1', 'zsxq-file-2'})

    def test_transcript_timestamps_and_review_state(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'transcript.json'
            for segments in [[], [{'start': -1, 'end': 5, 'text': 'bad'}], [{'start': 0, 'end': 99, 'text': 'outside recording'}]]:
                path.write_text(json.dumps({'segments': segments}), encoding='utf-8')
                with self.assertRaises(ValueError):
                    read_transcript(path, 60)
            path.write_text(json.dumps({'segments': [{'start': 0, 'end': 10, 'text': 'actual transcript'}]}), encoding='utf-8')
            self.assertEqual(read_transcript(path, 60)[0]['start'], 0)

    def test_curated_claims_reference_existing_source_records(self):
        import csv
        topics = set()
        for path in (ROOT / 'data/research/updates').glob('*-views-*.csv'):
            with path.open(encoding='utf-8-sig', newline='') as stream:
                topics.update(row['原文链接'].rsplit('/', 1)[-1] for row in csv.DictReader(stream))
        data = json.loads((ROOT / 'data/research/market-briefs.json').read_text(encoding='utf-8'))
        for brief in data['briefs']:
            ids = {source['topicId'] for source in brief['sources']}
            self.assertTrue(ids.issubset(topics))
            self.assertTrue(all(item['source'] in ids for item in brief['evidence']))


if __name__ == '__main__':
    unittest.main()
