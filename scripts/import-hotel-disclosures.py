from pathlib import Path
import json,hashlib,datetime
import argparse
ap=argparse.ArgumentParser();ap.add_argument('--source-root',required=True);ap.add_argument('--root',default='.');args=ap.parse_args()
R=Path(args.root); W=Path(args.source_root); observations=[];sources=[]
EXPECTED={'AI研报/首旅酒店/定期报告/首旅酒店_2026年半年度报告.pdf': '24bce043f4c00cc48e5f12afe7dcad005a2f364e07e6b459d39ef1cf1f568ffe', 'AI研报/锦江酒店/定期报告/锦江酒店_2026年半年度报告.pdf': 'a8621901329c1c26ccc35ae92da64c21752fc77f6c7eae60a9e162847361b2d0', 'AI研报/华住/定期报告/2026年第二季度及中期业绩公告.pdf': 'a0c308815938dd3e8a02c79f1b855b9415198a73d67cfa7ccf80af067dae1180'}
def source(cid,path,pages):
 f=W/path
 if hashlib.sha256(f.read_bytes()).hexdigest()!=EXPECTED[path]:raise ValueError('披露PDF已变化，需重新核验取数表：'+path)
 sid='report-'+hashlib.sha256(path.encode()).hexdigest()[:12]
 sources.append(dict(id=sid,companyId=cid,file=f.name,relativePath=path,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),importedAt=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),verification='本轮核对原PDF披露页及表格',pages=pages))
 return sid
S={c:source(c,p,pg) for c,p,pg in [('btg','AI研报/首旅酒店/定期报告/首旅酒店_2026年半年度报告.pdf','P7/P9/P12/P13/P14'),('jinjiang','AI研报/锦江酒店/定期报告/锦江酒店_2026年半年度报告.pdf','P9/P12/P13/P14'),('hworld','AI研报/华住/定期报告/2026年第二季度及中期业绩公告.pdf','P1/P2/P3')]}
def add(c,m,v,page,period='2026Q2',scope='全部',mode='全部',region=None,basis=None,yoy=None,reported_yoy=None,periodBasis=None,unit=None,currency=None):
 stock=m in ['hotels','rooms','pipeline'];price=m in ['adr','revpar'];money=m in ['revenue','parent_profit','hotel_revenue','other_revenue']
 region=region or {'btg':'中国','jinjiang':'中国大陆境内','hworld':'中国'}[c]
 basis=basis or {'btg':'模型经营数据 / 含轻管理','jinjiang':'有限服务型酒店','hworld':'HWC / Legacy-Huazhu'}[c]
 unit=unit or ('家' if m in ['hotels','pipeline','opened'] else '间' if m=='rooms' else '%' if m=='occ' else '百万元' if money else '元/间')
 currency=currency or ('CNY' if price or money else None)
 frequency='半年' if 'H' in period else '年度' if 'FY' in period else '季度'
 periodBasis=periodBasis or ('期末' if stock else '期间平均' if m in ['adr','revpar','occ'] else '半年' if frequency=='半年' else '单季')
 locator=f'PDF P{page} / {scope} / {mode} / {m}';key=[c,period,m,scope,mode,region,basis]
 o=dict(id='pdf-'+hashlib.sha256(json.dumps(key,ensure_ascii=False).encode()).hexdigest()[:16],companyId=c,period=period,frequency=frequency,periodBasis=periodBasis,metric=m,value=v,unit=unit,currency=currency,scope=scope,mode=mode,region=region,basis=basis,status='transcribed',sourceId=S[c],locator=locator,report=next(x['file'] for x in sources if x['id']==S[c]),pages='P'+str(page),formula=None,note='原报告披露页核对；无同比基期时不反推原值',rawValue=v,verification='原披露页核对')
 if reported_yoy is not None:o['reportedYoY']=reported_yoy
 observations.append(o)
 # prior-period raw values explicitly present in the same disclosure table
 if yoy is not None:add(c,m,yoy,page,period=str(int(period[:4])-1)+period[4:],scope=scope,mode=mode,region=region,basis=basis,periodBasis=periodBasis,unit=unit,currency=currency)

