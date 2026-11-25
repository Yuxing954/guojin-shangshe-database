import copy
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from update_sector_data import ROOT, build, choice_receipt, dates, parse_us, read, sync_overview, validate


class SectorDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build(cutoff='2026-10-10')

    def test_retained_histories_and_units(self):
        metrics = {m['id']: m for d in self.data.values() for m in d['metrics']}
        self.assertEqual(len(metrics['crossborder_scfi']['points']), 333)
        self.assertEqual(metrics['dining_revenue_ytd']['points'][-1]['value'], 37366)
        self.assertEqual(metrics['dining_revenue_ytd']['points'][-1]['quality'], 'official')
        self.assertEqual(metrics['dining_revenue']['points'][-1]['value'], 4544)
        self.assertEqual(metrics['dining_revenue_yoy']['points'][-1]['value'], 1.1)
        self.assertEqual(metrics['dining_above_yoy']['points'][-1]['value'], -.7)
        self.assertEqual(metrics['us_ecommerce_sa']['points'][-1]['value'], 3402.44)
        self.assertEqual(metrics['crossborder_trade']['points'][-1]['value'], 27500)
        self.assertNotIn('change', metrics['crossborder_trade']['points'][-1])

    def test_no_export_proxy_or_january_invention(self):
        metrics = {m['id']: m for d in self.data.values() for m in d['metrics']}
        self.assertEqual([p['period'] for p in metrics['crossborder_exports']['points']], ['2023', '2024'])
        self.assertFalse(any(p['period'].endswith('-01') for p in metrics['dining_revenue']['points']))
        feb = [p for p in metrics['dining_revenue']['points'] if p['period'].endswith('-02')]
        self.assertTrue(feb)
        self.assertTrue(all(p['basis'] == 'combined' for p in feb))

    def test_basis_dates(self):
        self.assertEqual(dates('2026-Q2', 'quarter')[:2], ('2026-04-01', '2026-06-30'))
        self.assertEqual(dates('2026-H1', 'half')[:2], ('2026-01-01', '2026-06-30'))
        self.assertEqual(dates('2026-08', 'ytd')[0], '2026-01-01')

    def test_strict_choice_scope_unit_and_frequency(self):
        def receipt(name, table='宏观数据（月）', value='4544亿', period='2026-08'):
            return {'content': [{'type': 'text', 'text': json.dumps({'data': [{'columns': [table, '数据来源', period], 'items': [[name, '国家统计局', value]], 'meta': {'jumpUrlList': [{'choiceUrl': 'https://choicew2z.eastmoney.com/dataDisplay/macroEDB/'}]}}]})}]}
        for name in ['跨境电子商务交易额(元)', '中国:进出口总额(美元)', '中国:CPI:食品:同比']:
            self.assertEqual(choice_receipt(receipt(name), '2026-10-10', '2026-10-10')['records'], [])
        monthly = choice_receipt(receipt('中国:社会消费品零售总额:餐饮收入(元)'), '2026-10-10', '2026-10-10')['records'][0]
        self.assertEqual(monthly['value'], 4544)
        self.assertEqual(monthly['basis'], 'monthly')
        cumulative = choice_receipt(receipt('中国:社会消费品零售总额:餐饮收入:累计值(元)'), '2026-10-10', '2026-10-10')['records'][0]
        self.assertEqual(cumulative['metricId'], 'dining_revenue_ytd')
        with self.assertRaises(ValueError):
            choice_receipt(receipt('中国:社会消费品零售总额:餐饮收入(元)', period='2026-02'), '2026-10-10', '2026-10-10')
        with self.assertRaises(ValueError):
            choice_receipt(receipt('中国:社会消费品零售总额:餐饮收入(元)', period='2026-11'), '2026-10-10', '2026-10-10')

    def test_census_columns_and_revision(self):
        rows = parse_us('2nd quarter 2026(p)/1986488/340244/17.1/2.9/3.8/6.7/12.2', 'sa', 'test', '2026-10-10')
        self.assertEqual(rows[0]['value'], 3402.44)
        self.assertEqual(rows[0]['change'], 12.2)
        self.assertEqual(rows[0]['mom'], 3.8)
        self.assertEqual(rows[1]['value'], 17.1)
        self.assertEqual(rows[0]['status'], '初步')
        with self.assertRaises(ValueError):
            parse_us('2nd quarter 2026(p)/1986488/340244/17.1', 'sa', 'test', '2026-10-10')

    def test_validation_rejects_duplicate_and_incompatible_period(self):
        data = copy.deepcopy(self.data['overseas'])
        data['metrics'][0]['points'].append(copy.deepcopy(data['metrics'][0]['points'][0]))
        with self.assertRaises(ValueError):
            validate(data, '2026-10-10')
        data = copy.deepcopy(self.data['overseas'])
        data['metrics'][0]['points'][0]['period'] = '2023-09'
        with self.assertRaises(ValueError):
            validate(data, '2026-10-10')

    def test_company_denominators_and_currency(self):
        rows = self.data['dining']['companyObservations']
        atp = next(r for r in rows if r['companyId'] == 'dpc' and r['metricId'] == 'atp')
        spend = next(r for r in rows if r['companyId'] == 'haidilao' and r['metricId'] == 'spend_person')
        self.assertEqual((atp['unit'], spend['unit']), ('元/单', '元/人'))
        same = next(r for r in rows if r['companyId'] == 'haidilao' and r['metricId'] == 'same_sales_yoy')
        self.assertAlmostEqual(same['value'], (same['inputs'][0] / same['inputs'][1] - 1) * 100)
        superhi = next(r for r in rows if r['companyId'] == 'superhi' and r['metricId'] == 'revenue')
        self.assertEqual(superhi['unit'], '亿美元')
        self.assertEqual(superhi['basis'], 'quarter')

    def test_scoped_sync_preserves_unrelated_sectors(self):
        before = read(ROOT / 'data/industry/overview.json')
        after = sync_overview(before, self.data)
        for a,b in zip(before['sectors'],after['sectors']):
            if a['id'] in ('hotel','dutyfree','gold'):
                self.assertEqual(a['metrics'],b['metrics'])
        self.assertEqual(before['revisions'],after['revisions'])

    def test_rebuild_is_idempotent(self):
        for sid, payload in self.data.items():
            self.assertEqual(payload, read(ROOT / f'data/sectors/{sid}.json'))

    def test_partial_company_batch_keeps_prior_periods(self):
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shutil.copytree(ROOT/'data', root/'data', ignore=shutil.ignore_patterns('*.csv','research','macro','gold-jewelry'))
            path = root/'data/sectors/reviewed.json'
            seed = read(path)
            seed['companyObservations'] = []
            path.write_text(json.dumps(seed, ensure_ascii=False), encoding='utf-8')
            result = build(root, '2026-10-10')
            for sid in ('dining','overseas'):
                self.assertEqual(result[sid]['companyObservations'], self.data[sid]['companyObservations'])

    def test_failed_update_keeps_all_histories(self):
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            shutil.copytree(ROOT/'data',root/'data',ignore=shutil.ignore_patterns('*.csv','research','macro','gold-jewelry'))
            files=list((root/'data/sectors').glob('*.json'))+[root/'data/industry/overview.json']
            hashes={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.name!='update-status.json'}
            proc=subprocess.run([sys.executable,str(ROOT/'scripts/update_sector_data.py'),'--root',str(root),'--cutoff','2020-01-01'],capture_output=True)
            self.assertNotEqual(proc.returncode,0)
            self.assertTrue(all(hashlib.sha256(p.read_bytes()).hexdigest()==h for p,h in hashes.items()))
            self.assertTrue(read(root/'data/sectors/update-status.json')['historicalDataRetained'])


if __name__ == '__main__':
    unittest.main()
