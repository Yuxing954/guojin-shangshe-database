"""Check ingestion metadata and brief references; repair only verified derived fields."""
import argparse
import copy
import json
from pathlib import Path

from research_sources import row_keys, update_rows

ROOT = Path(__file__).resolve().parents[1]
KINDS = ('views', 'all_views', 'minutes')


def reconcile(root):
    root = Path(root)
    manifest_path = root / 'data/research/updates/manifest.json'
    briefs_path = root / 'data/research/market-briefs.json'
    original_manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    original_briefs = json.loads(briefs_path.read_text(encoding='utf-8'))
    manifest, briefs = copy.deepcopy(original_manifest), copy.deepcopy(original_briefs)
    rows = {kind: update_rows(root, kind) for kind in KINDS}
    topics = {kind: {row_keys(row)[0][0] for row in rows[kind] if row_keys(row)[0]}
              for kind in ('views', 'all_views')}
    assigned = manifest.get('assignedTopics', {})
    if set(assigned.get('views', [])) & set(assigned.get('all_views', [])):
        raise ValueError('A topic is assigned to both views and all_views')
    for kind in KINDS:
        manifest.setdefault('counts', {})[kind] = len(rows[kind])
        manifest.setdefault('latest', {})[kind] = max(
            (row.get('时间') or row.get('日期') or '' for row in rows[kind]), default='')
    for brief in briefs['briefs']:
        label = brief.get('id', '<unnamed>')
        sources = brief['sources']
        ids = {source['topicId'] for source in sources}
        for source in sources:
            topic = source['topicId']
            matches = [kind for kind in topics if topic in topics[kind]]
            if not source.get('kind'):
                if len(matches) != 1:
                    raise ValueError(f'{label}: cannot resolve source kind for {topic}: {matches}')
                source['kind'] = matches[0]
            if source['kind'] not in matches:
                raise ValueError(f'{label}: {topic} is absent from {source["kind"]}')
        if any(item['source'] not in ids for item in brief['evidence']):
            raise ValueError(f'{label}: evidence references an undeclared source')
    # Check everything before writing either file; never rewrite publication times,
    # coverage, topic assignments, authored prose or ingestion audit records.
    return [(path, old, new) for path, old, new in (
        (manifest_path, original_manifest, manifest),
        (briefs_path, original_briefs, briefs)) if old != new]


def run(root=ROOT, repair=False):
    changes = reconcile(root)
    if changes and not repair:
        raise ValueError('Stale research metadata or missing source kinds: ' +
                         ', '.join(path.name for path, _, _ in changes) +
                         '; run scripts/validate_research_data.py --repair')
    for path, _, data in changes:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return [path.name for path, _, _ in changes]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--repair', action='store_true', help='Recompute derived metadata and fill uniquely verified source kinds')
    args = parser.parse_args()
    print(json.dumps({'repaired': run(args.root, args.repair)}, ensure_ascii=False))
