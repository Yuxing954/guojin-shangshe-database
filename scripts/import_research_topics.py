import sys,json,csv,re,datetime,collections,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
ap=argparse.ArgumentParser(description='Import connector topic pages into immutable research batches')
ap.add_argument('--topics-dir',required=True)
ap.add_argument('--since',required=True,help='YYYY-MM-DD; pages must reach this date')
ap.add_argument('--batch-date',default=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat())
args=ap.parse_args()
datetime.date.fromisoformat(args.since)
datetime.date.fromisoformat(args.batch_date)
HERE=Path(args.topics_dir).resolve()
sys.path.insert(0,str(ROOT/'update'))
sys.path.insert(0,str(ROOT/'scripts'))
from clean_text import normalize_content,make_title
from segment_filter import classify
from research_sources import merge_rows
cfg=json.loads((ROOT/'update/config.json').read_text(encoding='utf-8'))
cfg['pool'].append('东方甄选')
topics={}
for path in sorted(HERE.glob('page-*.json')):
    for t in json.loads(path.read_text(encoding='utf-8')):
        if str((t.get('group') or {}).get('group_id')) != cfg['group_id']:
            raise ValueError('Topic belongs to a different source group')
        topics[str(t['topic_id'])]=t
rows={'views':[],'all_views':[],'minutes':[]}; rejected=collections.Counter()
def hits(text):
    def match(k):
        if k=='好未来':return bool(re.search(r'(?<![看美])好未来',text))
        if k=='中国黄金':return bool(re.search(r'中国黄金(?!周)',text))
        return bool(re.search(r'(?<![A-Za-z])'+re.escape(k)+r'(?![A-Za-z])',text,re.I)) if k.isascii() else k in text
    return [k for k in cfg['pool'] if match(k)]
for tid,t in topics.items():
    if t['create_time'][:10]<args.since:continue
    talk=t.get('talk') or t.get('article') or {}
    body=normalize_content(talk.get('text') or t.get('text') or '')
    title=normalize_content(t.get('title') or '') or make_title(body,100)
    if title.endswith(('...','…')):
        full_title=make_title(body,100)
        if len(full_title)<8:full_title=make_title(' '.join(body.splitlines()[:2]),100)
        title=full_title or title
    files=talk.get('files') or t.get('files') or []
    names=[f.get('name','') for f in files]
    h=hits(title+'\n'+body)
    stamp=t['create_time'][:19]
    url='https://wx.zsxq.com/group/'+cfg['group_id']+'/topic/'+tid
    ok,reason=classify(title,body,{'files':files,'images':talk.get('images',[])})
    # Attachment titles are indexed as minutes; never pretend they are prose.
    if files and len(body)<150: ok=False;reason='附件标题'
    if ok:
        row={'时间':stamp,'月份':stamp[:7],'标题':title,'内容':body,'作者':(talk.get('owner') or {}).get('name',''),'命中关键词':'|'.join(h),'点赞':str(t.get('likes_count',0)),'评论':str(t.get('comments_count',0)),'阅读':str(t.get('readers_count',0)),'原文链接':url}
        relevant=any(k not in cfg['generic'] for k in h) or any(k in title for k in h) or any(k in title for k in ['文旅','社服','社零','商社','茶饮','珠宝'])
        if h and relevant and not (any(w in title for w in cfg['noise_title_words']) and all(k in cfg['generic'] for k in h)):rows['views'].append(row)
        else:rows['all_views'].append(row)
    else:rejected[reason]+=1
    mh=hits(title+'\n'+'\n'.join(names))
    meeting=any(w in title+' '.join(names) for w in ['纪要','交流','调研','业绩会','电话会','闭门会'])
    kept=[n for n in names if re.search(r'\.(pdf|docx?|mp3|m4a|wav)$',n,re.I) and (hits(n) or hits(title)) and (any(w in n+' '+title for w in ['纪要','交流','调研','业绩会','电话会','闭门会']) or re.search(r'\.(mp3|m4a|wav)$',n,re.I))]
    mh=hits(title+'\n'+'\n'.join(kept))
    if mh and kept:
        audio=not any(re.search(r'\.(pdf|docx?)$',n,re.I) for n in kept)
        state='会议音频，未转写' if audio else '附件索引，正文未提取'
        minute_title=make_title('；'.join(kept),100) if not hits(title) else title
        rows['minutes'].append({'日期':stamp[:10],'时间':stamp,'类型':'会议音频' if audio else '研究附件','标题':minute_title,'摘要':state+'。文件：'+'；'.join(kept),'相关标的':'|'.join(k for k in mh if k not in cfg['generic']),'下载链接':url,'原文链接':url,'文件名':'；'.join(kept),'覆盖板块':'|'.join(k for k in mh if k in cfg['generic']),'内容状态':state})
