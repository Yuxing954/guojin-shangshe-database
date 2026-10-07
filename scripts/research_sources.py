"""Merge immutable research update batches with the existing CSV archive."""
import csv
import hashlib
import json
import re
from pathlib import Path


def row_keys(row):
    url = str(row.get('原文链接') or row.get('下载链接') or '')
    match = re.search(r'/topic/(\d+)', url)
    # A topic can carry several distinct minute attachments.
    suffix = str(row.get('文件名', ''))
    content = str(row.get('内容') or row.get('摘要') or '').strip()
    return ((match.group(1), suffix) if match else None,
            (str(row.get('时间') or row.get('日期') or ''), str(row.get('标题') or '')),
            hashlib.sha256(content.encode('utf-8')).hexdigest() if content else None)


def merge_rows(base, incoming):
    out = []
    ids, stamps, bodies = set(), set(), set()
    # New batches take precedence when an older record was truncated in an index.
    when = lambda r: str(r.get('时间') or r.get('日期') or '')
    for row in sorted(incoming, key=when, reverse=True) + sorted(base, key=when, reverse=True):
        topic, stamp, body = row_keys(row)
        if (topic and topic in ids) or stamp in stamps or (body and body in bodies):
            continue
        out.append(row)
        if topic: ids.add(topic)
        stamps.add(stamp)
        if body: bodies.add(body)
    return sorted(out, key=lambda r: str(r.get('时间') or r.get('日期') or ''), reverse=True)


def update_rows(root, dbid):
    manifest = Path(root) / 'data/research/updates/manifest.json'
    if not manifest.exists(): return []
    data = json.loads(manifest.read_text(encoding='utf-8'))
    rows = []
    for path in data.get('files', {}).get(dbid, []):
        target = (Path(root) / path).resolve()
        if not target.is_relative_to(Path(root).resolve()):
            raise ValueError('Research update file is outside repository')
        with target.open(encoding='utf-8-sig', newline='') as stream:
            rows.extend(csv.DictReader(stream))
    return merge_rows([], rows)


def archive_rows(root, dbid, rows):
    """Apply new topic assignments without changing the original CSV archive."""
    path = Path(root) / 'data/research/updates/manifest.json'
    if dbid not in ('views', 'all_views') or not path.exists(): return rows
    data = json.loads(path.read_text(encoding='utf-8'))
    other = 'all_views' if dbid == 'views' else 'views'
    reassigned = set(data.get('assignedTopics', {}).get(other, []))
    return [r for r in rows if not (row_keys(r)[0] and row_keys(r)[0][0] in reassigned)]
