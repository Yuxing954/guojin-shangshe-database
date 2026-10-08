"""Register a successful connector upload; private file IDs remain outside the website."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]


def approved_share_url(value):
    url = urlparse(value)
    host = (url.hostname or '').lower()
    if url.scheme != 'https' or url.username or url.password or not (host in ('1drv.ms', 'onedrive.live.com') or host.endswith('.sharepoint.com')):
        raise ValueError('Use a stable OneDrive sharing or browser URL')
    if set(k.lower() for k in parse_qs(url.query)) & {'token', 'sig', 'signature', 'download'}:
        raise ValueError('Temporary download links must not be published')
    return value


def register(library_path, asset_id, original, receipt, private_dir, audience='private', share_url='', permissions_reviewed=False):
    library_path, original, private_dir = Path(library_path), Path(original), Path(private_dir)
    library = json.loads(library_path.read_text(encoding='utf-8-sig'))
    record = next((r for r in library['records'] if r['id'] == asset_id), None)
    digest = hashlib.sha256(original.read_bytes()).hexdigest()
    if not record or not re.fullmatch(r'zsxq-file-\d+', asset_id) or digest != record.get('sha256'):
        raise ValueError('Original does not match the source attachment SHA256')
    if not receipt.get('id') or not receipt.get('file') or receipt.get('name') != original.name or receipt.get('size') != original.stat().st_size:
        raise ValueError('Receipt must identify the successful upload of this original file')
    drive_id = receipt.get('parent_reference', receipt.get('parentReference', {})).get('drive_id') or receipt.get('parentReference', {}).get('driveId')
    if not drive_id:
        raise ValueError('Upload receipt has no destination drive')
    website = ROOT.resolve()
    resolved = private_dir.resolve()
    if resolved == website or website in resolved.parents:
        raise ValueError('Private upload registry must be outside the website directory')
    if audience not in ('private', 'clients', 'public'):
        raise ValueError('Unknown sharing audience')
    if audience != 'private' and (not permissions_reviewed or not share_url):
        raise ValueError('Confirm actual sharing permissions and supply a stable URL before enabling customer access')
    open_url = approved_share_url(share_url) if audience != 'private' else ''
    private_dir.mkdir(parents=True, exist_ok=True)
    private_record = {'assetId': asset_id, 'driveId': drive_id, 'itemId': receipt['id'], 'fileName': receipt['name'], 'size': receipt['size'], 'originalSha256': digest, 'audience': audience}
    (private_dir / (asset_id + '.json')).write_text(json.dumps(private_record, ensure_ascii=False, indent=2), encoding='utf-8')
    record['storage'] = {'provider': 'onedrive', 'status': 'uploaded', 'verifiedSha256': digest, 'audience': audience, 'permissionsReviewed': permissions_reviewed if audience != 'private' else False, 'openUrl': open_url}
    if record['processing']['status'] == 'awaiting_file':
        record['processing']['status'] = 'awaiting_text'
    library_path.write_text(json.dumps(library, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    return {'assetId': asset_id, 'provider': 'onedrive', 'audience': audience, 'customerLinkEnabled': bool(open_url)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--library', type=Path, default=ROOT / 'data/research/library.json')
    parser.add_argument('--asset-id', required=True)
    parser.add_argument('--file', required=True, type=Path)
    parser.add_argument('--receipt', required=True, type=Path, help='Successful OneDrive connector upload response: structuredContent or its item')
    parser.add_argument('--private-dir', type=Path, default=ROOT.parent / 'research-storage/uploads')
    parser.add_argument('--audience', choices=['private', 'clients', 'public'], default='private')
    parser.add_argument('--share-url', default='')
    parser.add_argument('--permissions-reviewed', action='store_true', help='Only after reading effective permissions through the connector')
    args = parser.parse_args()
    receipt = json.loads(args.receipt.read_text(encoding='utf-8-sig'))
    print(json.dumps(register(args.library, args.asset_id, args.file, receipt.get('structuredContent', receipt), args.private_dir, args.audience, args.share_url, args.permissions_reviewed)))


if __name__ == '__main__':
    main()
