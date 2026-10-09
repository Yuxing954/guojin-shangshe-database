"""Protect public updates against replay and older-workbook refreshes."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from supplement_dutyfree_holidays import apply_updates


class SupplementsTest(unittest.TestCase):
    def test_replay_and_workbook_refresh(self):
        current = json.loads((ROOT / "data/dutyfree/holidays.json").read_text())
        self.assertEqual(apply_updates(copy.deepcopy(current)), current)
        older = copy.deepcopy(current)
        updates = json.loads((ROOT / "data/dutyfree/public-supplements.json").read_text())["records"]
        new_ids = {f'{r["year"]}-{r["holiday"]}-{r["kind"]}-public' for r in updates}
        older["records"] = [copy.deepcopy(r["workbook_baseline"] if "id" in r.get("workbook_baseline", {}) else r) for r in current["records"]
                            if r["id"] not in new_ids and not r["id"].endswith("-public-baseline")]
        restored = apply_updates(older)
        self.assertEqual(len(restored["records"]), len(current["records"]))
        for record in current["records"]:
            candidate = next(r for r in restored["records"] if r["id"] == record["id"])
            for key in ("sales", "shoppers", "period", "days", "daily_sales", "daily_yoy"):
                self.assertEqual(candidate[key], record[key], (record["id"], key))


if __name__ == "__main__":
    unittest.main()
