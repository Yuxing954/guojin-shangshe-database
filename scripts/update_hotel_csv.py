"""Merge saved historical hotel data and normal website exports into stable CSVs."""
import argparse, csv, datetime as dt, hashlib, json, math, re
from pathlib import Path
from openpyxl import load_workbook

HEADERS = {
 'hotel_industry_weekly.csv': 'period_id,year,week,start_date,end_date,region,segment,hotel_count,room_count,hotel_count_15plus,room_count_15plus,occupancy_rate,adr,revpar,source'.split(','),
 'hotel_group_weekly.csv': 'period_id,year,week,start_date,end_date,group,region,hotel_count,room_count,price_index,heat_index,stay_price_index,stay_heat_index,adr,stay_adr,source'.split(','),
 'hotel_supply_weekly.csv': 'period_id,year,week,start_date,end_date,region,room_band,hotel_count,room_count,chain_hotel_count,chain_room_count,source'.split(','),
 'hotel_market_share_annual.csv': 'year,group,market_share_pct,source'.split(',')}
KEYS = {
 'hotel_industry_weekly.csv': ('period_id','region','segment'),
 'hotel_group_weekly.csv': ('period_id','group'),
 'hotel_supply_weekly.csv': ('period_id','region','room_band'),
 'hotel_market_share_annual.csv': ('year','group')}

def period(value):
 m=re.fullmatch(r'(20\d{2})年第(\d+)周\((20\d{2}-\d{2}-\d{2})\s*-\s*(20\d{2}-\d{2}-\d{2})\)',str(value or '').strip())
 if not m:return None
 y,week,start,end=m.groups()
 if (dt.date.fromisoformat(end)-dt.date.fromisoformat(start)).days!=6:raise ValueError(f'Not a seven-day source week: {value}')
 return [f'{y}W{int(week):02d}',int(y),int(week),start,end]

def number(value,occupancy=False):
 if value is None or str(value).strip()=='' or str(value).startswith('#'):return None
 text=str(value).strip(); result=round(float(text.rstrip('%'))/(100 if text.endswith('%') else 1),12)
 if not math.isfinite(result):raise ValueError(f'Non-finite number: {value}')
 if occupancy and not 0<=result<=1:raise ValueError(f'Occupancy outside 0–1: {value}')
 return int(result) if result.is_integer() else result

def collect(workbook):
 result={name:[] for name in HEADERS}
 for ws in workbook:
  values=iter(ws.values); header=next(values,())
  if not header or header[0]!='周期':continue
  for row in values:
   p=period(row[0])
   if not p:continue
   if len(header)>=10 and header[2]=='酒店类型':
    occ=number(row[7],True);adr=number(row[9])
    if adr is None:adr=number(row[8])
    # Missing OCC stays missing; use stay-date ADR consistently for RevPAR.
    rev=round(occ*adr,8) if occ is not None and adr is not None else None
    result['hotel_industry_weekly.csv'].append(p+[row[1],row[2]]+[number(x) for x in row[3:7]]+[occ,adr,rev,'酒店之家'])
   elif len(header)>=7 and header[2]=='房量区间':
    result['hotel_supply_weekly.csv'].append(p+[row[1],row[2]]+[number(x) for x in row[3:7]]+['酒店之家'])
   elif len(header)>=11 and header[1]=='集团':
    if row[2]!='全国':raise ValueError('The existing group key supports nationwide exports only')
    result['hotel_group_weekly.csv'].append(p+[row[1],row[2]]+[number(x) for x in row[3:11]]+['酒店之家'])
 if '市占率' in workbook.sheetnames:
  ws=workbook['市占率'];names=[str(ws.cell(3,c).value).split(':')[-1] for c in range(2,8)]
  # Stop at the end of the FIRST table: later rows are chain penetration, not market share.
  for row in ws.iter_rows(min_row=6,values_only=True):
   if not isinstance(row[0],(dt.date,dt.datetime)):break
   for i,group in enumerate(names,1):
    value=number(row[i])
    if value is not None:result['hotel_market_share_annual.csv'].append([row[0].year,group,value,'酒店之家/iFinD'])
 return result

def read_csv(path):
 if not path.exists():return []
 with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))

def key(name,row):return tuple(str(row[k]) for k in KEYS[name])
def text(value):return '' if value is None else str(value)
def same(left,right):
 if text(left)==text(right):return True
 try:
  a,b=number(left),number(right)
  return a is not None and b is not None and math.isclose(a,b,rel_tol=0,abs_tol=1e-8)
 except ValueError:return False

def validate(name,rows):
 if len({key(name,r) for r in rows})!=len(rows):raise ValueError(f'Duplicate keys: {name}')
 totals={}
 for row in rows:
  if set(HEADERS[name])-set(row):raise ValueError(f'Missing columns: {name}')
  if name=='hotel_industry_weekly.csv':
   occ=number(row['occupancy_rate'],True);adr=number(row['adr']);rev=number(row['revpar'])
   if occ is None and rev is not None:raise ValueError('Missing occupancy must leave RevPAR empty')
   if None not in (occ,adr,rev) and abs(occ*adr-rev)>0.000001:raise ValueError('RevPAR does not reconcile to ADR × OCC')
  if name=='hotel_market_share_annual.csv':totals[row['year']]=totals.get(row['year'],0)+number(row['market_share_pct'])
 if any(v>100.000001 for v in totals.values()):raise ValueError('Annual shares exceed 100%; check source-table boundaries')

