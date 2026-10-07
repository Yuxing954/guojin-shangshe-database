"""Import explicit, whitelisted Choice indicator rows from saved official MCP replies.

Authentication and complete provider replies stay outside this public repository.
This importer only writes selected numeric indicators and their provenance.
"""
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

RULES = {
    'dutyfree': {
        '海南:离岛免税购物:金额(元)': ('dutyfree_sales', 1e8, '月'),
        '海南:离岛免税购物:人次(人次)': ('dutyfree_shoppers', 1e4, '月'),
        '海南:离岛免税购物:件数(件)': ('dutyfree_items', 1e4, '月'),
        '海南:离岛免税商品销售:购物金额:同比(%)': ('dutyfree_sales_yoy', 1, '月'),
        '海南:离岛免税购物:人次:当月同比(%)': ('dutyfree_shoppers_yoy', 1, '月'),
    },
    'gold-price': {'上海黄金交易所:黄金Au9999:收盘价(元/克)': ('gold_price', 1, '日')},
    'gold-retail': {
        '限额以上企业(单位)商品零售类值:金银珠宝类:当月值(元)': ('gold_retail', 1e8, '月'),
        '限额以上企业(单位)商品零售类值:金银珠宝类:当月同比(1-2月合并)(%)': ('gold_retail_yoy', 1, '月'),
    },
    'gold-demand': {'黄金消费量:全国:黄金首饰:累计值(吨)': ('gold_jewelry_volume', 1, '季')},
    'dining': {'中国:社会消费品零售总额:餐饮收入(元)': ('dining_revenue', 1e8, '月')},
    'dining-yoy': {
        '中国:限额以上企业餐饮收入总额(元)': ('dining_above_revenue', 1e8, '月'),
        '中国:限额以上企业餐饮收入总额:同比(%)': ('dining_above_yoy', 1, '月'),
    },
    'fx': {'中间价:美元兑人民币': ('crossborder_fx', 1, '日')},
    'freight': {'SCFI:综合指数': ('crossborder_scfi', 1, '周')},
    'crossborder': {
        '中国:出口金额:99章 跨境电商B2B简化申报商品(美元)': ('crossborder_b2b_subset', 1e8, '月'),
        '中国:出口金额:99章 跨境电商B2B简化申报商品:累计同比(%)': ('crossborder_b2b_cumulative_yoy', 1, '月'),
    },
}


def numeric(value):
    text = str(value or '').replace(',', '').strip()
    if text in ('', '-', '--', '暂无', 'null'):
        return None
    match = re.fullmatch(r'(-?\d+(?:\.\d+)?)\s*(万亿|亿|万)?', text)
    if not match:
        raise ValueError('Unrecognized numeric representation')
    return float(match[1]) * {'万亿': 1e12, '亿': 1e8, '万': 1e4, None: 1}[match[2]]


def normalize_reply(payload):
    records, sources = [], []
    query_id = payload['id']
    rules = RULES.get(query_id, {})
    for block in payload.get('result', {}).get('content', []):
        if block.get('type') != 'text':
            continue
        body = json.loads(block['text'])
        for sheet in body.get('data', []):
            columns = sheet.get('columns', [])
            if len(columns) < 3:
                continue
            for row in sheet.get('items', []):
                if not row or row[0] not in rules:
                    continue
                metric, divisor, frequency = rules[row[0]]
                if '（' + frequency + '）' not in columns[0]:
                    continue
                stamp = re.sub(r'[^0-9]', '', payload['retrieved_at'][:19])
                source_id = 'mx-' + query_id + '-' + stamp + '-' + str(len(sources))
                urls = sheet.get('meta', {}).get('jumpUrlList', [])
                url = next((item.get('choiceUrl') for item in urls if item.get('choiceUrl', '').startswith('https://choicew2z.eastmoney.com/')), '')
                sources.append({'id': source_id, 'name': row[1], 'provider': '东方财富妙想 / Choice', 'url': url, 'retrievedAt': payload['retrieved_at'], 'publishedAt': None, 'indicator': row[0], 'query': payload['query'], 'quality': 'provider'})
                for period, raw in zip(columns[2:], row[2:]):
                    value = numeric(raw)
                    if value is not None:
                        records.append({'metricId': metric, 'period': period, 'value': value / divisor, 'rawValue': raw, 'sourceId': source_id, 'basis': 'cumulative' if '累计' in row[0] else 'point' if frequency in ('日', '周') else 'monthly', 'quality': 'provider'})
    # A duplicate series returned under two agency names must not double observations.
    unique = {}
    for record in records:
        unique.setdefault((record['metricId'], record['period']), record)
    return list(unique.values()), sources


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('raw_directory', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    records, sources, attempts = [], [], []
    for path in sorted(args.raw_directory.glob('*.json')):
        payload = json.loads(path.read_text(encoding='utf-8-sig'))
        if payload.get('id') not in RULES and payload.get('id') != 'hotel':
            continue
        data, provenance = normalize_reply(payload)
        records.extend(data)
        sources.extend(provenance)
        attempts.append({'id': payload['id'], 'tool': payload['tool'], 'retrievedAt': payload['retrieved_at'], 'acceptedRecords': len(data), 'query': payload['query']})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'version': 1, 'generatedAt': datetime.now(timezone.utc).isoformat(), 'sources': sources, 'records': records, 'attempts': attempts}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Selected provider observations:', len(records))


if __name__ == '__main__':
    main()
