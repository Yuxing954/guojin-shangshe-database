"""One reviewed Choice receipt -> all offshore duty-free monthly views; no Git writes."""
from __future__ import annotations
import argparse,copy,csv,hashlib,io,json,math,os,re,sys,tempfile,time
from datetime import date,datetime,timezone
from pathlib import Path
from urllib.parse import parse_qs,urlparse

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from import_miaoxiang_industry import normalize_reply
from dutyfree_yoy import fill_yoy

VALUES={'dutyfree_sales':'shopping_sales_cny_100m','dutyfree_shoppers':'shoppers_10k','dutyfree_items':'items_10k'}
NAMES={'海南:离岛免税购物:金额(元)','海南:离岛免税购物:人次(人次)','海南:离岛免税购物:件数(件)'}
CODES={'EMM01500925','EMM01500926','EMM01500927'}
def read(root,path):return json.loads((root/path).read_text(encoding='utf-8-sig'))
def rows(root):
    with (root/'data/dutyfree_monthly.csv').open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def number(value):
    if value in ('',None):return None
    n=float(value)
    if not math.isfinite(n):raise ValueError('非有限数值')
    return n
def dump(value,compact=False):return json.dumps(value,ensure_ascii=False,indent=None if compact else 2,separators=(',',':') if compact else None)+'\n'
def query_for(period):return f'海关总署海南离岛免税购物月度数据，{period}，仅购物金额（元）、购物人次（人次）、购物件数（件）。保留完整指标名、来源、原始精度及Choice代码链接；非累计、非含税营业额，不以预测或假期替代整月，未发布留空。'
def known(root,period):return any(r['period_id']==period for r in rows(root))
def check(root):
    data=rows(root);periods=[r['period_id'] for r in data]
    if periods!=sorted(set(periods)):raise ValueError('月份乱序或重复')
    latest=data[-1];period=latest['period_id'];overview=read(root,'data/industry/overview.json')
    metrics={m['id']:m for s in overview['sectors'] if s['id']=='dutyfree' for m in s['metrics']}
    for mid,field in VALUES.items():
        point=next((p for p in metrics[mid]['points'] if p['period']==period),None)
        if not point or not math.isclose(point['value'],number(latest[field]),abs_tol=1e-8):raise ValueError('CSV与行业快照不一致')
    shoppers=number(latest['shoppers_10k']);spend=number(latest['spend_per_shopper_cny'])
    if shoppers and (spend is None or abs(spend-number(latest['shopping_sales_cny_100m'])/shoppers*10000)>.00001):raise ValueError('每人次金额口径不一致')
    return {'period':period,'rows':len(data),'valid':True}

