import datetime as dt
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_daily_report import inside,stamp,numeric_candidates,TZ,window_hours
class DailyTests(unittest.TestCase):
 def test_window(self):
  end=stamp('2026-10-12T16:00:00+08:00')
  self.assertTrue(inside('2026-10-12T08:00:00Z',end,24))
  self.assertFalse(inside('2026-10-11T16:00:00+08:00',end,24))
  self.assertFalse(inside('2026-10-12T16:00:01+08:00',end,24))
  self.assertFalse(inside('bad',end,24))
 def test_monday_covers_full_weekend(self):
  end=stamp('2026-10-12T16:00:00+08:00')
  self.assertEqual(window_hours(end),72)
  for t in ['2026-10-10T00:00:00+08:00','2026-10-11T23:59:59+08:00','2026-10-09T16:00:01+08:00']:
   self.assertTrue(inside(t,end,window_hours(end)))
  self.assertFalse(inside('2026-10-09T16:00:00+08:00',end,window_hours(end)))
  self.assertEqual(window_hours(stamp('2026-10-13T16:00:00+08:00')),24)
  self.assertEqual(window_hours(stamp('2026-10-12T08:00:00Z')),72)
 def test_metadata_zero_and_missing(self):
  d={'series':{'consumer-cpi':{'spec':{'name':'消费价格','unit':'%'},'observations':[{'period':'2026-08','value':0},{'period':'2026-09','value':None}]}}}
  r=numeric_candidates(d,'automatic-series.json')['consumer-cpi']
  self.assertEqual((r['title'],r['unit'],r['value'],r['period']),('消费价格','%',0,'2026-08'))
if __name__=='__main__': unittest.main()
