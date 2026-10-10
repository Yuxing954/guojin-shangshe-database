"""Build only affected summaries, validating cached input and output hashes."""
import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter
from summary_io import write_json_if_changed

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    if not path.is_file():
        return 'missing'
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def inputs(root):
    manifest = json.loads((root / 'data-manifest.json').read_text(encoding='utf-8-sig'))
    datasets = {d['id']: d['file'] for d in manifest['datasets']}
    updates_path = root / 'data/research/updates/manifest.json'
    updates = json.loads(updates_path.read_text(encoding='utf-8-sig')) if updates_path.exists() else {}
    batches = [p for group in updates.get('files', {}).values() for p in group]
    research = [datasets[k] for k in ('views', 'all_views', 'minutes')]
    industry = [datasets[k] for k in ('hotel_industry_weekly', 'dutyfree_monthly', 'gold', 'crossborder', 'dining')]
    industry += [p.relative_to(root).as_posix() for pattern in ('miaoxiang-*.json', 'verified-*.json')
                 for p in sorted((root / 'data/industry').glob(pattern))]
    return {
        'research': research + batches + ['data/research/updates/manifest.json', 'scripts/research_sources.py'],
        'industry': industry + ['data/dutyfree/monthly-provenance.json', 'scripts/dutyfree_yoy.py'],
        'home': ['data/research/recent.json', 'data/industry/overview.json'] + ([] if (root / 'data/industry/overview.json').exists() else industry),
        'resources': ['data/research/recent.json', 'data/research/library.json', 'data/industry/overview.json', 'data/coverage-companies.json'],
    }


def run(root=ROOT, force=False, use_existing_index=False, as_of=None):
    root = Path(root).resolve()
    day = as_of or datetime.now(timezone(timedelta(hours=8))).date()
    cache = root / '.cache/research-build.json'
    try:
        state = json.loads(cache.read_text(encoding='utf-8'))
        if not isinstance(state, dict): state = {}
    except (FileNotFoundError, ValueError):
        state = {}
    stages = [('research', 'build_research_recent.py', 'data/research/recent.json'),
              ('industry', 'build_industry_snapshot.py', 'data/industry/overview.json'),
              ('home', 'build_home_snapshot.py', 'data/home-snapshot.json'),
              ('resources', 'build_resource_index.py', 'data/research/resource-index.json')]
    result = {}
    for name, script, output in stages:
        start = perf_counter()
        paths = set(inputs(root)[name] + ['data-manifest.json', 'scripts/' + script,
                                         'scripts/summary_io.py', 'scripts/build_site_summaries.py'])
        hashes = {p: digest(root / p) for p in sorted(paths)}
        if name == 'research':
            hashes['calendarDay'] = day.isoformat()
            hashes['useExistingIndex'] = use_existing_index
        fingerprint = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
        old = state.get(name, {})
        if not isinstance(old, dict): old = {}
        before = digest(root / output)
        if not force and before != 'missing' and old.get('inputs') == fingerprint and old.get('output') == before:
            status = 'skipped'
        else:
            command = [sys.executable, str(root / 'scripts' / script), '--root', str(root)]
            if name == 'research':
                command += ['--as-of', day.isoformat()]
                if use_existing_index: command.append('--use-existing-index')
            subprocess.run(command, cwd=root, check=True)
            status = 'updated' if before != digest(root / output) else 'unchanged'
        state[name] = {'inputs': fingerprint, 'output': digest(root / output)}
        result[name] = {'status': status, 'seconds': round(perf_counter() - start, 4)}
    write_json_if_changed(cache, state, indent=2)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--force', action='store_true', help='Rebuild after cache loss or for troubleshooting')
    parser.add_argument('--use-existing-index', action='store_true', help='Local incomplete archive only; production requires full CSVs')
    args = parser.parse_args()
    print(json.dumps(run(args.root, args.force, args.use_existing_index), ensure_ascii=False))
