import unittest
from research_sources import merge_rows, building_material_view
class Regression(unittest.TestCase):
 def test_same_minute(self):
  a={'时间':'2026-11-08 23:18','原始发布时间':'2026-11-08T23:18:39+0800','标题':'same','内容':'a','原文链接':'/topic/1'}
  b={**a,'原始发布时间':'2026-11-08T23:18:56+0800','内容':'b','原文链接':'/topic/2'}
  self.assertEqual(len(merge_rows([a],[b])),2)
 def test_scope(self):
  self.assertTrue(building_material_view({'标题':'消费建材周观点'}))
  self.assertFalse(building_material_view({'标题':'酒店经营更新'}))
if __name__=='__main__': unittest.main()
