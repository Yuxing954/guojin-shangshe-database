"""Apply checksum-verified connector chunks before the normal research build."""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import shutil


def git_sha(data):
    return hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()


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
    if spec.get('schemaVersion') != 1:
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
    old, new = json.loads(current), json.loads(payload)
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
    (root / 'data/research/library-sync-receipt.json').write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shutil.rmtree(manifest.parent)
    print(json.dumps({'libraryUploadApplied': receipt['batchId'], 'records': len(new['records'])}))


if __name__ == '__main__':
    import sys
    apply(sys.argv[1] if len(sys.argv) > 1 else '.')
