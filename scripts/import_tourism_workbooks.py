"""Read supplied workbooks without changing them. Preserve cell locators and cached values."""
import argparse,datetime,hashlib,json,math,pathlib,re
import openpyxl

def number(v):
    if v is None or isinstance(v,bool): return None
    try:
        n=float(v)
        return n if math.isfinite(n) else None
    except (ValueError,TypeError): return None

def pct(v):
    n=number(v)
    return n*100 if n is not None else None

def month(v):
    m=re.fullmatch(r'(\d{2})M(\d{1,2})',str(v))
    if m and 1<=int(m[2])<=12: return f'20{m[1]}-{int(m[2]):02d}'
    return None

def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def read(path):
    w=openpyxl.load_workbook(path,read_only=True,data_only=True)
    return {s.title:[{c.column_letter:c.value for c in row if c.value is not None}|{'row':i} for i,row in enumerate(s.iter_rows(),1)] for s in w}

def build(domestic,outbound,outdir):
    d,o=read(domestic),read(outbound)
    sources=[{'id':'domestic-book','name':domestic.name,'file':domestic.name,'quality':'用户数据库转录','checkedAt':'2026-10-23','sha256':sha(domestic)}, {'id':'outbound-book','name':outbound.name,'file':outbound.name,'quality':'用户数据库转录','checkedAt':'2026-10-23','sha256':sha(outbound)}]
    issues=[]
    holidays=[]
    order={'元旦':1,'春节':2,'清明':3,'五一':4,'端午':5,'中秋':6,'国庆':7,'国庆/中秋':7}
    sheet='出行人次 出行消费'
    for r in d[sheet]:
        y=number(r.get('A'));n=r.get('B');n='国庆/中秋' if n=='中秋/国庆' else n;days=number(r.get('C'));trips=number(r.get('D'));spend=number(r.get('F'))
        if y is None or y!=int(y) or not 2017<=y<=2026 or n not in order or not days or trips is None or spend is None: continue
        row=r['row'];loc=f"'{sheet}'!A{row}:H{row}"
        holidays.append(dict(year=int(y),holiday=n,order=order[n],period=f'{int(y)}年{n}',days=days,trips=trips,spend=spend,tripsYoY=pct(r.get('E')),spendYoY=pct(r.get('G')),sourceText=str(r.get('H','')),sourceId='domestic-book',locator=loc,rawTripsChange=r.get('E'),rawSpendChange=r.get('G')))
    existing={(r['year'],r['holiday']) for r in holidays}
    for r in d[sheet]:
        y=number(r.get('J'));n=r.get('K');days=number(r.get('L'));trips=number(r.get('M'));spend=number(r.get('O'))
        if y is None or not 2017<=y<=2026 or n not in order or (int(y),n) in existing or any(x['year']==int(y) and x['order']==order[n] for x in holidays) or not days or trips is None or spend is None: continue
        row=r['row'];holidays.append(dict(year=int(y),holiday=n,order=order[n],period=f'{int(y)}年{n}',days=days,trips=trips,spend=spend,tripsYoY=pct(r.get('N')),spendYoY=pct(r.get('P')),sourceText='原表辅助假期区',sourceId='domestic-book',locator=f"'{sheet}'!J{row}:P{row}",rawTripsChange=r.get('N'),rawSpendChange=r.get('P')));existing.add((int(y),n))
    holidays.sort(key=lambda r:(r['year'],r['order']))
    by={(r['year'],r['holiday']):r for r in holidays}
    for r in holidays:
        r['dailyTrips']=r['trips']/r['days'];r['dailySpend']=r['spend']/r['days'];r['perTrip']=r['spend']/r['trips'];p=by.get((r['year']-1,r['holiday']))
        # Holiday combinations differ across years. Do not force a combined festival into National Day.
        r['comparisonPeriod']=p['period'] if p else None;r['comparisonDays']=p['days'] if p else None
        for field in ['dailyTrips','dailySpend','perTrip']:
            r[field+'YoY']=(r[field]/p[field]-1)*100 if p and p[field]>0 else None
        if r['year']==2026 and r['holiday']=='国庆':
            r['dailyTripsYoY']=None;r['dailySpendYoY']=None;r['perTripYoY']=None
            issues.append({'locator':r['locator'],'message':'2026国庆7天与2025国庆/中秋8天不同；源表披露同比单列，不由跨假期总量强算同比。'})
    issues.append({'locator':"'出行人次 出行消费'!E35",'message':'2017国庆/中秋同比单元格混入26Q2文本；该同比留空。重复辅助区J25:P25误标2027端午，未导入，使用主表A:H。'})
    chang=[]
    for r in d['长白山']:
        p=month(r.get('E'));v=number(r.get('F'))
        if p and v is not None: chang.append({'period':p,'value':v,'sourceYoY':pct(r.get('G')),'sourceId':'domestic-book','locator':f"'长白山'!E{r['row']}:G{r['row']}"})
    chang.sort(key=lambda r:r['period']);cb={r['period']:r for r in chang}
    for r in chang:
        prior=cb.get(str(int(r['period'][:4])-1)+r['period'][4:]);r['change']=(r['value']/prior['value']-1)*100 if prior and prior['value']>0 else r['sourceYoY'];r['changeBasis']='同月客流计算' if prior and prior['value']>0 else '原表同比'
    jiuzhai=[]
    for r in d['九寨沟']:
        date=r.get('A');v=number(r.get('B'))
        if isinstance(date,datetime.datetime) and v is not None:
            jiuzhai.append({'period':date.strftime('%Y-%m-%d'),'value':v,'sourceId':'domestic-book','url':r.get('D'),'locator':f"'九寨沟'!A{r['row']}:E{r['row']}"})
    jiuzhai.sort(key=lambda r:r['period']);jb={r['period']:r for r in jiuzhai}
    for r in jiuzhai:
        p=jb.get(str(int(r['period'][:4])-1)+r['period'][4:]);r['change']=(r['value']/p['value']-1)*100 if p and p['value']>0 else None
    issues.append({'locator':"'九寨沟'!C2:C731",'message':'源表YOY部分对应其他日期，且含明显非同比计算。看板仅用同一月日的上年客流重算同比；基期缺失留空，不使用原C列。'})
    destinations=[]
    specs=[('日本','日本','B','D','E'),('韩国','韩国','A','B','C'),('中国香港','港澳台','C','D','E'),('中国澳门','港澳台','H','I','J'),('中国台湾','港澳台','L','M','N'),('越南','越南','A','C','D'),('泰国','泰国','A','B','C')]
    for name,s,pc,vc,yc in specs:
        records=[]
        for r in o[s]:
            p=month(r.get(pc));v=number(r.get(vc))
            if p and v is not None: records.append({'period':p,'value':v,'sourceYoY':pct(r.get(yc)),'sourceId':'outbound-book','locator':f"'{s}'!{pc}{r['row']}:{yc}{r['row']}"})
            elif v is not None and str(r.get(pc,'')).startswith('#'): issues.append({'locator':f"'{s}'!{pc}{r['row']}",'message':f'{name}数值{v}缺有效期间，保留原表、不推定月份。'})
        records.sort(key=lambda r:r['period']);destinations.append({'name':name,'records':records,'unit':'万人次'})
    records=[]
    for r in o['新加坡']:
        m=re.fullmatch(r'(20\d{2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)',str(r.get('A')));v=number(r.get('D'))
        if m and v is not None: records.append({'period':f"{m[1]}-{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].index(m[2])+1:02d}",'value':v/10000,'sourceYoY':pct(r.get('C')),'sourceId':'outbound-book','locator':f"'新加坡'!A{r['row']}:D{r['row']}"})
    destinations.append({'name':'新加坡','records':sorted(records,key=lambda r:r['period']),'unit':'万人次'})
    # Excel converted M-YY text to day-month in 2026. The period is ambiguous; retain quarantined records.
    malaysia=[{'rawDate':str(r.get('A')),'value':number(r.get('B')),'locator':f"'马来西亚'!A{r['row']}:F{r['row']}"} for r in o['马来西亚'] if number(r.get('B')) is not None]
    destinations.append({'name':'马来西亚','records':[],'unit':'万人次','status':'期间待核验','quarantined':malaysia})
    issues.append({'locator':"'马来西亚'!A2:A77",'message':f'原日期均为2026年，日期中的日号20—26疑似原年份。未获原始发布逐月确认，不猜测转换，{len(malaysia)}条原数保留在quarantined。'})
    for dest in destinations:
        lookup={r['period']:r for r in dest['records']}
        for r in dest['records']:
            p=lookup.get(str(int(r['period'][:4])-1)+r['period'][4:]);r['change']=(r['value']/p['value']-1)*100 if p and p['value']>0 else r['sourceYoY'];r['changeBasis']='同月客流计算' if p and p['value']>0 else '原表同比'
        dest['coverage']={'start':dest['records'][0]['period'] if dest['records'] else None,'end':dest['records'][-1]['period'] if dest['records'] else None,'count':len(dest['records'])}
    official=json.loads((outdir/'inbound-official.json').read_text(encoding='utf-8'))
    for r in official['border']: r['foreignShare']=r['foreign']/r['total']*100
    result={'schemaVersion':1,'checkedAt':'2026-10-23','sources':sources+official['sources'],'domestic':{'holidays':holidays,'changbai':chang,'jiuzhai':jiuzhai},'outbound':{'destinations':destinations},'inbound':{'border':official['border'],'tourists':official['tourists']},'issues':issues,'notes':[
        '国内游和出境游来自用户提供的Excel缓存值，保留原文件名、SHA256、工作表和单元格。文件名不是数据截止期；每条序列按实际期间标注。原表未含的月份不补零、不冒称已实时更新。',
        '国内假期总量、日均量、人均花费分开；人数单位亿人次、花费亿元、人均花费元。人均花费=花费亿元÷人次亿，日均值=假期总量÷天数。同比区分原表披露与同名假期测算；春节或国庆合并假期不得忽略天数差。',
        '目的地接待中国游客为当地统计，包含的居住地、国籍和出行目的可能不同，各目的地不加总为中国出境旅游总人次。缺月保留断点。数值单位统一换算万人次；能取得上年同月数值时用同月计算同比，否则保留原表同比并标明。',
        '国家移民管理局出入境查验合计、外国人单向入境、免签入境及文旅部入境游客为不同指标。外国人单向入境包含多种目的，不等同于外国游客；不得将外国人出入境合计除以2反推入境。',
        '参考图2026H1的4590.6万人次和20.6%属于外国人出入境合计；单向入境为2291.4万人次和20.4%。12.4%为外国人出入境查验占全部查验比例，不是入境游客占比。',
        '年度、上半年和第三季度分别绘图筛选，Q3是单季，不当作前三季度累计。原始总量有四舍五入，分项之和不强行归一化，比例以已披露总量为分母测算。2023H1外国人不含边民，保留原注，不强算跨口径增速。',
        '九寨沟同比按相同月日计算，未做星期及节假日错期调整；原表C列不可靠，未沿用。长白山读取E:G月度区，不把累计或季度区混进月度。',
        '马来西亚日期错位及韩国无有效期间的末行暂不进入趋势图，原值和定位保留在数据文件。国内原表含酒店和交通假期数据，本旅游页聚焦出游、花费及景区客流，酒店沿用现有酒店板块。'
    ]}
    from update_tourism_history import apply_history
    result=apply_history(result,outdir)
    target=outdir/'dashboard.json';target.write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    print(json.dumps({'file':str(target),'holidays':len(holidays),'changbai':len(chang),'jiuzhai':len(jiuzhai),'destinations':[(x['name'],x['coverage']) for x in destinations],'border':len(official['border']),'issues':len(issues)},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--domestic',type=pathlib.Path,required=True);p.add_argument('--outbound',type=pathlib.Path,required=True);p.add_argument('--output-dir',type=pathlib.Path,default=pathlib.Path('data/tourism'));a=p.parse_args();a.output_dir.mkdir(parents=True,exist_ok=True);build(a.domestic,a.outbound,a.output_dir)
