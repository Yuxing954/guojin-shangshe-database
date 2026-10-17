"""Keyless official US 10-year nominal constant-maturity yields; no estimates."""
import csv, hashlib, io, json, math, re
from datetime import date, timedelta
from pathlib import Path
from urllib.request import Request, build_opener
import xml.etree.ElementTree as ET
from gold_jewelry import NoRedirect

FRED_URL='https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd={start}&coed={cutoff}'
TREASURY_URL='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value={year}'
SOURCE_URL='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve'
FRED_SOURCE='https://fred.stlouisfed.org/series/DGS10'
REGISTRY_ID='treasury-cmt-10y'

def fetch_bytes(url):
    if not url.startswith(('https://home.treasury.gov/','https://fred.stlouisfed.org/')):raise ValueError('Untrusted source URL')
    with build_opener(NoRedirect()).open(Request(url,headers={'User-Agent':'GuojinMacro/3.0'}),timeout=60) as response:
        raw=response.read(4000001)
    if len(raw)>4000000:raise ValueError('Treasury response too large')
    digest=hashlib.sha256(raw).hexdigest()
    archive=Path(__file__).resolve().parents[1]/'.cache/macro-receipts'
    archive.mkdir(parents=True,exist_ok=True)
    (archive/('treasury-'+digest[:16]+('.xml' if b'<?xml' in raw[:50] else '.csv'))).write_bytes(raw)
    return raw

def value(text):
    if text is None or text.strip() in ('','.', 'N/A'):return None
    if not re.fullmatch(r'-?\d+(?:\.\d+)?',text.strip()):raise ValueError('Unknown numeric representation')
    result=float(text)
    if not math.isfinite(result) or not -5<=result<=30:raise ValueError('Observation outside reviewed bounds')
    return result

def insert(rows,period,number,start,cutoff,source):
    parsed=date.fromisoformat(period)
    if parsed.isoformat()!=period:raise ValueError('Invalid Treasury date')
    if not start<=period<=cutoff or number is None:return
    if period in rows and rows[period]['value']!=number:raise ValueError('Conflicting observations')
    rows[period]={'period':period,'value':number,'releaseDate':None,**({'sourceUrl':source} if source!=SOURCE_URL else {})}

def fred_rows(raw,start,cutoff):
    reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    if reader.fieldnames!=['observation_date','DGS10']:raise ValueError('Treasury series identity')
    rows={}
    for row in reader:insert(rows,row['observation_date'],value(row['DGS10']),start,cutoff,FRED_SOURCE)
    if not rows:raise ValueError('Empty Treasury source')
    return rows

def treasury_rows(raw,start,cutoff,year):
    tree=ET.fromstring(raw);rows={}
    namespace='http://schemas.microsoft.com/ado/2007/08/dataservices'
    for props in tree.iter('{http://schemas.microsoft.com/ado/2007/08/dataservices/metadata}properties'):
        fields={n.tag:n.text for n in props}
        if '{'+namespace+'}NEW_DATE' not in fields or '{'+namespace+'}BC_10YEAR' not in fields:raise ValueError('Treasury series identity')
        period=fields['{'+namespace+'}NEW_DATE'][:10]
        if int(period[:4])!=year:raise ValueError('Treasury year mismatch')
        insert(rows,period,value(fields['{'+namespace+'}BC_10YEAR']),start,cutoff,SOURCE_URL)
    if not rows:raise ValueError('Empty Treasury source')
    return rows

def assemble(previous,history,annual,receipts,start,cutoff):
    old={r['period']:r for r in previous.get('observations',[])}
    # Independently published H.15/FRED and Treasury observations must agree.
    if any(abs(history[p]['value']-annual[p]['value'])>1e-8 for p in history.keys()&annual.keys()):
        raise ValueError('Treasury source overlap conflict')
    incoming={**history,**annual}
    migrating=previous.get('registryId')!=REGISTRY_ID
    if migrating and any(p in incoming and abs(r['value']-incoming[p]['value'])>1e-8 for p,r in old.items()):
        raise ValueError('Treasury source migration conflict')
    if migrating and set(old)-set(incoming):raise ValueError('Treasury source migration incomplete')
    if not incoming:raise ValueError('Empty Treasury source')
    # Never drop an existing observation when an incremental annual feed is shorter.
    rows={**old,**incoming};revisions=sum(p in old and old[p]['value']!=r['value'] for p,r in incoming.items())
    from macro_auto import coverage
    spec={'id':'us-treasury10','start':start,'frequency':'daily'}
    result={'status':'ready','registryId':REGISTRY_ID,'observations':sorted(rows.values(),key=lambda r:r['period']),
        'sourceOrganization':'美国财政部','provider':'美国财政部公开XML / 美联储H.15历史（FRED）',
        'sourceUrl':SOURCE_URL,'metadataUrl':'https://home.treasury.gov/treasury-daily-interest-rate-xml-feed',
        'sourceReceipts':receipts,'receiptSha256':hashlib.sha256(json.dumps(receipts,sort_keys=True).encode()).hexdigest(),
        'spec':{'name':'10年期国债收益率','unit':'%','kind':'rate','frequency':'daily','source':'treasury','staleDays':10,
                'adjustment':'10年期固定期限；名义收益率；日度；非季调',
                'definition':'美国财政部10年期名义固定期限国债收益率（CMT），投资收益率口径；历史同口径美联储H.15/DGS10。'},
        'revisedCount':revisions,'coverage':coverage(list(rows.values()),spec)}
    migration=previous.get('sourceMigration')
    if migrating:migration={'previousProvider':previous.get('provider'),'previousReceiptSha256':previous.get('receiptSha256'),'matchedObservations':len(old),'conflicts':0,'historyPreserved':True}
    if migration:result['sourceMigration']=migration
    return result

def refresh(cutoff,previous=None,start='2016-01-01'):
    previous=previous or {};date.fromisoformat(cutoff);date.fromisoformat(start)
    receipts=[r for r in previous.get('sourceReceipts',[]) if r.get('role')=='official-history'];history={}
    first=min((r['period'] for r in previous.get('observations',[])),default='9999-12-31')
    if previous.get('registryId')!=REGISTRY_ID or first>(date.fromisoformat(start)+timedelta(days=7)).isoformat():
        receipts=[]
        url=FRED_URL.format(start=start,cutoff=cutoff);raw=fetch_bytes(url);history=fred_rows(raw,start,cutoff)
        receipts.append({'url':url,'receiptSha256':hashlib.sha256(raw).hexdigest(),'role':'official-history'})
    year=int(cutoff[:4]);url=TREASURY_URL.format(year=year);raw=fetch_bytes(url)
    annual=treasury_rows(raw,start,cutoff,year)
    receipts.append({'url':url,'receiptSha256':hashlib.sha256(raw).hexdigest(),'role':'official-current-year'})
    return assemble(previous,history,annual,receipts,start,cutoff)
