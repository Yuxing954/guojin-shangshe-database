import argparse, datetime as dt, json, hashlib
from pathlib import Path
from hydrate_daily_originals import normalize_url,corpus
from daily_scope import is_ecommerce_topic
from build_daily_report import stamp,ROOT,window_hours

def validate_industry_updates(d):
 if d.get('industryWindowHours')!=24:return  # Preserve historical snapshots.
 start,end=stamp(d.get('industryWindowStart')),stamp(d.get('industryWindowEnd'))
 assert start and end and end-start==dt.timedelta(hours=24),'Industry window must be exactly 24 hours'
 for row in d.get('industryUpdates',[]):
  published=row.get('publishedAt')
  assert published and len(published)>10,'Industry update requires a verified publication time'
  t=stamp(published)
  assert t and start<t<=end,'Industry update outside publication window'

def validate_announcements(d):
 rows=d.get('companyAnnouncements',[])
 assert isinstance(rows,list),'Company announcements must be an array'
 if not rows:return
 coverage=json.loads((ROOT/'data/coverage-companies.json').read_text())
 codes={r['code'] for r in coverage['companies']}
 end=stamp(d['cutoff']);start=stamp(d.get('windowStart')) or end-dt.timedelta(hours=window_hours(end))
 seen=set()
 for row in rows:
  for key in ('company','code','title','category','publishedAt','timePrecision','summary','impact','source','sourceType','url','checkedAt','evidenceFile'):
   assert isinstance(row.get(key),str) and row[key].strip(),'Missing announcement field: '+key
  assert row['code'] in codes,'Announcement company is outside the coverage directory'
  assert not is_ecommerce_topic(row['company']+' '+row['title']),'Ecommerce is excluded from daily announcements'
  assert row.get('verified') is True,'Unverified announcement cannot be published'
  assert row['sourceType'] in ('exchange','company','regulator'),'Announcement requires an original disclosure source'
  assert row['url'].startswith('https://'),'Announcement needs an original HTTPS URL'
  identity=(row['code'],row['url'].split('#')[0].split('?')[0]);assert identity not in seen,'Duplicate announcement';seen.add(identity)
  published=stamp(row['publishedAt']);checked=stamp(row['checkedAt'])
  assert published and checked and checked>=published,'Invalid announcement publication/check time'
  if row['timePrecision']=='timestamp':
   assert len(row['publishedAt'])>10 and (row['publishedAt'].endswith('Z') or '+' in row['publishedAt'][10:]),'Announcement timestamp must include a timezone'
   assert start<published<=end,'Announcement outside daily window'
  else:
   assert row['timePrecision']=='date' and len(row['publishedAt'])==10,'Unknown announcement date precision'
   assert start.date()<=published.date()<=end.date(),'Announcement date outside daily window'

def validate_announcement_monitoring(d):
 if not d.get('announcementMonitoringRequired'):return
 m=d.get('announcementMonitoring') or {}
 assert m.get('checkedAt') and stamp(m['checkedAt']),'Missing announcement monitoring time'
 assert m.get('windowStart')==d['windowStart'] and m.get('cutoff')==d['cutoff'],'Announcement monitoring window differs'
 assert m.get('coverageFile')=='data/coverage-companies.json' and m.get('evidenceFile'),'Missing announcement coverage/evidence'
 assert m.get('status') in ('complete','partial','incomplete','blocked'),'Unknown announcement monitoring status'
 coverage=json.loads((ROOT/'data/coverage-companies.json').read_text())
 expected={r['code'] for r in coverage['companies']}
 checked=m.get('checkedCompanies',[]);excluded=m.get('excludedCompanies',[])
 codes=[r.get('code') for r in checked+excluded]
 assert len(codes)==len(set(codes)) and set(codes)==expected,'Announcement monitoring must account for the current coverage directory'
 assert all(r.get('sources') and r.get('status') for r in checked),'Missing per-company source/check result'
 assert all(r.get('reason') for r in excluded),'Missing daily-scope exclusion reason'
 failed=m.get('failedCompanies',[])
 assert isinstance(failed,list) and all(r.get('code') in {c['code'] for c in checked} for r in failed),'Invalid failed-company records'
 if m['status']=='complete':
  assert not failed and all(r['status']=='complete' for r in checked),'Partial source checks cannot be reported as complete'

