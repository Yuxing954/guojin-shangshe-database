"""Public database invariants; source-cell reconciliation runs locally before publication."""
from pathlib import Path
import json,collections,unittest,math
ROOT=Path(__file__).resolve().parents[1]
def company_rows(path):
 index=json.loads(path.read_text(encoding='utf-8'));return [o for part in index['parts'] for o in json.loads((ROOT/part).read_text(encoding='utf-8'))['observations']]
class CompanyDataTests(unittest.TestCase):
 def test_identity_sources_and_series(self):
  d=ROOT/'data/companies';cat=json.loads((d/'catalog.json').read_text(encoding='utf-8'))
  sources={s['id']:s for s in json.loads((d/'sources.json').read_text(encoding='utf-8'))['sources']};ids=set();keys=set()
  self.assertEqual(len(cat['companies']),5)
  for c in cat['companies']:
   if not c['file']:
    self.assertEqual(c['count'],0);continue
   rows=company_rows(ROOT/c['file']);self.assertEqual(len(rows),c['count'])
   for o in rows:
    self.assertNotIn(o['id'],ids);ids.add(o['id']);self.assertIn(o['sourceId'],sources);self.assertTrue(o['locator']);self.assertTrue(math.isfinite(o['value']))
    key=tuple(o[k] for k in ['companyId','period','metric','scope','mode','region','basis','unit','currency','periodBasis','status'])
    self.assertNotIn(key,keys);keys.add(key)
    if o['status']=='forecast':self.assertLessEqual(int(o['period'][:4]),2028)
    elif o['status']!='pending':self.assertLessEqual(int(o['period'][:4]),2026)
    if o['metric']=='occ':self.assertTrue(0<=o['value']<=100)
 def test_boundary_cases(self):
  def rows(cid):return company_rows(ROOT/f'data/companies/hotels/{cid}.json')
  a=rows('atour');self.assertFalse(any(o['locator']=='季度经营数据!K7' and o['metric'] in ['opened','closed'] for o in a))
  self.assertTrue(any(o['period']=='2026Q2' and o['metric']=='revenue' and o['value']==3490.347 for o in a))
  self.assertTrue(any(o['period']=='2025FY' and o['metric']=='occ' and abs(o['value']-75.9)<1e-8 and o['scope']=='全部' for o in a))
  self.assertFalse(any(o['locator'].startswith('季度经营数据!') and int(''.join(filter(str.isdigit,o['locator'])))>34 for o in a))
  b=rows('btg');self.assertFalse(any(o['period']=='2026Q2' and o['metric']=='revpar' and o['status']=='transcribed' for o in b))
  j=rows('jinjiang');self.assertTrue(any(o['currency']=='EUR' and o['metric']=='revenue' for o in j));self.assertTrue(any(o['metric']=='to_pipeline' and o['value']==126 for o in j))
if __name__=='__main__':unittest.main()
