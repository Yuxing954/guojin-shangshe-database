"""Collect domestic spot gold; retain the last observation if upstream fails."""
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

DEST = Path(__file__).resolve().parents[1] / 'data/gold-jewelry/live.json'

def collect():
    request = Request('https://hq.sinajs.cn/list=gds_AU9999', headers={
        'Referer': 'https://finance.sina.com.cn/', 'User-Agent': 'Mozilla/5.0'})
    with urlopen(request, timeout=20) as response:
        text = response.read().decode('gb18030')
    match = re.search(r'hq_str_gds_AU9999="([^"]+)"', text)
    if not match:
        raise ValueError('Missing Au99.99 quote')
    fields = match[1].split(',')
    price, previous = float(fields[0]), float(fields[7])
    as_of = fields[12] + 'T' + fields[6] + '+08:00'
    datetime.fromisoformat(as_of)
    if price <= 0 or previous <= 0:
        raise ValueError('Invalid domestic quote')
    return {'symbol': 'AU9999', 'name': '上金所 Au99.99', 'price': price,
            'previousClose': previous, 'percent': (price / previous - 1) * 100,
            'unit': '元/克', 'asOf': as_of, 'source': '新浪财经转引',
            'url': 'https://finance.sina.com.cn/nmetal/', 'intervalMinutes': 5,
            'retrievedAt': datetime.now(timezone.utc).isoformat()}

if __name__ == '__main__':
    quote = collect()
    old = json.loads(DEST.read_text()) if DEST.exists() else None
    if old and quote['asOf'] < old['asOf']:
        raise ValueError('Source timestamp moved backwards; keeping last quote')
    if not old or (quote['asOf'], quote['price']) != (old['asOf'], old['price']):
        DEST.write_text(json.dumps(quote, ensure_ascii=False, indent=2) + '\n')
    print('Domestic gold source observation:', quote['asOf'])
