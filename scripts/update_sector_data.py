"""Incremental, provenance-preserving sector updates. No terminal credentials required.

Offline is the default. Choice receipts are supplied by an authorized MCP session;
public US quarterly tables can be refreshed explicitly with --refresh-us.
"""
import argparse
import calendar
import copy
import hashlib
import json
import math
import re
import urllib.request
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from summary_io import write_json_if_changed

ROOT = Path(__file__).resolve().parents[1]
LABELS = {'overseas': '出海', 'dining': '餐饮', 'gold': '黄金'}
PRIORITY = {'legacy': 0, 'provider': 1, 'official_reprint': 2, 'primary': 3, 'official': 3, 'derived': 3}


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def dates(period, basis):
    if re.fullmatch(r'\d{4}', period):
        return period + '-01-01', period + '-12-31', period + '年'
    match = re.fullmatch(r'(\d{4})-([QH])([1-4])', period)
    if match:
        year, kind, n = int(match[1]), match[2], int(match[3])
        if kind == 'H' and n > 2:
            raise ValueError('Invalid half year')
        last = n * (3 if kind == 'Q' else 6)
        first = last - (2 if kind == 'Q' else 5)
        if basis == 'ytd':
            first = 1
        label = f'{year}年{first}—{last}月' + ('累计' if basis == 'ytd' else '')
        return f'{year}-{first:02d}-01', f'{year}-{last:02d}-{calendar.monthrange(year, last)[1]:02d}', label
    if re.fullmatch(r'\d{4}-\d{2}', period):
        year, month = map(int, period.split('-'))
        first = 1 if basis in ('ytd', 'combined') else month
        return f'{year}-{first:02d}-01', f'{year}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}', f'{year}年{first}—{month}月累计' if basis == 'ytd' else f'{year}年1—2月' if basis == 'combined' else f'{year}年{month}月'
    date.fromisoformat(period)
    return period, period, period


def numeric(raw):
    text = str(raw).strip().replace(',', '')
    if text in ('', '-', '--', 'None'):
        return None
    m = re.fullmatch(r'(-?\d+(?:\.\d+)?)(万亿|亿|万)?', text)
    if not m:
        raise ValueError('Unrecognized number or unit')
    value = float(m[1]) * {'万亿': 1e12, '亿': 1e8, '万': 1e4, None: 1}[m[2]]
    if not math.isfinite(value):
        raise ValueError('Non-finite value')
    return value


# Exact provider indicator AND table frequency. Never infer an index is a rate.
CHOICE = {
    ('中国:限额以上企业餐饮收入总额(元)', 'monthly'): ('dining_above_revenue', 1e8, 'monthly', '国家统计局'),
    ('社会消费品零售总额:限额以上单位餐饮收入总额:当月同比(1-2月合并)(%)', 'monthly'): ('dining_above_yoy', 1, 'combined_monthly', '国家统计局'),
    ('社会消费品零售总额:餐饮收入:当月同比(1-2月合并)(%)', 'monthly'): ('dining_revenue_yoy', 1, 'combined_monthly', '国家统计局'),
    ('社会消费品零售总额:餐饮收入:当月值(1-2月合并)(元)', 'monthly'): ('dining_revenue', 1e8, 'combined_monthly', '国家统计局'),
    ('中国:社会消费品零售总额:餐饮收入(元)', 'monthly'): ('dining_revenue', 1e8, 'monthly', '国家统计局'),
    ('中国:社会消费品零售总额:餐饮收入:同比(%)', 'monthly'): ('dining_revenue_yoy', 1, 'monthly', '国家统计局'),
    ('中国:社会消费品零售总额:餐饮收入:累计值(元)', 'monthly'): ('dining_revenue_ytd', 1e8, 'ytd', '国家统计局'),
    ('中国:社会消费品零售总额:餐饮收入:同比(%)', 'annual'): ('dining_revenue_annual_yoy', 1, 'year', '国家统计局'),
    ('中国:限额以上企业社会消费品零售总额:餐饮收入(元)', 'annual'): ('dining_above_annual', 1e8, 'year', '国家统计局'),
    ('中国:限额以上企业社会消费品零售总额:餐饮收入:同比(%)', 'annual'): ('dining_above_annual_yoy', 1, 'year', '国家统计局'),
    ('中国:限额以上企业餐饮收入总额:累计值(元)', 'monthly'): ('dining_above_ytd', 1e8, 'ytd', '国家统计局'),
    ('中国:限额以上企业餐饮收入总额:累计同比(%)', 'monthly'): ('dining_above_ytd_yoy', 1, 'ytd', '国家统计局'),
    ('中国:CPI:食品:累计同比(%)', 'monthly'): ('dining_food_cpi_ytd', 1, 'ytd', '国家统计局'),
    ('中国:CPI:食品:肉禽及其制品:猪肉:同比(%)', 'monthly'): ('dining_pork_cpi_yoy', 1, 'monthly', '国家统计局'),
    ('SCFI:综合指数', 'weekly'): ('crossborder_scfi', 1, 'point', '上海航运交易所'),
}


