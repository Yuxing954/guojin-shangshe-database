#!/usr/bin/env python3
"""Build a dated 16:00 Asia/Shanghai digest; see docs/daily-report.md."""
import argparse, csv, datetime as dt, hashlib, json, re, subprocess
from pathlib import Path
from research_sources import merge_rows, update_rows, archive_rows
ROOT=Path(__file__).resolve().parent.parent
TZ=dt.timezone(dt.timedelta(hours=8))

def stamp(value):
    try:
        d=dt.datetime.fromisoformat(str(value).replace('Z','+00:00'))
        return d.replace(tzinfo=TZ) if d.tzinfo is None else d.astimezone(TZ)
    except (ValueError,TypeError): return None

def inside(value,end,hours):
    t=stamp(value)
    return t is not None and end-dt.timedelta(hours=hours)<t<=end

def read(path,default=None):
    p=ROOT/path
    return json.loads(p.read_text()) if p.exists() else default

def git(*args):
    return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()

def score(title,body):
    return sum(3 for x in ['业绩','经营','同店','门店','利润','收入','政策','数据','重要','国庆','免税','酒店','消费'] if x in title)+min(4,len(re.findall(r'\d+(?:\.\d+)?%',body)))

def research(end):
    result={'briefs':[],'views':[]}; seen=set(); excluded=0
    for db,file,kind in [('views','商社-市场观点.csv','briefs'),('all_views','全部-市场观点.csv','views')]:
        with (ROOT/'data'/file).open(encoding='utf-8-sig') as f: base=list(csv.DictReader(f))
        for r in merge_rows(archive_rows(ROOT,db,base),update_rows(ROOT,db)):
            when=r.get('时间',''); body=r.get('内容','').strip(); title=r.get('标题','').strip()
            if not inside(when,end,24): continue
            if len(when)<=10 or len(body)<80 or not title:
                excluded+=1; continue
            key=hashlib.sha256(re.sub(r'\s','',body).encode()).hexdigest()
            if key in seen: continue
            seen.add(key)
            result[kind].append({'id':key[:16],'title':title,'body':body,'publishedAt':stamp(when).isoformat(),'source':'研究观点原文','url':r.get('原文链接',''),'score':score(title,body)})
    for k in result: result[k]=sorted(result[k],key=lambda r:(r['score'],r['publishedAt']),reverse=True)[:12]
    return result,excluded

def numeric_candidates(payload,path):
    out={}
    if path.endswith('automatic-series.json'):
        for key,s in payload.get('series',{}).items():
            if not (key.startswith('consumer-') or key in ('cn-cpi','cn-retail','cn-disposable-income')): continue
            obs=[r for r in s.get('observations',[]) if r.get('value') is not None]
            if not obs: continue
            r=max(obs,key=lambda x:x['period']); meta=s.get('spec',{})
            out[key]={'title':meta.get('name') or meta.get('definition') or key,'value':r['value'],'unit':meta.get('unit',s.get('unit','')),'period':r['period'],'publishedAt':r.get('releaseDate'),'source':s.get('sourceOrganization','Choice'),'url':s.get('sourceUrl','consumption-macro.html'),'basis':meta.get('definition','')}
    elif path.endswith('observations.json'):
        sources={s['id']:s for s in payload.get('sources',[])}
        for m in payload.get('indicators',[]):
            obs=[r for r in payload.get('observations',[]) if r.get('indicatorId')==m['id'] and r.get('value') is not None]
            if not obs: continue
            r=max(obs,key=lambda x:x.get('endDate',x.get('period',''))); s=sources.get(r.get('sourceId'),{})
            out[m['id']]={'title':m['name'],'value':r['value'],'unit':m.get('unit',''),'period':r['period'],'publishedAt':s.get('publishedAt'),'source':s.get('publisher','原始数据'),'url':s.get('url','consumption-macro.html'),'basis':r.get('basis',''),'change':r.get('yoy')}
    else:
        for r in payload.get('industries',[]):
            out[r['id']]={'title':r['name']+' · '+r['metric'],'value':r['value'],'unit':r['unit'],'period':r['period'],'source':r['source'],'url':r['href'],'change':r.get('change'),'basis':r.get('changeLabel','')}
    return out

def important_data(end):
    start=end-dt.timedelta(hours=72); out=[]; seen=set()
    for path in ['data/home-snapshot.json','data/consumption-macro/observations.json','data/macro/automatic-series.json']:
        # Compare content at the cutoff with content before the window, not file mtime/check time.
        head=git('log','-1','--format=%H','--before='+end.isoformat(),'--',path)
        old=git('log','-1','--format=%H','--before='+start.isoformat(),'--',path)
        if not head: continue
        current=numeric_candidates(json.loads(git('show',head+':'+path)),path)
        previous=numeric_candidates(json.loads(git('show',old+':'+path)),path) if old else {}
        for key,r in current.items():
            before=previous.get(key,{})
            if all(r.get(k)==before.get(k) for k in ['value','period','change']): continue
            identity=(r['title'],r['period'],str(r['value']))
            if identity in seen: continue
            seen.add(identity)
            r.update(id=path+':'+key,updatedAt=git('show','-s','--format=%cI',head),sourceFile=path,updateType='新增入库' if not before else '数据更新')
            out.append(r)
    return sorted(out,key=lambda r:score(r['title'],''),reverse=True)[:30]

def build(end):
    sections,excluded=research(end); sections['data']=important_data(end)
    feed=read('data/daily/news.json',{'items':[]}); news=[]; seen=set()
    for r in feed.get('items',[]):
        if not r.get('verified') or len(r.get('publishedAt',''))<=10 or not inside(r.get('publishedAt'),end,24): continue
        if not r.get('url','').startswith('https://') or r['url'] in seen: continue
        seen.add(r['url']); news.append(r)
    sections['news']=sorted(news,key=lambda r:(r.get('importance',0),r['publishedAt']),reverse=True)[:12]
    return {'schemaVersion':1,'date':end.date().isoformat(),'cutoff':end.isoformat(),'generatedAt':dt.datetime.now(TZ).isoformat(timespec='seconds'),'sections':sections,'coverage':{'researchSourceTo':read('data/research/updates/manifest.json',{}).get('coverageTo'),'newsCheckedAt':feed.get('checkedAt'),'newsStatus':feed.get('status','未核验'),'excludedResearchRows':excluded},'notes':['重要数据按截点前72小时已提交数值/统计期变化筛选；入库更新不等同于新披露，最多30项。','段子、市场观点按原始发布时间筛选24小时，按经营/业绩/数据关键词排序，各取12条；保留原文，不将观点改写为新闻。','新闻仅收录已核验原文、分钟级发布时间及来源链接的记录；空栏不代表市场没有新闻。','每日16:00北京时间截点；自动任务启动、检索和发布可能延迟。']}

def main():
    p=argparse.ArgumentParser();p.add_argument('--date'); a=p.parse_args(); now=dt.datetime.now(TZ)
    end=dt.datetime.combine(dt.date.fromisoformat(a.date) if a.date else now.date(),dt.time(16),TZ)
    if not a.date and now<end:end-=dt.timedelta(days=1)
    report=build(end); folder=ROOT/'data/daily';folder.mkdir(exist_ok=True)
    for name in [report['date']+'.json','latest.json']:(folder/name).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    dates=sorted([p.stem for p in folder.glob('????-??-??.json')],reverse=True)
    (folder/'index.json').write_text(json.dumps({'dates':dates},ensure_ascii=False,indent=2)+'\n')
    print({k:len(v) for k,v in report['sections'].items()})
if __name__=='__main__': main()
