import importlib.util
import json
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('macro',Path(__file__).resolve().parents[1]/'update/gold_macro.py')
M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)

class GoldMacroNormalization(unittest.TestCase):
    def receipt(self, rows=None, dates=None):
        return {'content':[{'type':'text','text':json.dumps({'data':[{'columns':['指标','来源',*(dates or ['2026-10-09','2026-10-08','2026-10-07'])],'items':rows or [['美元指数','NYCE','102.5','102.123','-']]}]})}]}
    def test_cutoff_and_missing_do_not_become_observations(self):
        r=M.normalize(self.receipt(),'dxy','2026-10-08')
        self.assertEqual(r['observations'],[{'date':'2026-10-08','value':102.123}])
        self.assertEqual(r['quality'],'provider')
    def test_other_countries_and_lookalike_indicators_are_rejected(self):
        for rows in [[['广义贸易加权美元指数','NYCE','102','102','102']],[['美元指数','未知来源','102','102','102']]]:
            with self.assertRaises(ValueError):M.normalize(self.receipt(rows),'dxy','2026-10-08')
    def test_duplicate_indicator_or_conflicting_data_cannot_be_imported(self):
        r=['美元指数','NYCE','102','102','102']
        with self.assertRaises(ValueError):M.normalize(self.receipt([r,r]),'dxy','2026-10-08')
    def test_monthly_columns_and_unknown_numeric_units_are_rejected(self):
        with self.assertRaises(ValueError):M.normalize(self.receipt(dates=['2026-10','2026-09','2026-08']),'dxy','2026-10-08')
        with self.assertRaises(ValueError):M.normalize(self.receipt([['美元指数','NYCE','102','2.9万','102']]),'dxy','2026-10-08')
        with self.assertRaises(ValueError):M.normalize(self.receipt(dates=['2026-10-09','2026-02-30','2026-10-07']),'dxy','2026-10-08')
    def test_error_receipt_is_rejected(self):
        with self.assertRaises(ValueError):M.normalize({'isError':True},'dxy','2026-10-08')

if __name__=='__main__':unittest.main()
