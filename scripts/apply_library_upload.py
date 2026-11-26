"""Apply checksum-verified connector chunks before the normal research build."""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import shutil
from datetime import datetime, timedelta, timezone


def git_sha(data):
    return hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()

def merge_metadata(base, scan):
    """Merge only source metadata, leaving existing classifications and content fields intact."""
    group = '88888142214212'
    source_name = '水木调研纪要-2.0'
    tz = timezone(timedelta(hours=8))
    start = datetime.fromisoformat(scan['windowStart'])
    end = datetime.fromisoformat(scan['windowEndDate']).replace(tzinfo=tz) + timedelta(days=1)
    observed = datetime.fromisoformat(scan['observedAt'])
    if (not scan['boundaryReachedBeforeWindow'] or start != end - timedelta(days=3)
            or not start <= observed < end or scan['pages'] < 1
            or scan['topicsScanned'] < scan['topics']):
        raise ValueError('Incomplete metadata scan')
    records = base['records']
    by_id = {str(r['fileId']): r for r in records if r.get('fileId')}
    if len(by_id) != sum(bool(r.get('fileId')) for r in records):
        raise ValueError('Existing duplicate fileId')
    added = refreshed = occurrences = 0
    seen = set()
    for file_id, rows in scan['files']:
        if not isinstance(file_id, str) or not file_id.isdigit() or file_id in seen or not rows:
            raise ValueError('Invalid or duplicate scanned fileId')
        seen.add(file_id)
        occurrences += len(rows)
        for f in rows:
            if (str(f['file_id']) != file_id or not str(f['topicId']).isdigit()
                    or not f['name'] or type(f['size']) is not int or f['size'] < 0
                    or not start <= datetime.fromisoformat(f['topicCreatedAt']) < end):
                raise ValueError('Invalid attachment metadata')
            datetime.fromisoformat(f['create_time'])
        f = rows[0]
        extension = f['name'].rsplit('.', 1)[-1].lower() if '.' in f['name'] else ''
        audio = extension in {'mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'wma'}
        kind = 'audio' if audio else 'document'
        fresh = file_id not in by_id
        if fresh:
            r = {'id': 'zsxq-file-' + file_id, 'fileId': file_id, 'topicId': f['topicId'],
                 'name': f['name'], 'format': kind, 'extension': extension,
                 'published': f['topicCreatedAt'], 'date': f['topicCreatedAt'][:10],
                 'sortDate': f['create_time'], 'dateStatus': 'source_file_created_at',
                 'sourceType': 'zsxq_attachment', 'sourceName': source_name,
                 'sectors': ['other'], 'contentRead': False, 'aliases': ['zsxq-file-' + file_id],
                 'sourceTopics': [], 'occurrences': [],
                 'processing': {'status': 'awaiting_file', 'textAvailable': False,
                                'metadataStatus': 'metadata_complete_content_unread'}}
            records.append(r)
            by_id[file_id] = r
            added += 1
        else:
            r = by_id[file_id]
        before = json.dumps(r, ensure_ascii=False, sort_keys=True)
        metadata = {'fileId': file_id, 'topicId': f['topicId'], 'filename': f['name'],
                    'extension': extension, 'bytes': f['size'], 'fileCreatedAt': f['create_time'],
                    'topicCreatedAt': f['topicCreatedAt'], 'groupId': group, 'sourceName': source_name,
                    'sourceUrl': f'https://wx.zsxq.com/group/{group}/topic/{f["topicId"]}'}
        if 'source' in f:
            metadata['source'] = f['source']
        for key, target in [('download_count', 'downloadCount'), ('duration', 'durationSeconds'),
                            ('hash', 'sourceHash'), ('mime_type', 'mime'), ('mime', 'mime')]:
            if f.get(key) is not None:
                metadata[target] = f[key]
        if metadata.get('sourceHash'):
            metadata['sourceHashStatus'] = 'reported_by_zsxq_not_recomputed'
        for key in ['extension', 'bytes', 'source', 'sourceUrl', 'downloadCount', 'durationSeconds',
                    'sourceHash', 'sourceHashStatus', 'mime']:
            if key in metadata:
                r[key] = metadata[key]
        r['name'] = f['name']
        r.setdefault('metadata', {}).update(metadata)
        r['sourceTopics'] = list(dict.fromkeys(r.get('sourceTopics', []) + [a['topicId'] for a in rows]))
        row_list = r.setdefault('occurrences', [])
        touched = []
        for a in rows:
            key = '|'.join([file_id, a['topicId'], a['create_time'], a['name']])
            o = next((o for o in row_list if o.get('occurrenceKey') == key), None)
            if o is None:
                o = {'occurrenceKey': key, 'fileId': file_id, 'topicId': a['topicId'],
                     'topicTitle': a.get('topicTitle'), 'topicCreatedAt': a['topicCreatedAt'],
                     'fileCreatedAt': a['create_time'], 'name': a['name'], 'extension': extension,
                     'format': r.get('format', kind), 'sourceGroupId': group, 'sourceName': source_name,
                     'sourceUrl': f'https://wx.zsxq.com/group/{group}/topic/{a["topicId"]}',
                     'contentRead': False, 'metadataStatus': 'metadata_only_attachment_unread'}
                row_list.append(o)
            o['bytes'] = a['size']
            for field, target in [('download_count', 'downloadCount'), ('duration', 'durationSeconds'),
                                  ('source', 'source'), ('mime_type', 'mime'), ('mime', 'mime')]:
                if a.get(field) is not None:
                    o[target] = a[field]
            if a.get('hash'):
                o['sourceHash'] = a['hash']
                # Retain any independently computed content checksum on an existing record.
                if not o.get('sha256') or o.get('sha256Status') == 'reported_by_zsxq_not_recomputed':
                    o.update(sha256=a['hash'], sha256Status='reported_by_zsxq_not_recomputed')
            touched.append(o)
        if fresh or json.dumps(r, ensure_ascii=False, sort_keys=True) != before:
            refreshed += not fresh
            r['observedAt'] = scan['observedAt']
            r['metadata']['observedAt'] = scan['observedAt']
            for o in touched:
                o['observedAt'] = scan['observedAt']
    if len(seen) != scan['unique'] or occurrences != scan['attachments']:
        raise ValueError('Scan attachment counts do not reconcile')
    summary = {'observedAt': scan['observedAt'], 'sourceGroup': group, 'sourceName': source_name,
               'topicsScanned': scan['topicsScanned'], 'topicsInWindow': scan['topics'], 'topicPages': scan['pages'],
               'topicWindowFrom': scan['windowStart'], 'topicWindowTo': scan['latest'],
               'boundaryReachedBeforeWindow': True, 'attachmentsObserved': occurrences,
               'uniqueFileIds': len(seen), 'duplicateFileIds': occurrences - len(seen),
               'newRecords': added, 'existingRecordsRefreshed': refreshed, 'attachmentContentRead': False,
               'sourceMetadataFields': ['fileId','topicId','filename','extension','mime','bytes','fileCreatedAt',
                                        'topicCreatedAt','durationSeconds','downloadCount','sourceHash','source'],
               'windowStart': scan['windowStart'], 'windowEnd': scan['observedAt'],
               'windowEndDate': scan['windowEndDate'], 'windowComplete': True, 'archiveHasMore': True}
    base['generatedAt'] = scan['observedAt']
    base.setdefault('coverage', {}).update(to=scan['latest'], lastScanTopicCount=scan['topics'], completeArchive=False)
    base.setdefault('counts', {}).update(document=sum(r.get('format') == 'document' for r in records),
                                         audio=sum(r.get('format') == 'audio' for r in records))
    base['attachmentScan'] = summary
    return base


def apply(root):
    root = Path(root)
    library = root / 'data/research/library.json'
    pending = root / 'data/research/library-pending'
    manifests = sorted(pending.glob('*/manifest.json'))
    if len(manifests) > 1:
        raise ValueError('Multiple pending library uploads; resolve concurrency first')
    if not manifests:
        return
    manifest = manifests[0]
    spec = json.loads(manifest.read_text(encoding='utf-8'))
    if spec.get('schemaVersion') not in (1, 2):
        raise ValueError('Unsupported library upload schema')
    current = library.read_bytes()
    if git_sha(current) != spec['baseBlobSha']:
        raise ValueError('Library changed since metadata scan; upload retained for reconciliation')
    packed = bytearray()
    for i, chunk in enumerate(spec['chunks']):
        name = chunk['name']
        if name != f'part-{i:03}.b64':
            raise ValueError('Invalid chunk path/order')
        block = base64.b64decode((manifest.parent / name).read_bytes(), validate=True)
        if hashlib.sha256(block).hexdigest() != chunk['sha256']:
            raise ValueError('Library chunk checksum mismatch')
        packed.extend(block)
    if len(packed) != spec['compressedBytes']:
        raise ValueError('Library compressed size mismatch')
    payload = gzip.decompress(packed)
    if len(payload) != spec['bytes'] or hashlib.sha256(payload).hexdigest() != spec['sha256']:
        raise ValueError('Library payload checksum mismatch')
    old = json.loads(current)
    if spec['schemaVersion'] == 2:
        if len(current) != spec['baseBytes']:
            raise ValueError('Library base byte count mismatch')
        new = merge_metadata(json.loads(current), json.loads(payload))
        scan_sha = spec['sha256']
        payload = json.dumps(new, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        if not new['attachmentScan']['newRecords'] and not new['attachmentScan']['existingRecordsRefreshed']:
            payload = current
        spec = {**spec, 'sha256': hashlib.sha256(payload).hexdigest(),
                'bytes': len(payload), 'recordCount': len(new['records']), 'scanSha256': scan_sha}
    else:
        new = json.loads(payload)
    ids = [str(r['fileId']) for r in new['records'] if r.get('fileId')]
    old_ids = {str(r['fileId']) for r in old['records'] if r.get('fileId')}
    if len(ids) != len(set(ids)) or not old_ids.issubset(ids):
        raise ValueError('Duplicate or lost library file IDs')
    if len(new['records']) != spec['recordCount']:
        raise ValueError('Library record count mismatch')
    if not new['attachmentScan']['windowComplete'] or new['coverage']['completeArchive']:
        raise ValueError('Invalid library coverage flags')
    # No mutation occurs until every chunk, payload and record check passes.
    tmp = library.with_suffix('.json.tmp')
    tmp.write_bytes(payload)
    tmp.replace(library)
    receipt = {**{k: spec[k] for k in ['batchId', 'sha256', 'bytes', 'recordCount']},
               'blobSha': git_sha(payload), 'attachmentScan': new['attachmentScan']}
    if spec['schemaVersion'] == 2:
        receipt.update(schemaVersion=2, baseBlobSha=spec['baseBlobSha'], scanSha256=spec['scanSha256'])
    (root / 'data/research/library-sync-receipt.json').write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shutil.rmtree(manifest.parent)
    print(json.dumps({'libraryUploadApplied': receipt['batchId'], 'records': len(new['records'])}))


if __name__ == '__main__':
    import sys
    apply(sys.argv[1] if len(sys.argv) > 1 else '.')
