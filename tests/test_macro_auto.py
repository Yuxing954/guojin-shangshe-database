import copy,json,sys,unittest,os,tempfile
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'update'))
import macro_auto as M
from test_macro_due import DueWindowTests

class AutomaticMacroTests(unittest.TestCase):
    def test_official_nonpublication_is_not_an_unexplained_gap(self):
        rows=[{'period':'2025-09','value':100},{'period':'2025-11','value':101}]
        for sid in ['us-cpi','us-core-cpi','us-unemployment','bls-CUUR0000SA0','bls-LNS14000000']:
            c=M.coverage(rows,{'id':sid,'frequency':'monthly','start':'2025-09-01'})
            self.assertEqual(c['missingPeriods'],[]);self.assertEqual(c['structuralPeriods'],['2025-10'])
            self.assertEqual(c['unpublishedPeriods'][0]['period'],'2025-10')
            self.assertTrue(c['unpublishedPeriods'][0]['sourceUrl'].startswith('https://www.bls.gov/'))
            self.assertTrue(c['complete'])
        c=M.coverage(rows,{'id':'us-payroll','frequency':'monthly','start':'2025-09-01'})
        self.assertEqual(c['missingPeriods'],['2025-10']);self.assertFalse(c['complete'])
        c=M.coverage([{'period':'2026-09','value':1},{'period':'2026-11','value':2}],{'id':'us-cpi','frequency':'monthly','start':'2026-09-01'})
        self.assertEqual(c['missingPeriods'],['2026-10']);self.assertNotIn('unpublishedPeriods',c)

    def test_default_choice_config_and_explicit_override(self):
        with tempfile.TemporaryDirectory() as folder:
            config=Path(folder)/'config.toml';config.write_text('',encoding='utf-8')
            with patch.dict(os.environ,{'CODEX_HOME':folder,'EM_API_KEY':''}),patch.object(M,'configured_key',return_value='test-key') as get:
                self.assertEqual(M.choice_key(),'test-key');get.assert_called_once_with(config)
            explicit=Path(folder)/'explicit.toml'
            with patch.object(M,'configured_key',return_value='test-key') as get:
                M.choice_key(explicit);get.assert_called_once_with(explicit)
            with patch.dict(os.environ,{'CODEX_HOME':folder,'EM_API_KEY':'test-env'}),patch.object(M,'configured_key',return_value='test-env') as get:
                M.choice_key();get.assert_called_once_with(None)
    def test_refresh_error_classification_never_exposes_provider_or_secret_prose(self):
        auth=M.failure_info(ValueError('Choice credentials missing'))
        self.assertEqual(auth['errorCode'],'credentials_missing');self.assertIn('授权',auth['reason'])
        self.assertEqual(M.failure_info(ValueError('Indicator code mismatch'))['errorCode'],'indicator_code')
        self.assertEqual(M.failure_info(M.RateLimitError('private-provider-message'))['errorCode'],'rate_limit')
        self.assertEqual(M.failure_info(TimeoutError('private-url'))['errorCode'],'timeout')
        self.assertNotIn('private-secret',json.dumps(M.failure_info(ValueError('private-secret'))))

    def setUp(self):
        self.spec=dict(id='test',originalName='中国:PPI:全部工业品:同比',publisher='国家统计局',unit='%',kind='rate',frequency='monthly',start='2025-01-01',code='CODE',offset=-100)
        self.table=dict(columns=['指标','数据来源','2025-01','2025-03'],items=[[self.spec['originalName'],'国家统计局','100','102.1']],meta={'jumpUrlList':[{'choiceUrl':'https://choicew2z.eastmoney.com/dataDisplay/macroEDB/#/index?macroids=CODE'}]})
    def result(self,t=None):return M.normalize({'data':[t or self.table]},self.spec,'2026-10-09')
    def test_numeric_precision_and_missing(self):
        self.assertEqual(M.numeric('2.7万亿'),(2.7e12,True));self.assertEqual(M.numeric('0'),(0,False));self.assertIsNone(M.numeric('--'))
        for value in ['3%',True,'NaN','=1+2']:
            with self.assertRaises(ValueError):M.numeric(value)
    def test_reviewed_bounds_combined_months_and_empty_coverage(self):
        spec={**self.spec,'offset':0,'combinedMonths':[2],'minValue':0,'maxValue':200}
        t=copy.deepcopy(self.table);t['columns'][2]='2025-02'
        result=M.normalize({'data':[t]},spec,'2026-10-09')
        self.assertEqual(result['observations'][0]['basis'],'jan_feb')
        t['items'][0][2]='201'
        with self.assertRaises(ValueError):M.normalize({'data':[t]},spec,'2026-10-09')
        self.assertFalse(M.coverage([],spec)['complete'])
    def test_consumption_mapping_changes_reject_history_merge(self):
        spec={**self.spec,'consumerId':'cpi','basis':'month'}
        old=M.merge_history({},M.normalize({'data':[self.table]},spec,'2026-10-09'),spec,'2026-10-09')
        with self.assertRaises(ValueError):M.merge_history(old,old,{**spec,'basis':'ytd'},'2026-10-10')
    def test_rate_limit_business_message_is_not_an_empty_success(self):
        with self.assertRaises(M.RateLimitError):M.body_of({'content':[{'type':'text','text':'{"message":"操作过于频繁"}'}]})
    def test_exact_identity_source_code_frequency(self):
        for mutate in [lambda t:t['items'][0].__setitem__(0,'相近指标'),lambda t:t['items'][0].__setitem__(1,'其他机构'),lambda t:t['columns'].__setitem__(2,'2025'),lambda t:t['meta']['jumpUrlList'][0].__setitem__('choiceUrl','https://choicew2z.eastmoney.com/dataDisplay/#/index?macroids=WRONG'),lambda t:t['meta']['jumpUrlList'][0].__setitem__('choiceUrl','https://evil.example/index?macroids=CODE')]:
            t=copy.deepcopy(self.table);mutate(t)
            with self.assertRaises(ValueError):self.result(t)
    def test_index_conversion_unknown_release_and_real_gap(self):
        d=self.result();self.assertEqual([r['value'] for r in d['observations']],[0,2.1]);self.assertIsNone(d['observations'][0]['releaseDate']);self.assertEqual(d['coverage']['missingPeriods'],['2025-02'])
    def test_official_merge_preserves_a_known_release_date_when_source_omits_it(self):
        old=[{'period':'2026-09','value':336.94,'releaseDate':'2026-10-14'}]
        incoming=[{'period':'2026-09','value':336.94,'releaseDate':None}]
        self.assertEqual(M.preserve_release_dates(old,incoming)[0]['releaseDate'],'2026-10-14')
        incoming=[{'period':'2026-09','value':337.01,'releaseDate':'2026-11-12'}]
        self.assertEqual(M.preserve_release_dates(old,incoming)[0]['releaseDate'],'2026-11-12')
    def test_structural_months_and_short_history(self):
        rows=[{'period':'2025-03','value':1},{'period':'2026-03','value':2}]
        d=M.coverage(rows,{**self.spec,'expectedMissingMonths':[1,2]})
        self.assertFalse(d['historyShort']);self.assertNotIn('2026-02',d['missingPeriods']);self.assertIn('2026-02',d['structuralPeriods'])
        self.assertTrue(M.coverage(rows,{**self.spec,'start':'2016-01-01'})['historyShort'])
    def test_merge_retains_history_tracks_revision_and_rejects_definition_change(self):
        d=M.merge_history({},self.result(),self.spec,'2026-10-09T00:00:00Z');new=copy.deepcopy(d);new['observations']=[{**new['observations'][-1],'value':3}]
        merged=M.merge_history(d,new,self.spec,'2026-10-10T00:00:00Z');self.assertEqual(len(merged['observations']),2);self.assertEqual(merged['revisedCount'],1)
        with self.assertRaises(ValueError):M.merge_history(d,new,{**self.spec,'unit':'元'},'2026-10-10')
    def test_published_snapshot_has_valid_sorted_observations_and_coverage(self):
        d=json.loads((M.DATA/'automatic-series.json').read_text(encoding='utf-8'));self.assertTrue(d['publicRedistributionApproved']);self.assertIsInstance(d['errors'],list)
        for id,s in d['series'].items():
            periods=[r['period'] for r in s['observations']];self.assertEqual(periods,sorted(set(periods)),id);self.assertEqual(len(periods),s['coverage']['count'],id)
            self.assertTrue(all(isinstance(r['value'],(float,int)) for r in s['observations']),id)
        self.assertGreaterEqual(d['series']['us-housing-starts']['coverage']['count'],120)
        self.assertEqual(d['series']['cn-gdp-quarter']['spec']['kind'],'rate')

if __name__=='__main__':unittest.main()
