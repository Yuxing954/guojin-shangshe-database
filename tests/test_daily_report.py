import datetime as dt
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_daily_report import inside,stamp,numeric_candidates,TZ
class DailyTests(unittest.TestCase):
 def test_window(self):
  end=stamp('2026-10-12T16:00:00+08:00')
  self.assertTrue(inside('2026-10-12T08:00:00Z',end,24))
  self.assertFalse(inside('2026-10-11T16:00:00+08:00',end,24))
  self.assertFalse(inside('2026-10-12T16:00:01+08:00',end,24))
  self.assertFalse(inside('bad',end,24))
 def test_metadata_zero_and_missing(self):
  d={'series':{'consumer-cpi':{'spec':{'name':'消费价格','unit':'%'},'observations':[{'period':'2026-08','value':0},{'period':'2026-09','value':None}]}}}
  r=numeric_candidates(d,'automatic-series.json')['consumer-cpi']
  self.assertEqual((r['title'],r['unit'],r['value'],r['period']),('消费价格','%',0,'2026-08'))
if __name__=='__main__': unittest.main()
