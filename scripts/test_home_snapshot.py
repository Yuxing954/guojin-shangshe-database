import datetime as dt
import unittest
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
        payload = build(ROOT, dt.datetime(2099, 10, 7, 12, tzinfo=TZ))
        self.assertEqual(len(payload["focus"]), 3)
        self.assertEqual(len(payload["industries"]), 4)
        self.assertLessEqual(len(payload["research"]), 5)
        hotel = payload["industries"][0]
        self.assertIsNotNone(hotel["value"])
        self.assertRegex(hotel["asOf"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertEqual(payload["researchAsOf"], max((item["date"] for item in payload["research"]), default=None))
        self.assertNotEqual(payload["researchAsOf"], payload["generatedAt"][:10])
        for item in payload["industries"]:
            self.assertTrue((ROOT / item["sourceFile"]).is_file())
            self.assertTrue((ROOT / item["href"].split("#")[0]).is_file())


if __name__ == "__main__":
    unittest.main()