def validate(d):
 assert d.get('publicationStatus')!='blocked','Editorial has unresolved publication blockers'
 validate_industry_updates(d)
 validate_announcements(d)
 validate_announcement_monitoring(d)
 assert d['schemaVersion']==2,'Expected editorial v2'
 cutoff=stamp(d['cutoff']);assert cutoff and cutoff.date().isoformat()==d['date']
 if (cutoff.hour,cutoff.minute)!=(16,0):
  assert d.get('cutoffOverride',{}).get('requestedBy')=='user' and d['cutoffOverride'].get('reason'),'Nonstandard cutoff requires explicit user request'
 assert cutoff.second==0,'Cutoff must be a whole minute'
 assert d['headline'] and len(d['headline'])<=100
 assert len(d['industries'])<=6
 if d.get('dailySummaryPoints'):
  assert len(d['dailySummaryPoints'])==3 and all(isinstance(x,str) and x.strip() for x in d['dailySummaryPoints']),'Daily summary requires three points'
  assert d['dailySummary']=='\n'.join(n+' '+t for n,t in zip('①②③',d['dailySummaryPoints'])),'Display and export summaries differ'
 if d.get('dailySummary'):assert len(d['dailySummary'])<=450,'Daily summary must be concise'
 count=len(d.get('dailySummary') or d['headline'])+len(d.get('quiet',''))
 for group in ('focus','industries'):
  for r in d[group]:
   assert not is_ecommerce_topic(r.get('title',r.get('sector',''))),'Ecommerce is excluded from daily brief'
   for field in (('title','summary') if group=='focus' else ('sector','view','changeType','change')):
    assert r.get(field),field;count+=len(r[field])
   assert r.get('sources'),'Missing evidence'
   fresh=False
   for src in r['sources']:
    assert src['url'].startswith('https://')
    t=stamp(src['publishedAt']);assert t and len(src['publishedAt'])>10
    assert cutoff-dt.timedelta(days=7)<t<=cutoff,'Evidence outside comparison window'
    fresh|=cutoff-dt.timedelta(hours=window_hours(cutoff))<t
   assert fresh,'No new source in daily window'
 if d.get('allSegmentsListed'):
  for r in d['focus']:
   for source in r['sources']:
    original=d.get('originals',{}).get(normalize_url(source['url']))
    assert original and original.get('body','').strip(),'Missing full original text'
    assert original.get('sha256')==hashlib.sha256(original['body'].encode()).hexdigest(),'Original hash mismatch'
 else:assert count<=1100,'Editorial exceeds one-page budget'
 return count
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--date',required=True);p.add_argument('--check-resources',action='store_true',help='Compare this publication with the current local source metadata; do not use for frozen historical snapshots');a=p.parse_args()
 d=json.loads((ROOT/'data/daily/onepage'/f'{a.date}.json').read_text())
 print('Editorial valid:',validate(d),'characters')
 if d.get('announcementMonitoringRequired'):
  proof=(ROOT/d['announcementMonitoring']['evidenceFile']).resolve()
  assert proof.is_relative_to((ROOT/'data/daily/evidence').resolve()) and proof.is_file(),'Missing announcement monitoring evidence file'
  assert json.loads(proof.read_text()).get('announcementMonitoring')==d['announcementMonitoring'],'Announcement monitoring is not backed by its saved receipt'
 for row in d.get('companyAnnouncements',[]):
  proof=(ROOT/row['evidenceFile']).resolve()
  assert proof.is_relative_to((ROOT/'data/daily/evidence').resolve()) and proof.is_file(),'Missing announcement evidence file'
  saved=json.loads(proof.read_text()).get('companyAnnouncements',[])
  assert any(x.get('url')==row['url'] and x.get('code')==row['code'] for x in saved),'Announcement is not linked to its source evidence'
 if d.get('allSegmentsListed'):
  resources=json.loads((ROOT/'data/daily/resources'/f'{a.date}.json').read_text())
  expected={normalize_url(x['url']) for x in resources['groups']['segments']}
  actual={normalize_url(x['url']) for x in d['focus'] for x in x['sources']}
  assert actual==expected,'Daily segment list is incomplete or includes extra topics'
  rows=corpus()
  for url in actual:
   assert url in rows and d['originals'][url]['body']==rows[url]['内容'],'Original text is incomplete or differs from source corpus'
  print('Complete segment list and originals verified:',len(actual))
 if a.check_resources:
  from build_daily_resource_list import build
  from daily_attachment_coverage import validate_attachment_coverage
  saved=json.loads((ROOT/'data/daily/resources'/f'{a.date}.json').read_text())
  validate_attachment_coverage(saved)
  expected=build(a.date,saved['cutoff'])
  assert saved.get('attachmentCatalog')==expected['attachmentCatalog'],'Attachment catalogue version is stale'
  for kind in ('minutes','audio','reports'):
   assert saved['groups'][kind]==expected['groups'][kind],f'Incomplete or stale {kind} resource list'
  print('Attachment catalogue version and all resource items verified')

