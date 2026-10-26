import json, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import build_daily_resource_list as resources
from build_daily_report import stamp

class OverviewResourcesTests(unittest.TestCase):
 def test_overview_titles_do_not_require_sector_tags(self):
  for name in ['资金再均衡下商社投资机会20261016.pdf','消费行业底部推荐20261015.mp3','中国消费：黄金周现实检验-专家电话会要点.pdf','四季度消费的估值切换与布局窗口20261025.pdf','性价比消费时代-关注-纯过日子-组合20261025.pdf']:
   self.assertTrue(resources.allowed_attachment({'name':name,'sectors':['other']}))
  for name in ['AI消费电子深度.pdf','食品饮料26Q3业绩前瞻.pdf','中国房地产：黄金周表现.pdf','餐饮换挡-速冻提速-速冻行业结构性增长新机遇20261021.pdf']:
   self.assertFalse(resources.allowed_attachment({'name':name,'sectors':['other']}))
 def test_research_recap_is_not_registered_as_minutes(self):
  self.assertEqual(resources.attachment_kind({'name':'中国消费：黄金周现实检验-专家电话会要点-China Consumer Expert Call Takeaways.pdf','format':'document'}),'reports')
  self.assertEqual(resources.attachment_kind({'name':'九毛九调研纪要.pdf','format':'document'}),'minutes')
  self.assertEqual(resources.attachment_kind({'name':'消费行业底部推荐.mp3','format':'audio'}),'audio')
 def test_completed_historical_scan_can_cover_narrow_new_scan(self):
  start,end=stamp('2026-10-16T16:00:00+08:00'),stamp('2026-10-17T16:00:00+08:00')
  scan={'windowStart':'2026-10-16T00:00:00+08:00','windowEnd':'2026-10-18T18:00:00+08:00','observedAt':'2026-10-18T18:01:00+08:00','windowComplete':True,'boundaryReachedBeforeWindow':True,'topicPages':4}
  library={'generatedAt':'2026-10-19T16:36:00+08:00','attachmentScan':{**scan,'windowStart':'2026-10-17T00:00:00+08:00'}}
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);folder=root/'data/daily/resources';folder.mkdir(parents=True)
   (folder/'2026-10-17.json').write_text(json.dumps({'attachmentCatalog':{'scan':scan}}))
   with patch.object(resources,'ROOT',root):
    covered=resources.catalog_for_window(library,start,end)
    self.assertEqual(covered['coverageStatus'],'complete')
    self.assertEqual(covered['generatedAt'],library['generatedAt'])
    self.assertEqual(resources.catalog_for_window(library,start,stamp('2026-10-19T18:00:00+08:00'))['coverageStatus'],'pending')
