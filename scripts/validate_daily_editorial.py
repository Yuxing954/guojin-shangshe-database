import argparse, datetime as dt, json, hashlib
from pathlib import Path
from hydrate_daily_originals import normalize_url,corpus
from daily_scope import is_ecommerce_topic
from build_daily_report import stamp,ROOT,window_hours

def validate(d):
 assert d['schemaVersion']==2,'Expected editorial v2'
 cutoff=stamp(d['cutoff']);assert cutoff and cutoff.date().isoformat()==d['date']
 assert (cutoff.hour,cutoff.minute)==(16,0)
 assert d['headline'] and len(d['headline'])<=100
 assert len(d['industries'])<=6
 if d.get('dailySummary'):assert len(d['dailySummary'])<=350,'Daily summary must be concise'
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
 p=argparse.ArgumentParser();p.add_argument('--date',required=True);a=p.parse_args()
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
