"""Validate a real Choice MCP receipt and merge hotel-sector investment YoY history."""
from __future__ import annotations
import argparse
import calendar
import csv
import io
import json
import math
import re
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse

NAME = '中国:固定资产投资额:住宿和餐饮业:累计同比(%)'
CODE = 'EMM01013000'
FIELDS = ['period_id', 'start_date', 'end_date', 'yoy_pct', 'amount_cny_100m',
          'release_date', 'publisher', 'provider', 'indicator_id', 'source_url', 'amount_source_url']

def receipt_rows(receipt: dict, cutoff: str) -> list[dict]:
    cutoff_date = date.fromisoformat(cutoff)
    if 'data' not in receipt and 'content' in receipt:
        texts = [item['text'] for item in receipt['content'] if item.get('type') == 'text']
        if len(texts) != 1:
            raise ValueError('回执必须含一份可解析的JSON正文')
        receipt = json.loads(texts[0])
    candidates = []
    for table in receipt.get('data', []):
        if table.get('columns', [None])[0] != '宏观数据（月）':
            continue
        for item in table.get('items', []):
            if item and item[0] == NAME:
                candidates.append((table, item))
    if len(candidates) != 1:
        raise ValueError('未取得唯一审定月度投资同比指标，拒绝替换')
    table, item = candidates[0]
    if item[1] != '国家统计局' or len(item) != len(table['columns']):
        raise ValueError('来源或数据列数不符')
    links = table.get('meta', {}).get('jumpUrlList', [])
    if len(links) != 1:
        raise ValueError('需唯一指标来源链接')
    url = urlparse(links[0].get('choiceUrl', ''))
    codes = parse_qs(url.fragment.partition('?')[2]).get('macroids', [])
    if url.hostname != 'choicew2z.eastmoney.com' or codes != [CODE]:
        raise ValueError('指标代码或来源链接不符')
    rows, seen = [], set()
    for period, value in zip(table['columns'][2:], item[2:]):
        if not re.fullmatch(r'\d{4}-(0[2-9]|1[0-2])', period) or period in seen:
            raise ValueError('月份不合法或重复，不能拆出1月')
        seen.add(period)
        year, month = map(int, period.split('-'))
        end = date(year, month, calendar.monthrange(year, month)[1])
        if end > cutoff_date:
            raise ValueError('回执包含截止日之后的数据期')
        if value in (None, '', '-', '--'):
            continue
        number = float(value)
        if not math.isfinite(number) or number < -100:
            raise ValueError('同比值超出可用范围')
        rows.append(dict(period_id=period, start_date=f'{year}-01-01', end_date=end.isoformat(),
                         yoy_pct=number, amount_cny_100m=None, amount_source_url=None, release_date=None))
    if not rows:
        raise ValueError('回执没有有效同比值')
    return sorted(rows, key=lambda row: row['period_id'])

def merge(existing: dict, rows: list[dict], checked_at: str) -> dict:
    if (existing.get('indicator_id') != CODE or existing.get('original_name') != NAME
            or existing.get('frequency') != 'monthly' or existing.get('aggregation') != 'year_to_date'
            or existing.get('yoy_unit') != '%' or existing.get('publisher') != '国家统计局'):
        raise ValueError('已有序列定义不符，拒绝合并')
    result = dict(existing)
    by_period = {}
    for row in existing['observations']:
        if row['period_id'] in by_period:
            raise ValueError('已有历史存在重复月份')
        by_period[row['period_id']] = dict(row)
    for row in rows:
        if row['period_id'] in by_period:
            # This receipt only carries YoY. Preserve separately verified amounts and release dates.
            by_period[row['period_id']]['yoy_pct'] = row['yoy_pct']
        else:
            by_period[row['period_id']] = row
    result['observations'] = sorted(by_period.values(), key=lambda row: row['period_id'])
    if result['observations'] != existing['observations']:
        result['retrieved_date'] = checked_at
    return result

def csv_text(data: dict) -> str:
    out = io.StringIO(newline='')
    writer = csv.DictWriter(out, fieldnames=FIELDS, lineterminator='\n')
    writer.writeheader()
    for row in data['observations']:
        writer.writerow({key: row.get(key, data.get(key, '')) for key in FIELDS})
    return '\ufeff' + out.getvalue()

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--receipt', type=Path, required=True)
    parser.add_argument('--checked-at', required=True)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    target = args.root / 'data/hotel-investment-monthly.json'
    existing = json.loads(target.read_text(encoding='utf-8-sig'))
    receipt = json.loads(args.receipt.read_text(encoding='utf-8-sig'))
    rows = receipt_rows(receipt, args.checked_at)
    result = merge(existing, rows, args.checked_at)
    changed = result != existing
    if changed:
        contents = {target: json.dumps(result, ensure_ascii=False, indent=2) + '\n',
                    target.with_suffix('.csv'): csv_text(result),
                    target.parent / 'hotel-investment-choice-receipt.json': json.dumps(receipt, ensure_ascii=False, indent=2) + '\n'}
        for file, content in contents.items():
            temporary = file.with_suffix(file.suffix + '.tmp')
            temporary.write_text(content, encoding='utf-8', newline='\n')
            temporary.replace(file)
    print(json.dumps(dict(changed=changed, observations=len(result['observations']),
                          latest=result['observations'][-1]['period_id']), ensure_ascii=False))

if __name__ == '__main__':
    main()
