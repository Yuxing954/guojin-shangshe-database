import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from daily_scope import sector_for,is_ecommerce_topic

class ChannelUpdates(unittest.TestCase):
 def test_named_consumer_brands(self):
  self.assertEqual(sector_for('欧莱雅26Q3业绩'),'零售与消费出海')
  self.assertEqual(sector_for('特步26Q3运营数据电话会'),'零售与消费出海')
  self.assertEqual(sector_for('六福集团20261023.pdf'),'黄金珠宝')
 def test_social_retail(self):
  self.assertEqual(sector_for('【国金商社】9月社零：总量边际回暖，结构分化'),'零售与消费出海')
 def test_beauty_channel_not_platform(self):
  title='【国海商社】美护双11抖音&天猫数据跟踪261018'
  self.assertFalse(is_ecommerce_topic(title))
  self.assertEqual(sector_for(title),'零售与消费出海')
  self.assertIsNone(sector_for('【商社】天猫平台电商投资观点'))
 def test_brand_and_generic_beauty_tracker(self):
  self.assertEqual(sector_for('周观点：双11大促揭幕，珀莱雅销售更新'),'零售与消费出海')
  self.assertEqual(sector_for('双11大促跟踪：首日预售偏弱','珀莱雅 毛戈平 玉泽 佰草集'),'零售与消费出海')
  self.assertIsNone(sector_for('双11大促跟踪：平台经营','阿里巴巴 京东 拼多多'))
 def test_airline_not_manufacturing(self):
  self.assertEqual(sector_for('9月各航司供需持续恢复'),'酒店旅游')
  self.assertIsNone(sector_for('航空发动机经营数据'))

class SnackRetailScopeTests(unittest.TestCase):
    def test_snack_retail_is_not_food_manufacturing(self):
        self.assertEqual(sector_for('万辰集团跌超7%20261019', '量贩龙头同店和新店爬坡'), '零售与消费出海')
        self.assertIsNone(sector_for('保龄宝代糖需求更新', '餐饮客户订单增长'))

if __name__=='__main__':unittest.main()


