import argparse, datetime as dt, json
from pathlib import Path
from daily_scope import is_ecommerce_topic
from build_daily_report import stamp,ROOT,window_hours

def validate(d):
 assert d['schemaVersion']==2,'Expected editorial v2'
 cutoff=stamp(d['cutoff']);assert cutoff and cutoff.date().isoformat()==d['date']
 assert (cutoff.hour,cutoff.minute)==(16,0)
 assert d['headline'] and len(d['headline'])<=100
 assert len(d['focus'])<=4 and len(d['industries'])<=6
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
 assert count<=1100,'Editorial exceeds one-page budget'
 return count
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--date',required=True);a=p.parse_args()
 print('Editorial valid:',validate(json.loads((ROOT/'data/daily/onepage'/f'{a.date}.json').read_text())),'characters')