def choice_receipt(receipt, retrieved_at, cutoff):
    result = receipt.get('result', receipt)
    tables = json.loads(next(c['text'] for c in result['content'] if c['type'] == 'text'))['data']
    sources, records, rejected = [], [], []
    for table in tables:
        columns = table['columns']
        frequency = 'annual' if '年）' in columns[0] else 'weekly' if '周）' in columns[0] else 'monthly' if '月）' in columns[0] else ''
        for row in table['items']:
            if not isinstance(row, list) or len(row) != len(columns):
                raise ValueError('Unexpected Choice table shape')
            spec = CHOICE.get((row[0], frequency))
            if not spec or row[1] != spec[3]:
                rejected.append({'indicator': row[0], 'frequency': frequency, 'reason': '指标名称、单位、频率或原始机构不匹配白名单'})
                continue
            metric, divisor, basis, publisher = spec
            links = table.get('meta', {}).get('jumpUrlList', [])
            url = next((v['choiceUrl'] for v in links if v.get('choiceUrl', '').startswith('https://choicew2z.eastmoney.com/')), '')
            if not url:
                raise ValueError('Missing Choice source link')
            sid = 'choice-' + hashlib.sha256((row[0] + frequency + retrieved_at).encode()).hexdigest()[:16]
            sources.append({'id': sid, 'name': row[0], 'publisher': publisher, 'provider': 'Choice / 东方财富 MCP', 'url': url, 'publishedAt': None, 'retrievedAt': retrieved_at, 'quality': 'provider', 'queryIndicator': row[0], 'publishedAtStatus': '接口未返回发布日期', 'receiptSha256': hashlib.sha256(json.dumps(result, ensure_ascii=False, sort_keys=True).encode()).hexdigest(), 'locator': columns[0] + ' / ' + row[0]})
            for period, raw in zip(columns[2:], row[2:]):
                value = numeric(raw)
                if value is None:
                    continue
                point_basis = ('combined' if period.endswith('-02') else 'monthly') if basis == 'combined_monthly' else basis
                if frequency == 'monthly' and point_basis == 'monthly' and metric in ('dining_revenue', 'dining_revenue_yoy', 'dining_above_revenue', 'dining_above_yoy') and period.endswith(('-01', '-02')):
                    raise ValueError('Single January/February must be reviewed, not inferred')
                start, end, label = dates(period, point_basis)
                if end > cutoff:
                    raise ValueError('Future observation')
                value /= divisor
                if (divisor > 1 or metric == 'crossborder_scfi') and value <= 0:
                    raise ValueError('Non-positive amount/index')
                if metric.endswith(('yoy', 'cpi_ytd')) and not -100 <= value <= 500:
                    raise ValueError('Rate outside review bounds')
                records.append({'metricId': metric, 'period': period, 'basis': point_basis, 'startDate': start, 'endDate': end, 'periodLabel': label, 'value': value, 'sourceId': sid, 'quality': 'provider', 'originalValue': raw, 'unitConversion': f'原始元 ÷ {divisor:g}' if divisor > 1 else '原始值'})
    return {'sources': sources, 'records': records, 'rejected': rejected}


