"""Import reviewed Korea duty-free receipts without refetching or changing Hainan history."""
import argparse,hashlib,json,re
from decimal import Decimal
from pathlib import Path
GROUPS={'total':'总计','domestic':'国内游客','foreign':'国外游客'}
FIELDS={'韩国:免税店顾客数:总计(人)':('total','shoppers'),'韩国:免税店顾客数:国内游客(人)':('domestic','shoppers'),'韩国:免税店顾客数:国外游客(人)':('foreign','shoppers'),'韩国:免税店销售额:总计(美元)':('total','salesUsd'),'韩国:免税店销售额:国内游客(美元)':('domestic','salesUsd')}
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def number(v):
 if v is None or str(v).strip() in ('','—','--','-'):return None
 s=str(v).replace(',','').strip()
 if not re.fullmatch(r'[0-9]+(?:\.[0-9]+)?(?:万亿|亿|万)?',s):raise ValueError('Unsupported raw quantity: '+s)
 scale=1
 for suffix,m in [('万亿',10**12),('亿',10**8),('万',10**4)]:
  if s.endswith(suffix):s=s[:-len(suffix)];scale=m;break
 return float(Decimal(s)*scale)
def tables(receipt):
 if 'data' in receipt:return receipt['data']
 if receipt.get('isError') or receipt.get('ok') is False:raise ValueError('Provider error receipt')
 return [t for item in receipt.get('content',[]) if item.get('type')=='text' for t in json.loads(item['text']).get('data',[])]
