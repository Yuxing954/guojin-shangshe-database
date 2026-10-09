"""Collect reviewed primary demand releases; produce a review batch with byte receipts."""
import argparse, calendar, re
from html import unescape
from pathlib import Path
from gold_jewelry import request_bytes,archive,atomic_json,read_json,TableParser

def nbs_row(html, period):
    year,month=map(int,period.split('-'))
    if month<2: raise ValueError('January cannot be separated from Jan-Feb')
    text=re.sub(r'\s+','',unescape(re.sub('<[^>]+>','',html)))
    if f'{year}年' not in text or '绝对量' not in text or '亿元' not in text: raise ValueError('Wrong release or missing units')
    if not any(t in text for t in (f'{year}年{month}月份社会消费品零售总额主要数据',f'{year}年1—{month}月份社会消费品零售总额主要数据')): raise ValueError('Release period mismatch')
    parser=TableParser();parser.feed(html)
    # Releases repeat the same table for desktop/mobile. Conflicting duplicates fail.
    rows=list(dict.fromkeys(tuple(re.sub(r'\s+','',v) for v in r) for r in parser.rows if r and re.sub(r'\s+','',r[0])=='金银珠宝类'))
    if len(rows)!=1: raise ValueError('Ambiguous national jewelry row')
    values=[float(v.replace(',','').strip()) for v in rows[0][1:]]
    if len(values)!=(2 if month==2 else 4): raise ValueError('Unexpected current/YTD columns')
    end=f'{year}-{month:02d}-{calendar.monthrange(year,month)[1]}'
    return dict(period=period,periodStart=f'{year}-01-01' if month==2 else f'{year}-{month:02d}-01',periodEnd=end,basis='jan_feb' if month==2 else 'monthly',amount=values[0],yoy=values[1],ytdAmount=values[0] if month==2 else values[2],ytdYoy=values[1] if month==2 else values[3],unit='亿元',scope='全国限额以上单位金银珠宝类',quality='primary')

def cga_row(html,period):
    year,q=period.split('-Q');year=int(year);q=int(q)
    text=re.sub(r'\s+','',unescape(re.sub('<[^>]+>','',html)))
    if q not in (1,2,3,4): raise ValueError('Wrong quarter')
    label={1:'一季度',2:'上半年',3:'前三季度',4:''}[q]
    context=re.search(re.escape(f'{year}年{label}')+r'，(?:全国|我国)黄金消费量[\d,.]+吨[^。]*。其中[：:](.{1,500})',text)
    if not context: raise ValueError('Wrong consumption period or scope')
    text=context.group(1)
    values={}; changes={}
    for field,label in [('jewelry','黄金首饰'),('bars','金条及金币'),('industrial','工业及其他用金')]:
        hits=re.findall(re.escape(label)+r'([\d,.]+)吨，同比(增长|下降)([\d.]+)%',text)
        unique=set(hits)
        if len(unique)!=1: raise ValueError('Missing or ambiguous CGA category')
        v,sign,yoy=unique.pop();values[field]=float(v.replace(',',''));changes[field]=float(yoy)*(1 if sign=='增长' else -1)
    end=f'{year}-{q*3:02d}-{calendar.monthrange(year,q*3)[1]}'
    return dict(period=period,year=year,quarter=q,periodStart=f'{year}-01-01',periodEnd=end,basis='cumulative',unit='吨',scope='中国黄金协会全国黄金消费量',quality='primary',values=values,yoy=changes)

def collect(manifest,raw_dir):
    out={'schemaVersion':1,'checkedAt':manifest['checkedAt'],'retail':[],'consumption':[],'sources':[],'failures':[]}
    for s in manifest['sources']:
        try:
            raw=request_bytes(s['url']);html=raw.decode('utf-8-sig');row=(nbs_row if s['type']=='nbs' else cga_row)(html,s['period'])
            path=archive(raw,{'url':s['url'],'period':s['period']},raw_dir)
            source={**s,'quality':'primary','sha256':path.stem,'capturedDate':manifest['checkedAt']}
            row['sourceId']=s['id'];out['sources'].append(source);out['retail' if s['type']=='nbs' else 'consumption'].append(row)
        except Exception as e: out['failures'].append({'sourceId':s['id'],'errorType':type(e).__name__})
    return out

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--manifest',type=Path,required=True);ap.add_argument('--raw-dir',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);args=ap.parse_args()
    out=collect(read_json(args.manifest),args.raw_dir);atomic_json(args.out,out)
    print('Review batch: %d retail periods, %d consumption periods, %d failures. No canonical import.'%(len(out['retail']),len(out['consumption']),len(out['failures'])))
    raise SystemExit(2 if out['failures'] else 0)