def refresh(root,period,receipt,*,query=None,retrieved_at=None,as_of=None):
    """Validate everything before writing; history and unrelated sectors are immutable."""
    started=time.monotonic();root=Path(root);day=as_of or date.today()
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',period) or period>=day.strftime('%Y-%m'):raise ValueError('仅可更新已结束的月份')
    history=rows(root)
    if any(r['period_id']==period for r in history):return {'noChange':True,'period':period,'reason':'月份已收录，未请求数据'}
    if period<=history[-1]['period_id']:raise ValueError('历史补录需单独复核')
    # Reject a skipped month, rather than silently creating a new history gap.
    y,m=map(int,history[-1]['period_id'].split('-'));following=f'{y+1 if m==12 else y}-{1 if m==12 else m+1:02d}'
    if period!=following:raise ValueError('须先补齐紧邻月份')
    raw=receipt if isinstance(receipt,bytes) else json.dumps(receipt,ensure_ascii=False).encode()
    envelope=json.loads(raw);result=envelope.get('result',envelope)
    if result.get('isError'):raise ValueError('来源返回错误')
    stamp=envelope.get('retrievedAt') or retrieved_at or datetime.now(timezone.utc).isoformat(timespec='seconds')
    parsed=datetime.fromisoformat(stamp.replace('Z','+00:00'))
    if parsed.tzinfo is None or parsed>datetime.now(timezone.utc):raise ValueError('获取时间异常')
    query=envelope.get('query') or query or query_for(period);digest=hashlib.sha256(raw).hexdigest();clean=copy.deepcopy(result);matched=set()
    for block in clean.get('content',[]):
        if block.get('type')!='text':continue
        body=json.loads(block['text'])
        for table in body.get('data',[]):
            columns=table.get('columns',[])
            if not columns or columns[0]!='宏观数据（月）' or period not in columns[2:]:continue
            urls=[x.get('choiceUrl','') for x in table.get('meta',{}).get('jumpUrlList',[])]
            approved=False
            for url in urls:
                u=urlparse(url);codes=set(parse_qs(u.fragment.split('?',1)[-1]).get('macroids',[''])[0].split(','))
                approved|=u.scheme=='https' and u.hostname=='choicew2z.eastmoney.com' and CODES<=codes
            if not approved:raise ValueError('来源代码或域名变化，需复核')
            for r in table.get('items',[]):
                if not r or r[0] not in NAMES:continue
                if r[0] in matched or r[1]!='海关总署' or len(r)!=len(columns):raise ValueError('指标身份、频率或行列变化')
                matched.add(r[0])
                # The legacy importer treats numeric 0 as absent; preserve actual zero here.
                for i in range(2,len(r)):
                    if isinstance(r[i],bool):raise ValueError('布尔数值异常')
                    if isinstance(r[i],(int,float)):r[i]=str(r[i])
        block['text']=json.dumps(body,ensure_ascii=False)
    if matched!=NAMES:raise ValueError('来源未提供完整三项月度指标')
    observations,sources=normalize_reply({'id':'dutyfree','retrieved_at':stamp,'query':query,'result':clean})
    new=[r for r in observations if r['period']==period]
    if len(new)!=3 or {r['metricId'] for r in new}!=set(VALUES):raise ValueError('当月原始值不完整，保留原数据')
    for r in new:
        bound={'dutyfree_sales':1000,'dutyfree_shoppers':1000,'dutyfree_items':20000}[r['metricId']]
        if not math.isfinite(r['value']) or not 0<=r['value']<=bound:raise ValueError('指标数量级异常，需复核')
    for s in sources:s['receiptSha256']=digest
    payload=read(root,'data/industry/overview.json');sector=next(s for s in payload['sectors'] if s['id']=='dutyfree')
    selected={};new_source={r['metricId']:r['sourceId'] for r in new}
    import calendar
    def point(r):return {'startDate':period+'-01','endDate':period+f'-{calendar.monthrange(int(period[:4]),int(period[5:]))[1]}','periodLabel':f'{int(period[:4])}年{int(period[5:])}月',**r}
    for r in new:selected[r['metricId'],period]=point(r)
    sales=selected['dutyfree_sales',period];shoppers=selected['dutyfree_shoppers',period]
    spend=sales['value']/shoppers['value']*10000 if shoppers['value']>0 else None
    if spend is not None:selected['dutyfree_spend',period]={**sales,'metricId':'dutyfree_spend','value':spend,'quality':'derived','inputs':[sales['sourceId'],shoppers['sourceId']]};selected['dutyfree_spend',period].pop('rawValue',None)
    prior=f'{int(period[:4])-1}{period[4:]}'
    for metric in sector['metrics']:
        for p in metric['points']:
            if p['period']==period:raise ValueError('快照与CSV月份不同步，需复核')
            if p['period']==prior:selected[metric['id'],prior]=copy.deepcopy(p)
    fill_yoy(selected)
    for metric in sector['metrics']:
        p=selected.get((metric['id'],period))
        if p:metric['points'].append(p)
    payload['sources'].extend(sources);payload['sources']=sorted(payload['sources'],key=lambda s:s['id'])
    sector['sourceIds']=sorted({p['sourceId'] for m in sector['metrics'] for p in m['points']});payload['generatedAt']=stamp
    headers=list(history[0]);row={k:'' for k in headers}
    fmt=lambda v:'' if v is None else f'{v:.6f}'.rstrip('0').rstrip('.')
    row.update(period_id=period,year=period[:4],month=str(int(period[5:])),source='海关总署 · 东方财富Choice；'+sources[0]['url'])
    for mid,field in VALUES.items():
        v=selected[mid,period]['value'];row[field]=str(int(v)) if float(v).is_integer() else str(v)
    row.update(spend_per_shopper_cny=fmt(spend),items_per_shopper=fmt(selected['dutyfree_items',period]['value']/shoppers['value'] if shoppers['value'] else None),unit_price_cny=fmt(sales['value']/selected['dutyfree_items',period]['value']*10000 if selected['dutyfree_items',period]['value'] else None))
    output={};buf=io.StringIO(newline='');csv.writer(buf,lineterminator='\n').writerow([row[k] for k in headers]);output['data/dutyfree_monthly.csv']=(root/'data/dutyfree_monthly.csv').read_text(encoding='utf-8-sig').rstrip('\n')+'\n'+buf.getvalue()
    output[f'data/industry/miaoxiang-{day.isoformat()}-dutyfree-{period}.json']=dump({'version':1,'generatedAt':stamp,'sources':sources,'records':new,'attempts':[{'id':'dutyfree','tool':'mx_macro_data','retrievedAt':stamp,'query':query,'acceptedRecords':3,'receiptSha256':digest}]})
    output['data/industry/overview.json']=dump(payload,True)
    calc=read(root,'data/dutyfree/monthly-calculations.json');calc['records']=[p['changeCalculation'] for m in sector['metrics'] for p in m['points'] if p.get('changeMethod')=='calculated'];output['data/dutyfree/monthly-calculations.json']=dump(calc,True)
    provenance=read(root,'data/dutyfree/monthly-provenance.json');provenance.setdefault('supplements',[]).append({'period':period,'sourceId':'choice-dutyfree-'+period.replace('-',''),'sourceType':'东方财富Choice转引海关总署','sourceUrl':sources[0]['url'],'retrievedAt':stamp,'publishedAt':None,'receiptSha256':digest,'observations':new,'growthBasis':'使用保留的上年同月原始基期计算，不替换历史原值；同比为计算值。','missing':['tourists_10k','tourists_yoy_pct','conversion_rate_pct','publishedAt']});provenance['totalRecordCount']=len(history)+1;output['data/dutyfree/monthly-provenance.json']=dump(provenance)
    overview=read(root,'data/dutyfree/overview.json');overview['updatedAt']=day.isoformat();overview['note']='原Excel历史 / Choice月度补充；每人次金额及同比为计算值，来源日期未知留空。'
    for kpi in overview['kpis']:
        mid={'hainan_sales':'dutyfree_sales','hainan_shoppers':'dutyfree_shoppers','hainan_items':'dutyfree_items','hainan_spend':'dutyfree_spend'}[kpi['key']];p=selected.get((mid,period),{});kpi.update(period=period,value=round(p['value'],0 if mid=='dutyfree_spend' else 2) if 'value' in p else None,yoy=p.get('change'),source='choice-dutyfree-'+period.replace('-',''),changeMethod='calculated')
    output['data/dutyfree/overview.json']=dump(overview)
    for name in ['hainan','manifest','sources']:
        value=read(root,f'data/dutyfree/{name}.json');value['updatedAt']=day.isoformat()
        if name=='sources':value['sources']['monthly_sources']={'sourceName':'原Excel历史 + Choice月度补充','sourceType':'原Excel / Choice转引海关总署','reportDate':None,'page':None,'url':'data/dutyfree/monthly-provenance.json','note':f'月度截至{period}；每人次金额、同比为计算值；独立发布日期未知留空。'}
        else:value['sourceNote']=f'月度截至{period}；逐期来源见monthly-provenance.json。'
        output[f'data/dutyfree/{name}.json']=dump(value)
    manifest=read(root,'data-manifest.json');manifest['updatedAt']=day.isoformat()
    for item in manifest['datasets']:
        if item['id']=='dutyfree_monthly':item.update(asOf=sales['endDate'],latestPeriod=period,rowCount=len(history)+1,updateRecord='data/dutyfree/monthly-provenance.json')
    output['data-manifest.json']=dump(manifest)
    # Write only after every check succeeds. Restore all original bytes on an I/O failure.
    original={p:(root/p).read_bytes() if (root/p).exists() else None for p in output}
    try:
        for p,text in output.items():
            target=root/p;target.parent.mkdir(parents=True,exist_ok=True)
            with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',newline='\n',dir=target.parent,delete=False) as f:f.write(text);temporary=Path(f.name)
            os.replace(temporary,target)
        check(root)
    except Exception:
        for p,raw_before in original.items():
            if raw_before is None:(root/p).unlink(missing_ok=True)
            else:(root/p).write_bytes(raw_before)
        raise
    return {'period':period,'added':3,'historicalRowsPreserved':len(history),'changedFiles':list(output),'receiptSha256':digest,'elapsedMs':round((time.monotonic()-started)*1000)}

