import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from daily_scope import sector_for
class ScopeTests(unittest.TestCase):
 def test_excludes_unrelated(self):
  for title in ['食饮周观点：白酒动销改善','惠泰医疗业绩预期','GPU电源研究','国海轻工周观点','白酒渠道反馈：商超动销']:
   self.assertIsNone(sector_for(title,'酒店消费门店'))
 def test_keeps_relevant_despite_broker_label(self):
  self.assertEqual(sector_for('【浙商食饮】餐饮与茶饮更新'),'餐饮茶饮')
  self.assertEqual(sector_for('【国海传媒】泡泡玛特周度跟踪'),'零售与消费出海')
 def test_excludes_ecommerce_but_keeps_retail_channels(self):
  for title in ['阿里巴巴业绩更新','京东零售利润修复','跨境电商周观点','安克创新经营更新','零售电商行业观点','【银河社服】东方甄选今日上涨情况更新']:
   self.assertIsNone(sector_for(title))
  self.assertEqual(sector_for('泡泡玛特电商渠道增长'),'零售与消费出海')
  self.assertEqual(sector_for('名创优品美国经营更新'),'零售与消费出海')
 def test_incidental_mention_is_not_sector(self):
  self.assertIsNone(sector_for('科技周报','酒店客户使用新款GPU'))

 def test_consumer_research_coverage_and_platform_boundary(self):
  for title in ['复盘乐高成长史（布鲁可同行比较）','LVMH三季报解读','双11化妆品品牌动销前瞻']:
   self.assertEqual(sector_for(title),'零售与消费出海')
  self.assertEqual(sector_for('冰雪大世界官宣扩容'),'酒店旅游')
  self.assertIsNone(sector_for('【中信社服&新零售】美团观点更新'))
  self.assertIsNone(sector_for('住房贷款贴息政策落地-存量房链消费建材'))

 def test_air_travel_supply_not_aerospace_manufacturing(self):
  self.assertEqual(sector_for('2026年冬航季时刻计划详解'),'酒店旅游')
  self.assertIsNone(sector_for('【招商航空航天及国防】商用发动机深度'))
