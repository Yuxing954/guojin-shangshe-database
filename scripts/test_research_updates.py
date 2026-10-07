"""Validate source coverage, assignments and the generated research index."""
import json
import unittest
from pathlib import Path
from research_sources import update_rows, row_keys

ROOT=Path(__file__).resolve().parent.parent

class ResearchDataTests(unittest.TestCase):
    def test_sources_and_latest_index(self):
        meta=json.loads((ROOT/'data/research/updates/manifest.json').read_text(encoding='utf-8'))
        index=json.loads((ROOT/'data/research/recent.json').read_text(encoding='utf-8'))
        self.assertLessEqual(meta['oldestFetched'][:10],meta['coverageFrom'])
        assigned=meta['assignedTopics']
        self.assertFalse(set(assigned['views']) & set(assigned['all_views']))
        for kind in ('views','all_views','minutes'):
            rows=update_rows(ROOT,kind)
            self.assertEqual(len(rows),meta['counts'][kind])
            self.assertEqual(len({row_keys(r)[0] for r in rows}),len(rows))
            latest=max((r.get('时间') or r.get('日期') or '' for r in rows),default='')
            self.assertEqual(latest,meta['latest'][kind])
            db=next(d for d in index['dbs'] if d['id']==kind)
            self.assertTrue(any((r.get('时间') or r.get('日期') or '')==latest for r in db['rows']))
            for r in rows:
                self.assertNotIn('<e ',r.get('内容',''))
                self.assertTrue((r.get('原文链接') or '').startswith('https://wx.zsxq.com/group/'+meta['sourceGroup']+'/topic/'))
                if kind=='minutes':self.assertIn(r['内容状态'],('会议音频，未转写','附件索引，正文未提取'))

if __name__=='__main__':unittest.main()
