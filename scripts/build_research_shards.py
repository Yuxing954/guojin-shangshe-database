"""Connector-readable full research archive and partitioned deduplication keys."""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import re
import sys
from pathlib import Path
from research_sources import archive_rows, merge_rows, update_rows

LIMIT = 256 * 1024
BASES = {'views': '商社-市场观点.csv', 'all_views': '全部-市场观点.csv'}

def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')

def digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()

def keys(row):
    topic = re.search(r'/topic/(\d+)', str(row.get('原文链接') or ''))
    stamp = str(row.get('原始发布时间') or row.get('时间') or row.get('日期') or '')
    # Normalize ISO offset spelling and minute/second timestamps consistently.
    stamp = stamp.replace('T', ' ')[:19]
    body = str(row.get('内容') or row.get('摘要') or '').replace('\r\n', '\n').replace('\r', '\n').strip()
    out = ['stamp:' + digest(stamp + '|' + str(row.get('标题') or ''))]
    if topic: out.append('topic:' + topic.group(1))
    if body:
        out += ['body:' + digest(body), 'compactBody:' + digest(re.sub(r'\s+', '', body))]
    return out


def _publication_utc(value):
    text = str(value or '').strip().replace('Z', '+00:00')
    for candidate in (text, text[:19]):
        if not candidate: continue
        try:
            moment = dt.datetime.fromisoformat(candidate)
            if moment.tzinfo is None:
                moment = moment.replace(tzinfo=dt.timezone(dt.timedelta(hours=8)))
            return moment.astimezone(dt.timezone.utc)
        except ValueError:
            pass
    return dt.datetime.min.replace(tzinfo=dt.timezone.utc)


def market_view_exports(rows_by_kind, coverage_to, limit=300):
    """Return stable, full-row JSON exports for mini-program clients."""
    items = []
    for kind in ('views', 'all_views'):
        for row in rows_by_kind.get(kind, []):
            published = str(row.get('原始发布时间') or row.get('时间') or row.get('日期') or '')
            topic = re.search(r'/topic/(\d+)', str(row.get('原文链接') or ''))
            items.append({'kind': kind, 'topicId': topic.group(1) if topic else '',
                          'publishedAt': published, 'record': row})
    items.sort(key=lambda item: _publication_utc(item['publishedAt']), reverse=True)
    common = {'schemaVersion': 1, 'coverageTo': coverage_to,
              'sort': 'publishedAt_desc', 'totalRows': len(items)}
    recent = {**common, 'limit': limit, 'items': items[:limit]}
    complete = {**common, 'items': items}
    return recent, complete

def build(root):
    root = Path(root).resolve()
    output = root / 'data/research/archive'
    output.mkdir(parents=True, exist_ok=True)
    updates = json.loads((root / 'data/research/updates/manifest.json').read_text(encoding='utf-8-sig'))
    manifest = {'schemaVersion': 1, 'coverageTo': updates.get('coverageTo'),
                'maxFileBytes': LIMIT, 'keyAlgorithm': 'sha256-utf8-v1',
                'bucketAlgorithm': 'sha256(key).hexdigest()[:2]', 'databases': {}, 'dedupBuckets': {}}
    buckets = {}
    generated = set()
    market_rows = {}
    def write(path, value):
        raw = encoded(value)
        if len(raw) > LIMIT: raise ValueError(f'{path}: {len(raw)} exceeds shard limit')
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.read_bytes() != raw: target.write_bytes(raw)
        generated.add(target.resolve())
        return {'path': path, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    def write_export(path, value):
        raw = encoded(value)
        # GitHub rejects a single file at 100 MB; fail before attempting a bad push.
        if len(raw) > 95 * 1024 * 1024:
            raise ValueError(f'{path}: {len(raw)} bytes exceeds the safe single-file limit')
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.read_bytes() != raw: target.write_bytes(raw)
        generated.add(target.resolve())
        return {'path': path, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    for kind, filename in BASES.items():
        with (root / 'data' / filename).open(encoding='utf-8-sig', newline='') as handle:
            base = list(csv.DictReader(handle))
        incoming = update_rows(root, kind)
        # Index all existing keys, including records collapsed by the archive merge.
        for row in base + incoming:
            for key in keys(row):
                buckets.setdefault(digest(key)[:2], set()).add(key)
        rows = merge_rows(archive_rows(root, kind, base), incoming)
        shards, pending = [], []
        def flush():
            if not pending: return
            path = f'data/research/archive/{kind}/{len(shards)+1:04d}.json'
            meta = write(path, {'schemaVersion': 1, 'kind': kind, 'rows': list(pending)})
            meta.update(rows=len(pending), newest=pending[0].get('原始发布时间') or pending[0].get('时间'),
                        oldest=pending[-1].get('原始发布时间') or pending[-1].get('时间'))
            shards.append(meta)
            pending.clear()
        for row in rows:
            candidate = {'schemaVersion': 1, 'kind': kind, 'rows': pending + [row]}
            if pending and len(encoded(candidate)) > LIMIT: flush()
            pending.append(row)
        flush()
        manifest['databases'][kind] = {'rows': len(rows), 'shards': shards}
        if kind in ('views', 'all_views'):
            market_rows[kind] = rows
    recent_export, complete_export = market_view_exports(market_rows, updates.get('coverageTo'), limit=300)
    write_export('data/research/market-views-recent-300.json', recent_export)
    write_export('data/research/market-views-all.json', complete_export)
    for bucket, values in sorted(buckets.items()):
        meta = write(f'data/research/archive/dedup/{bucket}.json', {'keys': sorted(values)})
        meta['keys'] = len(values)
        manifest['dedupBuckets'][bucket] = meta
    write('data/research/archive/manifest.json', manifest)
    for path in output.rglob('*.json'):
        if path.resolve() not in generated: path.unlink()
    return manifest

if __name__ == '__main__':
    csv.field_size_limit(sys.maxsize)
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = build(args.root)
    print(json.dumps({k: v['rows'] for k, v in result['databases'].items()}))
