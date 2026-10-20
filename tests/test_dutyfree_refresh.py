import copy,csv,hashlib,io,json,sys,tempfile,unittest,shutil,subprocess
from contextlib import redirect_stdout
from datetime import date
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import update_dutyfree_monthly as m
from is_dutyfree_only import dutyfree_only

class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        headers=['period_id','year','month','shopping_sales_cny_100m','shoppers_10k','items_10k','tourists_10k','sales_yoy_pct','shoppers_yoy_pct','items_yoy_pct','tourists_yoy_pct','conversion_rate_pct','spend_per_shopper_cny','spend_per_shopper_yoy_pct','items_per_shopper','unit_price_cny','source']
        self.history=[dict.fromkeys(headers,'') for _ in range(2)]
        for r,p in zip(self.history,['2025-09','2026-08']):r.update(period_id=p,year=p[:4],month=str(int(p[5:])),shopping_sales_cny_100m='20',shoppers_10k='25',items_10k='100',spend_per_shopper_cny='8000',source='fixture')
        p=self.root/'data/dutyfree_monthly.csv';p.parent.mkdir(parents=True)
        with p.open('w',newline='',encoding='utf-8') as f:w=csv.DictWriter(f,fieldnames=headers);w.writeheader();w.writerows(self.history)
        metrics=[]
        for mid in [*m.VALUES,'dutyfree_spend','dutyfree_sales_yoy','dutyfree_shoppers_yoy']:
            value={'dutyfree_sales':20,'dutyfree_shoppers':25,'dutyfree_items':100,'dutyfree_spend':8000}.get(mid,0)
            metrics.append({'id':mid,'points':[{'metricId':mid,'period':p,'endDate':p+'-30','startDate':p+'-01','periodLabel':p,'value':value,'sourceId':'fixture','basis':'monthly','quality':'legacy','change':0} for p in ['2025-09','2026-08']]})
        self.write('data/industry/overview.json',{'generatedAt':'before','checkedAt':'unchanged','sources':[{'id':'fixture'}],'sectors':[{'id':'hotel','metrics':[]},{'id':'dutyfree','metrics':metrics,'sourceIds':['fixture']}],'revisions':[]})
        self.write('data/dutyfree/monthly-calculations.json',{'records':[],'launchSource':'preserved'})
        self.write('data/dutyfree/monthly-provenance.json',{'sourceFile':'fixture.xlsx','recordCount':2,'supplements':[{'period':'2020-01'}]})
        self.write('data/dutyfree/overview.json',{'kpis':[{'key':k} for k in ['hainan_sales','hainan_shoppers','hainan_items','hainan_spend']]})
        for name in ['hainan','manifest']:self.write(f'data/dutyfree/{name}.json',{})
        self.write('data/dutyfree/sources.json',{'sources':{}});self.write('data-manifest.json',{'datasets':[{'id':'dutyfree_monthly'},{'id':'hotel','asOf':'unchanged'}]})
    def write(self,path,obj):
        p=self.root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj),encoding='utf-8')
    def receipt(self):return {'content':[{'type':'text','text':json.dumps({'data':[{'columns':['宏观数据（月）','数据来源','2026-09'],'items':[['海南:离岛免税购物:金额(元)','海关总署','17.12亿'],['海南:离岛免税购物:人次(人次)','海关总署','28.06万'],['海南:离岛免税购物:件数(件)','海关总署','145.3万']],'meta':{'jumpUrlList':[{'choiceUrl':'https://choicew2z.eastmoney.com/dataDisplay/macroEDB/#/index?macroids=EMM01500925,EMM01500926,EMM01500927'}]}}]})}]}
    def digest(self):return {p.relative_to(self.root).as_posix():p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
    def run_refresh(self,r=None):return m.refresh(self.root,'2026-09',self.receipt() if r is None else r,as_of=date(2026,10,20))
    def test_one_receipt_syncs_views_and_preserves_history(self):
        old=self.digest();result=self.run_refresh();data=m.rows(self.root);self.assertEqual(data[:-1],self.history);self.assertEqual(result['added'],3)
        self.assertAlmostEqual(float(data[-1]['spend_per_shopper_cny']),17.12/28.06*10000,places=5);self.assertEqual(data[-1]['tourists_10k'],'')
        v=m.read(self.root,'data/industry/overview.json');before=json.loads(old['data/industry/overview.json']);self.assertEqual(v['sectors'][0],before['sectors'][0]);self.assertEqual(v['checkedAt'],'unchanged')
        for a,b in zip(v['sectors'][1]['metrics'],before['sectors'][1]['metrics']):self.assertEqual(a['points'][:-1],b['points'])
        provenance=m.read(self.root,'data/dutyfree/monthly-provenance.json');self.assertEqual(provenance['supplements'][0],{'period':'2020-01'});self.assertIsNone(provenance['supplements'][-1]['publishedAt']);self.assertTrue(m.check(self.root)['valid'])
    def test_duplicate_month_does_not_read_receipt_or_credentials(self):
        self.run_refresh();before=self.digest();self.assertTrue(self.run_refresh({'isError':True})['noChange']);self.assertEqual(before,self.digest())
        with patch.object(sys,'argv',['updater','--root',str(self.root),'--period','2026-09','--fetch']),redirect_stdout(io.StringIO()) as out:
            self.assertEqual(m.main(),0)
        self.assertTrue(json.loads(out.getvalue())['noDataFetch']);self.assertEqual(before,self.digest())
    def test_invalid_or_incomplete_receipt_never_changes_any_file(self):
        original=self.digest()
        for change in ['publisher','missing','code','cumulative','duplicate']:
            r=self.receipt();body=json.loads(r['content'][0]['text']);t=body['data'][0]
            if change=='publisher':t['items'][0][1]='其他机构'
            elif change=='missing':t['items'][0][2]='-'
            elif change=='code':t['meta']['jumpUrlList'][0]['choiceUrl']='https://example.com/#/index?macroids=wrong'
            elif change=='cumulative':t['columns'][0]='宏观数据（季）'
            else:t['items'].append(t['items'][0])
            r['content'][0]['text']=json.dumps(body)
            with self.assertRaises(ValueError):self.run_refresh(r)
            self.assertEqual(original,self.digest())
    def test_existing_batch_lock_skips_before_credentials_or_network(self):
        p=self.root/'.cache/dutyfree-refresh.lock';p.parent.mkdir();p.write_text('fixture lock');before=self.digest()
        with patch.object(sys,'argv',['updater','--root',str(self.root),'--period','2026-09','--fetch']),redirect_stdout(io.StringIO()) as out:self.assertEqual(m.main(),0)
        self.assertTrue(json.loads(out.getvalue())['activeBatch']);self.assertEqual(before,self.digest())
    def test_real_zero_is_retained_and_missing_denominator_is_not_zero_filled(self):
        r=self.receipt();body=json.loads(r['content'][0]['text']);body['data'][0]['items'][0][2]=0;body['data'][0]['items'][1][2]=0;r['content'][0]['text']=json.dumps(body);self.run_refresh(r)
        row=m.rows(self.root)[-1];self.assertEqual(row['shopping_sales_cny_100m'],'0');self.assertEqual(row['shoppers_10k'],'0');self.assertEqual(row['spend_per_shopper_cny'],'');self.assertTrue(m.check(self.root)['valid'])
    def test_unfinished_or_skipped_month_is_rejected(self):
        before=self.digest()
        for period in ['2026-10','2026-11','2025-07']:
            with self.assertRaises(ValueError):m.refresh(self.root,period,self.receipt(),as_of=date(2026,11,1))
        self.assertEqual(before,self.digest())
    def test_fast_build_is_narrow_and_fail_closed(self):
        base=['data/dutyfree_monthly.csv','data/industry/overview.json','data/industry/miaoxiang-2026-10-20-dutyfree-2026-09.json']
        self.assertTrue(dutyfree_only(base));self.assertFalse(dutyfree_only(base+['data/research/recent.json']));self.assertFalse(dutyfree_only(base+['scripts/site-charts.js']));self.assertFalse(dutyfree_only(['data-manifest.json']));self.assertFalse(dutyfree_only([]))
    @unittest.skipUnless(shutil.which('git'),'Git unavailable for isolated classification fixture')
    def test_fast_build_cli_uses_actual_commit_diff_and_rejects_unknown_base(self):
        with tempfile.TemporaryDirectory() as name:
            root=Path(name)
            def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,text=True,check=True).stdout.strip()
            git('init','-q');(root/'README.md').write_text('fixture');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','initial');base=git('rev-parse','HEAD')
            for path in ['data/dutyfree_monthly.csv','data/industry/overview.json','data/industry/miaoxiang-2026-10-20-dutyfree-2026-09.json']:
                p=root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('fixture')
            git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','dutyfree');head=git('rev-parse','HEAD')
            command=[sys.executable,str(Path(m.__file__).with_name('is_dutyfree_only.py')),'--base',base,'--head',head]
            self.assertEqual(subprocess.check_output(command,cwd=root,text=True).strip(),'true')
            command[-3]='f'*40
            self.assertEqual(subprocess.check_output(command,cwd=root,text=True).strip(),'false')
if __name__=='__main__':unittest.main()

