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
            (str(row.get('原始发布时间') or row.get('时间') or row.get('日期') or '').replace('T', ' ')[:19], str(row.get('标题') or '')),
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
    rows = merge_rows([], rows)
    # Incremental classification corrections override the original batch category.
    # Keep each topic in exactly one of the two opinion indexes.
    if dbid in ('views', 'all_views'):
        other = 'all_views' if dbid == 'views' else 'views'
        reassigned = set(data.get('assignedTopics', {}).get(other, []))
        rows = [r for r in rows if not (row_keys(r)[0] and row_keys(r)[0][0] in reassigned)]
    return rows


def archive_rows(root, dbid, rows):
    """Apply new topic assignments without changing the original CSV archive."""
    path = Path(root) / 'data/research/updates/manifest.json'
    if dbid not in ('views', 'all_views') or not path.exists(): return rows
    data = json.loads(path.read_text(encoding='utf-8'))
    other = 'all_views' if dbid == 'views' else 'views'
    reassigned = set(data.get('assignedTopics', {}).get(other, []))
    return [r for r in rows if not (row_keys(r)[0] and row_keys(r)[0][0] in reassigned)]

# Exclude building-materials research from commercial industry views.
BUILDING_MATERIALS = re.compile(r'建材|水泥|玻纤|电子布|光伏玻璃|浮法玻璃|东方雨虹|三棵树|北新建材|兔宝宝|伟星新材|科顺|公元股份|苏博特|中国巨石|中材科技|防水|涂料|石膏板|瓷砖|卫浴|门窗|悍高')
def building_material_view(row):
    topic = row_keys(row)[0]
    return bool((topic and topic[0] in ["55521421881885824","14425124252184852","55521425145451884","14425124458448152","45548245152451848","45548245151842488","82258454555228182","22258454555282111","82258454145522182","82258451228451512","82258451488554212","82258485552481412"]) or BUILDING_MATERIALS.search(str(row.get('标题') or '')))

_original_update_rows = update_rows
_original_archive_rows = archive_rows
def update_rows(root, dbid):
    rows = _original_update_rows(root, dbid)
    if dbid == 'views':
        return [r for r in rows if not building_material_view(r)]
    if dbid == 'all_views':
        source = Path(root) / 'data' / '商社-市场观点.csv'
        with source.open(encoding='utf-8-sig', newline='') as stream:
            moved = [r for r in csv.DictReader(stream) if building_material_view(r)]
        moved += [r for r in _original_update_rows(root, 'views') if building_material_view(r)]
        rows = merge_rows(rows, moved)
    return rows

def archive_rows(root, dbid, rows):
    rows = _original_archive_rows(root, dbid, rows)
    return [r for r in rows if not building_material_view(r)] if dbid == 'views' else rows
