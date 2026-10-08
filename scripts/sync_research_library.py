"""One batch-directory entry point for import, verified sharing and exception report.

Cloud discovery, text reading and sharing use the connected OneDrive tools.
This script does not create permissions or treat local flags as authorization.
"""
import argparse
import json
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from import_onedrive_minutes import ROOT, import_catalog, read
from register_research_onedrive import approved_share_url


def verified_share(item, receipt):
    storage, metadata, permission = item['storage'], receipt['metadata'], receipt['permission']
    digest = storage['sha256'].lower()
    if (receipt['assetId'] != 'onedrive-docx-' + digest[:20]
            or receipt['itemId'] != storage['itemId'] or receipt['driveId'] != storage['driveId']
            or metadata['id'] != storage['itemId']
            or metadata['parent_reference']['drive_id'] != storage['driveId']
            or metadata['name'] != item['originalName'] or metadata['size'] != storage['size']
            or metadata['file']['hashes']['sha256Hash'].lower() != digest):
        raise ValueError('Sharing receipt is not bound to this original')
    link = permission.get('link', {})
    if (not permission.get('id') or link.get('scope') != 'anonymous' or link.get('type') != 'view'
            or link.get('prevents_download') is not False or permission.get('roles') != ['read']):
        raise ValueError('Only verified anonymous read-only downloads can be published')
    expiry = permission.get('expiration_date_time')
    if expiry and datetime.fromisoformat(expiry.replace('Z', '+00:00')) <= datetime.now(timezone.utc):
        raise ValueError('Sharing permission has expired')
    return {'openUrl': approved_share_url(link['web_url']), 'audience': 'public',
            'permissionsReviewed': True, 'downloadAllowed': True, 'shareType': 'view',
            'expiresAt': expiry}


def sync(batch_dir, root=ROOT):
    batch_dir, root = Path(batch_dir).resolve(), Path(root).resolve()
    if batch_dir.is_relative_to(root):
        raise ValueError('Batch working files must remain outside the public website')
    catalog_path = batch_dir / 'catalog.json'
    if not catalog_path.exists():
        candidates = sorted(batch_dir.glob('*纪要索引_*.json'))
        if not candidates:
            raise ValueError('Missing batch catalog')
        catalog_path = candidates[-1]
    source_path = batch_dir / 'source-texts.json'
    if not source_path.exists():
        source_path = batch_dir / 'first-batch-source-texts.json'
    catalog = read(catalog_path)
    receipt_path = batch_dir / 'sharing-receipts.json'
    sharing = {}
    if receipt_path.exists():
        receipts = read(receipt_path)
        by_id = {r['assetId']: r for r in receipts['items']}
        if len(by_id) != len(receipts['items']):
            raise ValueError('Duplicate permission receipt')
        for item in catalog['items']:
            asset_id = 'onedrive-docx-' + item['storage']['sha256'].lower()[:20]
            if asset_id not in by_id:
                raise ValueError('Every release item needs a checked sharing receipt')
            sharing[asset_id] = {**verified_share(item, by_id[asset_id]), 'permissionCheckedAt': receipts['verifiedAt']}
    with tempfile.TemporaryDirectory(prefix='research-release-') as directory:
        staging = Path(directory) / 'site'
        data_dir = staging / 'data/research'
        data_dir.mkdir(parents=True)
        source_dir = root / 'data/research'
        if (source_dir / 'library.json').exists():
            shutil.copy2(source_dir / 'library.json', data_dir / 'library.json')
        if (source_dir / 'processed').exists():
            shutil.copytree(source_dir / 'processed', data_dir / 'processed')
        batch = import_catalog(catalog_path, source_path, staging)
        library = read(data_dir / 'library.json')
        for record in library['records']:
            if record['id'] in sharing:
                record['storage'].update(sharing[record['id']])
                content_path = staging / record['processing']['contentPath']
                content = read(content_path)
                content['originalAccess'] = 'public'
                content_path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        downloads = [r for r in library['records'] if r.get('storage', {}).get('audience') == 'public'
                     and r['storage'].get('permissionsReviewed') and r['storage'].get('downloadAllowed')
                     and r['storage'].get('verifiedSha256') == r.get('sha256')]
        library['ingestedBatch']['customerDownloads'] = len(downloads)
        (data_dir / 'library.json').write_text(json.dumps(library, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        exceptions = [{'name': item['originalName'], 'issues': item['qualityIssues']}
                      for item in catalog['items'] if item['qualityIssues']]
        report = {'imported': batch['originals'], 'excludedDuplicates': batch['duplicateCopiesExcluded'],
                  'customerDownloads': len(downloads), 'needsReview': len(exceptions), 'exceptions': exceptions}
        private_map_path = catalog_path.parent / 'website-import-map.json'
        private_map = read(private_map_path)
        for record in library['records']:
            if record['id'] in private_map:
                private_map[record['id']].update(record.get('storage', {}))
        private_map_path.write_text(json.dumps(private_map, ensure_ascii=False, indent=2), encoding='utf-8')
        source_dir.mkdir(parents=True, exist_ok=True)
        for output in data_dir.rglob('*.json'):
            target = source_dir / output.relative_to(data_dir)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(output, target)
    (batch_dir / '入库结果.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return {key: value for key, value in report.items() if key != 'exceptions'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--batch-dir', required=True, type=Path)
    parser.add_argument('--root', default=ROOT, type=Path)
    args = parser.parse_args()
    print(json.dumps(sync(args.batch_dir, args.root), ensure_ascii=False))
