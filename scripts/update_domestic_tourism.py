"""Build domestic quarterly and cumulative series from reviewed MCT releases."""
import json
from pathlib import Path


def apply_domestic(data, folder):
    official = json.loads((folder / 'domestic-official.json').read_text(encoding='utf-8'))
    known = {s['id'] for s in data['sources']}
    data['sources'] += [s for s in official['sources'] if s['id'] not in known]
    cumulative = [dict(r) for r in official['cumulative']]
    lookup = {r['period']: r for r in cumulative}
    direct = {r['period']: r for r in official['directQuarters']}
    quarters = []
    for r in cumulative:
        q = r['quarter']
        previous = lookup.get(f"{r['year']}Q{q-1}") if q > 1 else None
        row = {k: r[k] for k in ['period', 'year', 'quarter', 'sourceId', 'locator']}
        row['scope'] = 'quarter'
        for key in ['trips', 'spend']:
            d = direct.get(r['period']) if key == 'trips' else None
            if d or q == 1:
                original = d or r
                row[key] = original[key]
                row[key + 'YoY'] = original.get(key + 'YoY')
                row[key + 'Basis'] = '官方披露'
                row[key + 'YoYBasis'] = '官方披露同比'
                row[key + 'SourceIds'] = [original['sourceId']]
            elif previous:
                row[key] = round(r[key] - previous[key], 8)
                row[key + 'YoY'] = None
                row[key + 'Basis'] = '累计差额测算'
                row[key + 'SourceIds'] = [r['sourceId'], previous['sourceId']]
            else:
                row[key] = row[key + 'YoY'] = None
                row[key + 'Basis'] = '缺少前一累计期'
                row[key + 'SourceIds'] = [r['sourceId']]
        quarters.append(row)
        for key in ['trips', 'spend']:
            r[key + 'Basis'] = '官方累计披露'
            r[key + 'YoYBasis'] = '官方披露同比'
            r[key + 'SourceIds'] = [r['sourceId']]
    for rows in [quarters, cumulative]:
        by_period = {r['period']: r for r in rows}
        for r in rows:
            prior = by_period.get(f"{r['year']-1}Q{r['quarter']}")
            r['comparisonPeriod'] = prior['period'] if prior else None
            for key in ['trips', 'spend']:
                r['comparison' + key.title() + 'SourceIds'] = prior[key + 'SourceIds'] if prior else []
                if r.get(key + 'YoY') is None:
                    r[key + 'YoY'] = (r[key] / prior[key] - 1) * 100 if prior and prior[key] and r[key] is not None else None
                    r[key + 'YoYBasis'] = '同季披露值差额计算' if r[key + 'YoY'] is not None else '缺少上年同季基期'
            r['perTrip'] = r['spend'] / r['trips'] if r['trips'] and r['spend'] is not None else None
            r['perTripBasis'] = '花费÷出游人次测算'
            r['perTripSourceIds'] = list(dict.fromkeys(r['tripsSourceIds'] + r['spendSourceIds']))
        for r in rows:
            prior = by_period.get(r['comparisonPeriod'])
            r['perTripYoY'] = (r['perTrip'] / prior['perTrip'] - 1) * 100 if prior and prior['perTrip'] and r['perTrip'] is not None else None
            r['perTripYoYBasis'] = '同口径人均花费计算' if r['perTripYoY'] is not None else '缺少上年同季基期'
            r['comparisonPertripSourceIds'] = prior['perTripSourceIds'] if prior else []
    data['domestic']['quarters'] = quarters
    data['domestic']['quarterYtd'] = cumulative
    for note in official['notes']:
        if note not in data['notes']:
            data['notes'].append(note)
    return data


if __name__ == '__main__':
    folder = Path(__file__).resolve().parents[1] / 'data' / 'tourism'
    target = folder / 'dashboard.json'
    target.write_text(json.dumps(apply_domestic(json.loads(target.read_text(encoding='utf-8')), folder), ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    print('Domestic quarterly and YTD tourism data updated')
