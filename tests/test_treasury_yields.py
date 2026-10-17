import json,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'update'))
import treasury_yields as T

def xml(values):
    return ('<feed xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices">'+''.join('<entry><m:properties><d:NEW_DATE>'+day+'T00:00:00</d:NEW_DATE><d:BC_10YEAR>'+value+'</d:BC_10YEAR></m:properties></entry>' for day,value in values)+'</feed>').encode()

class TreasuryTests(unittest.TestCase):
    def test_exact_public_series_zero_missing_future_and_identity(self):
        rows=T.fred_rows(b'observation_date,DGS10\n2026-10-14,0\n2026-10-15,.\n2026-10-19,4.2\n','2016-01-01','2026-10-17')
        self.assertEqual(rows['2026-10-14']['value'],0);self.assertNotIn('2026-10-15',rows);self.assertNotIn('2026-10-19',rows)
        with self.assertRaises(ValueError):T.fred_rows(b'observation_date,DGS2\n2026-10-14,1\n','2016-01-01','2026-10-17')
        raw=xml([('2026-10-14','5.19'),('2026-10-15',''),('2026-10-16','5.09')])
        rows=T.treasury_rows(raw,'2016-01-01','2026-10-17',2026)
        self.assertEqual(rows['2026-10-16']['value'],5.09);self.assertNotIn('2026-10-15',rows)
        for invalid in [raw.replace(b'BC_10YEAR',b'BC_2YEAR'),xml([('2025-10-16','5.09')]),xml([('2026-10-16','99')])]:
            with self.assertRaises(ValueError):T.treasury_rows(invalid,'2016-01-01','2026-10-17',2026)
    def test_conflicts_do_not_replace_or_truncate_choice_history(self):
        old={'registryId':'us-treasury10','observations':[{'period':'2026-10-15','value':5.1}]}
        a={'2026-10-15':{'period':'2026-10-15','value':5.1,'releaseDate':None}}
        result=T.assemble(old,a,a,[],'2016-01-01','2026-10-17')
        self.assertEqual(result['sourceMigration']['matchedObservations'],1)
        self.assertEqual(old['observations'][0]['value'],5.1)
        with self.assertRaisesRegex(ValueError,'overlap conflict'):T.assemble(old,a,{'2026-10-15':{'period':'2026-10-15','value':5.11}},[],'2016-01-01','2026-10-17')
        with self.assertRaisesRegex(ValueError,'migration conflict'):T.assemble(old,{}, {'2026-10-15':{'period':'2026-10-15','value':5.11}},[],'2016-01-01','2026-10-17')
        with self.assertRaisesRegex(ValueError,'migration incomplete'):T.assemble(old,{}, {'2026-10-16':{'period':'2026-10-16','value':5.09}},[],'2016-01-01','2026-10-17')
    def test_incremental_public_source_does_not_fetch_fred_or_credentials_again(self):
        old={'registryId':T.REGISTRY_ID,'observations':[{'period':'2016-01-04','value':2.24},{'period':'2025-12-31','value':4.2}]}
        with patch.object(T,'fetch_bytes',return_value=xml([('2026-10-16','5.09')])) as get:
            result=T.refresh('2026-10-17',old)
        self.assertEqual(get.call_count,1);self.assertIn('home.treasury.gov',get.call_args.args[0])
        self.assertEqual([r['period'] for r in result['observations']],['2016-01-04','2025-12-31','2026-10-16'])
        self.assertIsNone(result['observations'][-1]['releaseDate'])
        self.assertEqual(len(result['sourceReceipts'][0]['receiptSha256']),64)
    def test_public_source_transport_failure_does_not_touch_history(self):
        old={'registryId':T.REGISTRY_ID,'observations':[{'period':'2016-01-04','value':2.24}]};before=json.dumps(old)
        with patch.object(T,'fetch_bytes',side_effect=TimeoutError):
            with self.assertRaises(TimeoutError):T.refresh('2026-10-17',old)
        self.assertEqual(json.dumps(old),before)

if __name__=='__main__':unittest.main()
