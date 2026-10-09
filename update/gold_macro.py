"""Normalize explicitly reviewed macro rows into a review batch; never import automatically."""
import argparse
from datetime import date as calendar_date
import hashlib
import json
import re
from pathlib import Path

INDICATORS = {
    'real10': ('美国:国债实际收益率(以通胀为标的):10年(%)', '%', '美联储'),
    'dxy': ('美元指数', '指数', 'NYCE'),
    'usdcny': ('中间价:美元兑人民币', 'CNY/USD', '中国人民银行'),
    'brent': ('日现货FOB价:欧洲布伦特原油(美元/桶)', 'USD/桶', 'EIA'),
}

def normalize(receipt, indicator, cutoff):
    calendar_date.fromisoformat(cutoff)
    name, unit, publisher = INDICATORS[indicator]
    if receipt.get('isError'):
        raise ValueError('MCP returned an error')
    tables = []
    for block in receipt.get('content', []):
        if block.get('type') == 'text':
            tables.extend(json.loads(block['text']).get('data', []))
    observations = {}
    matched = 0
    for table in tables:
        columns = table.get('columns', [])
        for row in table.get('items', []):
            if not row or row[0] != name:
                continue
            matched += 1
            if len(row) != len(columns) or row[1] != publisher:
                raise ValueError('Unexpected indicator source or dimensions')
            for date, value in zip(columns[2:], row[2:]):
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
                    raise ValueError('Not a daily date')
                calendar_date.fromisoformat(date)
                if date > cutoff or value in ('-', '', None):
                    continue
                if not re.fullmatch(r'-?\d+(?:\.\d+)?', str(value)):
                    raise ValueError('Unknown numeric representation')
                value = float(value)
                if date in observations and observations[date] != value:
                    raise ValueError('Conflicting observations')
                observations[date] = value
    if matched != 1 or not observations:
        raise ValueError('Expected exactly one nonempty reviewed indicator row')
    return {'id': indicator, 'originalName': name, 'reportedPublisher': publisher,
            'unit': unit, 'frequency': 'daily', 'quality': 'provider',
            'observations': [{'date': date, 'value': value} for date, value in sorted(observations.items())]}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('receipt', type=Path)
    parser.add_argument('--indicator', choices=INDICATORS, required=True)
    parser.add_argument('--cutoff', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    raw = args.receipt.read_bytes()
    result = normalize(json.loads(raw), args.indicator, args.cutoff)
    result['receiptSha256'] = hashlib.sha256(raw).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('Review batch written; repository data was not changed.')

if __name__ == '__main__':
    main()
