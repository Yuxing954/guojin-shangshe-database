"""Read public Gamma market snapshots; no account, wallet, trading, or invented price history."""
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
from macro_data import fetch

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'data/macro/predictions.json'
TRANSLATIONS=json.loads((ROOT/'data/macro/prediction-translations.json').read_text(encoding='utf-8'))

def localize(market):
    # Exact original-title matching prevents a changed contract from inheriting an old translation.
    return {**market, 'questionZh': TRANSLATIONS['questions'].get(market['question']),
        'optionLabelZh': TRANSLATIONS.get('options',{}).get(market['question'],market.get('optionLabel')),
        'outcomes': [{**o, 'nameZh': TRANSLATIONS['outcomes'].get(o['name'])} for o in market['outcomes']]}
THEMES=[
 ('经济与利率',r'\b(fed|fomc|interest rates?|rate cuts?|rate hikes?|inflation|recession|gdp|unemployment|cpi|pce|tariffs?|treasury|government shutdown)\b'),
 ('金融市场',r'\b(s&p|nasdaq|stock market|bitcoin|ethereum|gold price|oil price|crude oil|dollar index)\b'),
 ('政治与地缘',r'\b(presidential election|midterms?|senate|house of representatives|balance of power|ceasefire|invad\w*|taiwan|china.*(?:trade|tariff)|nuclear deal)\b'),
]
def theme(question):
    # Exclude rapid price bets and sporting markets even when a token is ambiguous.
    if re.search(r'\b(up or down|nba|nfl|premier league|world cup|champions league)\b',question,re.I):return None
    for name,pattern in THEMES:
        if re.search(pattern,question,re.I):return name
    return None

def parse_list(value):
    result=json.loads(value) if isinstance(value,str) else value
    if not isinstance(result,list):raise ValueError('Expected array')
    return result

def parse_date(value):
    result=datetime.fromisoformat(value.replace('Z','+00:00'))
    return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result

def normalize(row,now,category_override=None):
    question=row.get('question','')
    category=category_override or theme(question)
    if not category or row.get('active') is not True or row.get('closed') is not False or row.get('archived'):
        return None
    if not row.get('endDate') or parse_date(row['endDate'])<=now:return None
    if row.get('updatedAt') and parse_date(row['updatedAt'])>now:return None
    names=parse_list(row['outcomes']);prices=parse_list(row['outcomePrices'])
    if len(names)!=len(prices) or len(names)<2:return None
    numbers=[float(p) for p in prices]
    if any(not math.isfinite(p) or p<0 or p>1 for p in numbers):return None
    # Keep published prices, never renormalize them to manufacture probabilities.
    if abs(sum(numbers)-1)>.05:return None
    events=row.get('events') or []
    slug=events[0].get('slug') if events else row.get('slug')
    if not slug or not re.fullmatch(r'[a-zA-Z0-9_-]+',slug):return None
    def numeric(key):
        value=row.get(key)
        if value is None:return None
        value=float(value)
        if not math.isfinite(value) or value<0:raise ValueError('Invalid market statistics')
        return value
    return dict(id=str(row['id']),eventId=str(events[0].get('id',slug)) if events else slug,
        question=question,category=category,optionLabel=row.get('groupItemTitle'),outcomes=[dict(name=str(name),probability=p) for name,p in zip(names,numbers)],
        volume24h=numeric('volume24hr'),liquidity=numeric('liquidityNum'),spread=numeric('spread'),
        endDate=row['endDate'],updatedAt=row.get('updatedAt'),url='https://polymarket.com/event/'+slug)

def select(markets):
    selected=[];events={};categories={};seen=set()
    for market in sorted(markets,key=lambda m:m['volume24h'] or 0,reverse=True):
        if market['id'] in seen:continue
        seen.add(market['id'])
        event=market['eventId'];cat=market['category']
        if events.get(event,0)>=3 or categories.get(cat,0)>=8:continue
        selected.append(market);events[event]=events.get(event,0)+1;categories[cat]=categories.get(cat,0)+1
    return selected[:24]

