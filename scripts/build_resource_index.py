"""Small title-only directory for search and company links; no originals or transcripts."""
import argparse
import csv
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from summary_io import write_json_if_changed

ROOT = Path(__file__).resolve().parents[1]


def read(path, default):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else default


def build(root=ROOT):
    root = Path(root)
    companies = read(root / 'data/coverage-companies.json', {'companies': []})['companies']
    items = []
    for c in companies:
        code, name = c['code'], c['name']
        items.append({'id': code, 'kind': 'company', 'title': name, 'company': name,
                      'code': code, 'aliases': c.get('aliases', []), 'sector': c.get('sector', ''), 'date': c.get('addedAt', '')[:10],
                      'href': 'quotes.html?' + urlencode({'symbol': code})})
    library = read(root / 'data/research/library.json', {'records': []})
    for r in library['records']:
        s = r.get('storage', {})
        stored = s.get('provider') == 'onedrive' and s.get('status') == 'uploaded'
        verified = (bool(re.fullmatch('[a-fA-F0-9]{64}', r.get('sha256') or ''))
                    and s.get('verifiedSha256') == r['sha256']) if r.get('sha256') else (
                        s.get('metadataVerified') is True and s.get('verificationMethod') == 'provider_metadata_version'
                        and bool(re.fullmatch('[a-fA-F0-9]{64}', s.get('cloudVersion') or '')))
        processing = r.get('processing', {})
        published_text = (processing.get('bodyAvailable') is True and processing.get('textAvailable') is True
                          and bool(re.fullmatch('[a-fA-F0-9]{64}', r.get('sha256') or ''))
                          and bool(re.fullmatch('[a-fA-F0-9]{64}', processing.get('bodySha256') or ''))
                          and bool(re.fullmatch(r'data/research/processed/[A-Za-z0-9_-]+\.json', processing.get('contentPath') or '')))
        if not (stored and verified) and not published_text:
            continue
        items.append({'id': r['id'], 'kind': 'minutes', 'title': r['name'],
                      'date': '' if r.get('dateStatus') == 'needs_review' else r.get('date', ''),
                      'sortDate': r.get('sortDate') or r.get('published', ''),
                      'company': r.get('company', ''), 'sector': ' '.join(r.get('sectors', [])),
                      'href': 'research.html?' + urlencode({'kind': 'minutes', 'scope': 'archived', 'asset': r['id']})})
    recent = read(root / 'data/research/recent.json', {'dbs': []})
    seen = set()
    for db in recent['dbs']:
        if db['id'] != 'views':
            continue
        for r in db['rows']:
            topic = re.search(r'/topic/(\d+)', str(r.get('原文链接', '')))
            title = r.get('标题', '')
            key = topic.group(1) if topic else (r.get('时间', ''), title)
            if not title or key in seen:
                continue
            seen.add(key)
            query = {'kind': 'views', 'topic': topic.group(1)} if topic else {'kind': 'views', 'record': title}
            items.append({'id': str(key), 'kind': 'views', 'title': title,
                          'date': r.get('时间', '')[:10], 'company': '',
                          'sector': r.get('命中关键词', ''), 'href': 'research.html?' + urlencode(query)})
    overview = read(root / 'data/industry/overview.json', {'sectors': []})
    for sector in overview['sectors']:
        for m in sector['metrics']:
            latest = m.get('points', [])[-1] if m.get('points') else {}
            items.append({'id': m['id'], 'kind': 'industry', 'title': sector['name'] + ' · ' + m['label'],
                          'sector': sector['name'], 'date': latest.get('endDate', ''),
                          'href': 'industry.html?' + urlencode({'metric': m['id']}) + '#' + sector['id']})
    items.sort(key=lambda r: (r.get('sortDate') or r.get('date', ''), r['id']), reverse=True)
    return {'version': 1, 'generatedAt': datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'),
            'coverage': '公司、已归档纪要、近期商社观点与行业指标；搜索标题与公司信息，不搜索原件全文。',
            'items': items}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    payload = build(args.root)
    changed = write_json_if_changed(args.root / 'data/research/resource-index.json', payload, volatile={'generatedAt'})
    print(json.dumps({'items': len(payload['items']), 'changed': changed}, ensure_ascii=False))
