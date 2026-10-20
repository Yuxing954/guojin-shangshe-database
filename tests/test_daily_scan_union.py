import sys,unittest,json,tempfile
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_daily_report import stamp
from daily_attachment_coverage import attachment_catalog,validate_attachment_coverage
from daily_scope import sector_for
from build_daily_resource_list import allowed_attachment,catalog_for_window

def scan(start,end):
 return {'windowStart':start,'windowEnd':end,'observedAt':end,'windowComplete':True,'boundaryReachedBeforeWindow':True,'topicPages':2}

class ScanUnionTest(unittest.TestCase):
 def catalog(self,scans):
  return attachment_catalog({'attachmentScan':scans[-1],'attachmentScans':scans},stamp('2026-10-16T18:00:00+08:00'),stamp('2026-10-19T18:00:00+08:00'))
 def test_overlapping_completed_receipts_cover_monday(self):
  c=self.catalog([scan('2026-10-16T00:00:00+08:00','2026-10-18T17:45:00+08:00'),scan('2026-10-18T00:00:00+08:00','2026-10-20T16:39:00+08:00')])
  self.assertEqual(c['coverageStatus'],'complete')
  validate_attachment_coverage({'attachmentCatalog':c,'windowStart':c['requestedWindowStart'],'cutoff':c['requestedCutoff']})
 def test_real_gap_stays_pending(self):
  c=self.catalog([scan('2026-10-16T00:00:00+08:00','2026-10-18T12:00:00+08:00'),scan('2026-10-18T13:00:00+08:00','2026-10-20T16:39:00+08:00')])
  self.assertEqual(c['coverageStatus'],'pending')
  self.assertEqual(c['missingIntervals'],[{'start':'2026-10-18T12:00:00+08:00','end':'2026-10-18T13:00:00+08:00'}])
 def test_incomplete_receipt_cannot_close_gap(self):
  s=scan('2026-10-18T00:00:00+08:00','2026-10-20T16:39:00+08:00');s['windowComplete']=False
  self.assertEqual(self.catalog([scan('2026-10-16T00:00:00+08:00','2026-10-18T17:45:00+08:00'),s])['coverageStatus'],'pending')
 def test_business_scope_not_team_name(self):
  for title in ['润本股份：婴童护理增长','丽江股份：Q3经营承压','9月潮玩动漫线上跟踪【国金轻工】']:
   self.assertIsNotNone(sector_for(title))
  for title in ['轻工周观点：造纸','食品饮料业绩更新','阿里巴巴平台电商']:
   self.assertIsNone(sector_for(title))
 def test_auto_retail_is_outside_consumer_retail_scope(self):
  self.assertFalse(allowed_attachment({'name':'中国汽车-专家访谈：预计国内零售增长-China Automobiles.pdf','sectors':['retail']}))
  self.assertTrue(allowed_attachment({'name':'资深烟草专家交流20261019.pdf','sectors':[]}))
 def test_backfill_receipt_is_stable_when_adjacent_snapshot_is_refreshed(self):
  old=scan('2026-10-16T00:00:00+08:00','2026-10-18T17:45:00+08:00')
  narrow=scan('2026-10-17T00:00:00+08:00','2026-10-19T16:36:00+08:00')
  latest=scan('2026-10-18T00:00:00+08:00','2026-10-20T16:39:00+08:00')
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);out=root/'data/daily/resources';out.mkdir(parents=True)
   (out/'2026-10-17.json').write_text(json.dumps({'attachmentCatalog':{'scan':old}}))
   neighbor=out/'2026-10-18.json';neighbor.write_text(json.dumps({'attachmentCatalog':{'scan':narrow}}))
   with patch('build_daily_resource_list.ROOT',root):
    a=catalog_for_window({'attachmentScan':latest},stamp('2026-10-16T18:00:00+08:00'),stamp('2026-10-19T18:00:00+08:00'))
    (out/'2026-10-19.json').write_text(json.dumps({'attachmentCatalog':a}))
    neighbor.write_text(json.dumps({'attachmentCatalog':{'scan':old,'scanReceiptFile':'data/daily/resources/2026-10-17.json'}}))
    b=catalog_for_window({'attachmentScan':latest},stamp('2026-10-16T18:00:00+08:00'),stamp('2026-10-19T18:00:00+08:00'))
    self.assertEqual(a,b)
