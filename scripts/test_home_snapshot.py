import datetime as dt
import unittest
from urllib.parse import urlparse
from build_home_snapshot import build, numeric, rate, research_items, ROOT, TZ


class HomeSnapshotTests(unittest.TestCase):
    def test_missing_values_are_not_zero(self):
        self.assertIsNone(numeric(""))
        self.assertIsNone(numeric("NaN"))
        self.assertEqual(numeric("0"), 0)
        self.assertEqual(rate(0, 10), -100)
        self.assertIsNone(rate(10, 0))

    def test_research_dedup_and_safe_links(self):
        payload = {"dbs": [{"id": "views", "rows": [
            {"标题": "酒店观点", "时间": "2026-09-10T12:00:00", "原文链接": "javascript:bad()"},
            {"标题": "酒店观点", "时间": "2026-09-10T12:00:00"},
            {"标题": "免税观点", "时间": "2026-09-12T12:00:00", "原文链接": "https://example.com/view"},
            {"标题": "芯片观点", "时间": "2026-09-13T12:00:00"},
        ]}]}
        result = research_items(payload)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["title"], "免税观点")
        self.assertEqual(result[1]["href"], "research.html")

    def test_actual_snapshot_dates_and_sources(self):
        payload = build(ROOT, dt.datetime(2099, 10, 7, 12, tzinfo=TZ), industry_only=True)
        self.assertEqual(len(payload["focus"]), 3)
        self.assertEqual(len(payload["industries"]), 5)
        self.assertLessEqual(len(payload["research"]), 5)
        hotel = payload["industries"][0]
        self.assertIsNotNone(hotel["value"])
        self.assertRegex(hotel["asOf"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertEqual(payload["researchAsOf"], max((item["date"] for item in payload["research"]), default=None))
        self.assertNotEqual(payload["researchAsOf"], payload["generatedAt"][:10])
        for item in payload["industries"]:
            source = item["sourceFile"]
            if source.startswith('https://'):
                self.assertIn(urlparse(source).hostname, ('www.stats.gov.cn', 'www.sge.com.cn', 'www.cngold.org.cn', 'choicew2z.eastmoney.com', 'www.ccpitzj.gov.cn'))
            else:
                self.assertTrue((ROOT / source.split('#')[0]).is_file())
            self.assertTrue((ROOT / item["href"].split("#")[0]).is_file())
        crossborder = next(item for item in payload['industries'] if item['id'] == 'overseas')
        self.assertEqual(crossborder['value'], 21500)
        self.assertEqual(crossborder['asOf'], '2024-12-31')
        self.assertEqual(crossborder['href'], 'overseas.html')

    def test_home_keeps_latest_classified_research(self):
        payload={"dbs":[{"id":"views","rows":[
            {"标题":"县域文旅表现","时间":"2026-10-07T12:13:56","更新批次":"data/research/updates/views.csv"},
            {"标题":"东方甄选月度更新","时间":"2026-10-07T11:48:02","更新批次":"data/research/updates/views.csv"},
            {"标题":"酒店观点","时间":"2026-10-05T10:00:00"},
        ]},{"id":"minutes","rows":[{"标题":"开市客音频","日期":"2026-09-28","类型":"会议音频"}]}]}
        result=research_items(payload)
        self.assertEqual(result[0]['date'],'2026-10-07')
        self.assertEqual(result[1]['title'],'东方甄选月度更新')
        self.assertEqual(result[-1]['label'],'会议音频')


if __name__ == "__main__":
    unittest.main()