# BTG: scale includes two overseas hotels and unconsolidated JV/management-output hotels.
for scope,hotel,room in [('全部',8013,562116),('经济型',2070,163695),('中高端',2348,237682),('轻管理',3571,159439),('其他',24,1300)]:
 for m,v in [('hotels',hotel),('rooms',room)]:add('btg',m,v,12 if scope in ['经济型','中高端'] else 13,scope=scope,region='集团整体',basis='报告全网络 / 含未并表合资和管理输出')
for mode,h,r in [('直营',527,63947),('加盟',7486,498169)]:
 add('btg','hotels',h,13,mode=mode,region='集团整体',basis='报告全网络 / 含未并表合资和管理输出');add('btg','rooms',r,13,mode=mode,region='集团整体',basis='报告全网络 / 含未并表合资和管理输出')
for scope,v in [('全部',388),('经济型',74),('中高端',84),('轻管理',228),('其他',2)]:add('btg','opened',v,13,scope=scope,region='集团整体',basis='报告全网络 / 含未并表合资和管理输出')
add('btg','pipeline',1641,13,region='集团整体',basis='已签约未开业和正在签约')
for scope,a,o,r,changes in [('全部',224,63.4,142,[-0.2,-0.5,-1.0]),('经济型',193,69.2,134,[0.1,0,0.1]),('中高端',277,66.7,185,[-1.7,-0.7,-2.7]),('轻管理',166,51.6,86,[3.5,0.1,3.8]),('不含轻管理',240,67.8,163,[-0.6,-0.4,-1.2])]:
 for j,(m,v) in enumerate([('adr',a),('occ',o),('revpar',r)]):add('btg',m,v,14,scope=scope,basis='报告运营酒店 / 不含未并表合资和管理输出',reported_yoy=changes[j])
for m,v in [('adr',222),('occ',63.8),('revpar',142)]:add('btg',m,v,14,scope='18个月以上成熟酒店 / 含轻管理',basis='2026Q2固定成熟店组',reported_yoy={'adr':-2.4,'occ':-2.4,'revpar':-5.9}[m])
add('btg','revenue',1802.80436667,7,region='集团整体',basis='原报告单季财务');add('btg','parent_profit',271.61130812,7,region='集团整体',basis='原报告单季财务')
for m,v in [('hotel_revenue',3290.8585),('other_revenue',288.9263)]:add('btg',m,v,12,period='2026H1',region='集团整体',basis='模型累计财务',scope='全部')

# Jinjiang: both current and prior exact raw figures are printed in one table.
for scope,vals,prev in [('有限服务型酒店',[229.86,65.53,150.63],[236,65.36,154.25]),('全服务型酒店',[498.57,53.30,265.74],[500.30,53.49,267.61]),('中端酒店',[245.83,66.09,162.47],[252.25,66.82,168.55]),('经济型酒店',[166.61,63.41,105.65],[176.96,60.57,107.18])]:
 for m,v,b in zip(['adr','occ','revpar'],vals,prev):add('jinjiang',m,v,12,scope=scope,basis='全服务型酒店' if scope=='全服务型酒店' else '有限服务型酒店',yoy=b)
for m,v,b in [('adr',229.44,231.15),('occ',63.92,63.16),('revpar',146.66,145.99)]:add('jinjiang',m,v,12,period='2026H1',scope='有限服务型酒店',yoy=b)

# HWC/HWI franchise structure and pipeline. Existing group financial history remains authoritative.
for region,total,leased,franchised,rooms,lr,fr in [('中国',13417,484,12933,1310091,73888,1236203),('海外',122,63,59,25354,13442,11912)]:
 for mode,h,r in [('全部',total,rooms),('直营',leased,lr),('加盟',franchised,fr)]:
  for m,v in [('hotels',h),('rooms',r)]:add('hworld',m,v,2 if region=='中国' else 3,region=region,mode=mode,basis='中国酒店' if region=='中国' else 'HWI酒店')
for region,v in [('中国',3054),('海外',35)]:add('hworld','pipeline',v,2,region=region,basis='中国酒店' if region=='中国' else 'HWI酒店')
add('hworld','opened',498,2,basis='中国酒店');add('hworld','closed',176,2,basis='中国酒店',unit='家')
for m,v,b in [('adr',298,290),('occ',79.8,81),('revpar',238,235)]:add('hworld',m,v,2 if m!='revpar' else 3,yoy=b)
add('hworld','revpar',233,3,scope='18个月以上同店',basis='2026Q2固定同店组',yoy=240)
for m,v,b in [('adr',139,137),('occ',70.5,74),('revpar',98,102)]:add('hworld',m,v,3,region='海外',basis='HWI / 恒定美元 / 剔除临时关闭酒店',unit='美元/间' if m!='occ' else '%',currency='USD' if m!='occ' else None,yoy=b)

