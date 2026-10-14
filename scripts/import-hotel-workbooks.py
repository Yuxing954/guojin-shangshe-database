"""Read-only adapters for the three supplied disclosure workbooks.

Writes an independent, traceable supplement; never rewrites older datasets.
"""
from pathlib import Path
import argparse,collections,hashlib,json,math,re,zipfile
import openpyxl
from openpyxl.utils import get_column_letter

FILES={'hworld':'华住经营数据底稿_定期报告页码与真实截图嵌入.xlsx','jinjiang':'锦江酒店_经营数据简洁版_20261012.xlsx','btg':'首旅酒店_2016至2026H1重要经营数据与原始报告截图.xlsx'}
FIN={'营业收入':'revenue','归母净利润':'parent_profit','扣非归母净利润':'deducted_profit','经营现金流净额':'operating_cf','营业成本':'hotel_cost','销售费用':'sales_expense','管理费用':'admin_expense','财务费用':'finance_expense','营业利润':'operating_profit','总资产':'assets','归母净资产':'parent_equity','利润总额':'pretax_profit'}
STOCK={'hotels','rooms','pipeline','signed_hotels','signed_rooms','assets','parent_equity','mature_hotels'}
AVG={'adr','occ','revpar'}
METRICS={'signed_hotels':('签约酒店数','家','规模','stock'),'signed_rooms':('签约客房数','间','规模','stock'),'mature_hotels':('成熟酒店样本数','家','经营','stock'),'finance_expense':('财务费用','百万元','财务','flow'),'parent_equity':('归母净资产','百万元','财务','stock'),'pretax_profit':('利润总额','百万元','财务','flow'),'project_revenue':('项目收入','百万元','财务','flow'),'project_cost':('项目成本','百万元','财务','flow'),'gross_profit':('毛利','百万元','财务','flow'),'gross_margin':('毛利率','%','财务','average'),'ebitda':('EBITDA','百万元','财务','flow'),'capex':('资本性支出','百万元','现金流','flow'),'product_share':('产品结构比例','%','产品','average'),'ownership':('受益持股比例','%','股权','stock'),'reported_growth':('披露同比','%','财务','average'),'managed_share':('加盟管理收入占比','%','财务','average')}

METRICS['deducted_profit']=('扣非归母净利润','百万元','财务','flow')

def number(v):
 return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def period(v):
 s=str(v or '').strip()
 if re.fullmatch(r'20\d\d',s):return s+'FY'
 if re.fullmatch(r'20\d\dA',s):return s[:4]+'FY'
 if re.fullmatch(r'FY20\d\d',s):return s[2:]+'FY'
 s=s.replace('YTD9','9M')
 return s if re.fullmatch(r'20\d\d(?:Q[1-4]|H[12]|FY|9M|AprDec)',s) else None
