import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('macro_import', ROOT / 'scripts/import_consumption_macro.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
FOLDER = ROOT / 'data/consumption-macro'


class ConsumptionEvidenceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sources = json.loads((FOLDER / 'sources.json').read_text(encoding='utf8'))
        cls.evidence = json.loads((FOLDER / 'evidence.json').read_text(encoding='utf8'))
        cls.data = json.loads((FOLDER / 'observations.json').read_text(encoding='utf8'))

    def test_offline_rebuild_matches_shipped_data(self):
        self.assertEqual(module.compile_data(self.sources,self.evidence,self.data['checkedAt']),self.data)

    def test_empty_or_changed_official_table_fails(self):
        source = next(s for s in self.sources if s['id']=='retail-2026-08')
        bad=copy.deepcopy(self.evidence)
        bad[source['id']]['rows']=[]
        with self.assertRaisesRegex(ValueError,'checksum'):
            module.compile_data([source],bad,'2026-10-09')
        bad[source['id']]['sha256']=module.evidence_hash([],bad[source['id']]['paragraphs'])
        with self.assertRaisesRegex(ValueError,'incomplete'):
            module.compile_data([source],bad,'2026-10-09')

    def test_conflicting_mobile_table_duplicate_is_rejected(self):
        source = next(s for s in self.sources if s['id']=='retail-2026-08')
        bad=copy.deepcopy(self.evidence)
        record=next(r for r in bad[source['id']]['rows'] if r[0]=='社会消费品零售总额')
        bad[source['id']]['rows'].append([record[0],'99999',*record[2:]])
        e=bad[source['id']]
        e['sha256']=module.evidence_hash(e['rows'],e['paragraphs'])
        with self.assertRaisesRegex(ValueError,'conflicting'):
            module.compile_data([source],bad,'2026-10-09')

    def test_observations_match_source_cells(self):
        source = next(s for s in self.sources if s['id']=='retail-2026-08')
        rows=self.evidence[source['id']]['rows']
        raw=next(r for r in rows if r[0]=='社会消费品零售总额')
        monthly=next(r for r in self.data['observations'] if r['sourceId']==source['id'] and r['indicatorId']=='retail' and r['basis']=='month')
        cumulative=next(r for r in self.data['observations'] if r['sourceId']==source['id'] and r['indicatorId']=='retail' and r['basis']=='ytd')
        self.assertEqual([monthly['value'],monthly['yoy'],cumulative['value'],cumulative['yoy']],list(map(module.number,raw[1:])))

    def test_missing_values_and_january_table_layout(self):
        self.assertIsNone(module.number('-'))
        self.assertEqual(module.number('0.0'),0)
        with self.assertRaises(ValueError):module.number('未披露')
        self.assertTrue(any(r['period']=='2025-01' and r['indicatorId']=='cpi' for r in self.data['observations']))

    def test_parser_retains_cells_not_redrawn_text(self):
        p=module.ReleaseParser()
        p.feed('<table><tr><td>社会消费品零售总额</td><td><span>39824</span></td><td>0.4</td></tr></table><p>同比采用可比口径</p>')
        self.assertEqual(p.rows,[['社会消费品零售总额','39824','0.4']])
        self.assertEqual(p.paragraphs,['同比采用可比口径'])

    def test_annual_and_quarterly_income_do_not_invent_single_quarters(self):
        rows=[r for r in self.data['observations'] if r['indicatorId']=='income_national']
        self.assertTrue(all(r['basis'] in ('ytd','year') for r in rows))
        self.assertTrue(any(r['period']=='2024' and r['basis']=='year' for r in rows))


if __name__=='__main__':unittest.main()
