"""Attach complete stored text sources to the daily editorial; no media downloads."""
import argparse,csv,hashlib,json
from build_daily_report import ROOT,stamp
from research_sources import archive_rows,merge_rows,update_rows

def normalize_url(url):return str(url).split('#')[0].split('?')[0].rstrip('/')
def corpus():
 result={}
 for db,file in [('views','商社-市场观点.csv'),('all_views','全部-市场观点.csv')]:
  with (ROOT/'data'/file).open(encoding='utf-8-sig') as f:base=list(csv.DictReader(f))
  for r in merge_rows(archive_rows(ROOT,db,base),update_rows(ROOT,db)):
   u=normalize_url(r.get('原文链接'))
   if u and r.get('内容'):result[u]=r
 return result

def hydrate(d,rows):
 originals={}
 for item in d['focus']:
  for source in item['sources']:
   key=normalize_url(source['url']);r=rows.get(key)
   if not r or not r.get('内容','').strip():raise ValueError('Missing complete stored source: '+source['url'])
   body=r['内容'];originals[key]={'url':source['url'],'title':r['标题'],'publishedAt':stamp(r['时间']).isoformat(),'body':body,'sha256':hashlib.sha256(body.encode()).hexdigest()}
 d['originals']=originals
 return d
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--date',required=True);a=p.parse_args();path=ROOT/'data/daily/onepage'/f'{a.date}.json'
 d=hydrate(json.loads(path.read_text()),corpus());path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 print('Complete originals:',len(d['originals']))
