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

def validate(d):
 validate_industry_updates(d)
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
  saved=json.loads((ROOT/'data/daily/resources'/f'{a.date}.json').read_text())
  expected=build(a.date,saved['cutoff'])
  assert saved.get('attachmentCatalog')==expected['attachmentCatalog'],'Attachment catalogue version is stale'
  for kind in ('minutes','audio','reports'):
   assert saved['groups'][kind]==expected['groups'][kind],f'Incomplete or stale {kind} resource list'
  print('Attachment catalogue version and all resource items verified')

