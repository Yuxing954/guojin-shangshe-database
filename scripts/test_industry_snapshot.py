import copy
import csv
import json
import unittest
from datetime import date

from build_industry_snapshot import ROOT, build, period_info
from import_miaoxiang_industry import normalize_reply, numeric


class IndustrySnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build()
        cls.metrics = {m['id']: m for s in cls.data['sectors'] for m in s['metrics']}

    def test_hotel_occupancy_changes_in_percentage_points(self):
        metric = self.metrics['hotel_occ']
        historical = next(p for p in metric['points'] if p['period'] == '2026-09-06')
        self.assertAlmostEqual(historical['value'], 55.61)
        self.assertAlmostEqual(historical['change'], 2.62)
        self.assertEqual(metric['changeUnit'], '百分点')

    def test_hotel_latest_matches_current_national_source(self):
        with (ROOT / 'data/hotel_industry_weekly.csv').open(encoding='utf-8-sig', newline='') as handle:
            rows = [r for r in csv.DictReader(handle) if r['region'] == '全国' and r['segment'] == '全部']
        latest = max(rows, key=lambda r: r['end_date'])
        self.assertGreaterEqual(latest['end_date'], '2026-10-04')
        prior = next(r for r in rows if int(r['year']) == int(latest['year']) - 1 and r['week'] == latest['week'])
        for metric_id, field in [('hotel_occ', 'occupancy_rate'), ('hotel_adr', 'adr'), ('hotel_revpar', 'revpar')]:
            point = self.metrics[metric_id]['points'][-1]
            value, old = float(latest[field]), float(prior[field])
            occupancy = metric_id == 'hotel_occ'
            self.assertEqual(point['period'], latest['end_date'])
            self.assertAlmostEqual(point['value'], value * 100 if occupancy else value)
            self.assertAlmostEqual(point['change'], (value - old) * 100 if occupancy else (value / old - 1) * 100)
        self.assertIn(latest['end_date'], self.data['sectors'][0]['note'])

    def test_dutyfree_spend_uses_matching_release_and_units(self):
        value = self.metrics['dutyfree_spend']['points'][-1]
        self.assertAlmostEqual(value['value'], 21.45 / 37.24 * 10000)
        self.assertEqual(value['quality'], 'derived')
        self.assertEqual(len(value['inputs']), 2)
        # The old sales growth is not attached to a different provider's amount.
        self.assertNotIn('change', self.metrics['dutyfree_sales']['points'][-1])

    def test_monthly_and_cumulative_rates_are_not_interchanged(self):
        self.assertEqual(self.metrics['dining_revenue_yoy']['points'][-1]['value'], 1.1)
        self.assertEqual(self.metrics['dining_revenue']['points'][-1]['value'], 4544)
        self.assertEqual(self.metrics['dining_above_yoy']['points'][-1]['value'], -0.7)

    def test_january_is_missing_and_february_is_a_combined_period(self):
        points = self.metrics['dining_revenue']['points']
        self.assertFalse(any(p['period'] == '2026-01' for p in points))
        february = next(p for p in points if p['period'] == '2026-02')
        self.assertEqual(february['startDate'], '2026-01-01')
        self.assertEqual(february['periodLabel'], '2026年1—2月')
        self.assertEqual(february['basis'], 'combined')

    def test_primary_disclosures_preserve_their_precision(self):
        self.assertEqual(self.metrics['gold_price']['points'][-1]['value'], 907.32)
        self.assertEqual(self.metrics['gold_retail']['points'][-1]['value'], 247)
        self.assertEqual(self.metrics['gold_jewelry_volume']['points'][-1]['value'], 132.133)
        self.assertTrue(any(r['metricId'] == 'gold_price' and r['period'] == '2026-09-30' and r['previousValue'] == 907.3 for r in self.data['revisions']))

    def test_crossborder_subset_does_not_fill_all_industry_exports(self):
        self.assertEqual(self.metrics['crossborder_exports']['points'], [])
        self.assertTrue(self.metrics['crossborder_b2b_subset']['subset'])
        self.assertEqual(self.metrics['crossborder_b2b_cumulative_yoy']['points'][-1]['periodLabel'], '2026年1—8月累计')

    def test_sources_periods_and_unique_keys(self):
        sources = {s['id'] for s in self.data['sources']}
        self.assertEqual(len(self.data['sectors']), 5)
        for metric in self.metrics.values():
            keys = [p['period'] for p in metric['points']]
            self.assertEqual(len(keys), len(set(keys)))
            for point in metric['points']:
                self.assertIn(point['sourceId'], sources)
                self.assertLessEqual(date.fromisoformat(point['startDate']), date.fromisoformat(point['endDate']))
                self.assertLessEqual(point['endDate'], '2026-10-07')

    def test_provider_units_and_missing_are_strict(self):
        self.assertEqual(numeric('1.108万亿'), 1108000000000)
        self.assertEqual(numeric('37.24万'), 372400)
        self.assertIsNone(numeric('-'))
        with self.assertRaises(ValueError):
            numeric('约100')

    def test_importer_rejects_cumulative_income_for_monthly_series(self):
        rows = [['中国:社会消费品零售总额:餐饮收入(元)', '国家统计局', '4544亿'], ['中国:社会消费品零售总额:餐饮收入:累计值(元)', '国家统计局', '3.737万亿']]
        reply = {'id': 'dining', 'query': 'test', 'retrieved_at': '2026-10-07', 'result': {'content': [{'type': 'text', 'text': json.dumps({'data': [{'columns': ['宏观数据（月）', '数据来源', '2026-08'], 'items': rows}]})}]}}
        records, _ = normalize_reply(reply)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['value'], 4544)


if __name__ == '__main__':
    unittest.main()