def select_events(markets):
    groups={}
    for market in markets:
        groups.setdefault(market['eventId'],[]).append(market)
    counts={};selected=[]
    for items in sorted(groups.values(),key=lambda rows:sum(m['volume24h'] or 0 for m in rows),reverse=True):
        category=items[0]['category']
        if counts.get(category,0)>=6:continue
        counts[category]=counts.get(category,0)+1
        selected.append(items[0])
    return selected

def expand_event(event,seed,now):
    if str(event.get('id'))!=seed['eventId'] or event.get('closed') or event.get('archived'):raise ValueError('Event identity/status mismatch')
    raw=event.get('markets')
    if not isinstance(raw,list) or not raw:raise ValueError('Event has no markets')
    items=[];seen=set();expected=0
    for row in raw:
        if row.get('active') is not True or row.get('closed') is not False or row.get('archived'):continue
        try:
            if parse_date(row['endDate'])<=now:continue
        except (KeyError,ValueError,TypeError):raise ValueError('Missing active contract deadline')
        expected+=1
        item=normalize({**row,'events':[dict(id=event['id'],slug=event['slug'])]},now,seed['category'])
        if not item:raise ValueError('Invalid active event outcome')
        if item['id'] in seen:raise ValueError('Duplicate contract')
        seen.add(item['id']);items.append({**localize(item),'eventTitle':event.get('title'),'eventTitleZh':TRANSLATIONS.get('events',{}).get(event.get('title')),'eventComplete':True,'eventActiveMarketCount':expected})
    if not items:raise ValueError('No active valid outcomes')
    for item in items:item['eventActiveMarketCount']=len(items)
    return items

def with_previous(markets,previous):
    old={m['id']:m for m in previous.get('markets',[])}
    for item in markets:
        prior=old.get(item['id'])
        if not prior or prior['question']!=item['question']:continue
        prices={o['name']:o['probability'] for o in prior['outcomes']}
        for outcome in item['outcomes']:
            if outcome['name'] in prices:outcome['previousProbability']=prices[outcome['name']]
    return markets

def main():
    now=datetime.now(timezone.utc);stamp=now.isoformat(timespec='seconds')
    previous=json.loads(TARGET.read_text(encoding='utf-8')) if TARGET.exists() else dict(markets=[],fetchedAt=None)
    try:
        candidates=[];receipts=[];scanned=0
        for offset in range(0,600,100):
            url=f'https://gamma-api.polymarket.com/markets?limit=100&offset={offset}&active=true&closed=false&order=volume24hr&ascending=false'
            body,digest=fetch(url)
            if not isinstance(body,list):raise ValueError('Unexpected Gamma response')
            receipts.append(dict(url=url,sha256=digest));scanned+=len(body)
            for row in body:
                try:market=normalize(row,now)
                except (ValueError,KeyError,TypeError):continue
                if market:candidates.append(market)
            if len(body)<100:break
        markets=[]
        for seed in select_events(candidates):
            url='https://gamma-api.polymarket.com/events/'+seed['eventId']
            event,digest=fetch(url)
            receipts.append(dict(url=url,sha256=digest))
            markets.extend(expand_event(event,seed,now))
        if not markets:raise ValueError('No valid relevant markets')
        output=dict(version=2,status='ready',fetchedAt=stamp,checkedAt=stamp,previousFetchedAt=previous.get('fetchedAt'),markets=with_previous(markets,previous),receipts=receipts,
            selectionNote=f'扫描成交量排名前{scanned}个活跃合约；每主题最多6个事件，补取事件全部有效活跃合约。非全市场覆盖；原始价格不归一化。')
    except Exception:
        output={**previous,'status':'error','checkedAt':stamp,'error':'Gamma读取或校验失败；保留最后成功快照。'}
    temp=TARGET.with_suffix('.tmp');temp.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temp.replace(TARGET)
    print(output['status'],len(output['markets']),'markets')
    if output['status']=='error':raise SystemExit(1)

if __name__=='__main__':main()


