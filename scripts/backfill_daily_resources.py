"""Refresh attachment metadata for recent published dailies after an index arrives.

No network calls, downloads, attachment reading, or editorial changes.
"""
import argparse, copy, datetime as dt, json
from pathlib import Path
from build_daily_report import ROOT, TZ
from build_daily_resource_list import build
from daily_attachment_coverage import validate_attachment_coverage

ATTACHMENT_GROUPS = ('minutes', 'audio', 'reports')


def reconcile(saved, fresh, at):
    validate_attachment_coverage(fresh)
    for key in ('date', 'windowStart', 'cutoff'):
        if saved.get(key) != fresh.get(key):
            raise ValueError('Cannot move an existing daily window: ' + key)
    same = saved.get('attachmentCatalog') == fresh['attachmentCatalog'] and all(
        saved['groups'].get(k, []) == fresh['groups'][k] for k in ATTACHMENT_GROUPS)
    if same:
        return saved
    result = copy.deepcopy(saved)
    result['schemaVersion'] = 2
    result['attachmentCatalog'] = fresh['attachmentCatalog']
    for key in ATTACHMENT_GROUPS:
        result['groups'][key] = fresh['groups'][key]
    result['attachmentBackfill'] = {
        'at': at, 'originalCutoff': saved['cutoff'],
        'indexGeneratedAt': fresh['attachmentCatalog'].get('generatedAt'),
        'previousIndexGeneratedAt': saved.get('attachmentCatalog', {}).get('generatedAt')}
    return result


def backfill(dates=None, limit=2):
    dates = dates or sorted((p.stem for p in (ROOT/'data/daily/onepage').glob('*.json')), reverse=True)[:limit]
    updated, skipped = [], []
    at = dt.datetime.now(TZ).isoformat(timespec='seconds')
    for date in dates:
        path = ROOT/'data/daily/resources'/f'{date}.json'
        if not path.exists():
            skipped.append({'date': date, 'reason': 'No published resource snapshot'})
            continue
        saved = json.loads(path.read_text())
        fresh = build(date, saved['cutoff'])
        try:
            result = reconcile(saved, fresh, at)
        except AssertionError as e:
            skipped.append({'date': date, 'reason': str(e)})
            continue  # Never replace valid history with an incomplete index.
        if result != saved:
            path.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
            updated.append(date)
    return {'updated': updated, 'skipped': skipped}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', action='append')
    parser.add_argument('--limit', type=int, default=2)
    args = parser.parse_args()
    print(json.dumps(backfill(args.date, args.limit), ensure_ascii=False))
