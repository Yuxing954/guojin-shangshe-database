"""List source metadata only. Never fetch attachments or media."""
import argparse,csv,datetime as dt,hashlib,json,re
from pathlib import Path
from build_daily_report import ROOT,TZ,stamp,window_hours
from research_sources import merge_rows,update_rows,archive_rows
from daily_scope import sector_for,is_ecommerce_topic,EXCLUDE,title_for,published_for,substantive_segment
from daily_attachment_coverage import attachment_catalog,scan_updated_after_four

def filename_key(name):return re.sub(r'[\s—\-_]+','',name).lower()
def within(value,start,end):
 t=stamp(value);return bool(t and start<t<=end)
def allowed_attachment(r):
 name=r.get('name','')
 if re.search(r'速冻(?:食品|行业)|速冻.*(?:结构性增长|新机遇)',name):return False
 if re.search(r'中国汽车|China Automobiles|汽车行业|汽车零部件|消费电子|房地产',name,re.I):return False
 if re.search(r'LendAPI|嵌入式金融|金融科技',name,re.I):return False
 if is_ecommerce_topic(name) or EXCLUDE.search(name):return False
 consumer_overview = re.search(r'商社|中国消费[:：]|消费(?:价值|行业|周周谈)|消费业绩前瞻|四季度消费的估值切换|性价比消费时代',name)
 if consumer_overview and not re.search(r'消费电子|房地产|地产建筑',name):return True
 return bool(sector_for(name) or set(r.get('sectors',[])) & {'hotel','tourism','dutyfree','gold','retail','dining','education','hr'})

def attachment_kind(r):
 if r['format']=='audio':return 'audio'
 name=r['name']
 # Bilingual broker research recaps remain research material, not meeting minutes.
 if re.search(r'China Consumer|Expert Call Takeaways',name,re.I):return 'reports'
 return 'minutes' if re.search(r'交流|纪要|电话会|调研|闭门',name) else 'reports'

def catalog_for_window(library,start,end):
 current=attachment_catalog(library,start,end)
 if current['coverageStatus']=='complete' or scan_updated_after_four(current.get('scan'),end):return current
 scans=[library.get('attachmentScan') or {}]
 # A newer narrow scan does not invalidate an older completed historical scan.
 folder=ROOT/'data/daily/resources'
 for path in sorted(folder.glob('*.json'),reverse=True):
  saved=json.loads(path.read_text()).get('attachmentCatalog',{})
  scan=saved.get('scan')
  if not scan:continue
  scans.extend(saved.get('coverageScans') or [{**scan,'receiptFile':saved.get('scanReceiptFile') or str(path.relative_to(ROOT))}])
  candidate=attachment_catalog({**library,'attachmentScan':scan},start,end)
  if candidate['coverageStatus']=='complete':
   candidate['scanReceiptFile']=str(path.relative_to(ROOT))
   candidate['usedHistoricalScan']=True
   return candidate
 unique={json.dumps(s,sort_keys=True,ensure_ascii=False):s for s in scans}
 combined=attachment_catalog({**library,'attachmentScans':list(unique.values())},start,end)
 if combined['coverageStatus']=='complete':
  combined['usedHistoricalScan']=True
  return combined
 return current
def build(date,cutoff=None):
 editorial_path=ROOT/'data/daily/onepage'/f'{date}.json'
 if not editorial_path.exists():editorial_path=ROOT/'data/daily/drafts'/f'{date}.json'
 editorial=json.loads(editorial_path.read_text())
 end=stamp(cutoff or editorial['cutoff']);start=stamp(editorial.get('windowStart')) or stamp(editorial['cutoff'])-dt.timedelta(hours=window_hours(stamp(editorial['cutoff'])))
 assert end.date().isoformat()==date and end>start
 groups={'segments':[],'minutes':[],'audio':[],'reports':[]};seen=set()
 for db,file in [('views','商社-市场观点.csv'),('all_views','全部-市场观点.csv')]:
  with (ROOT/'data'/file).open(encoding='utf-8-sig') as f:base=list(csv.DictReader(f))
  for r in merge_rows(archive_rows(ROOT,db,base),update_rows(ROOT,db)):
   body=r.get('内容','');title=title_for(r.get('标题',''),body);when=published_for(r);sector=sector_for(title,body)
   if not sector or not within(when,start,end) or not substantive_segment(title,body):continue
   url=r.get('原文链接','');identity=re.sub(r'\s','',body)
   if identity in seen or url in seen:continue
   seen.update([identity,url]);groups['segments'].append({'title':title,'publishedAt':stamp(when).isoformat(),'sector':sector,'url':url})
 library=json.loads((ROOT/'data/research/library.json').read_text());seen_files=set()
 for r in library.get('records',[]):
  if not within(r.get('published'),start,end) or not allowed_attachment(r):continue
  key=r.get('fileId') or r.get('sha256') or filename_key(r['name'])
  if key in seen_files or filename_key(r['name']) in seen_files:continue
  seen_files.update([key,filename_key(r['name'])]);kind=attachment_kind(r)
  groups[kind].append({'id':r['id'],'title':r['name'],'publishedAt':stamp(r['published']).isoformat(),'url':r.get('sourceUrl',''),'status':('已转写' if r.get('processing',{}).get('textAvailable') else '未转写') if kind=='audio' else ('有正文索引' if r.get('processing',{}).get('textAvailable') else '仅标题登记'),'sector':' / '.join(r.get('sectors',[]))})
 # Preserve minute indexes absent from attachment catalogue, without downloading.
 with (ROOT/'data/商社-纪要文库.csv').open(encoding='utf-8-sig') as f:base=list(csv.DictReader(f))
 for r in merge_rows(base,update_rows(ROOT,'minutes')):
  name=r.get('文件名') or r.get('标题','');when=r.get('时间') or r.get('日期');key=filename_key(name)
  if key in seen_files or not within(when,start,end) or not sector_for(name):continue
  seen_files.add(key);kind='audio' if re.search(r'\.(mp3|m4a|wav)$',name,re.I) or '音频' in r.get('类型','') else 'minutes'
  groups[kind].append({'title':name,'publishedAt':stamp(when).isoformat(),'url':r.get('原文链接') or r.get('下载链接',''),'status':r.get('内容状态') or '仅标题登记','sector':r.get('覆盖板块','')})
 for items in groups.values():items.sort(key=lambda r:r['publishedAt'],reverse=True)
 manifest=json.loads((ROOT/'data/research/updates/manifest.json').read_text())
 return {'schemaVersion':2,'date':date,'windowStart':start.isoformat(),'cutoff':end.isoformat(),'sourceThrough':manifest.get('coverageTo'),'attachmentCatalog':catalog_for_window(library,start,end),'groups':groups,'policy':'仅依据已入库元数据列出标题、发布时间和来源主题；未下载、读取或转写附件，不把研究报告标为纪要。'}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--date',required=True);p.add_argument('--cutoff');a=p.parse_args();d=build(a.date,a.cutoff)
 out=ROOT/'data/daily/resources';out.mkdir(exist_ok=True);(out/f'{a.date}.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 print({k:len(v) for k,v in d['groups'].items()})
