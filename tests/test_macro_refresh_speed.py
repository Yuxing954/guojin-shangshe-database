import copy,importlib,io,json,sys,tempfile,threading,unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'update'))
import polymarket_data as P

class RefreshSpeedTests(unittest.TestCase):
    def test_public_reads_are_bounded_and_preserve_input_order(self):
        mutex=threading.Lock();gate=threading.Event();state={'active':0,'peak':0,'calls':0}
        def fetch(url):
            with mutex:
                state['active']+=1;state['calls']+=1;state['peak']=max(state['peak'],state['active'])
                if state['active']==4:gate.set()
            self.assertTrue(gate.wait(2))
            with mutex:state['active']-=1
            return (url,'digest')
        urls=[str(i) for i in range(18)]
        with patch.object(P,'fetch',side_effect=fetch):result=P.ordered_fetch(urls)
        self.assertEqual(result,[(u,'digest') for u in urls]);self.assertEqual(state['peak'],4);self.assertEqual(state['calls'],18)

    def test_any_failed_public_read_rejects_the_batch(self):
        def fetch(url):
            if url=='bad':raise ValueError('invalid upstream')
            return url,'digest'
        with patch.object(P,'fetch',side_effect=fetch),self.assertRaises(ValueError):P.ordered_fetch(['good','bad','other'])

    def test_only_acquisition_metadata_and_derived_previous_are_ignored(self):
        old={'status':'ready','fetchedAt':'old','markets':[{'id':'1','updatedAt':'source-time','question':'original','outcomes':[{'name':'Yes','probability':0,'previousProbability':.3}]}],'receipts':[{'url':'https://gamma-api.polymarket.com/events/1','sha256':'old'}]}
        new=copy.deepcopy(old);new['fetchedAt']='new';new['receipts'][0]['sha256']='new';new['markets'][0]['outcomes'][0]['previousProbability']=0
        self.assertEqual(P.meaningful(old),P.meaningful(new))
        for field,value in [('status','error'),('markets',[]),('receipts',[{'url':'https://gamma-api.polymarket.com/events/2'}])]:self.assertNotEqual(P.meaningful(old),P.meaningful({**new,field:value}))
        for key,value in [('question','changed'),('updatedAt','new-source-time')]:
            changed=copy.deepcopy(new);changed['markets'][0][key]=value;self.assertNotEqual(P.meaningful(old),P.meaningful(changed))
        changed=copy.deepcopy(new);changed['markets'][0]['outcomes'][0]['probability']=.1;self.assertNotEqual(P.meaningful(old),P.meaningful(changed))

    def test_repeated_failure_preserves_file_bytes_and_is_still_a_failure(self):
        prior={'status':'error','fetchedAt':'old','checkedAt':'old','markets':[],'error':'Gamma读取或校验失败；保留最后成功快照。'}
        with tempfile.TemporaryDirectory() as folder:
            target=Path(folder)/'predictions.json';target.write_text(json.dumps(prior),encoding='utf8');before=target.read_bytes()
            with patch.object(P,'TARGET',target),patch.object(P,'ordered_fetch',side_effect=ValueError('private')),redirect_stdout(io.StringIO()) as out,self.assertRaises(SystemExit) as error:P.main()
            self.assertEqual(error.exception.code,1);self.assertEqual(target.read_bytes(),before);self.assertTrue(json.loads(out.getvalue())['noChange'])

if __name__=='__main__':unittest.main()