def parse_us(text, adjustment, source_id, cutoff):
    records = []
    for line in text.splitlines():
        cells = line.strip().split('/')
        if len(cells) != 8:
            raise ValueError('Unexpected Census table')
        m = re.fullmatch(r'([1-4])(?:st|nd|rd|th) quarter (\d{4})(\([pr]\))?', cells[0])
        if not m:
            raise ValueError('Unrecognized Census period')
        period = f'{m[2]}-Q{m[1]}'
        start, end, label = dates(period, 'quarter')
        if end > cutoff:
            raise ValueError('Future Census period')
        if int(m[2]) < 2016:
            continue
        for metric, col, scale in [(f'us_ecommerce_{adjustment}', 2, 100), (f'us_ecommerce_share_{adjustment}', 3, 1)]:
            value = numeric(cells[col]) / scale
            record = {'metricId': metric, 'period': period, 'basis': 'quarter', 'startDate': start, 'endDate': end, 'periodLabel': label + (' · 季调' if adjustment == 'sa' else ' · 未季调'), 'value': value, 'sourceId': source_id, 'quality': 'official', 'status': '初步' if m[3] == '(p)' else '修订' if m[3] == '(r)' else '披露值'}
            if col == 2:
                record.update(change=numeric(cells[7]), changeLabel='同比', mom=numeric(cells[5]), calculation='官方同比/环比；未自行回算')
            records.append(record)
    if not records:
        raise ValueError('Empty Census table')
    return records


def validate(data, cutoff):
    metrics = {m['id']: m for m in data['metrics']}
    sources = {s['id']: s for s in data['sources']}
    if len(metrics) != len(data['metrics']) or len(sources) != len(data['sources']):
        raise ValueError('Duplicate definitions')
    seen = set()
    for m in data['metrics']:
        if not m.get('scope') or not m.get('unit') or not m.get('frequency'):
            raise ValueError('Incomplete metric definition')
        for p in m['points']:
            key = (m['id'], p['period'], p['basis'])
            if key in seen:
                raise ValueError('Duplicate observation')
            seen.add(key)
            if not isinstance(p['value'], (int, float)) or not math.isfinite(p['value']):
                raise ValueError('Non-finite observation')
            s = sources[p['sourceId']]
            if not (s.get('url') or s.get('file')):
                raise ValueError('Missing source')
            if not '0001-01-01' <= p['startDate'] <= p['endDate'] <= cutoff:
                raise ValueError('Invalid/future period')
            if s.get('publishedAt') and s['publishedAt'][:10] > cutoff:
                raise ValueError('Future source publication')
            if m.get('basis') and p['basis'] != m['basis']:
                raise ValueError('Mixed metric basis')
            expected = {'year': r'\d{4}', 'quarter': r'\d{4}-Q[1-4]', 'half': r'\d{4}-H[12]', 'monthly': r'\d{4}-\d{2}', 'combined': r'\d{4}-02'}.get(p['basis'])
            if expected and not re.fullmatch(expected, p['period']):
                raise ValueError('Period does not match basis')
            if p['basis'] == 'monthly' and p['period'].endswith(('-01', '-02')) and m['id'] in ('dining_revenue', 'dining_revenue_yoy', 'dining_above_revenue', 'dining_above_yoy'):
                raise ValueError('Inferred January/February')
    company_keys = set()
    companies = {c['id'] for c in data['companies']}
    for p in data['companyObservations']:
        key = (p['companyId'], p['metricId'], p['period'], p['basis'])
        if key in company_keys or p['companyId'] not in companies:
            raise ValueError('Duplicate/unknown company observation')
        company_keys.add(key)
        if p['sourceId'] not in sources or not math.isfinite(p['value']):
            raise ValueError('Invalid company fact')
        start, end, _ = dates(p['period'], p['basis'])
        if end > cutoff or not p.get('unit') or not p.get('scope'):
            raise ValueError('Invalid company period/unit/scope')
        if p.get('calculation') and not p.get('inputs'):
            raise ValueError('Derived fact without inputs')
    return data