def update_metadata(out,report):
 path=out.parent/'data-manifest.json'
 if path.exists():
  manifest=json.loads(path.read_text(encoding='utf-8-sig'));manifest['updatedAt']=report['importedAt'][:10]
  for item in manifest['datasets']:
   name=Path(item['file']).name
   if name in report['datasets']:
    item.update({k:report['datasets'][name][k] for k in ('asOf','latestPeriod','rowCount')});item['updateRecord']='data/hotel-update-record.json'
  path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 path=out/'home-snapshot.json'
 if path.exists():
  home=json.loads(path.read_text(encoding='utf-8-sig'))
  rows=[r for r in read_csv(out/'hotel_industry_weekly.csv') if r['region']=='全国' and r['segment']=='全部' and r['revpar']]
  latest=max(rows,key=lambda r:r['period_id']);old=next((r for r in rows if int(r['year'])==int(latest['year'])-1 and r['week']==latest['week']),None)
  change=(number(latest['revpar'])/number(old['revpar'])-1)*100 if old and number(old['revpar']) not in (None,0) else None
  for item in home['industries']:
   if item['id']=='hotel':item.update(value=number(latest['revpar']),change=change,period=latest['period_id'],asOf=latest['end_date'],changeLabel='同周号同比，未作节假日错期调整')
  for item in home['focus']:
   if item['sector']=='酒店经营':
    suffix=f'{change:+.1f}%' if change is not None else '暂无数据'
    item.update(summary=f"全国 RevPAR 为 {number(latest['revpar']):.1f} 元，同周号同比 {suffix}（未作节假日错期调整）。结合入住率与房价查看变化来源。",asOf=latest['end_date'])
  home['generatedAt']=report['importedAt'];path.write_text(json.dumps(home,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('source',type=Path);parser.add_argument('output',type=Path);parser.add_argument('--exports-dir',type=Path);args=parser.parse_args()
 paths=[args.source]+(sorted(args.exports_dir.glob('*.xlsx')) if args.exports_dir else [])
 incoming={name:[] for name in HEADERS};sources=[]
 for path in paths:
  wb=load_workbook(path,data_only=True,read_only=True);content=collect(wb);wb.close()
  for name,rows in content.items():incoming[name].extend(dict(zip(HEADERS[name],map(text,row))) for row in rows)
  sources.append({'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rows':{name:len(rows) for name,rows in content.items()}})
 args.output.mkdir(parents=True,exist_ok=True)
 report={'importedAt':dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec='seconds'),'sources':sources,'datasets':{},'comparisonPolicy':'Default YoY matches source year/week; no automatic holiday shift. Comparable holiday periods must be explicitly mapped and labelled.'};staged={}
 for name,header in HEADERS.items():
  old=read_csv(args.output/name);original={key(name,r):r for r in old}
  if len(original)!=len(old):raise ValueError(f'Duplicate existing keys: {name}')
  field='year' if 'annual' in name else 'period_id'
  if old and incoming[name] and max(r[field] for r in incoming[name])<max(r[field] for r in old):raise ValueError(f'Source latest period predates repository: {name}')
  merged=original.copy()
  if name=='hotel_market_share_annual.csv' and incoming[name]:
   years={r['year'] for r in incoming[name]};merged={k:r for k,r in merged.items() if r['year'] not in years}
  for row in incoming[name]:merged[key(name,row)]=row
  rows=sorted(merged.values(),key=lambda r:key(name,r));validate(name,rows)
  latest=max(r[field] for r in rows)
  if old and latest<max(r[field] for r in old):raise ValueError(f'Latest period would regress: {name}')
  asof=f'{latest}-12-31' if field=='year' else max(r['end_date'] for r in rows)
  report['datasets'][name]={'rowCount':len(rows),'previousRowCount':len(old),'added':sum(key(name,r) not in original for r in rows),'revised':sum(key(name,r) in original and any(not same(original[key(name,r)][f],r[f]) for f in header) for r in rows),'removed':len(set(original)-set(merged)),'latestPeriod':latest,'asOf':asof,'regions':sorted({r['region'] for r in rows if 'region' in r})};staged[name]=rows
 # Validate all four tables before any write.
 for name,rows in staged.items():
  with (args.output/name).open('w',encoding='utf-8-sig',newline='') as f:
   writer=csv.DictWriter(f,fieldnames=HEADERS[name]);writer.writeheader();writer.writerows(rows)
 update_metadata(args.output,report)
 (args.output/'hotel-update-record.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(report['datasets'],ensure_ascii=False,indent=2))

if __name__=='__main__':main()
