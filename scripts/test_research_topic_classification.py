import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "update"))
from segment_filter import classify, is_food_beverage_focus


class FoodBeverageRoutingTests(unittest.TestCase):
    def test_food_and_beverage_topics_stay_out_of_commercial_views(self):
        titles = [
            "CT食饮周观点：双节反馈符合预期",
            "惠泉啤酒改革梳理及投资观点",
            "紫江企业：穿越周期的饮料包装龙头",
            "食品饮料行业Q3跟踪",
            "安井食品业绩点评",
            "【国泰海通食饮】伊利半年报业绩会精要",
            "[中金食品]零食板块更新",
            "2026食饮中期策略：零售变革方兴未艾",
            "【天味食品】业绩点评：收入稳步增长",
            "【中炬高新】情况更新：改革深水区，经营拐点将至",
            "[礼物]【国信食饮|求支持】H&H调研反馈：增长强劲，指引积极",
            "【国泰海通食饮】周报第28期：底部价值凸显",
            "【华创食饮】鲟龙科技2026H1交流要点",
            "千味央厨 | 2026H1业绩说明会要点",
        ]
        for title in titles:
            with self.subTest(title=title):
                self.assertTrue(is_food_beverage_focus(title))

    def test_restaurant_and_retail_topics_remain_eligible(self):
        titles = [
            "9月及国庆餐饮上市公司更新",
            "现制茶饮行业周报",
            "零食量贩：基本面强势，关注门店扩张",
            "商超渠道调研更新",
            "【华创食饮|深度】鸣鸣很忙：效率领先，行稳致远",
            "【国金食饮】万辰集团：单店改善超预期",
            "【中金社服&食饮】茶饮行业系列报告一：一杯奶茶，万店江湖",
            "【中泰食饮】锅圈深度：重构餐饮零售效率",
            "[太阳]【天风食饮】继续推荐古茗",
            "[太阳]【东财食饮&农业】周观点更新及研究回顾",
            "【华西食品&新消费】巨子生物更新",
            "零售变革草根调研：新鲜零食新机遇",
            "20260306当前位置持续重点推荐万辰集团&卫龙美味",
        ]
        for title in titles:
            with self.subTest(title=title):
                self.assertFalse(is_food_beverage_focus(title))

    def test_event_announcement_is_not_market_view(self):
        title = "【2026金融街论坛年会将于10月19日在京开幕 年会期间将集中发布系列金融改革发展政策】"
        body = "财联社10月12日电，2026金融街论坛年会新闻发布会在京举行。据介绍，年会将于10月19日在京开幕。"
        accepted, reason = classify(title, body)
        self.assertFalse(accepted)
        self.assertEqual(reason, "活动通知/预告")


if __name__ == "__main__":
    unittest.main()