def build(root=ROOT, cutoff=None):
    cutoff = cutoff or date.today().isoformat()
    overview = read(root / 'data/industry/overview.json')
    seed = read(root / 'data/sectors/reviewed.json')
    incoming = [read(root / 'data/sectors/choice-history.json'), read(root / 'data/sectors/us-retail.json'), seed]
    # Reuse already reviewed NBS observations; no duplicate scraping or rounding.
    consumption = read(root / 'data/consumption-macro/observations.json')
    nbs = {'sources': consumption['sources'], 'records': []}
    for p in consumption['observations']:
        stem = {'catering': 'dining_revenue', 'above_catering': 'dining_above_revenue'}.get(p['indicatorId'])
        if not stem:
            continue
        suffix = {'monthly': '', 'combined': '', 'ytd': '_ytd', 'year': '_annual'}.get(p['basis'])
        if suffix is None:
            continue
        id = stem + suffix
        id = id.replace('dining_above_revenue_', 'dining_above_')
        start, end, label = dates(p['period'], p['basis'])
        nbs['records'].append({'metricId': id, 'period': p['period'], 'basis': p['basis'], 'startDate': start, 'endDate': end, 'periodLabel': label, 'value': p['value'], 'change': p.get('yoy'), 'changeLabel': '同比', 'sourceId': p['sourceId'], 'quality': 'official'})
        if p.get('yoy') is not None:
            rate_id = {'dining_revenue': 'dining_revenue_yoy', 'dining_above_revenue': 'dining_above_yoy', 'dining_revenue_annual': 'dining_revenue_annual_yoy', 'dining_above_annual': 'dining_above_annual_yoy', 'dining_revenue_ytd': 'dining_revenue_ytd_yoy', 'dining_above_ytd': 'dining_above_ytd_yoy'}[id]
            nbs['records'].append({**nbs['records'][-1], 'metricId': rate_id, 'value': p['yoy'], 'change': None})
    incoming.append(nbs)
    output = {}
    for sid in ('overseas', 'dining'):
        baseline = next((s for s in overview['sectors'] if s['id'] == sid), None)
        path = root / f'data/sectors/{sid}.json'
        previous = read(path) if path.exists() else None
        # Retired boards remain archival inputs without restoring website entries.
        baseline = baseline or previous
        if baseline is None:
            raise ValueError(f'Missing baseline or archive for {sid}')
        definitions = {m['id']: {k: v for k, v in m.items() if k != 'points'} for m in baseline['metrics']}
        definitions.update({m['id']: m for m in seed['metrics'] if m['sectorId'] == sid})
        source_map = {s['id']: s for s in overview['sources']}
        selected, revisions = {}, copy.deepcopy(previous.get('revisions', [])) if previous else []
        def rank(r):
            s = source_map[r['sourceId']]
            return (PRIORITY.get(r.get('quality', s.get('quality', 'legacy')), 0), s.get('publishedAt') or '', s.get('retrievedAt') or '')
        def add(p):
            if p['metricId'] not in definitions:
                return
            key = (p['metricId'], p['period'], p['basis'])
            old = selected.get(key)
            if old and rank(old) > rank(p):
                return
            if old and old['value'] != p['value']:
                revision = {'metricId': p['metricId'], 'period': p['period'], 'basis': p['basis'], 'previousValue': old['value'], 'previousSourceId': old['sourceId'], 'selectedValue': p['value'], 'selectedSourceId': p['sourceId'], 'reason': '官方原始披露优先；金额保留原始精度'}
                if revision not in revisions:
                    revisions.append(revision)
            selected[key] = copy.deepcopy(p)
        if previous:
            source_map.update({s['id']: s for s in previous['sources']})
        for m in (previous or baseline)['metrics']:
            for p in m['points']:
                add(p)
        for evidence in incoming:
            source_map.update({s['id']: {**s, 'name': s.get('name', s.get('title', s['id']))} for s in evidence['sources']})
            for p in evidence['records']:
                add(p)
        metrics = []
        for mid, definition in definitions.items():
            points = sorted((p for (id, _, _), p in selected.items() if id == mid), key=lambda p: (p['endDate'], p['basis']))
            definition = dict(definition)
            rate_id = definition.get('changeMetric') or {'dining_revenue_ytd': 'dining_revenue_ytd_yoy', 'dining_above_ytd': 'dining_above_ytd_yoy', 'dining_revenue_annual': 'dining_revenue_annual_yoy', 'dining_above_annual': 'dining_above_annual_yoy'}.get(mid)
            for point in points:
                rate = selected.get((rate_id, point['period'], point['basis']))
                if rate and point.get('change') is None:
                    ps, rs = source_map[point['sourceId']], source_map[rate['sourceId']]
                    matching = point['sourceId'] == rate['sourceId'] or (ps.get('receiptSha256') and ps.get('receiptSha256') == rs.get('receiptSha256') and ps.get('retrievedAt') == rs.get('retrievedAt'))
                    if matching:
                        point.update(change=rate['value'], changeLabel='同比', changeSourceId=rate['sourceId'])
            if points:
                definition.pop('missing', None)
            metrics.append({**definition, 'points': points})
        company_map = {c['id']: c for c in (previous or {}).get('companies', [])}
        company_map.update({c['id']: c for c in seed['companies'] if sid in c['sectors']})
        companies = list(company_map.values())
        company_ids = {c['id'] for c in companies}
        fact_map = {(p['companyId'], p['metricId'], p['period'], p['basis']): p for p in (previous or {}).get('companyObservations', [])}
        for p in seed['companyObservations']:
            if p['companyId'] not in company_ids:
                continue
            key = (p['companyId'], p['metricId'], p['period'], p['basis'])
            old = fact_map.get(key)
            if old and rank(old) > rank(p):
                continue
            fact_map[key] = p
        facts = list(fact_map.values())
        used = {p[k] for m in metrics for p in m['points'] for k in ('sourceId', 'changeSourceId') if p.get(k)} | {p['sourceId'] for p in facts} | {r[k] for r in revisions for k in ('previousSourceId', 'selectedSourceId')}
        checked = max((source_map[k].get('retrievedAt') or '')[:10] for k in used)
        output[sid] = validate({'schemaVersion': 1, 'id': sid, 'name': LABELS[sid], 'checkedAt': checked, 'core': seed['core'][sid], 'defaultMetric': seed['core'][sid][0], 'metrics': metrics, 'sources': [source_map[k] for k in sorted(used)], 'companies': companies, 'companyObservations': facts, 'research': [r for r in seed['research'] if r['sectorId'] == sid], 'gaps': [g for g in seed['gaps'] if g['sectorId'] == sid], 'revisions': revisions}, cutoff)
    return output


