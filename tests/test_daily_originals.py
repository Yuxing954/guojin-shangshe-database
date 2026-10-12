import hashlib,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from hydrate_daily_originals import hydrate,normalize_url
class OriginalTests(unittest.TestCase):
 def test_weekend_original_is_embedded_without_recent_snapshot(self):
  url='https://wx.zsxq.com/group/888/topic/123'
  d={'focus':[{'sources':[{'url':url+'?from=daily'}]}]}
  body='完整的周末原文，包含经营数据。'
  out=hydrate(d,{url:{'内容':body,'时间':'2026-10-10T00:31:11','标题':'名创优品经营更新'}})
  self.assertEqual(out['originals'][url]['body'],body)
  self.assertEqual(out['originals'][url]['sha256'],hashlib.sha256(body.encode()).hexdigest())
 def test_missing_original_stops_publication(self):
  with self.assertRaises(ValueError):hydrate({'focus':[{'sources':[{'url':'https://example.com/missing'}]}]}, {})
