"""Import exact Choice forecast rows, retaining receipts, precision and unknown vintages."""
import argparse, hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPECS = {
    'cn-cpi': ('中国:预测值:CPI:同比(%)', 'monthly', '当月同比', True),
    'cn-gdp-quarter': ('中国:预测值:GDP:同比(%)', 'quarterly', '季度同比；实际/名义定义待核验', False),
    'cn-retail': ('中国:预测值:社会消费品零售总额:同比(%)', 'monthly', '同比；1—2月合并口径待核验', True),
}

def extract(receipt, metric_id, receipt_path, fetched_at):
    name, frequency, basis, comparable = SPECS[metric_id]
    if receipt.get('isError'): raise ValueError('Provider error')
    tables = [t for c in receipt.get('content', []) if c.get('type') == 'text'
              for t in json.loads(c['text']).get('data', [])]
    matches = []
    pattern = r'\d{4}-Q[1-4]' if frequency == 'quarterly' else r'\d{4}-(?:0[1-9]|1[0-2])'
    for table in tables:
        periods = table.get('columns', [])[2:]
        if not periods or not all(re.fullmatch(pattern, p) for p in periods): continue
        for row in table.get('items', []):
            if row[:2] != [name, 'Choice数据']: continue
            if len(row) != len(periods) + 2 or len(set(periods)) != len(periods):
                raise ValueError('Malformed forecast periods')
            urls = [s.get('choiceUrl', '') for s in table.get('meta', {}).get('jumpUrlList', [])]
            if len(urls) != 1 or not urls[0].startswith('https://choicew2z.eastmoney.com/dataDisplay/macroEDB/'):
                raise ValueError('Unverified forecast source')
            observations = []
            for period, raw in zip(periods, row[2:]):
                if raw in ('-', '--', '', None): continue
                if not re.fullmatch(r'-?\d+(?:\.\d+)?', str(raw)): raise ValueError('Invalid forecast value')
                observations.append({'period': period, 'value': float(raw), 'rawValue': str(raw),
                    'forecastDate': None, 'comparisonAllowed': comparable and not (metric_id == 'cn-retail' and period.endswith(('-01', '-02')))})
            matches.append({'name': name, 'frequency': frequency, 'unit': '%', 'basis': basis,
                'aggregation': None, 'vintageVerified': False, 'sourceName': 'Choice 预测值',
                'sourceUrl': urls[0], 'fetchedAt': fetched_at, 'receipt': receipt_path,
                'observations': sorted(observations, key=lambda r: r['period'])})
    if len(matches) != 1: raise ValueError(f'{metric_id}: expected one exact forecast series, got {len(matches)}')
    return matches[0]

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--receipt-dir', type=Path, required=True)
    ap.add_argument('--fetched-at', required=True)
    ap.add_argument('--output', type=Path, default=ROOT/'data/macro/expectations.json')
    args = ap.parse_args()
    series = {}
    for metric_id, key in [('cn-cpi','cpi'), ('cn-gdp-quarter','gdp'), ('cn-retail','retail')]:
        files = list(args.receipt_dir.glob('*-' + key + '.json'))
        if len(files) != 1: raise ValueError('One fresh receipt per indicator required')
        file = files[0].resolve()
        value = extract(json.loads(file.read_text(encoding='utf-8')), metric_id, file.relative_to(ROOT).as_posix(), args.fetched_at)
        value['receiptSha256'] = hashlib.sha256(file.read_bytes()).hexdigest()
        series[metric_id] = value
    result = {'version': 1, 'fetchedAt': args.fetched_at, 'series': series, 'notes': [
        'Choice预测值；接口未披露均值/中位数定义与调查发布日期，不标为公布前市场一致预期。',
        '历史差值仅为当前实际值减当前返回预测值，不代表公布时超预期；未取得公布前版本。',
        'GDP预测序列未进一步说明实际/名义口径，保留季度同比预测，暂不与实际GDP计算差值。',
        '社零1—2月预测值的合并口径未核验，保留原始期间，不拆分或参与差值。',
        '未来期间为预测对象期间，不能用作预测发布日期；未知发布日期保持空值。',
        '美国同类预测尚未取得匹配序列；不以IMF年度预测或实际值替代。']}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: len(v['observations']) for k,v in series.items()}))

if __name__ == '__main__': main()