def q(**kw):return kw
def profile(c,intro,tags,ops,scale,fin,profit,structures,watch,gaps,sourceIds):
 return dict(id=c,intro=intro,tags=tags,operating=ops,scale=scale,financial=fin,profitMetric=profit,structures=structures,watch=watch,gaps=gaps,evidence=sourceIds)
P={}
P['jinjiang']=profile('jinjiang','境内与海外酒店业务并行，覆盖有限服务型、全服务型酒店；直营、自有租赁与加盟管理分开跟踪。',['境内 / 海外','有限服务 / 全服务','加盟管理'],q(region='中国大陆境内',scope='有限服务型酒店',mode='全部',basis='有限服务型酒店',frequency='季度'),q(region='全球',scope='全部',mode='全部',basis='酒店业务口径（含全服务型+有限服务型）',frequency='季度'),q(region='集团整体',scope='全部',mode='全部',basis='模型累计财务'),'parent_profit',[
 dict(title='经营模式 · 酒店数',metric='hotels',rows=[q(label='自有和租赁',mode='直营店/自有和租赁',basis='酒店业务含全服务型'),q(label='加盟和管理',mode='加盟店/加盟和管理',basis='酒店业务含全服务型')]),
 dict(title='酒店类型 · 酒店数',metric='hotels',rows=[q(label='有限服务型',mode='有限服务型酒店',basis='酒店业务含全服务型'),q(label='全服务型',mode='全服务型酒店',basis='酒店业务含全服务型')])],['境内有限服务型量价与同店表现','海外业务收入、亏损与直营改造','新开、退出、转筹建与净增的区别','所得税、财务费用对利润变动的影响'],['现金流、债务和所得税桥尚未形成连续结构化序列','境内外ADR与RevPAR币种不同，不合并作图'],[S['jinjiang']])
P['btg']=profile('btg','如家系与首旅品牌覆盖经济型至高端酒店，另有海南南山景区；酒店直营收入与加盟管理费采用不同确认方式。',['经济型 / 中高端','轻管理','酒店 + 景区'],q(region='中国',scope='全部',mode='全部',basis='报告运营酒店 / 不含未并表合资和管理输出',frequency='季度'),q(region='集团整体',scope='全部',mode='全部',basis='报告全网络 / 含未并表合资和管理输出',frequency='季度'),q(region='集团整体',scope='全部',mode='全部',basis='模型累计财务'),'parent_profit',[
 dict(title='经营模式 · 酒店数',metric='hotels',rows=[q(label='直营',mode='直营'),q(label='特许及管理输出',mode='加盟')]),
 dict(title='产品结构 · 酒店数',metric='hotels',rows=[q(label='经济型',scope='经济型'),q(label='中高端',scope='中高端'),q(label='轻管理',scope='轻管理'),q(label='其他',scope='其他')])],['含轻管理与不含轻管理的RevPAR','成熟店表现与新店扩张','标准管理酒店和轻管理开店占比','酒店业务与景区收入、利润贡献'],['Q2规模为全网络口径；旧模型“中国”口径不直接拼接同比','合资和管理输出门店纳入规模，但不纳入本期运营RevPAR'],[S['btg']])
P['hworld']=profile('hworld','集团分为华住中国HWC与海外HWI；通过直营、自有租赁及加盟管理扩张。酒店交易额与集团确认收入分别跟踪。',['HWC / HWI','加盟管理','收入 ≠ 酒店交易额'],q(region='中国',scope='全部',mode='全部',basis='HWC / Legacy-Huazhu',frequency='季度'),q(region='集团整体',scope='全部',mode='全部',basis='集团整体',frequency='季度'),q(region='集团整体',scope='全部',mode='全部',basis='集团整体'),'parent_profit',[
 dict(title='区域结构 · 酒店数',metric='hotels',rows=[q(label='HWC中国',region='中国',basis='中国酒店'),q(label='HWI海外',region='海外',basis='HWI酒店')]),
 dict(title='HWC经营模式 · 酒店数',metric='hotels',denominator=q(region='中国',basis='中国酒店'),rows=[q(label='直营及自有',region='中国',basis='中国酒店',mode='直营'),q(label='加盟及管理',region='中国',basis='中国酒店',mode='加盟')])],['华住中国ADR、入住率与成熟同店RevPAR','加盟管理收入增长及占比','HWI海外表现、汇率与恒定美元口径','开店、关店与待开业储备'],['2022Q4前后集团Blended与HWC口径切换','全年经营均值与季度HWC定义不同；同店组不跨年强行拼接'],[S['hworld']])
