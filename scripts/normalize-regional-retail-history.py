import sys,json,re,html,math,calendar
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
import xlrd,openpyxl
import argparse
ap=argparse.ArgumentParser(description='Read official Beijing/Shanghai XLS, XLSX and HTML tables without editing them.')
ap.add_argument('manifest',type=Path);ap.add_argument('output',type=Path);args=ap.parse_args()
manifest=json.loads(args.manifest.read_text(encoding='utf-8'));sources=[];records=[];audit=[]
def clean(v):return re.sub(r'[\s\u3000]+','',html.unescape(str(v or '')))
def number(v):
 if isinstance(v,(int,float)) and not isinstance(v,bool):return float(v) if math.isfinite(v) else None
 s=clean(v).replace(',','').replace('，','').replace('－','-')
 if s in ('','-','—','--','…'):return None
 try:return float(s)
 except:return None
def cat(v):
 s=clean(v);s=re.sub(r'^(?:其中[:：]|[#＃])','',s);s=s.replace('（亿元）','').replace('(亿元)','').replace('、','')
 return {'社会消费品零售总额':'社零总额','商品零售额':'商品零售','吃的商品':'吃类商品','穿的商品':'穿类商品','用的商品':'用类商品','烧的商品':'烧类商品'}.get(s,s)
def dimension(c,limited):
 if c in ['吃类商品','穿类商品','用类商品','烧类商品']:return 'usage'
 if c in ['商品零售','餐饮收入']:return 'form'
 if c in ['批发零售业','住宿餐饮业']:return 'industry'
 if c in ['城镇','乡村']:return 'location'
 if limited and c.endswith('类'):return 'goods'
 return None
for source in manifest:
 if source.get('error'):audit.append(source);continue
 rows=[];file=None
 if source['attachments']:
  a=source['attachments'][0];file=a['file']
  if file.endswith('xlsx'):rows=[list(r)for r in openpyxl.load_workbook(file,data_only=True).active.values]
  else:
   sh=xlrd.open_workbook(file).sheet_by_index(0);rows=[sh.row_values(i)for i in range(sh.nrows)]
 else:
  raw=Path(source['htmlFile']).read_text(encoding='utf-8');rows=[[html.unescape(re.sub('<[^>]+>',' ',td)).strip()for td in re.findall(r'<t[dh]\b[^>]*>([\s\S]*?)</t[dh]>',tr,re.I)]for tr in re.findall(r'<tr\b[^>]*>[\s\S]*?</tr>',raw,re.I)]
 while rows and all(not r or not clean(r[0]) for r in rows) and max(map(len,rows))>3:rows=[r[1:]if r else r for r in rows]
 title=''.join(clean(''.join(str(x or '')for x in r))for r in rows[:4])+''.join(a['title']for a in source['attachments'])
 period=source.get('period')
 if not period:
  match=re.search(r'(202\d)年1[-—－至](\d{1,2})月',title)
  if not match:raise ValueError('period '+source['id']+' '+title[:150])
  period=f'{match[1]}-{int(match[2]):02}'
 year,month=map(int,period.split('-'));date=source.get('publishedAtRaw');release=None
 raw=Path(source['htmlFile']).read_text(encoding='utf-8')
 if source['city']=='上海':
  date=re.search(r'<meta\s+name="PubDate"\s+content="([^"]+)"',raw,re.I)
  if date:date=date[1]
  else:
   date=re.search(r'(?:发布日期|发布时间|日期)[：:\s]+(?:</?[^>]+>\s*)*(\d{4}[-年]\d{1,2}[-月]\d{1,2})',raw)
   date=date[1]if date else None
 if date:
  d=re.search(r'(\d{4})[-年](\d{1,2})[-月](\d{1,2})',date)
  if d:
   candidate=f'{int(d[1]):04}-{int(d[2]):02}-{int(d[3]):02}'
   if candidate>f'{year:04}-{month:02}-{calendar.monthrange(year,month)[1]:02}':release=candidate
 sid='history-'+source['id'];sources.append({'id':sid,'name':f'{source["city"]}{period}'+('限上主要商品零售额'if'主要商品' in source['title']else'社会消费品零售总额'),'url':source['url'],'publisher':source['city']+'市统计局','quality':'official','releaseDate':release,'publishedAt':release,'sourcePublishedAtRaw':str(date)if date else None,'retrievedAt':source['retrievedAt'],'sha256':source['attachments'][0]['sha256']if source['attachments']else source['sha256'],'attachmentUrl':source['attachments'][0]['url']if source['attachments']else None,'locator':Path(file).name if file else '网页原表','note':None if release else '页面未提供可确认的发布日期，原始日期元数据单独保留。'})
 limited='限额以上' in source['title'];count=0
 has_ytd_column=any(len(r)>=5 and number(r[3]) is not None and len(clean(r[0]))<45 for r in rows)
 for i,row in enumerate(rows):
  if len(row)<3:continue
  c=cat(row[0])
  if '限额以上单位主要商品' in c:limited=True;continue
  if not c or len(c)>45 or all(number(x)is None for x in row[1:]):continue
  dim=dimension(c,limited)
  # Only the total and non-overlapping published partition rows are imported.
  if c!='社零总额' and dim is None:continue
  scope='限额以上' if dim=='goods'else'全口径'
  denom=10000 if source['city']=='北京'else 1
  if month==2 and not has_ytd_column:
   pairs=[('ytd',number(row[1]),number(row[2])),('combined',number(row[1]),number(row[2]))]
  elif len(row)>=5:
   pairs=[('month',number(row[1]),number(row[2])),('ytd',number(row[3]),number(row[4]))]
   if month==2 and number(row[3])is not None:pairs.append(('combined',number(row[3]),number(row[4])))
  else:
   pairs=[('ytd',number(row[1]),number(row[2]))]
   if month==2:pairs.append(('combined',number(row[1]),number(row[2])))
  for basis,value,yoy in pairs:
   if value is None and yoy is None:continue
   if value is not None and value<0:raise ValueError('negative amount '+sid)
   if yoy is not None and yoy<=-100:raise ValueError('invalid yoy '+sid)
   records.append({'regionId':'p0'if source['city']=='北京'else'p8','period':period,'basis':basis,'category':c,'scope':scope,'dimension':dim,'amount':value/denom if value is not None else None,'yoy':yoy,'provenance':{'amount':{'sourceId':sid,'originalName':clean(row[0]),'locator':f'第{i+1}行','rawUnit':'万元'if denom==10000 else'亿元','priority':120},'yoy':{'sourceId':sid,'originalName':clean(row[0]),'locator':f'第{i+1}行','priority':120}}});count+=1
  if c=='社零总额' and count==0:audit.append({'source':sid,'reason':'no numeric total'})
 if not count:raise ValueError('empty '+sid)
result={'sources':sources,'observations':records,'audit':audit}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'sources':len(sources),'observations':len(records),'byCity':{city:{'periods':len(set(r['period']for r in records if r['regionId']==id and r['category']=='社零总额')),'range':[min(r['period']for r in records if r['regionId']==id),max(r['period']for r in records if r['regionId']==id)],'dimensions':{dim:len([r for r in records if r['regionId']==id and r['dimension']==dim])for dim in ['usage','goods','form','industry']}}for city,id in [('北京','p0'),('上海','p8')]},'audit':audit},ensure_ascii=False))
