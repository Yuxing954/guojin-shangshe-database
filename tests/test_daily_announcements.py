import copy,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from validate_daily_editorial import validate_announcements

class AnnouncementTests(unittest.TestCase):
 def report(self,published='2026-10-16T10:00:00+08:00',precision='timestamp'):
  return {'cutoff':'2026-10-16T16:00:00+08:00','windowStart':'2026-10-15T16:00:00+08:00','companyAnnouncements':[
   {'company':'锦江酒店','code':'600754.SH','title':'测试公告','category':'经营数据','publishedAt':published,'timePrecision':precision,
    'summary':'测试事实','impact':'测试判断','source':'测试原始披露','sourceType':'exchange','url':'https://example.com/disclosure/1',
    'checkedAt':'2026-10-16T16:05:00+08:00','evidenceFile':'data/daily/evidence/2026-10-16.json','verified':True}]}
 def test_verified_timestamp_and_real_date_are_preserved(self):
  validate_announcements(self.report())
  validate_announcements(self.report('2026-10-16','date'))
 def test_unverified_or_unsupported_sources_cannot_publish(self):
  for key,value in [('verified',False),('sourceType','broker'),('url','javascript:alert(1)'),('code','UNKNOWN')]:
   d=self.report();d['companyAnnouncements'][0][key]=value
   with self.assertRaises(AssertionError):validate_announcements(d)
 def test_stale_future_and_timezone_missing_cannot_publish(self):
  for published in ['2026-10-15T10:00:00+08:00','2026-10-16T17:00:00+08:00','2026-10-16T10:00:00']:
   with self.assertRaises(AssertionError):validate_announcements(self.report(published))
 def test_duplicate_announcement_cannot_publish(self):
  d=self.report();d['companyAnnouncements'].append(copy.deepcopy(d['companyAnnouncements'][0]))
  with self.assertRaisesRegex(AssertionError,'Duplicate announcement'):validate_announcements(d)
 def test_historical_report_needs_no_announcement_backfill(self):
  validate_announcements({})
