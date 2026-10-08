"""Import curated meeting summaries from a private OneDrive catalog.

Originals, cloud IDs, owner URLs and complete Word text stay outside the site.
Archive checks rely on verified OneDrive metadata, not a claimed local download.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECTORS = {'酒店文旅': 'travel', '免税': 'dutyfree', '教育人服': 'education',
           '体育消费': 'sports', '跨境电商': 'commerce', '餐饮茶饮': 'dining',
           '电商与品牌服务': 'brandservices'}

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def import_catalog(catalog_path, source_path, root=ROOT):
    root = Path(root).resolve()
    for path in (catalog_path, source_path):
        if Path(path).resolve().is_relative_to(root):
            raise ValueError('Private input must remain outside the website')
    catalog, sources = read(catalog_path), read(source_path)
    source_items = {x['metadata']['id']: x for x in sources['items']}
    if catalog['uniqueDocumentCount'] != len(catalog['items']):
        raise ValueError('Catalog count mismatch')
    imports, processed, mappings, seen = [], {}, {}, set()
    for item in catalog['items']:
        storage = item['storage']
        digest = storage['sha256'].lower()
        if not re.fullmatch(r'[a-f0-9]{64}', digest) or digest in seen:
            raise ValueError('Invalid or duplicate original checksum')
        seen.add(digest)
        source = source_items.get(storage['itemId'])
        if not source or source['metadata']['file']['hashes']['sha256Hash'].lower() != digest:
            raise ValueError('Source and archive checksum differ')
        if source['metadata']['size'] != storage['size'] or storage['size'] <= 0:
            raise ValueError('Source and archive size differ')
        if not storage.get('moveIntegrityVerified') or not storage.get('permissionsReviewed') or storage['audience'] != 'private':
            raise ValueError('Archive metadata or private permissions not checked')
        lines = source['text'].split('\n')
        evidence = []
        for ref in item['evidence']:
            line = ref['line']
            if not isinstance(line, int) or line < 1 or line > len(lines) or ref['anchor'] not in lines[line-1]:
                raise ValueError('Summary evidence does not match original text')
            evidence.append({'line': line, 'anchor': ref['anchor'], 'excerpt': lines[line-1][:400]})
        issues = [{'type': x['type'], 'detail': x['detail'], 'line': x['evidenceLine']}
                  for x in item['qualityIssues']]
        for issue in item['qualityIssues']:
            line = issue['evidenceLine']
            if not isinstance(line, int) or line < 1 or line > len(lines) or issue['anchor'] not in lines[line-1]:
                raise ValueError('Quality issue evidence does not match')
        asset_id = 'onedrive-docx-' + digest[:20]
        has_date_conflict = item['dateStatus'] == 'needs_review'
        if has_date_conflict and item['eventDate'] is not None:
            raise ValueError('Unresolved meeting date cannot be confirmed')
        date = '' if has_date_conflict else item['eventDate']
        if date and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
            raise ValueError('Invalid meeting date')
        filename_date = item['filenameDate']
        sort_date = filename_date[:4] + '-' + filename_date[4:6] + '-' + filename_date[6:8]
        status = 'needs_review' if issues else 'summary_draft'
        imports.append({'id': asset_id, 'batchId': catalog['batchId'], 'name': item['originalName'], 'company': item['company'],
                        'format': 'document', 'extension': 'docx', 'published': date or sort_date,
                        'date': date, 'sortDate': sort_date, 'dateStatus': item['dateStatus'],
                        'dateCandidates': [filename_date, item['headerDate']] if has_date_conflict else [],
                        'sectors': [SECTORS[item['sector']]], 'classificationReviewed': True,
                        'documentType': item['documentType'], 'sourceType': 'onedrive_document',
                        'sourceName': '用户提供纪要', 'sourceUrl': '', 'sourceTopics': [],
                        'bytes': storage['size'], 'durationSeconds': None, 'sha256': digest,
                        'storage': {'provider': 'onedrive', 'status': 'uploaded', 'audience': 'private',
                                    'verifiedSha256': digest, 'verificationMethod': 'provider_metadata_hash',
                                    'permissionsReviewed': True},
                        'processing': {'status': status, 'textAvailable': True,
                                       'contentPath': 'data/research/processed/' + asset_id + '.json',
                                       'summary': item['summary'], 'searchText': ' '.join([item['company'], item['summary'], item['followUp'], *[x['detail'] for x in issues]]),
                                       'qualityIssueCount': len(issues), 'summaryOnly': True,
                                       'summaryHash': hashlib.sha256(json.dumps([item['summary'], item['followUp'], evidence, issues, date], ensure_ascii=False).encode()).hexdigest(),
                                       'updatedAt': catalog['processedAt']}})
        processed[asset_id] = {'assetId': asset_id, 'type': 'meeting_summary', 'reviewed': False,
                               'company': item['company'], 'documentType': item['documentType'],
                               'summary': item['summary'], 'watch': item['followUp'],
                               'note': '根据所提供Word纪要整理，摘要待审阅；未独立核对公告或原录音。历史预测、目标和计划保留当时语境。',
                               'dateStatus': item['dateStatus'], 'dateCandidates': imports[-1]['dateCandidates'],
                               'qualityIssues': issues, 'evidence': evidence,
                               'evidenceLocator': '连接器抽取文本行号，并非Word页码',
                               'originalAccess': 'private'}
        mappings[asset_id] = {'privateCatalogId': item['id'], **storage}
    path = root / 'data/research/library.json'
    library = read(path) if path.exists() else {'schemaVersion': 1, 'records': [], 'coverage': {}}
    by_checksum = {r.get('sha256'): r for r in library['records'] if r.get('sha256')}
    previous = {r['id']: r for r in library['records']}
    for record in imports:
        old = by_checksum.get(record['sha256'])
        if old:
            record['aliases'] = list(dict.fromkeys([record['id'], *old.get('aliases', [])]))
            record['sourceTopics'] = old.get('sourceTopics', [])
            # Reimporting an unchanged source must not erase verified customer links.
            if old.get('storage', {}).get('verifiedSha256') == record['sha256'] and old['storage'].get('permissionsReviewed'):
                record['storage'] = old['storage']
                processed[record['id']]['originalAccess'] = old['storage'].get('audience', 'private')
        if old and old.get('processing', {}).get('status') == 'reviewed' and old['processing'].get('summaryHash') == record['processing']['summaryHash']:
            record['processing']['status'] = 'reviewed'
            processed[record['id']]['reviewed'] = True
            content_file = root / old['processing']['contentPath']
            if content_file.exists():
                old_content = read(content_file)
                for key in ['reviewedAt', 'reviewNote']:
                    if key in old_content:
                        processed[record['id']][key] = old_content[key]
        if old and old['id'] != record['id']:
            record['aliases'] = list(dict.fromkeys([record['id'], old['id'], *old.get('aliases', [])]))
            record['sourceTopics'] = old.get('sourceTopics', [])
            record['sourceUrl'] = old.get('sourceUrl', '')
            previous.pop(old['id'], None)
        previous[record['id']] = record
    library['records'] = sorted(previous.values(), key=lambda r: (r.get('sortDate') or r.get('published', ''), r['id']), reverse=True)
    library['generatedAt'] = datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')
    library['counts'] = dict(Counter(r['format'] for r in library['records']))
    library['ingestedBatch'] = {'id': catalog['batchId'], 'date': catalog['processedAt'],
                                'originals': len(imports), 'duplicateCopiesExcluded': catalog['duplicateCount'],
                                'qualityIssues': sum(len(x['qualityIssues']) for x in processed.values()),
                                'source': 'OneDrive 用户提供Word纪要', 'summaryReview': 'pending'}
    all_dates = [r['date'] for r in library['records'] if r.get('date')]
    library.setdefault('coverage', {})['from'] = min(all_dates) if all_dates else ''
    library['coverage']['to'] = max(all_dates) if all_dates else ''
    path.parent.mkdir(parents=True, exist_ok=True)
    folder = root / 'data/research/processed'
    folder.mkdir(parents=True, exist_ok=True)
    for asset_id, document in processed.items():
        (folder / (asset_id + '.json')).write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    path.write_text(json.dumps(library, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    private_path = Path(catalog_path).parent / 'website-import-map.json'
    private_path.write_text(json.dumps(mappings, ensure_ascii=False, indent=2), encoding='utf-8')
    return library['ingestedBatch']

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--source-texts', required=True, type=Path)
    parser.add_argument('--root', default=ROOT, type=Path)
    args = parser.parse_args()
    print(json.dumps(import_catalog(args.catalog, args.source_texts, args.root), ensure_ascii=False))
