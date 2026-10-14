import importlib.util
import unittest
from datetime import date
from pathlib import Path

repo = Path(__file__).resolve().parents[1] if Path(__file__).parent.name == "tests" else Path(__file__).resolve().parent
module_path = repo / "update" / "macro_due.py" if (repo / "update" / "macro_due.py").exists() else Path(__file__).with_name("macro_due.py")
spec = importlib.util.spec_from_file_location("macro_due", module_path)
due = importlib.util.module_from_spec(spec)
spec.loader.exec_module(due)


class DueWindowTests(unittest.TestCase):
    def setUp(self):
        self.registry = {"series": [
            {"id": "cn-cpi", "publisher": "国家统计局", "frequency": "monthly"},
            {"id": "cn-pmi", "publisher": "国家统计局", "frequency": "monthly"},
            {"id": "consumer-cpi", "publisher": "国家统计局", "frequency": "monthly"},
            {"id": "us-retail", "publisher": "美国人口普查局", "frequency": "monthly"},
            {"id": "us-treasury10", "publisher": "美联储", "frequency": "daily"},
        ]}

    def test_daily_market_does_not_pull_monthly_series(self):
        plan = due.build_plan(date(2026, 10, 8), self.registry)
        self.assertEqual(plan["dueChoice"], ["us-treasury10"])

    def test_official_cpi_window_is_after_release(self):
        self.assertNotIn("cn-cpi", due.build_plan(date(2026, 10, 14), self.registry)["dueChoice"])
        plan = due.build_plan(date(2026, 10, 16), self.registry)
        self.assertIn("cn-cpi", plan["dueChoice"])
        self.assertIn("consumer-cpi", plan["dueChoice"])

    def test_pmi_uses_its_own_window(self):
        self.assertIn("cn-pmi", due.build_plan(date(2026, 10, 1), self.registry)["dueChoice"])
        self.assertNotIn("cn-pmi", due.build_plan(date(2026, 10, 16), self.registry)["dueChoice"])

    def test_missing_february_nbs_activity_release_is_not_guessed(self):
        self.assertNotIn("cn-cpi", due.build_plan(date(2026, 2, 18), self.registry)["dueChoice"])

    def test_bls_events_follow_beijing_next_day_and_suppress_retry(self):
        self.assertNotIn("bls-cpi", due.build_plan(date(2026, 10, 14), self.registry)["dueOfficial"])
        self.assertIn("bls-cpi", due.build_plan(date(2026, 10, 15), self.registry)["dueOfficial"])
        ledger = {"official": {"bls-cpi": "2026-10-15"}}
        self.assertNotIn("bls-cpi", due.build_plan(date(2026, 10, 16), self.registry, ledger)["dueOfficial"])

    def test_cross_month_retry_keeps_the_same_release_key(self):
        self.assertEqual(due.window_key(date(2027, 3, 31), "us_pce"), due.window_key(date(2027, 4, 1), "us_pce"))

    def test_census_housing_waits_for_the_publication_day(self):
        self.assertNotIn("census-housing", due.build_plan(date(2026, 10, 20), self.registry)["dueOfficial"])
        self.assertIn("census-housing", due.build_plan(date(2026, 10, 21), self.registry)["dueOfficial"])

    def test_federal_reserve_industrial_production_uses_g17_release_dates(self):
        registry = {"series": [{"id": "us-industrial-production", "publisher": "美联储", "frequency": "monthly"}]}
        self.assertEqual(due.build_plan(date(2026, 10, 16), registry)["dueChoice"], [])
        self.assertEqual(due.build_plan(date(2026, 10, 17), registry)["dueChoice"], ["us-industrial-production"])

    def test_incremental_queries_keep_history_and_bound_response_size(self):
        monthly = {"start": "2016-01-01", "frequency": "monthly"}
        obs = [{"period": "2026-09"}]
        self.assertEqual(due.incremental_start(monthly, obs), "2024-09-01")
        self.assertEqual(due.incremental_start(monthly, obs, full_history=True), "2016-01-01")
        quarterly = {"start": "2016-01-01", "frequency": "quarterly"}
        self.assertEqual(due.incremental_start(quarterly, [{"period": "2026-Q3"}]), "2024-07-01")
        daily = {"start": "2016-01-01", "frequency": "daily"}
        self.assertEqual(due.incremental_start(daily, [{"period": "2026-10-14"}]), "2026-04-17")

    def test_successful_series_is_suppressed_for_the_window_only(self):
        ledger = {"choice": {"cn-cpi": "2026-10"}}
        self.assertNotIn("cn-cpi", due.build_plan(date(2026, 10, 16), self.registry, ledger)["dueChoice"])
        self.assertIn("cn-cpi", due.build_plan(date(2026, 11, 11), self.registry, ledger)["dueChoice"])


if __name__ == "__main__":
    unittest.main()