def sync_overview(payload, snapshots):
    payload = copy.deepcopy(payload)
    sources = {s['id']: s for s in payload['sources']}
    for sector in payload['sectors']:
        sector['name'] = LABELS.get(sector['id'], sector['name'])
        if sector['id'] not in snapshots:
            continue
        data = snapshots[sector['id']]
        sector.update(metrics=data['metrics'], core=data['core'], defaultMetric=data['defaultMetric'], detailHref='industry.html#' + sector['id'] if sector['id']=='dining' else sector['id'] + '.html', checkedAt=data['checkedAt'], note='')
        sector['sourceIds'] = sorted({p['sourceId'] for m in data['metrics'] for p in m['points']})
        sources.update({s['id']: s for s in data['sources']})
    payload['sources'] = list(sources.values())
    return payload


def refresh_us(root, cutoff):
    records, sources = [], []
    captured = datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')
    # Release notice is retained as a separate vintage field; retrieval is not publication.
    notice_url = 'https://www.census.gov/retail/eCommerce.html'
    notice = urllib.request.urlopen(notice_url, timeout=30).read().decode('utf-8')
    release = re.search(r'August 18, 2026', notice)
    if not release:
        raise ValueError('New Census release requires publication-date review')
    for adjustment, filename in [('sa', 'tsadprectbl3.dat'), ('nsa', 'tsnadprectbl3.dat')]:
        url = 'https://www.census.gov/retail/mrts/www/data/delimited/' + filename
        raw = urllib.request.urlopen(url, timeout=30).read()
        source_id = 'census-' + adjustment + '-' + hashlib.sha256(raw).hexdigest()[:12]
        parsed = parse_us(raw.decode('utf-8'), adjustment, source_id, cutoff)
        if max(p['period'] for p in parsed) != '2026-Q2':
            raise ValueError('New Census vintage requires review')
        sources.append({'id': source_id, 'name': 'US Census Quarterly Retail E-Commerce', 'publisher': '美国人口普查局', 'provider': '官方公开表', 'url': url, 'releaseUrl': notice_url, 'publishedAt': '2026-08-18', 'retrievedAt': captured, 'quality': 'official', 'sha256': hashlib.sha256(raw).hexdigest(), 'vintage': '2026-08-18；9月28日提示年度修订，更新估计待3Q发布', 'locator': 'Table 1 / millions of dollars; seasonally adjusted' if adjustment == 'sa' else 'Table 1 / not adjusted', 'adjustment': adjustment})
        records.extend(parsed)
    return {'sources': sources, 'records': records}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--cutoff', default=date.today().isoformat())
    parser.add_argument('--choice-receipts', type=Path)
    parser.add_argument('--retrieved-at')
    parser.add_argument('--refresh-us', action='store_true')
    args = parser.parse_args()
    staged = {}
    try:
        if args.choice_receipts:
            if not args.retrieved_at:
                raise ValueError('--retrieved-at required for receipts')
            prior = read(args.root / 'data/sectors/choice-history.json')
            for path in sorted(args.choice_receipts.glob('*.json')):
                result = choice_receipt(read(path), args.retrieved_at, args.cutoff)
                if not result['records'] and result['rejected']:
                    # Rejected queries are documented, but do not replace histories.
                    pass
                for k in ('sources', 'records', 'rejected'):
                    prior.setdefault(k, []).extend(result[k])
            prior['sources'] = list({s['id']: s for s in prior['sources']}.values())
            prior['records'] = list({(r['metricId'], r['period'], r['basis']): r for r in prior['records']}.values())
            prior['rejected'] = list({json.dumps(r, sort_keys=True): r for r in prior['rejected']}.values())
            staged['choice-history.json'] = prior
        if args.refresh_us:
            staged['us-retail.json'] = refresh_us(args.root, args.cutoff)
        # Stage evidence in an isolated copy; validate every snapshot before mutations.
        if staged:
            import tempfile, shutil
            with tempfile.TemporaryDirectory() as temp:
                tmp = Path(temp)
                for relative in ['data/industry/overview.json', 'data/consumption-macro/observations.json']:
                    target = tmp / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(args.root / relative, target)
                shutil.copytree(args.root / 'data/sectors', tmp / 'data/sectors')
                for name, payload in staged.items():
                    write_json_if_changed(tmp / 'data/sectors' / name, payload)
                snapshots = build(tmp, args.cutoff)
        else:
            snapshots = build(args.root, args.cutoff)
        for name, payload in staged.items():
            write_json_if_changed(args.root / 'data/sectors' / name, payload)
        for sid, data in snapshots.items():
            write_json_if_changed(args.root / f'data/sectors/{sid}.json', data)
        overview = sync_overview(read(args.root / 'data/industry/overview.json'), snapshots)
        write_json_if_changed(args.root / 'data/industry/overview.json', overview, volatile={'generatedAt'})
        write_json_if_changed(args.root / 'data/sectors/update-status.json', {'status': 'ok', 'checkedAt': max(d['checkedAt'] for d in snapshots.values()), 'observations': {sid: sum(len(m['points']) for m in d['metrics']) for sid, d in snapshots.items()}})
        print('Sector data validated and updated')
    except Exception as exc:
        # No response bodies, environment or credentials are recorded in errors.
        write_json_if_changed(args.root / 'data/sectors/update-status.json', {'status': 'failed', 'errorType': type(exc).__name__, 'historicalDataRetained': True})
        raise SystemExit('Sector update failed; historical snapshots retained (' + type(exc).__name__ + ')') from None


if __name__ == '__main__':
    main()