def collect_and_apply(args,day):
    query=query_for(args.period)
    if args.fetch:
        sys.path.insert(0,str(args.root/'update'))
        from miaoxiang_mcp import Client,configured_key
        config=Path(os.getenv('CODEX_HOME') or Path.home()/'.codex')/'config.toml'
        client=Client(configured_key(config));client.initialize();result=client.rpc('tools/call',{'name':'mx_macro_data','arguments':{'query':query}})
        raw=json.dumps({'result':result,'query':query,'retrievedAt':datetime.now(timezone.utc).isoformat(timespec='seconds')},ensure_ascii=False).encode()
    else:raw=args.receipt.read_bytes()
    receipt_dir=args.root/'.cache/dutyfree-receipts';receipt_dir.mkdir(parents=True,exist_ok=True);(receipt_dir/(hashlib.sha256(raw).hexdigest()+'.json')).write_bytes(raw)
    result=refresh(args.root,args.period,raw,query=query,as_of=day)
    (args.root/'.cache/dutyfree-last-run.json').write_text(dump(result),encoding='utf-8');print(json.dumps(result,ensure_ascii=False));return 0

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--root',type=Path,default=ROOT);ap.add_argument('--period');ap.add_argument('--receipt',type=Path);ap.add_argument('--fetch',action='store_true');ap.add_argument('--check',action='store_true');args=ap.parse_args()
    if args.check:print(json.dumps(check(args.root),ensure_ascii=False));return 0
    if not args.period:ap.error('--period is required')
    from zoneinfo import ZoneInfo
    day=datetime.now(ZoneInfo('Asia/Shanghai')).date()
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',args.period) or args.period>=day.strftime('%Y-%m'):raise ValueError('仅可更新已结束的月份')
    if known(args.root,args.period):print(json.dumps({'noChange':True,'period':args.period,'noDataFetch':True}));return 0
    if args.fetch==bool(args.receipt):ap.error('choose exactly one of --fetch or --receipt')
    lock=args.root/'.cache/dutyfree-refresh.lock';lock.parent.mkdir(parents=True,exist_ok=True)
    try:fd=os.open(lock,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    except FileExistsError:print(json.dumps({'skipped':True,'activeBatch':True,'noDataFetch':True}));return 0
    try:
        with os.fdopen(fd,'w') as f:json.dump({'pid':os.getpid(),'period':args.period},f)
        if known(args.root,args.period):print(json.dumps({'noChange':True,'noDataFetch':True}));return 0
        return collect_and_apply(args,day)
    finally:lock.unlink(missing_ok=True)
if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as exc:print(json.dumps({'ok':False,'errorType':type(exc).__name__,'reason':str(exc) if isinstance(exc,ValueError) else '更新失败，保留原数据'},ensure_ascii=False));raise SystemExit(1)

