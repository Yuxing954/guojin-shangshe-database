"""Import saved Choice/Miaoxiang tool receipts; does not log in or call an API."""
import argparse, json, re, hashlib, datetime
from decimal import Decimal
from pathlib import Path

COMPANIES={'锦江':'jinjiang','首旅':'btg','亚朵':'atour','华住':'hworld'}
METRICS={'营业总收入':'revenue','营业收入':'revenue','归属于母公司股东的净利润':'parent_profit','经营活动产生的现金流量净额':'operating_cf','货币资金':'monetary_funds','现金及现金等价物期末余额':'cash_equivalents','资产总计':'assets','负债合计':'liabilities'}
STOCK={'assets','liabilities','monetary_funds','cash_equivalents'}

def money(raw):
 m=re.fullmatch(r'(-?\d+(?:\.\d+)?)(亿|万)?(元|美元|港元)?',str(raw))
 if not m:return None
 factor=Decimal(100) if m[2]=='亿' else Decimal('0.01') if m[2]=='万' else Decimal('0.000001')
 return float(Decimal(m[1])*factor),'USD' if m[3]=='美元' else 'HKD' if m[3]=='港元' else 'CNY'

def report_period(label):
 year=re.search(r'20\d\d',label)
 if not year:return None
 if '年报' in label:return year[0]+'FY','年度'
 if '中报' in label:return year[0]+'H1','半年'
 return None

def dump(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main(input_dir,root):
 out=[];sources=[];keys=set()
 for file in ['a-share','us']:
  path=input_dir/f'choice-{file}-raw.json';receipt=json.loads(path.read_text(encoding='utf-8'))
  for i,table in enumerate(receipt['result']['data']):
   if '按货币' in table['sheetName']:continue
   cid=next((v for name,v in COMPANIES.items() if name in table['sheetName']),None)
   if cid is None:continue
   sid=f'choice-{file}-{i+1:02}';jumps=table.get('meta',{}).get('jumpUrlList') or [{}]
   used=False
   indicators={row[0] for row in table['items']}
   for row in table['items']:
    if row[0]=='营业收入' and '营业总收入' in indicators:continue
    metric=METRICS.get(row[0])
    if not metric:continue
    if len(row)!=len(table['columns']):raise ValueError('receipt row/column mismatch')
    for j,label in enumerate(table['columns'][1:],1):
     pf=report_period(label);parsed=money(row[j])
     if not pf or not parsed:continue
     period,frequency=pf;value,currency=parsed
     key=(cid,metric,period,currency)
     if key in keys:raise ValueError('duplicate financial series key: '+str(key))
     keys.add(key);used=True
     original_unit=re.sub(r'^-?\d+(?:\.\d+)?','',row[j])
     out.append(dict(id=sid+'-'+metric+'-'+period,companyId=cid,metric=metric,period=period,frequency=frequency,periodBasis='期末' if metric in STOCK else '全年累计' if frequency=='年度' else '上半年累计',value=value,unit='百万元',currency=currency,region='集团整体',scope='全部',mode='全部',basis='Choice财报 / 返回币种',status='transcribed',sourceId=sid,locator=table['sheetName']+' / '+row[0]+' / '+label,report=label,rawValue=row[j],originalUnit=original_unit,verification='Choice接口返回',note='仅换算为百万元单位，未转换币种或补充精度；美股返回美元，原始列报币种未确认。' if currency=='USD' else '仅换算为百万元单位；保留返回精度；独立于研究底稿。'))
   if used:sources.append(dict(id=sid,companyId=cid,file='Choice · '+table['sheetName'],relativePath='东方财富妙想 / '+receipt['tool'],provider='东方财富 Choice / 妙想',url=jumps[0].get('choiceUrl'),importedAt=receipt.get('accessedAt'),query=receipt.get('query') or '酒店公司历史年报与中报实际财务',sha256=hashlib.sha256(json.dumps(table,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),verification='直接读取Choice接口；返回展示精度，未逐项复核原公告'+('；返回美元，原始列报币种未确认' if file=='us' else ''),precision='保留接口返回值精度，不补小数'))
 parts=[]
 for i in range(0,len(out),28):
  path=f'data/companies/choice/{i//28+1:03}.json';dump(root/path,{'observations':out[i:i+28]});parts.append(path)
 dump(root/'data/companies/choice.json',dict(schemaVersion=1,updatedAt=datetime.date.today().isoformat(),sources=sources,parts=parts))
 print(json.dumps(dict(observations=len(out),sources=len(sources),companies=sorted({o['companyId'] for o in out}))))

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--input-dir',required=True,type=Path);ap.add_argument('--root',default='.',type=Path);args=ap.parse_args();main(args.input_dir,args.root)
