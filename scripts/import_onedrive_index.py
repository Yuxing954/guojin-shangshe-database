"""Index verified OneDrive files without opening, extracting or summarizing them.

Input is a private connector metadata/permission receipt, never a public form.
Only file metadata and stable read-only links reach the customer website.
"""
import hashlib
import json
import re
from collections import Counter
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from import_onedrive_minutes import read
from register_research_onedrive import approved_share_url


def filename_date(name):
    match = re.match(r'^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})(?:\D|$)', name)
    try:
        return date(*map(int, match.groups())).isoformat() if match else ''
    except ValueError:
        return ''


def import_index(batch_dir, root):
    batch_dir, root = Path(batch_dir).resolve(), Path(root).resolve()
    if batch_dir.is_relative_to(root):
        raise ValueError('Private receipts must stay outside the public website')
    receipt_path = batch_dir / 'sharing-receipts.json'
    if not receipt_path.exists():
        raise ValueError('Read file metadata and download permissions through OneDrive first')
    receipts = read(receipt_path)
    library_path = root / 'data/research/library.json'
    library = read(library_path) if library_path.exists() else {'schemaVersion': 1, 'records': []}
    records = {r['id']: r for r in library['records']}
    by_hash = {r['sha256']: r for r in library['records'] if r.get('sha256')}
    map_path = batch_dir / 'website-import-map.json'
    mappings = read(map_path) if map_path.exists() else {}
    by_item = {(m['driveId'], m['itemId']): asset for asset, m in mappings.items() if m.get('driveId') and m.get('itemId')}
    seen, imported, duplicates = set(), [], 0
    for receipt in receipts['items']:
        metadata, permission = receipt['metadata'], receipt['permission']
        drive, item = receipt['driveId'], receipt['itemId']
        if (metadata['id'] != item or metadata['parent_reference']['drive_id'] != drive
                or not metadata.get('file') or metadata.get('folder')
                or not metadata.get('name') or not isinstance(metadata.get('size'), int) or metadata['size'] <= 0):
            raise ValueError('Receipt must identify an actual uploaded file')
        digest = metadata['file'].get('hashes', {}).get('sha256Hash', '').lower()
        if digest and not re.fullmatch(r'[a-f0-9]{64}', digest):
            raise ValueError('Invalid provider checksum')
        if any(receipt.get(k) is not None and receipt[k] != value for k, value in
               [('name', metadata['name']), ('size', metadata['size']), ('sha256', digest)]):
            raise ValueError('Receipt metadata changed')
        # No original bytes are downloaded or hashed. ETag binds an index to a cloud version.
        version = metadata.get('e_tag') or ''
        if not digest and not version:
            raise ValueError('Provider hash or cloud version is required')
        version_key = hashlib.sha256(str(version).encode()).hexdigest() if version else ''
        old_id = by_item.get((drive, item))
        old = records.get(old_id) or by_hash.get(digest)
        unchanged = bool(old and ((digest and old.get('sha256') == digest) or
                                  (not digest and old.get('storage', {}).get('cloudVersion') == version_key)))
        asset_id = old['id'] if unchanged else ('onedrive-docx-' + digest[:20] if digest and metadata['name'].lower().endswith('.docx')
                                              else 'onedrive-file-' + hashlib.sha256((drive + '|' + item + '|' + (digest or version_key)).encode()).hexdigest()[:20])
        link = permission.get('link', {})
        if (not permission.get('id') or permission.get('roles') != ['read'] or link.get('scope') != 'anonymous'
                or link.get('type') != 'view' or link.get('prevents_download') is not False):
            raise ValueError('Customer links require verified anonymous read-only download permissions')
        expiry = permission.get('expiration_date_time')
        if expiry and datetime.fromisoformat(expiry.replace('Z', '+00:00')) <= datetime.now(timezone.utc):
            raise ValueError('Permission has expired')
        url = approved_share_url(link['web_url'])
        key = digest or (drive, item, version_key)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        name = metadata['name']
        extension = Path(name).suffix.lower().lstrip('.')
        audio = extension in {'mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'wma', 'mp4'}
        if extension not in {'pdf', 'doc', 'docx'} and not audio:
            raise ValueError('Only Word, PDF and meeting audio belong in this index')
        file_date = filename_date(name)
        record = dict(old) if unchanged else {
            'id': asset_id, 'name': name, 'company': '', 'format': 'audio' if audio else 'document',
            'extension': extension, 'date': file_date, 'published': file_date, 'sortDate': file_date,
            'dateStatus': 'filename' if file_date else 'unknown', 'sectors': [],
            'classificationReviewed': False, 'sourceType': 'onedrive_document',
            'sourceName': '用户提供纪要', 'sourceUrl': '', 'sourceTopics': [],
            'durationSeconds': None, 'sha256': digest,
            'processing': {'status': 'original_only', 'textAvailable': False, 'contentPath': '', 'summary': ''}}
        record.update(name=name, bytes=metadata['size'])
        record['storage'] = {**record.get('storage', {}), 'provider': 'onedrive', 'status': 'uploaded',
                             'audience': 'public', 'permissionsReviewed': True, 'downloadAllowed': True,
                             'openUrl': url, 'shareType': 'view', 'expiresAt': expiry,
                             'permissionCheckedAt': receipts['verifiedAt'], 'metadataVerified': True,
                             'cloudVersion': version_key, 'verifiedSha256': digest,
                             'verificationMethod': 'provider_metadata_hash' if digest else 'provider_metadata_version'}
        if old_id and old_id != asset_id:
            record['aliases'] = list(dict.fromkeys([asset_id, old_id, *records.get(old_id, {}).get('aliases', [])]))
            records.pop(old_id, None)
            mappings.pop(old_id, None)
        records[asset_id] = record
        mappings[asset_id] = {**mappings.get(asset_id, {}), 'driveId': drive, 'itemId': item,
                              'name': name, 'cloudVersion': version_key, 'sha256': digest, 'size': metadata['size']}
        imported.append(asset_id)
    library['records'] = sorted(records.values(), key=lambda r: (r.get('sortDate') or r.get('published', ''), r['id']), reverse=True)
    library['counts'] = dict(Counter(r['format'] for r in library['records']))
    library['generatedAt'] = datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')
    library['indexUpdatedAt'] = receipts['verifiedAt']
    # Keep earlier curated batch statistics and processed files; indexing does not review summaries.
    report = {'mode': 'originals', 'indexed': len(imported), 'excludedDuplicates': duplicates,
              'summariesGenerated': 0, 'filesExtracted': 0}
    library_path.parent.mkdir(parents=True, exist_ok=True)
    library_path.write_text(json.dumps(library, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    map_path.write_text(json.dumps(mappings, ensure_ascii=False, indent=2), encoding='utf-8')
    (batch_dir / '入库结果.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report

