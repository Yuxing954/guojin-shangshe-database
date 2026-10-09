import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'update'))
from miaoxiang_mcp import decode_reply, READ_ONLY_TOOLS,response_summary
from gold_history import sge_rows,brand_rows

class IntegrationGuards(unittest.TestCase):
    def test_rpc_json_and_sse(self):
        raw=b'{"jsonrpc":"2.0","id":3,"result":{"data":[]}}'
        self.assertEqual(decode_reply(raw,3),{'data':[]})
        self.assertEqual(decode_reply(b'event: message\r\ndata: '+raw+b'\r\n\r\n',3),{'data':[]})
        for invalid in (b'{"id":4,"result":{}}',b'{"id":3,"error":{}}'):
            with self.assertRaises(ValueError):decode_reply(invalid,3)
    def test_readonly_allowlist(self):
        self.assertIn('mx_macro_data',READ_ONLY_TOOLS)
        self.assertNotIn('mx_simulator_trade',READ_ONLY_TOOLS)
    def test_business_error_is_not_protocol_success(self):
        self.assertTrue(response_summary({'isError':False,'content':[{'type':'text','text':'{"code":114}'}]})['businessError'])
        self.assertFalse(response_summary({'isError':False,'content':[{'type':'text','text':'{"data":[]}'}]})['structuredDataReturned'])
    def test_daily_instrument_and_column_identity(self):
        html='<table><tr><th>日期</th><th>合约</th><th>收盘价</th><th>加权平均价</th></tr><tr><td>2026-09-01</td><td>iAu99.99</td><td>3</td><td>4</td></tr><tr><td>2026-09-01</td><td>Au99.99</td><td>1,000.25</td><td>999.15</td></tr></table>'
        self.assertEqual(sge_rows(html,'2026-09-01'),[('close',1000.25),('weighted_average',999.15)])
        self.assertEqual(sge_rows(html,'2026-09-02'),[])
        with self.assertRaises(ValueError):sge_rows(html+html,'2026-09-01')
    def test_brand_dates_required_and_duplicates_rejected(self):
        row='<li><div class="new"><span>1200</span>元/克</div><div class="time">2026-09-01</div></li>'
        self.assertEqual(brand_rows(row),[('2026-09-01',1200)])
        with self.assertRaises(ValueError):brand_rows(row+row)
        with self.assertRaises(ValueError):brand_rows(row.replace('2026-09-01','一分钟前'))

if __name__=='__main__':unittest.main()
