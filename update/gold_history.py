"""Collect dated SGE and third-party brand history into a review batch, never auto-publish."""
import argparse
from datetime import date,timedelta
from html import unescape
from pathlib import Path
import re
from gold_jewelry import request_bytes,archive,atomic_json,TableParser,positive

BRAND_PATHS={'ctf':'chowtaifook','lfx':'laofengxiang','zlf':'zhouliufu','css':'chowsangsang','cds':'chowtaiseng','lukfook':'lukfook','laomiao':'laomiao','caibai':'caibai','3dgold':'3d-gold','chj':'chj'}

def sge_rows(html,trade_date):
    parser=TableParser();parser.feed(html)
    headers=next((r for r in parser.rows if all(x in r for x in ('日期','合约','收盘价','加权平均价'))),None)
    if not headers: raise ValueError('SGE headings missing')
    indices=[headers.index(x) for x in ('日期','合约','收盘价','加权平均价')]
    matches=[r for r in parser.rows if len(r)>max(indices) and r[indices[0]]==trade_date and r[indices[1]]=='Au99.99']
    if not matches: return []  # No returned observation; never label this as a confirmed holiday.
    if len(matches)!=1: raise ValueError('Ambiguous SGE observation')
    out=[]
    for kind,index in zip(('close','weighted_average'),indices[2:]):
        value=float(matches[0][index].replace(',',''))
        if not positive(value): raise ValueError('Missing SGE price')
        out.append((kind,value))
    return out

def brand_rows(html):
    out=[]
    for item in re.findall(r'<li\b[^>]*>(.*?)</li>',html,flags=re.S|re.I):
        value=re.search(r'<div class="new">\s*<span[^>]*>([\d,.]+)</span>元/克',item)
        stamp=re.search(r'<div class="time">(\d{4}-\d{2}-\d{2})</div>',item)
        if value and stamp: out.append((stamp[1],float(value[1].replace(',',''))))
    if not out: raise ValueError('Dated brand quote list missing')
    if len({d for d,v in out})!=len(out): raise ValueError('Duplicate brand quote dates')
    return out

def source(sid,url,raw,raw_dir,kind,name,as_of):
    path=archive(raw,{'url':url,'captureMethod':'original_http_response'},raw_dir)
    return {'id':sid,'name':name,'provider':name,'kind':kind,'url':url,'capturedDate':as_of,'publishedAt':None,'captureMethod':'original_http_table','sha256':path.stem,'rawArchive':None,'note':'原始HTTP响应归档在仓库之外；仅转录明确日期与字段，不填补缺日。'}

def collect(start,end,raw_dir):
    batch={'checkedAt':end,'sources':[],'benchmarks':[],'quotes':[],'collectionChecks':[]}
    cursor=date.fromisoformat(start)
    while cursor<=date.fromisoformat(end):
        d=cursor.isoformat();cursor+=timedelta(days=1)
        url=f'https://www.sge.com.cn/sjzx/quotation_daily_new?end_date={d}&start_date={d}'
        try:
            raw=request_bytes(url);rows=sge_rows(raw.decode('utf-8-sig'),d)
            s=source('sge-history-'+d,url,raw,raw_dir,'primary','上海黄金交易所·每日行情',end)
            if rows:
                batch['sources'].append(s)
                for kind,value in rows: batch['benchmarks'].append({'id':s['id']+'-'+kind,'instrument':'Au99.99','quoteDate':d,'quoteTime':None,'market':'CN','currency':'CNY','unit':'CNY/g','purity':0.9999,'priceType':kind,'price':value,'sourceId':s['id'],'verification':'primary'})
            batch['collectionChecks'].append({'date':d,'status':'observed' if rows else 'no_returned_observation','sha256':s['sha256']})
        except Exception as exc: batch['collectionChecks'].append({'date':d,'status':'fetch_or_parse_failed','errorType':type(exc).__name__})
    for brand,path in BRAND_PATHS.items():
        url=f'https://www.jinjia.com.cn/{path}/'
        try:
            raw=request_bytes(url);rows=brand_rows(raw.decode('utf-8-sig'))
            s=source('jinjia-history-'+brand+'-'+end,url,raw,raw_dir,'aggregator','金价网·'+brand+'历史报价',end)
            batch['sources'].append(s)
            for d,value in rows:
                if start<=d<=end:
                    batch['quotes'].append({'id':s['id']+'-'+d,'brandId':brand,'quoteDate':d,'quoteTime':None,'market':'CN','city':None,'currency':'CNY','unit':'CNY/g','product':'gold_ornament','priceBasis':'posted_per_gram','purity':None,'includesLabor':None,'includesTax':None,'price':value,'sourceId':s['id'],'verification':'pending_primary'})
            batch['collectionChecks'].append({'brandId':brand,'status':'third_party_observed','rows':len(rows)})
        except Exception as exc: batch['collectionChecks'].append({'brandId':brand,'status':'fetch_or_parse_failed','errorType':type(exc).__name__})
    return batch

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    for field in ('start','end'): ap.add_argument('--'+field,required=True)
    ap.add_argument('--raw-dir',type=Path,required=True);ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    if date.fromisoformat(args.end)<date.fromisoformat(args.start) or (date.fromisoformat(args.end)-date.fromisoformat(args.start)).days>62: ap.error('Use a valid batch of at most 63 days')
    result=collect(args.start,args.end,args.raw_dir);atomic_json(args.out,result)
    print('Review batch saved: %d benchmarks, %d third-party quotes; canonical data unchanged.'%(len(result['benchmarks']),len(result['quotes'])))