def frequency(p):return '季度' if 'Q' in p else '半年' if 'H' in p else '累计' if '9M' in p else '期间' if 'AprDec' in p else '年度'
def temporal(p,m):return '期末' if m in STOCK else '期间平均' if m in AVG else '年初至9月累计' if '9M' in p else '4—12月累计' if 'AprDec' in p else '单季' if 'Q' in p else '上半年' if p.endswith('H1') else '下半年' if p.endswith('H2') else '全年累计'
def dump(path,obj):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main(source_root,root):
 root=Path(root);source_root=Path(source_root);tables={};evidence={};sources=[];obs=[];issues=[];checks=[]
 for cid,name in FILES.items():
  p=source_root/name;w=openpyxl.load_workbook(p,read_only=True,data_only=True)
  tables[cid]={s.title:list(s.values) for s in w if not s.title.startswith('原始报告截图') and s.title not in ['股权结构截图底稿']}
  w.close();sid='workbook-'+cid+'-20261014'
  sources.append(dict(id=sid,companyId=cid,file=name,relativePath='AI研报/AI产物/'+name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),importedAt='2026-10-14',kind='用户提供的研究底稿',verification='底稿逐单元格转录；报告页码及截图定位沿用底稿，未重新核对原PDF',embeddedImageCount=len([x for x in zipfile.ZipFile(p).namelist() if x.startswith('xl/media/') ])))
  ev={}
  if cid=='btg':
   for r in tables[cid]['截图索引'][5:]:
    if r[0]:ev[str(r[0])]=dict(report=r[3],pages='P'+str(r[4]),screenshotLocator=str(r[6])+'!'+str(r[7]),reportUrl=r[9])
  elif cid=='jinjiang':
   for r in tables[cid]['证据索引'][4:]:
    if r[0]:ev[str(r[0])]=dict(report=r[3],pages='P'+str(r[4]),screenshotLocator=str(r[6])+'!A'+str(r[7]))
   for r in tables[cid]['收入成本截图索引'][4:]:
    if r[0]:ev[str(r[0])]=dict(report=r[2],pages='P'+str(r[3]),screenshotLocator=str(r[5])+'!A'+str(r[6]))
  evidence[cid]=ev

 def add(cid,sheet,row,col,p,m,**kw):
  raw=tables[cid][sheet][row-1][col-1]
  if not number(raw) or not period(p):return
  p=period(p);factor=kw.pop('factor',1);unit=kw.pop('unit',METRICS.get(m,('',None))[1] or ('家' if m in ['hotels','opened','closed','net_opened','pipeline','to_pipeline'] else '间' if m=='rooms' else '%' if m=='occ' else '元/间' if m in AVG else '百万元'))
  eids=kw.pop('eids',[]);eids=[eids] if isinstance(eids,str) else eids
  ev=[evidence[cid][x] for x in eids if x in evidence[cid]]
  formula=kw.pop('formula',None);status=kw.pop('status','derived' if formula else 'transcribed')
  report=kw.pop('report',None) or ' / '.join(dict.fromkeys(str(x['report']) for x in ev)) or None
  pages=kw.pop('pages',None) or ' / '.join(dict.fromkeys(x['pages'] for x in ev)) or None
  loc=sheet+'!'+get_column_letter(col)+str(row)
  o=dict(id='wb-'+hashlib.sha256((cid+'|'+loc+'|'+m).encode()).hexdigest()[:20],companyId=cid,period=p,frequency=frequency(p),periodBasis=temporal(p,m),metric=m,value=raw*factor,unit=unit,currency='CNY' if unit in ['百万元','元/间'] else None,region='集团整体',scope='全部',mode='全部',basis='原报告底稿',status=status,sourceId='workbook-'+cid+'-20261014',locator=loc,report=report,pages=pages,formula=formula or (str(raw)+' × '+str(factor) if factor!=1 else None),rawValue=raw,originalUnit=kw.pop('originalUnit',unit),note='',evidenceIds=eids,screenshotLocator=' / '.join(dict.fromkeys(x['screenshotLocator'] for x in ev)),reportUrl=next((x.get('reportUrl') for x in ev if x.get('reportUrl')),None),verification='底稿逐单元格转录')
  o.update(kw)
  if m=='occ' and not 0<=o['value']<=100:
   o['status']='pending';issues.append(dict(type='range',observationId=o['id'],message=p+' '+loc+'：底稿入住率超过0—100%，保留原值，待核验'))
  obs.append(o);checks.append((cid,sheet,row,col,raw,factor,o['id']))
  return o
 def rows(cid,sheet,start=5):
  for i,r in enumerate(tables[cid][sheet],1):
   if i>=start and r and period(r[0]):yield i,r
 def eid(v):return re.findall(r'[ER]\d+',str(v or ''))
 def norm_scope(v):return {'全部酒店':'全部','小计':'全部','合计':'全部','经济型酒店':'经济型','中高端酒店':'中高端','不含轻管理酒店':'不含轻管理'}.get(v,v)
 def mode(v):return {'合计':'全部','特许管理':'加盟','特许':'加盟'}.get(v,v)
 def stock_period(p):return period(p).replace('H1','Q2').replace('FY','Q4')

 # H World: exact existing statistical dimensions allow semantic replacement.
 for sheet,start,mapping in [('季度经营数据',5,{2:'hotels',3:'rooms',4:'hotels',5:'adr',6:'occ',7:'revpar',8:'revenue',9:'leased_revenue',10:'managed_revenue',11:'other_revenue',13:'operating_profit',14:'parent_profit',15:'adjusted_ebitda'}),('年度数据',4,{2:'hotels',3:'rooms',4:'adr',5:'occ',6:'revpar',7:'revenue',8:'reported_growth',9:'parent_profit',10:'operating_profit',11:'leased_revenue',12:'managed_revenue',13:'managed_share',14:'adjusted_ebitda'})]:
  for i,r in rows('hworld',sheet,start):
   p=period(r[0]);ev=[x for x in tables['hworld']['截图索引'][1:] if str(x[0]) in [p,p[:4],'FY'+p[:4]]]
   for c,m in mapping.items():
    china=sheet=='季度经营数据' and p>='2022Q4' and m in AVG
    report=' / '.join(dict.fromkeys(str(x[1]) for x in ev));pg=' / '.join(dict.fromkeys(str(x[2]) for x in ev))
    add('hworld',sheet,i,c,p,m,region='中国' if china or (sheet=='季度经营数据' and c==4) else '集团整体',basis='HWC / Legacy-Huazhu' if china else '集团Blended / 源表年度口径' if m in AVG else '中国酒店' if sheet=='季度经营数据' and c==4 else '集团整体',periodBasis='期末' if m in STOCK else '期间平均' if m in AVG or m in ['reported_growth','managed_share'] else '单季' if 'Q' in p else '半年' if 'H' in p else '全年累计',report=report,pages=pg,note=str(tables['hworld'][sheet][1][0]),unit='%' if m in ['reported_growth','managed_share'] else '%' if m=='occ' else '家' if m=='hotels' else '间' if m=='rooms' else '元/间' if m in AVG else '百万元')
 for i,r in enumerate(tables['hworld']['股权结构(最新)'],1):
  if i!=4:continue
  for c in range(3,12):add('hworld','股权结构(最新)',i,c,'2025FY','ownership',scope=tables['hworld']['股权结构(最新)'][2][c-1],basis='受益持股 / 2026-03-31',periodBasis='截至2026-03-31',note=str(tables['hworld']['股权结构(最新)'][1][0]),report='2025年年度报告(20-F)',pages='Item 6.E')

 # BTG: sample names and early hotel networks remain separate.
 for i,r in rows('btg','原始经营数据',6):
  base=dict(region='中国',scope=norm_scope(r[2]),mode=mode(r[3]),basis='原报告运营酒店 / '+r[1],eids=[r[14]],report=r[12],pages='P'+str(r[13]),note=r[15] or '',screenshotLocator=r[16])
  if '成熟' in r[1]:base['basis']+=' / 固定样本'+period(r[0])
  for c,m,yc in [(6,'revpar',7),(8,'adr',9),(10,'occ',11)]:
   add('btg','原始经营数据',i,c,r[0],m,**base,factor=100 if m=='occ' else 1,reportedYoY=r[yc-1]*(1 if m=='occ' else 100) if number(r[yc-1]) else None,originalUnit='比例' if m=='occ' else '元/间')
  add('btg','原始经营数据',i,5,r[0],'mature_hotels',**base)
 for i,r in rows('btg','原始门店客房',6):
  region='中国' if r[1]=='地区' else '集团整体';scope=norm_scope(r[3]) if r[1]=='地区' else norm_scope(r[2]) if r[3] in ['小计','合计'] or str(r[3]).rstrip('*')==str(r[2]) else str(r[2])+' / '+str(r[3])
  for c,m,md in [(5,'hotels','全部'),(6,'hotels','直营'),(7,'hotels','加盟'),(8,'rooms','全部'),(9,'rooms','直营'),(10,'rooms','加盟')]:
   add('btg','原始门店客房',i,c,stock_period(r[0]),m,region=region,scope=scope,mode=md,basis='原报告门店网络 / '+r[1],eids=[r[12]],report=r[10],pages='P'+str(r[11]),note=r[13] or '',screenshotLocator=r[14],originalPeriod=r[0])
 for i,r in rows('btg','原始开店储备',6):
  m='pipeline' if '储备' in r[2] else 'closed' if '关闭' in r[2] else 'opened';p=stock_period(r[0]) if m in STOCK else r[0]
  for c,md in [(4,'全部'),(5,'直营'),(6,'加盟')]:add('btg','原始开店储备',i,c,p,m,region='集团整体',scope=norm_scope(r[1]),mode=md,basis='原报告拓店 / '+r[2],eids=[r[8]],report=r[6],pages='P'+str(r[7]),screenshotLocator=r[9],originalPeriod=r[0])
 for i,r in rows('btg','原始财务分部',6):
  if r[2] not in FIN:raise ValueError('unmapped BTG finance '+r[2])
  add('btg','原始财务分部',i,4,r[0],FIN[r[2]],scope='全部' if r[1]=='集团' else r[1],basis='原报告合并财务' if r[1]=='集团' else '原报告分部财务',factor=1e-6 if r[4]=='元' else .01,originalUnit=r[4],eids=[r[8]],report=r[6],pages='P'+str(r[7]),screenshotLocator=r[9],note=r[5])
 # Single-quarter summary is a source-produced calculation, not cumulative data.
 for i,r in rows('btg','规模及财务汇总',7):
  for c,m in [(11,'revenue'),(12,'parent_profit'),(13,'deducted_profit'),(14,'operating_cf')]:
   related=[o for o in obs if o['companyId']=='btg' and o['metric']==m and o['scope']=='全部' and o['basis']=='原报告合并财务' and o['period']==period(r[0])]
   if related:continue
   ev=[x for x in tables['btg']['原始财务分部'][5:] if x[1]=='集团' and x[2] in FIN and FIN[x[2]]==m and str(x[0])[:4]==str(r[0])[:4]]
   add('btg','规模及财务汇总',i,c,r[0],m,basis='原报告合并财务',factor=100,originalUnit='亿元',status='derived',formula='底稿单季差额；Q2=H1-Q1；Q4=FY-9M；同范围同单位',eids=list(dict.fromkeys(x[8] for x in ev)),note=r[16] or '')
 for i,r in rows('btg','产品会员及资本支出',6):
  m='members' if r[1]=='会员数量' else 'capex' if '支出' in r[1] else 'product_share';factor=.01 if r[3]=='万人' else 100 if r[3]=='亿人' else .01 if r[3]=='万元' else 100 if m=='product_share' else 1
  add('btg','产品会员及资本支出',i,3,r[0],m,scope=r[1],basis='原报告产品会员及资本支出',factor=factor,unit='百万人' if m=='members' else '百万元' if m=='capex' else '%',originalUnit=r[3],eids=[r[7]],report=r[5],pages='P'+str(r[6]),screenshotLocator=r[8],note=r[4] or '')

 # Jinjiang: prices in EUR, financial segments in CNY/EUR as supplied.
 for i,r in rows('jinjiang','经营指标修订明细'):
  currency='EUR' if '欧元' in str(r[4]) else 'CNY';sc=r[3];md='加盟' if '/加盟' in sc else '直营' if '/自有' in sc else '全部';sc=sc.split('/')[0] if md!='全部' else sc
  for c,m in [(6,'adr'),(7,'occ'),(8,'revpar')]:
   add('jinjiang','经营指标修订明细',i,c,r[0],m,region='中国大陆境内' if r[2]=='境内' else '海外',scope=sc,mode=md,basis='有限服务型酒店' if sc=='有限服务型酒店' else '全服务型酒店' if sc=='全服务型酒店' else '原报告分类 / '+sc,unit='%' if m=='occ' else r[4],currency=None if m=='occ' else currency,factor=100 if m=='occ' else 1,originalUnit='比例' if m=='occ' else r[4],eids=eid(r[20]),report=r[18],pages='P'+str(r[19]),note='；'.join(str(x) for x in [r[1],r[15],r[16],r[17]] if x),selectionRank=2 if r[15]=='本期列' else 1,reportedYoY=(r[13] if m=='occ' else r[12]*100 if m=='adr' and number(r[12]) else r[11]*100 if m=='revpar' and number(r[11]) else None))
 for i,r in rows('jinjiang','可比酒店修订'):
  m={'ADR':'adr','OCC':'occ','RevPAR':'revpar'}[r[3]]
  add('jinjiang','可比酒店修订',i,5,r[0],m,region='中国大陆境内',scope=r[1],mode=r[2],basis='原报告可比酒店 / '+str(r[9])+' / 固定样本'+period(r[0]),factor=100 if m=='occ' else 1,originalUnit='比例' if m=='occ' else r[8],eids=eid(r[12]),report=r[10],pages='P'+str(r[11]),reportedYoY=r[6]*(1 if m=='occ' else 100) if number(r[6]) else None)
 for i,r in rows('jinjiang','合并财务原始披露'):
  add('jinjiang','合并财务原始披露',i,3,r[0],FIN[r[1]],basis='原报告合并财务',factor=1e-6,originalUnit='元',eids=eid(r[7]),report=r[5],pages='P'+str(r[6]),note=r[4])
 for i,r in rows('jinjiang','财务季度'):
  for c,m in enumerate(['revenue','parent_profit','deducted_profit','operating_cf','hotel_cost','sales_expense','admin_expense','finance_expense','operating_profit'],2):
   ev=[x for x in tables['jinjiang']['合并财务原始披露'][4:] if x[1] in FIN and FIN[x[1]]==m and str(x[0])[:4]==str(r[0])[:4]]
   add('jinjiang','财务季度',i,c,r[0],m,basis='原报告合并财务',factor=100,originalUnit='亿元',status='transcribed' if str(r[0]).endswith('Q1') else 'derived',formula='底稿单季序列：Q2=H1-Q1；Q3优先单季，否则9M-H1；Q4=FY-9M',eids=list(dict.fromkeys(x[7] for x in ev)))
 for sheet in ['开店原始披露','签约规模原始披露']:
  for i,r in rows('jinjiang',sheet):
   m={'净增开业':'net_opened','开业转筹建':'to_pipeline','开业退出':'closed','新开业':'opened','期末开业客房数':'rooms','期末开业酒店数':'hotels','签约酒店数':'signed_hotels','签约客房数':'signed_rooms'}[r[1]]
   shift=1 if sheet=='开店原始披露' else 0
   add('jinjiang',sheet,i,3,r[0],m,region='全球',basis='酒店业务口径（含全服务型+有限服务型）' if r[3]=='全部酒店业务' else '有限服务型连锁酒店',eids=eid(r[6+shift]),report=r[4+shift],pages='P'+str(r[5+shift]))
 for i,r in rows('jinjiang','开店季度修订'):
  basis='酒店业务口径（含全服务型+有限服务型）' if '含全服务型' in str(r[11]) else '有限服务型连锁酒店'
  for c,m in [(2,'opened'),(3,'closed'),(4,'to_pipeline'),(5,'net_opened'),(8,'hotels'),(9,'rooms'),(10,'signed_hotels'),(11,'signed_rooms')]:
   if any(o['companyId']=='jinjiang' and o['period']==period(r[0]) and o['metric']==m and o['basis']==basis and o['scope']=='全部' and o['mode']=='全部' and o['region']=='全球' for o in obs):continue
   ev=[x for x in tables['jinjiang']['证据索引'][4:] if str(r[0]) in str(x[1]) and '开' in str(x[5])]
   add('jinjiang','开店季度修订',i,c,r[0],m,region='全球',basis=basis,status='derived' if m in ['opened','closed','to_pipeline','net_opened'] else 'transcribed',formula='底稿季度修订；累计流量按同口径差额，期末存量直接引用',eids=[x[0] for x in ev],note=r[11])
 for i,r in rows('jinjiang','规模结构修订'):
  md=r[2] if r[1]=='经营模式' else '全部';scope='有限服务型酒店' if r[1]=='经营模式' else norm_scope(r[2]);basis='原报告规模分类'
  for c,m in [(4,'hotels'),(5,'rooms')]:add('jinjiang','规模结构修订',i,c,r[0],m,region='全球',scope=scope,mode=md,basis=basis,eids=eid(r[8]),report=r[6],pages='P'+str(r[7]),note=r[5])
 for i,r in rows('jinjiang','境内外开业签约规模'):
  for c,m,md in [(4,'hotels','直营'),(5,'rooms','直营'),(6,'hotels','加盟'),(7,'rooms','加盟'),(8,'signed_hotels','直营'),(9,'signed_rooms','直营'),(10,'signed_hotels','加盟'),(11,'signed_rooms','加盟')]:add('jinjiang','境内外开业签约规模',i,c,r[0],m,region=('中国大陆境内' if r[1]=='境内' else '海外')+' / '+str(r[2]),basis='原报告境内外开业签约规模',mode=md,eids=eid(r[13]),report=r[11],pages='P'+str(r[12]),note='法国为欧洲子集，不能重复加总')
 for i,r in rows('jinjiang','分部收入利润原始披露'):
  for c,m in [(4,'revenue'),(5,'parent_profit')]:add('jinjiang','分部收入利润原始披露',i,c,r[0],m,region='中国大陆境内' if r[1]=='境内' else '海外',scope=r[2],basis='原报告境内外分部',factor=.01,originalUnit=r[5],currency='EUR' if '欧元' in str(r[5]) else 'CNY',eids=eid(r[9]),report=r[7],pages='P'+str(r[8]))
 for i,r in rows('jinjiang','分部收入利润半年'):
  if not str(r[0]).endswith('H2'):continue
  ev=[x for x in tables['jinjiang']['分部收入利润原始披露'][4:] if str(x[0])[:4]==str(r[0])[:4] and x[1:3]==r[1:3]]
  for c,m in [(4,'revenue'),(5,'parent_profit')]:add('jinjiang','分部收入利润半年',i,c,r[0],m,region='中国大陆境内' if r[1]=='境内' else '海外',scope=r[2],basis='原报告境内外分部',factor=.01,originalUnit=r[5],currency='EUR' if '欧元' in str(r[5]) else 'CNY',status='derived',formula='同地区、业务和币种：FY-H1',eids=[x[9] for x in ev],note=r[7])
 for i,r in rows('jinjiang','加盟及管理费修订'):
  add('jinjiang','加盟及管理费修订',i,5,r[0],'managed_revenue',region={'境内':'中国大陆境内','境外':'海外'}.get(r[1],r[1]),scope=r[2]+' / '+r[3],basis='原报告加盟与管理费项目',factor=.01,originalUnit=r[5],eids=eid(r[9]),report=r[7],pages='P'+str(r[8]),note=r[6] or '')
 for i,r in rows('jinjiang','酒店费用及EBITDA'):
  m='adjusted_ebitda' if '调整后' in r[1] else 'ebitda' if 'EBITDA' in r[1] else 'hotel_cost' if '成本' in r[1] else 'sales_expense' if '销售' in r[1] else 'admin_expense' if '管理' in r[1] else 'finance_expense' if '财务' in r[1] else None
  if not m:raise ValueError('unmapped JJ expense '+r[1])
  add('jinjiang','酒店费用及EBITDA',i,3,r[0],m,scope=r[1],basis='有限服务型酒店分部 / 未抵销跨分部交易',factor=1e-6 if r[3]=='元' else .01,originalUnit=r[3],eids=eid(r[6]),report=r[4],pages='P'+str(r[5]))
 # Detailed project matrices; column labels distinguish segments and currencies.
 for sheet,start,mapping,sc,reportc,pagec,eidc,fc in [('项目收入成本原披露',5,[(5,'project_revenue'),(6,'project_cost'),(9,'gross_profit'),(10,'gross_margin')],(2,3),13,14,15,1e-6),('项目收入成本半年',5,[(4,'project_revenue'),(5,'project_cost'),(6,'gross_profit'),(7,'gross_margin')],(2,3),9,None,10,100)]:
  for i,r in rows('jinjiang',sheet,start):
   for c,m in mapping:add('jinjiang',sheet,i,c,r[0],m,scope=str(r[sc[0]-1])+' / '+str(r[sc[1]-1]),basis='原报告项目收入成本 / '+('2020年起' if int(str(r[0])[:4])>=2020 else '2020年前成本列报'),factor=100 if m=='gross_margin' else fc,unit='%' if m=='gross_margin' else '百万元',currency=None if m=='gross_margin' else 'CNY',originalUnit='比例' if m=='gross_margin' else '元' if fc==1e-6 else '亿元',report=r[reportc-1],pages='P'+str(r[pagec-1]) if pagec else None,eids=eid(r[eidc-1]),status='derived' if sheet.endswith('半年') or m in ['gross_profit','gross_margin'] else 'transcribed',formula='底稿毛利/毛利率或同口径FY-H1' if sheet.endswith('半年') or m in ['gross_profit','gross_margin'] else None,note=str(r[11] or '') if sheet.endswith('原披露') else str(r[7] or ''))
 for sheet,mapping,reportc,pagec,eidc,fc in [('收入分部项目原披露',range(4,10),11,12,14,1e-6),('收入分部项目半年',range(3,9),None,None,None,100)]:
  for i,r in rows('jinjiang',sheet):
   for c in mapping:add('jinjiang',sheet,i,c,r[0],'project_revenue',scope=str(tables['jinjiang'][sheet][3][c-1]).split('(')[0]+' / '+str(r[1]),basis='原报告分部收入矩阵',factor=fc,originalUnit='元' if fc==1e-6 else '亿元',report=r[reportc-1] if reportc else None,pages='P'+str(r[pagec-1]) if pagec else None,eids=eid(r[eidc-1]) if eidc else [],status='derived' if sheet.endswith('半年') else 'transcribed',formula='底稿同口径FY-H1' if str(r[0]).endswith('H2') else None,note=str(r[-1]) if sheet.endswith('半年') else '全部分部列以人民币披露；境外列不是欧元')
 for i,r in rows('jinjiang','年报成本构成原披露'):
  add('jinjiang','年报成本构成原披露',i,5,r[0],'project_cost',scope=str(r[2])+' / '+str(r[3]),basis='年报成本构成原披露 / '+('2020年起' if int(str(r[0])[:4])>=2020 else '2020年前成本列报'),factor=1e-6,originalUnit='元',report=r[10],pages='P'+str(r[11]),eids=eid(r[12]),note=r[9] or '')
 # Preserve every source version while exposing one deterministic canonical row.
 groups=collections.defaultdict(list)
 key=lambda o:tuple(o[k] for k in ['companyId','period','frequency','periodBasis','metric','scope','mode','region','basis','unit','currency'])
 for o in obs:groups[key(o)].append(o)
 final=[];duplicates=0
 for group in groups.values():
  group.sort(key=lambda o:(o.get('selectionRank',1),o['status']!='pending',o['status']!='derived'),reverse=True)
  first=group[0];final.append(first)
  for other in group[1:]:
   duplicates+=1;other['basis']+=' / 来源版本 '+other['locator'];other['note']+='；另一底稿来源版本，保留原值';final.append(other)
   if not math.isclose(first['value'],other['value'],rel_tol=1e-9,abs_tol=1e-7):issues.append(dict(type='source-version',observationId=first['id'],message=first['period']+' '+first['metric']+'：底稿不同来源版本存在差异；主值 '+str(first['value'])+'，另一版本 '+str(other['value']),alternative=dict(value=other['value'],sourceId=other['sourceId'],locator=other['locator'])))
 assert len({o['id'] for o in final})==len(final)
 assert len({key(o) for o in final})==len(final)
 byid={o['id']:o for o in final}
 for cid,sheet,row,col,raw,factor,ident in checks:assert byid[ident]['rawValue']==raw and byid[ident]['value']==raw*factor
 dest=root/'data/companies';parts=[]
 company_parts={}
 for cid in FILES:
  own=[o for o in final if o['companyId']==cid]
  company_parts[cid]=[]
  for k in range(0,len(own),800):
   path='data/companies/workbook-disclosures/'+cid+'/'+str(k//800+1).zfill(3)+'.json';parts.append(path);company_parts[cid].append(path)
   out=root/path;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(dict(observations=own[k:k+800]),ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
 index=dict(schemaVersion=1,updatedAt='2026-10-14',sources=sources,parts=parts,companyParts=company_parts,observationCount=len(final),counts=dict(collections.Counter(o['companyId'] for o in final)),issues=issues,verification=dict(sourceCellsReconciled=len(checks),sourceVersionsPreserved=duplicates,missingPolicy='空白不转零；不反推基期；异常入住率待核验'))
 dump(dest/'workbook-disclosures.json',index)
 cat=json.loads((dest/'catalog.json').read_text(encoding='utf-8'));existing={m['id'] for m in cat['metrics']}
 for k,v in METRICS.items():
  if k not in existing:cat['metrics'].append(dict(id=k,name=v[0],unit=v[1],category=v[2],aggregation=v[3]))
 cat['updatedAt']='2026-10-14';cat['workbookDisclosuresFile']='data/companies/workbook-disclosures.json';dump(dest/'catalog.json',cat)
 print(json.dumps({k:index[k] for k in ['observationCount','counts','verification']},ensure_ascii=False));print('issues',len(issues),'parts',len(parts))

if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--source-root',required=True);a.add_argument('--root',default='.');args=a.parse_args();main(args.source_root,args.root)
