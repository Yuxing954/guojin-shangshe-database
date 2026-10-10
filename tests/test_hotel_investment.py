import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('hotel_investment', ROOT / 'scripts/import_hotel_investment.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def receipt(periods=None, values=None):
    periods = periods or ['2026-08', '2026-07']
    values = values or ['-15.1', '-13.9']
    return {'data': [{'columns': ['宏观数据（月）', '数据来源'] + periods,
                     'items': [[module.NAME, '国家统计局'] + values],
                     'meta': {'jumpUrlList': [{'choiceUrl': 'https://choicew2z.eastmoney.com/dataDisplay/macroEDB/#/index?macroids=EMM01013000'}]}}]}

class InvestmentTests(unittest.TestCase):
    def setUp(self):
        self.existing = json.loads((ROOT / 'data/hotel-investment-monthly.json').read_text(encoding='utf-8'))
        self.by_period = {row['period_id']: row for row in self.existing['observations']}

    def test_short_receipt_preserves_history_amount_and_check_only_does_not_change(self):
        rows = module.receipt_rows(receipt(values=[str(self.by_period[p]['yoy_pct']) for p in ['2026-08','2026-07']]), '2026-10-10')
        result = module.merge(self.existing, rows, '2026-10-11')
        self.assertEqual(result, self.existing)
        self.assertEqual(len(result['observations']), len(self.existing['observations']))
        self.assertEqual(next(r for r in result['observations'] if r['period_id'] == '2017-12')['amount_cny_100m'], 6107)

    def test_revision_is_accepted_without_fabricating_amounts(self):
        revised = self.by_period['2026-08']['yoy_pct'] + .1
        rows = module.receipt_rows(receipt(values=[str(revised), str(self.by_period['2026-07']['yoy_pct'])]), '2026-10-10')
        result = module.merge(self.existing, rows, '2026-10-11')
        self.assertEqual(next(r for r in result['observations'] if r['period_id']=='2026-08')['yoy_pct'], revised)
        self.assertIsNone(next(r for r in result['observations'] if r['period_id']=='2026-08')['amount_cny_100m'])
        self.assertEqual(result['retrieved_date'], '2026-10-11')

    def test_wrong_indicator_frequency_code_or_source_rejected(self):
        for kind in ['name', 'frequency', 'code', 'source']:
            value = receipt()
            table = value['data'][0]
            if kind == 'name': table['items'][0][0] = '中国:GDP:住宿和餐饮业:累计值(元)'
            if kind == 'frequency': table['columns'][0] = '宏观数据（年）'
            if kind == 'code': table['meta']['jumpUrlList'][0]['choiceUrl'] += ',EMM02622261'
            if kind == 'source': table['items'][0][1] = '其他机构'
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                module.receipt_rows(value, '2026-10-10')

    def test_duplicate_january_future_or_invalid_value_rejected(self):
        for periods, values in [(['2026-08','2026-08'],['1','1']), (['2026-01'],['1']),
                                (['2026-11'],['1']), (['2026-08'],['NaN']), (['2026-08'],['-101'])]:
            with self.subTest(periods=periods, values=values), self.assertRaises(ValueError):
                module.receipt_rows(receipt(periods, values), '2026-10-10')

    def test_null_and_zero_are_distinct(self):
        rows = module.receipt_rows(receipt(values=['0','-']), '2026-10-10')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['yoy_pct'], 0)
        self.assertIsNone(rows[0]['amount_cny_100m'])

    def test_failure_does_not_mutate_existing(self):
        existing = copy.deepcopy(self.existing)
        wrong = receipt()
        wrong['data'][0]['items'][0][0] = 'GDP'
        with self.assertRaises(ValueError):
            module.merge(existing, module.receipt_rows(wrong,'2026-10-10'),'2026-10-10')
        self.assertEqual(existing, self.existing)

if __name__ == '__main__':
    unittest.main()