def build(group_receipt,sales_receipt,wind,checked_at):
 records={};sources=[]
 for sid,receipt in [('choice-korea-groups',group_receipt),('choice-korea-sales',sales_receipt)]:
  urls=[];codes=set()
  for table in tables(receipt):
   columns=table.get('columns',[])
   if not columns or columns[0]!='宏观数据（月）':continue
   for entry in table.get('meta',{}).get('jumpUrlList',[]):
    url=entry.get('choiceUrl','')
    if not url.startswith('https://choicew2z.eastmoney.com/'):raise ValueError('Unexpected Choice source')
    urls.append(url)
    from urllib.parse import urlparse,parse_qs
    codes.update(parse_qs(urlparse(url).fragment.partition('?')[2]).get('macroids',[''])[0].split(','))
   for row in table.get('items',[]):
    if row[0] not in FIELDS:continue
    if row[1]!='韩国免税店协会' or len(row)!=len(columns):raise ValueError('Source or column mismatch')
    scope,field=FIELDS[row[0]]
    for period,raw in zip(columns[2:],row[2:]):
     if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',period):raise ValueError('Not a monthly period')
     r=records.setdefault((period,scope),{'period':period,'scope':scope})
     val=number(raw)
     if field in r and r[field]!=val:raise ValueError('Conflicting overlapping observations')
     r.update({field:val,field+'Raw':raw,field+'Precision':'provider-rounded' if isinstance(raw,str) and any(c in raw for c in '万亿') else 'raw',field+'Source':sid})
  sources.append({'id':sid,'name':'东方财富Choice转引韩国免税店协会','provider':'东方财富Choice','publisher':'韩国免税店协会','sourceType':'vendor-republished','url':urls[0] if urls else None,'codeCandidates':sorted(c for c in codes if c),'checkedAt':checked_at,'publishedAt':None,'receiptSha256':hashlib.sha256(json.dumps(receipt,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),'note':'只使用月表；代码集合为表级候选，不按行序绑定。工具返回缩略值，保留原字符串与精度状态。'})
 if wind.get('meta',{}).get('code')!='D5529203' or wind['meta'].get('unit')!='美元' or wind['meta'].get('source')!='韩国免税店协会':raise ValueError('Unexpected Wind indicator')
 if len(wind['date'])!=len(wind['value']):raise ValueError('Wind arrays mismatch')
 for period,value in zip(wind['date'],wind['value']):
  key=(period,'foreign')
  if key not in records:continue
  if not isinstance(value,(float,int)) or value<0:raise ValueError('Invalid sales')
  records[key].update(salesUsd=value,salesUsdRaw=value,salesUsdPrecision='raw',salesUsdSource='wind-korea-foreign')
 sources.append({'id':'wind-korea-foreign','name':'万得Wind转引韩国免税店协会','provider':'Wind','publisher':'韩国免税店协会','sourceType':'vendor-republished','code':'D5529203','url':'https://www.kdfa.or.kr/ko/trend/total_krw.php','unit':'美元','checkedAt':checked_at,'publishedAt':None,'providerUpdatedAt':'2026-09-23','receiptSha256':hashlib.sha256(json.dumps(wind,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),'note':'外国人销售额使用Wind原美元值；providerUpdatedAt是供应商更新日期，不是协会发布日期。协会历史表需会员，未冒称直接取得原表。'})
 rows=sorted(records.values(),key=lambda r:(r['period'],list(GROUPS).index(r['scope'])))
 periods=sorted({r['period'] for r in rows})
 for period in periods:
  rr=[r for r in rows if r['period']==period]
  if len(rr)!=3 or any('salesUsd' not in r or 'shoppers' not in r for r in rr):raise ValueError('Incomplete cohort month '+period)
  total=next(r for r in rr if r['scope']=='total')
  for field in ['salesUsd','shoppers']:
   others=sum(r[field] for r in rr if r['scope']!='total')
   if abs(total[field]-others)>max(150000,abs(total[field])*.001):raise ValueError('Components disagree beyond source rounding')
 return {'schemaVersion':1,'updatedAt':checked_at,'dataAsOf':periods[-1],'coverageStart':periods[0],'coverageEnd':periods[-1],'periodCount':len(periods),'count':len(rows),'country':'KR','currency':'USD','sourceName':'韩国免税店协会（Wind / Choice转引）','notes':['韩国全国免税店月度统计，按全部顾客、韩国本国人、外国人分组；韩国本国人/外国人按协会顾客分类，不等于中国游客。','金额均为美元；图表按1亿美元=100000000美元显示，人次按1万人次=10000人次显示。原数据及CSV保留美元与人次。','外国人销售额为Wind原值；其他金额及全部人次来自Choice缩略回执，保留原字符串、舍入状态及来源，未伪造精确个位数。','同比以同一指标、同一顾客分类的上年同月计算；缩略原值算出的同比标为测算。没有基期或基期非正数时留空，不用相邻月份替代。','客单价=同月同组销售额/购物人次，属于测算值；不换算人民币，不混用韩元和美元增速。','三组独立披露值因源精度可能有小幅加总差异，不强行配平。统计为购物人次口径，不当作去重访韩游客人数。','当前共同覆盖'+periods[0]+'—'+periods[-1]+'；未取得更后月份，不能据此认定协会尚未发布。来源独立发布日期未提供，留空；核对日不代替发布日期。'],'sources':sources,'rows':rows}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--groups',type=Path,required=True);p.add_argument('--sales',type=Path,required=True);p.add_argument('--wind',type=Path,required=True);p.add_argument('--checked-at',required=True);p.add_argument('--output',type=Path,default=Path('data/dutyfree/korea.json'));a=p.parse_args()
 new=build(read(a.groups),read(a.sales),read(a.wind),a.checked_at)
 if a.output.exists():
  old=read(a.output);old_rows={(r['period'],r['scope']):r for r in old['rows']}
  for r in new['rows']:old_rows[r['period'],r['scope']]=r
  if len(old_rows)>len(new['rows']):raise ValueError('Incremental receipts must preserve prior source coverage; merge reviewed history first')
 text=json.dumps(new,ensure_ascii=False,indent=2)+'\n'
 if a.output.exists() and a.output.read_text(encoding='utf-8')==text:print('No change');return
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(text,encoding='utf-8');print(json.dumps({'output':str(a.output),'periods':new['periodCount'],'rows':new['count'],'latest':new['dataAsOf']},ensure_ascii=False))
if __name__=='__main__':main()
