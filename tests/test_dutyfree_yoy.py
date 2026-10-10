import copy
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from dutyfree_yoy import fill_yoy
def record(period, value, change=None):
    row = dict(period=period, value=value, sourceId="source-"+period, basis="monthly", metricId="dutyfree_sales", endDate=period+"-28")
    if change is not None: row["change"] = change
    return row
class GrowthTests(unittest.TestCase):
    def test_compatible_reported_growth_is_preserved(self):
        selected = {("dutyfree_sales","2025-08"):record("2025-08",20), ("dutyfree_sales","2026-08"):record("2026-08",25,0)}
        fill_yoy(selected)
        self.assertEqual(selected["dutyfree_sales","2026-08"]["change"],0)
    def test_derived_zero_negative_and_source_lineage(self):
        selected = {("dutyfree_sales","2025-08"):record("2025-08",20), ("dutyfree_sales","2026-08"):record("2026-08",0)}
        fill_yoy(selected)
        row=selected["dutyfree_sales","2026-08"]
        self.assertEqual(row["change"],-100)
        self.assertEqual(row["changeCalculation"]["priorPeriod"],"2025-08")
        self.assertEqual(row["changeCalculation"]["priorSourceId"],"source-2025-08")
        before=copy.deepcopy(selected);fill_yoy(selected);self.assertEqual(selected,before)
    def test_explicit_null_growth_is_computed(self):
        selected={("dutyfree_sales","2025-08"):record("2025-08",20), ("dutyfree_sales","2026-08"):record("2026-08",25)}
        selected["dutyfree_sales","2026-08"]["change"]=None
        fill_yoy(selected);self.assertEqual(selected["dutyfree_sales","2026-08"]["change"],25)
    def test_absent_zero_or_different_basis_is_not_computed(self):
        for prior in (None,0):
            selected={("dutyfree_sales","2026-08"):record("2026-08",25)}
            if prior is not None:selected["dutyfree_sales","2025-08"]=record("2025-08",prior)
            fill_yoy(selected);self.assertNotIn("change",selected["dutyfree_sales","2026-08"])
        selected={("dutyfree_sales","2025-08"):record("2025-08",20),("dutyfree_sales","2026-08"):record("2026-08",25)}
        selected["dutyfree_sales","2025-08"]["basis"]="cumulative"
        fill_yoy(selected);self.assertNotIn("change",selected["dutyfree_sales","2026-08"])
    def test_published_snapshot_has_exact_formula_and_only_missing_changes_filled(self):
        p=Path(__file__).resolve().parents[1]/"data/industry/overview.json"
        data=json.loads(p.read_text(encoding="utf-8"))
        sector=next(s for s in data["sectors"] if s["id"]=="dutyfree")
        count=0
        for metric in sector["metrics"]:
            for row in metric["points"]:
                if row.get("changeMethod")!="calculated":continue
                c=row["changeCalculation"];count+=1
                self.assertAlmostEqual(row["change"],(c["currentValue"]/c["priorValue"]-1)*100)
                self.assertEqual(c["priorPeriod"],str(int(row["period"][:4])-1)+row["period"][4:])
        self.assertGreater(count,0)
if __name__=="__main__":unittest.main()
