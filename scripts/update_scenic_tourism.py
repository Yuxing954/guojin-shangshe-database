"""Merge reviewed scenic observations and derive comparable monthly series.

Public-source snapshots retain each original URL and disclosure basis. Daily
missing values stay missing; qualified cumulative values are never differenced.
"""
import json
from pathlib import Path


def exact(item):
    return item is not None and not item.get('qualifier') and item.get('value') is not None


def build_oct(disclosures):
    monthly, cumulative = [], []
    lookup = {r['period']: r for r in disclosures}
    for raw in disclosures:
        period = raw['period']; year, month = map(int, period.split('-'))
        prior = lookup.get(f'{year}-{month-1:02}') if month > 1 else None
        common = {k: raw[k] for k in ['period', 'sourceId', 'url', 'publishedAt', 'locator']}
        ytd = raw['ytd']; direct = raw.get('monthly')
        cy = dict(common, value=ytd['value'] if exact(ytd) else None,
                  disclosedValue=ytd['value'], qualifier=ytd.get('qualifier', ''),
                  sourceYoY=ytd.get('sourceYoY'), sourceIds=[raw['sourceId']],
                  valueBasis='官方年初累计披露', growthQualifier=ytd.get('growthQualifier', ''))
        cumulative.append(cy)
        row = dict(common, sourceIds=[raw['sourceId']], sourceYoY=None,
                   value=None, valueBasis='缺少精确前期累计值')
        if exact(direct):
            row.update(value=direct['value'], valueBasis='官方当月披露', sourceYoY=direct.get('sourceYoY'))
        elif month == 1 and exact(ytd):
            row.update(value=ytd['value'], valueBasis='官方1月披露', sourceYoY=ytd.get('sourceYoY'))
        elif prior and exact(ytd) and exact(prior['ytd']):
            row.update(value=round(ytd['value'] - prior['ytd']['value'], 8),
                       valueBasis='相邻累计差额测算', sourceIds=[raw['sourceId'], prior['sourceId']])
        monthly.append(row)
    for rows in [monthly, cumulative]:
        lookup = {r['period']: r for r in rows}
        for row in rows:
            prior = lookup.get(str(int(row['period'][:4])-1) + row['period'][4:])
            row['comparisonPeriod'] = prior['period'] if prior else None
            row['comparisonSourceIds'] = prior['sourceIds'] if prior else []
            if row.get('sourceYoY') is not None:
                row['change'] = row['sourceYoY']; row['changeBasis'] = '公司公告披露同比'
            elif prior and prior['value'] and row['value'] is not None:
                row['change'] = (row['value'] / prior['value'] - 1) * 100
                row['changeBasis'] = '相同月份披露值计算'
            else:
                row['change'] = None; row['changeBasis'] = '缺少精确上年同月基期'
    return {'id': 'oct', 'name': '华侨城旗下文旅企业', 'unit': '万人次', 'frequency': 'month',
            'basis': '公司项目组合 · 含主题公园、酒店、商业等 · 非同店',
            'records': [r for r in monthly if r['period'] >= '2024-01'],
            'ytd': [r for r in cumulative if r['period'] >= '2024-01']}


def apply_scenic(data, folder):
    snapshot = json.loads((folder / 'scenic-official.json').read_text(encoding='utf-8'))
    known = {s['id'] for s in data['sources']}
    data['sources'] += [s for s in snapshot['sources'] if s['id'] not in known]
    for key in ['changbai', 'jiuzhai']:
        rows = {r['period']: dict(r) for r in data['domestic'][key]}
        for record in snapshot[key]:
            r = dict(record); old = rows.get(r['period'])
            if old and old['sourceId'] == 'domestic-book':
                r['originalWorkbook'] = {k: old.get(k) for k in ['value', 'sourceId', 'locator']}
            elif old and old.get('originalWorkbook'):
                r['originalWorkbook'] = old['originalWorkbook']
            rows[r['period']] = r
        for period, r in rows.items():
            prior = rows.get(str(int(period[:4])-1)+period[4:])
            r['comparisonPeriod'] = prior['period'] if prior else None
            r['comparisonSourceId'] = prior['sourceId'] if prior else None
            if key == 'changbai' and r['sourceId'] != 'domestic-book' and r.get('sourceYoY') is not None:
                r['change'] = r['sourceYoY']; r['changeBasis'] = '官方披露同比'
            elif prior and prior['value'] > 0:
                r['change'] = (r['value']/prior['value']-1)*100
                r['changeBasis'] = '同月客流计算' if key == 'changbai' else '上年相同月日实际客流计算'
            else:
                r['change'] = r.get('sourceYoY') if key == 'changbai' else None
                r['changeBasis'] = '原表同比' if r['change'] is not None else '缺少上年同口径基期'
        data['domestic'][key] = sorted(rows.values(), key=lambda r: r['period'])
    data['domestic']['scenicOther'] = [build_oct(snapshot['octDisclosures'])]
    data['domestic']['scenicAvailability'] = snapshot['availability']
    for note in snapshot['notes']:
        if note not in data['notes']:
            data['notes'].append(note)
    for item in snapshot['availability']:
        if item['status'].startswith('候选'):
            note = '连续景区数据检索：' + item['name'] + '；' + item['status'] + '。' + item.get('note', '')
            if note not in data['notes']:
                data['notes'].append(note)
    return data


if __name__ == '__main__':
    folder = Path(__file__).resolve().parents[1] / 'data' / 'tourism'
    target = folder / 'dashboard.json'
    target.write_text(json.dumps(apply_scenic(json.loads(target.read_text(encoding='utf-8')), folder), ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    print('Updated official scenic series and monthly tourism enterprise visitors')