P['atour']=profile('atour','酒店业务以加盟及管理为主，同时经营亚朵星球零售。品牌、成熟同店、储备店与零售收入单独跟踪。',['酒店 + 零售','加盟及管理','品牌与同店'],q(region='全部',scope='全部',mode='全部',basis='全酒店 / 含税 / 剔除临时关闭客房',frequency='季度'),q(region='全部',scope='全部',mode='全部',basis='集团整体',frequency='季度'),q(region='全部',scope='全部',mode='全部',basis='集团整体'),'net_profit',[
 dict(title='经营模式 · 酒店数',metric='hotels',rows=[q(label='加盟',mode='加盟'),q(label='直营',mode='直营')])],['成熟同店与全酒店RevPAR差异','加盟酒店、待开业项目及品牌结构','酒店收入与零售收入的增长贡献','零售GMV、收入、费用及现金流分别跟踪'],['全酒店ADR×OCC与RevPAR有勾稽差异，保留源值','2020—2022零售及其他与2023起单列零售不可直接比较'],[])
P['juneyao']=dict(id='juneyao',intro='已建立上市主体档案，专项经营及财务数据待补。',tags=['待补资料'],operating={},scale={},financial={},profitMetric='parent_profit',structures=[],watch=['补充年报、半年报和经营底稿','补充品牌、直营加盟、门店与客房结构'],gaps=['暂无专项经营底稿','暂无可核验业务画像'],evidence=[])
for o in observations:
 if o['companyId']=='btg' and o['basis']=='原报告单季财务':
  o['rawValue']={'revenue':1802804366.67,'parent_profit':271611308.12}[o['metric']];o['originalUnit']='元';o['formula']=str(o['rawValue'])+'/1000000';o['note']='原报告以元披露，转换为百万元；核对原表数值'
 if o['companyId']=='btg' and o['metric'] in ['hotel_revenue','other_revenue']:
  o['rawValue']={'hotel_revenue':329085.85,'other_revenue':28892.63}[o['metric']];o['originalUnit']='万元';o['formula']=str(o['rawValue'])+'/100';o['note']='原报告以万元披露，转换为百万元；景区收入单列'
P['jinjiang']['structures'][0]['title']='有限服务型经营模式 · 酒店数'
P['jinjiang']['structures'][0]['denominator']=q(mode='有限服务型酒店',basis='酒店业务含全服务型')
P['btg']['pipeline']=q(region='集团整体',scope='全部',mode='全部',basis='已签约未开业和正在签约',frequency='季度')
P['hworld']['opened']=q(region='中国',scope='全部',mode='全部',basis='中国酒店',frequency='季度')
P['hworld']['pipeline']=P['hworld']['opened']
P['atour']['opened']=q(region='全部',scope='全部',mode='全部',basis='',frequency='季度')
out=R/'data/companies';out.mkdir(parents=True,exist_ok=True)
(out/'profiles.json').write_text(json.dumps(dict(schemaVersion=1,updatedAt='2026-10-10',companies=P),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
parts=[];batch=[];size=0
def flush():
 global batch,size
 if not batch:return
 f=f'data/companies/supplements/{len(parts)+1:03}.json';(R/f).parent.mkdir(parents=True,exist_ok=True);(R/f).write_text(json.dumps({'observations':batch},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');parts.append(f);batch=[];size=0
for o in observations:
 n=len(json.dumps(o,ensure_ascii=False).encode('utf-8'))
 if size+n>25000:flush()
 batch.append(o);size+=n
flush()
(out/'supplements.json').write_text(json.dumps(dict(schemaVersion=1,sources=sources,parts=parts),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('profiles',len(P),'supplement observations',len(observations))
