"""Refresh official macro snapshots. Standard library only; never synthesize observations."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/macro'

def fetch(url, payload=None):
    request = urllib.request.Request(url, data=json.dumps(payload).encode() if payload else None,
        headers={'User-Agent': 'GuojinMacroResearch/1.0', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=25) as response:
        raw = response.read()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()

def observation(period, value, release_date=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('Invalid numeric observation')
    return dict(period=period, value=value, releaseDate=release_date)

def validate_period(period, frequency):
    if frequency == 'annual':
        if not re.fullmatch(r'\d{4}', period): raise ValueError('Invalid annual period')
        date(int(period), 1, 1)
    elif frequency == 'quarterly':
        if not re.fullmatch(r'\d{4}-Q[1-4]', period): raise ValueError('Invalid quarter')
        date(int(period[:4]), 1, 1)
    elif frequency == 'monthly':
        if not re.fullmatch(r'\d{4}-\d{2}', period): raise ValueError('Invalid month')
        date.fromisoformat(period + '-01')
    else:
        date.fromisoformat(period)

def period_end(period, frequency):
    import calendar
    if frequency == 'annual': return date(int(period), 12, 31)
    if frequency == 'quarterly':
        month = int(period[-1]) * 3
        return date(int(period[:4]), month, calendar.monthrange(int(period[:4]), month)[1])
    if frequency == 'monthly':
        y, m = map(int, period.split('-'))
        return date(y, m, calendar.monthrange(y, m)[1])
    return date.fromisoformat(period)

def worldbank(series, cutoff, metadata=None):
    country = {'CN': 'CHN', 'US': 'USA'}[series['country']]
    url = f"https://api.worldbank.org/v2/country/{country}/indicator/{series['code']}?format=json&date=2000:{cutoff.year}&per_page=100"
    body, digest = fetch(url)
    if not isinstance(body, list) or len(body) != 2 or not isinstance(body[1], list):
        raise ValueError('Unexpected World Bank response')
    if int(body[0]['pages']) != 1: raise ValueError('Unexpected pagination')
    rows = []
    for row in body[1]:
        if row['indicator']['id'] != series['code'] or row['countryiso3code'] != country:
            raise ValueError('Source identity mismatch')
        validate_period(row['date'], 'annual')
        if row['value'] is not None and period_end(row['date'], 'annual') <= cutoff:
            rows.append(observation(row['date'], row['value']))
    # Dataset lastupdated is not the publication date of an individual observation.
    return dict(observations=sorted(rows, key=lambda x: x['period']), sourceUrl=url,
        receiptSha256=digest, datasetUpdatedAt=body[0].get('lastupdated'), **(metadata or {}))

def worldbank_metadata(code):
    url = f'https://api.worldbank.org/v2/indicator/{code}?format=json'
    body, digest = fetch(url)
    matches = [r for r in body[1] if r.get('id') == code and str(r.get('source', {}).get('id')) == '2']
    if len(matches) != 1 or not matches[0].get('sourceOrganization'):
        raise ValueError('Missing WDI attribution metadata')
    row = matches[0]
    return dict(sourceOrganization=row['sourceOrganization'], sourceDefinition=row.get('sourceNote'),
                metadataUrl=url, metadataSha256=digest)

def bls_batch(series, cutoff):
    key = os.environ.get('BLS_API_KEY')
    payload = dict(seriesid=[s['code'] for s in series], startyear=str(cutoff.year-(14 if key else 2)), endyear=str(cutoff.year))
    if key: payload['registrationkey'] = key
    url = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
    body, digest = fetch(url, payload)
    if body.get('status') != 'REQUEST_SUCCEEDED': raise ValueError('BLS request rejected')
    by_code = {s['seriesID']: s for s in body['Results']['series']}
    results = {}
    for spec in series:
        if spec['code'] not in by_code: raise ValueError('BLS series missing')
        rows = []
        for row in by_code[spec['code']]['data']:
            # M13 is an annual average, not a month.
            if not re.fullmatch(r'M(?:0[1-9]|1[0-2])', row['period']): continue
            period = row['year'] + '-' + row['period'][1:]
            validate_period(period, 'monthly')
            if period_end(period, 'monthly') > cutoff: continue
            if row['value'] in ('-', '', None): continue
            item = observation(period, float(row['value']))
            item['footnotes'] = [n['text'] for n in row.get('footnotes', []) if n.get('text')]
            rows.append(item)
        results[spec['id']] = dict(observations=sorted(rows, key=lambda x: x['period']),
            sourceUrl='https://data.bls.gov/timeseries/'+spec['code'], receiptSha256=digest)
    return results

def treasury(series, cutoff):
    url = ('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny'
           f'?filter=record_date:lte:{cutoff.isoformat()}&sort=-record_date&page[size]=2000&fields=record_date,tot_pub_debt_out_amt')
    body, digest = fetch(url)
    rows = []
    for row in body['data']:
        validate_period(row['record_date'], 'daily')
        if row['record_date'] > cutoff.isoformat(): raise ValueError('Future Treasury observation')
        rows.append(observation(row['record_date'], float(row['tot_pub_debt_out_amt'])))
    return dict(observations=sorted(rows, key=lambda x: x['period']), sourceUrl=url, receiptSha256=digest)

def reviewed_import(path, catalog, cutoff):
    """Manual rows require an explicit license decision, dated original source, and matching units."""
    specs = {s['id']: s for s in catalog['series']}
    body = json.loads(path.read_text(encoding='utf-8'))
    results = {}
    for entry in body['series']:
        spec = specs[entry['id']]
        if spec['adapter'] != 'manual': raise ValueError('Manual import cannot override API series')
        if entry.get('unit') != spec['unit'] or entry.get('adjustment') != spec['adjustment']:
            raise ValueError('Unit or adjustment mismatch')
        if entry.get('redistributionApproved') is not True or not entry.get('reviewedBy') or not entry.get('licenseBasis'):
            raise ValueError('Review and redistribution decision required')
        rows = []
        seen = set()
        for row in entry['observations']:
            validate_period(row['period'], spec['frequency'])
            if row['period'] in seen: raise ValueError('Duplicate period')
            seen.add(row['period'])
            published = date.fromisoformat(row['releaseDate'])
            if published < period_end(row['period'], spec['frequency']):
                raise ValueError('Publication precedes completed observation period')
            if published > cutoff or period_end(row['period'], spec['frequency']) > cutoff:
                raise ValueError('Future publication or period')
            url = row['sourceUrl']
            parsed = urllib.parse.urlparse(url)
            official = urllib.parse.urlparse(catalog['sources'][spec['source']]['url']).hostname
            domain = 'stats.gov.cn' if spec['source'] == 'nbs' else official.removeprefix('www.')
            if parsed.scheme not in ('http', 'https') or not parsed.hostname or not (parsed.hostname == domain or parsed.hostname.endswith('.'+domain)):
                raise ValueError('Original official source URL required')
            item = observation(row['period'], row['value'], row['releaseDate'])
            item['sourceUrl'] = url
            rows.append(item)
        if entry['id'] in results: raise ValueError('Duplicate series')
        results[entry['id']] = dict(observations=sorted(rows, key=lambda x: x['period']),
            sourceUrl=rows[-1]['sourceUrl'] if rows else catalog['sources'][spec['source']]['url'],
            reviewedBy=entry['reviewedBy'], licenseBasis=entry['licenseBasis'])
    return results

def apply_result(previous, result, checked_at, error=None):
    if error:
        return {**previous, 'status': 'error', 'checkedAt': checked_at,
                'error': '官方接口读取或校验失败；已保留上次成功数据。'}
    if not result['observations']:
        return {**previous, 'status': 'empty', 'checkedAt': checked_at,
                'error': '上游本次未提供观测值；保留已有快照。'}
    return {**result, 'status': 'ready', 'checkedAt': checked_at, 'fetchedAt': checked_at}

def refresh(catalog, previous, cutoff, imported=None):
    now = datetime.now(timezone.utc).isoformat(timespec='seconds')
    values = dict(previous.get('series', {}))
    api = [s for s in catalog['series'] if s['adapter'] in ('worldbank', 'treasury')]
    codes = {s['code'] for s in api if s['adapter'] == 'worldbank'}
    metadata = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(worldbank_metadata, code): code for code in codes}
        for future in as_completed(futures):
            try: metadata[futures[future]] = future.result()
            except Exception: pass
    def task(s):
        if s['adapter'] == 'worldbank':
            if s['code'] not in metadata: raise ValueError('WDI attribution unavailable')
            return worldbank(s, cutoff, metadata[s['code']])
        return treasury(s, cutoff)
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(task, s): s for s in api}
        for future in as_completed(futures):
            s = futures[future]
            try: values[s['id']] = apply_result(values.get(s['id'], {}), future.result(), now)
            except Exception:
                values[s['id']] = apply_result(values.get(s['id'], {}), None, now, error=True)
    group = [s for s in catalog['series'] if s['adapter'] == 'bls']
    try:
        results = bls_batch(group, cutoff)
        for s in group: values[s['id']] = apply_result(values.get(s['id'], {}), results[s['id']], now)
    except Exception:
        for s in group: values[s['id']] = apply_result(values.get(s['id'], {}), None, now, error=True)
    for s in catalog['series']:
        if s['adapter'] == 'manual':
            if imported and s['id'] in imported:
                values[s['id']] = apply_result(values.get(s['id'], {}), imported[s['id']], now)
            elif s['id'] not in values:
                values[s['id']] = dict(status='pending', observations=[], checkedAt=None)
    return dict(version=1, generatedAt=now, cutoff=cutoff.isoformat(), series=values)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cutoff', default=date.today().isoformat())
    parser.add_argument('--import-reviewed', type=Path)
    parser.add_argument('--import-only', action='store_true')
    args = parser.parse_args()
    cutoff = date.fromisoformat(args.cutoff)
    catalog = json.loads((DATA/'catalog.json').read_text(encoding='utf-8'))
    target = DATA/'snapshot.json'
    previous = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {'series': {}}
    imported = reviewed_import(args.import_reviewed, catalog, cutoff) if args.import_reviewed else None
    if args.import_only:
        if not imported: parser.error('--import-only requires nonempty --import-reviewed')
        now = datetime.now(timezone.utc).isoformat(timespec='seconds')
        snapshot = {**previous, 'generatedAt': now, 'cutoff': cutoff.isoformat(),
            'series': {**previous['series'], **{k: apply_result(previous['series'].get(k, {}), v, now) for k,v in imported.items()}}}
    else: snapshot = refresh(catalog, previous, cutoff, imported)
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    temp.replace(target)
    counts = {status: sum(v.get('status') == status for v in snapshot['series'].values()) for status in ['ready','pending','empty','error']}
    print(json.dumps(counts))
    # Fail automation visibly after writing explicit error statuses, never claim a successful refresh.
    if counts['error']: raise SystemExit(1)

if __name__ == '__main__': main()