out=ROOT/'data/research/updates';out.mkdir(parents=True,exist_ok=True)
if not topics:raise ValueError('No topic pages found')
if min(t['create_time'] for t in topics.values())[:10]>args.since:raise ValueError('Incomplete pagination: fetch pages back to --since first')
previous=json.loads((out/'manifest.json').read_text(encoding='utf-8')) if (out/'manifest.json').exists() else {}
if previous and previous['coverageTo'][:10]<args.since:raise ValueError('Date gap: --since must overlap the previous coverage')
manifest={'syncedAt':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(timespec='seconds'),'sourceGroup':cfg['group_id'],'sourceName':cfg['group_name'],'coverageFrom':args.since,'coverageTo':max(t['create_time'] for t in topics.values()),'oldestFetched':min(t['create_time'] for t in topics.values()),'fetchedTopics':len(topics),'files':{},'counts':{},'latest':{},'excluded':dict(rejected)}
for kind,records in rows.items():
    records=merge_rows([],records);manifest['counts'][kind]=len(records);manifest['latest'][kind]=max((r.get('时间') or r.get('日期') for r in records),default='');manifest['files'][kind]=[]
    # Small immutable files are compatible with the connector and lazy reading.
    batches=[];batch=[];chars=0
    for r in records:
        n=sum(len(str(v)) for v in r.values())
        if batch and chars+n>100000:batches.append(batch);batch=[];chars=0
        batch.append(r);chars+=n
    if batch:batches.append(batch)
    for i,batch in enumerate(batches):
        path='data/research/updates/'+args.batch_date+'-'+kind+'-'+str(i+1).zfill(3)+'.csv'
        for r in batch:r['更新批次']=path
        with (ROOT/path).open('w',encoding='utf-8-sig',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=list(batch[0]));writer.writeheader();writer.writerows(batch)
        manifest['files'][kind].append(path)
manifest['assignedTopics']={kind:list(dict.fromkeys(re.search(r'/topic/(\d+)',r['原文链接']).group(1) for r in rows[kind])) for kind in ('views','all_views')}
current_ids={tid for tid,t in topics.items() if t['create_time'][:10]>=args.since}
for kind in ('views','all_views'):
    manifest['assignedTopics'][kind]+= [tid for tid in previous.get('assignedTopics',{}).get(kind,[]) if tid not in current_ids]
for kind in rows:
    manifest['files'][kind]+=[f for f in previous.get('files',{}).get(kind,[]) if not Path(f).name.startswith(args.batch_date+'-')]
manifest['coverageFrom']=min(args.since,previous.get('coverageFrom',args.since))
manifest['coverageTo']=max(manifest['coverageTo'],previous.get('coverageTo',''))
manifest['oldestFetched']=min(manifest['oldestFetched'],previous.get('oldestFetched',manifest['oldestFetched']))
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
from research_sources import update_rows
for kind in rows:
    merged=update_rows(ROOT,kind)
    manifest['counts'][kind]=len(merged)
    manifest['latest'][kind]=max((r.get('时间') or r.get('日期') for r in merged),default='')
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:manifest[k] for k in ['counts','latest','oldestFetched','fetchedTopics']},ensure_ascii=False))
