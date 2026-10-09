"""Prepare a Work-folder batch. GitHub connector writes and verifies it before ack.

No network or credentials. State and logs must stay outside the public repository.
Original files are read only; unsupported, empty and unstable files are retried.
"""
import argparse
import copy
import hashlib
import io
import json
import re
import unicodedata
import zipfile
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET
from build_research_library import sector_ids
from summary_io import write_json_if_changed

ROOT = Path(__file__).resolve().parents[1]
TZ = timezone(timedelta(hours=8))
NS = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
COMPANIES = ('中国东方教育', '中国中免', '首旅酒店', '锦江酒店', '华住集团', '亚朵集团',
             '华图山鼎', '小商品城', '焦点科技', '青木科技', '行动教育', '金陵体育',
             '力盛体育', '岭南控股', '蜜雪冰城', '老铺黄金', '小菜园', '海底捞',
             '海峡股份', '海南机场', '恒隆广场', '携程')

def now(): return datetime.now(TZ).isoformat(timespec='seconds')
def sha(data): return hashlib.sha256(data).hexdigest()
def read(path, default=None):
    return json.loads(Path(path).read_text(encoding='utf-8-sig')) if Path(path).exists() else default
def normalized(text): return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text))

def docx_text(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        part = archive.getinfo('word/document.xml')
        if part.file_size > 32 * 1024 * 1024: raise ValueError('Word text part exceeds size limit')
        element = ET.fromstring(archive.read(part))
        # Document paragraphs include table cells and text boxes in document order.
        lines = []
        for paragraph in element.iter(NS + 'p'):
            fragments = []
            for node in paragraph.iter():
                if node.tag == NS + 't': fragments.append(node.text or '')
                elif node.tag == NS + 'tab': fragments.append('\t')
                elif node.tag in (NS + 'br', NS + 'cr'): fragments.append('\n')
            if ''.join(fragments).strip(): lines.append(''.join(fragments).strip())
        return '\n'.join(lines)

def extract(data, extension):
    if extension == '.docx': return docx_text(data), 'OOXML document paragraphs and tables'
    if extension in ('.txt', '.md'): return data.decode('utf-8-sig'), 'UTF-8 source text'
    if extension == '.pdf':
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        pages = ['[第%d页]\n%s' % (i + 1, page.extract_text() or '') for i, page in enumerate(reader.pages)]
        return '\n\n'.join(pages), 'PDF text layer with page numbers; no OCR'
    raise ValueError('Unsupported format; needs actual conversion or transcription')

def dated(name, body):
    match = re.match(r'^(\d{4})(\d{2})(\d{2})(?:\D|$)', name)
    value = ''
    if match:
        try: value = date(*map(int, match.groups())).isoformat()
        except ValueError: pass
    headers = re.findall(r'(20\d{2})年(\d{1,2})月(\d{1,2})日', '\n'.join(body.splitlines()[:8]))
    candidates = []
    for parts in headers:
        try: candidates.append(date(*map(int, parts)).isoformat())
        except ValueError: pass
    conflicts = sorted({v for v in candidates if value and v != value})
    return ('' if conflicts else value or (candidates[0] if len(set(candidates)) == 1 else ''),
            value, 'needs_review' if conflicts else 'filename' if value else 'source_header' if candidates else 'unknown',
            sorted(set([value, *candidates]) - {''}))

def sources(folder, events):
    for path in sorted(folder.rglob('*'), key=lambda p: ('副本' in p.stem or bool(re.search(r'copy', p.stem, re.I)), str(p))):
        if not path.is_file() or path.name.startswith('~$'): continue
        relative = path.relative_to(folder).as_posix()
        if any(part in ('数据库', '.git', '.workbuddy') for part in path.relative_to(folder).parts):
            events.append({'source': relative, 'status': 'excluded', 'reason': 'Outside minutes scope'})
            continue
        try:
            before = path.stat()
            data = path.read_bytes()
            after = path.stat()
            if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
                raise ValueError('Source changed during reading; retry next run')
            info = {'mtimeNs': after.st_mtime_ns, 'size': after.st_size}
            if path.suffix.lower() == '.zip':
                with zipfile.ZipFile(io.BytesIO(data)) as archive:
                    for member in archive.infolist():
                        if member.is_dir(): continue
                        entry = member.filename
                        if not member.flag_bits & 0x800:
                            try: entry = entry.encode('cp437').decode('gb18030')
                            except (UnicodeError, LookupError): pass
                        if Path(entry).suffix.lower() not in ('.docx', '.pdf', '.md', '.txt'): continue
                        if member.file_size > 64 * 1024 * 1024: raise ValueError('Archive member exceeds size limit')
                        yield relative + '::' + entry, Path(entry).name, archive.read(member), info
            else:
                yield relative, path.name, data, info
        except Exception as error:
            events.append({'source': relative, 'status': 'failed', 'reason': str(error)})

def prepare(source_dir, private_dir, root=ROOT):
    source_dir, private_dir, root = map(lambda p: Path(p).resolve(), (source_dir, private_dir, root))
    if not source_dir.is_dir(): raise ValueError('Source directory is unavailable')
    if private_dir.is_relative_to(root) or source_dir.is_relative_to(root):
        raise ValueError('Sources and private state must stay outside public repository')
    private_dir.mkdir(parents=True, exist_ok=True)
    state = read(private_dir / 'state.json', {'schemaVersion': 1, 'files': {}})
    library_path = root / 'data/research/library.json'
    library = read(library_path)
    if not isinstance(library, dict) or not isinstance(library.get('records'), list):
        raise ValueError('Read the current GitHub library first; refusing an empty baseline')
    original = copy.deepcopy(library)
    records = {r['id']: r for r in library['records']}
    hashes = {r['sha256']: r for r in records.values() if r.get('sha256')}
    body_hashes = {r.get('processing', {}).get('bodySha256'): r for r in records.values() if r.get('processing', {}).get('bodySha256')}
    events, pending, changed_paths, seen_assets = [], {}, set(), set()
    counts = Counter()
    for relative, name, data, file_info in sources(source_dir, events):
        try:
            digest = sha(data)
            extension = Path(name).suffix.lower()
            if extension not in ('.docx', '.pdf', '.md', '.txt'):
                raise ValueError('Unsupported format; no text invented')
            previous = state['files'].get(relative, {})
            old = (records.get(previous.get('assetId')) if not previous.get('duplicate') else None) or next((r for r in records.values() if r.get('sourceRelativePath') == relative), None) or hashes.get(digest)
            if old and old.get('sha256') == digest and old.get('processing', {}).get('bodySha256'):
                key = old['id']
                pending[relative] = {**file_info, 'sha256': digest, 'assetId': key}
                status = 'duplicate' if key in seen_assets else 'unchanged'
                if status == 'duplicate' or old.get('sourceRelativePath') != relative:
                    pending[relative]['duplicate'] = True
                seen_assets.add(key)
                events.append({'source': relative, 'status': status, 'assetId': key})
                counts['duplicates' if status == 'duplicate' else status] += 1
                continue
            body, method = extract(data, extension)
            if len(normalized(body)) < 40: raise ValueError('No usable text layer; manual conversion or transcription needed')
            body_digest = sha(normalized(body).encode('utf-8'))
            duplicate = body_hashes.get(body_digest)
            if duplicate and (not old or duplicate['id'] != old['id']):
                pending[relative] = {**file_info, 'sha256': digest, 'assetId': duplicate['id'], 'duplicate': True}
                counts['duplicates'] += 1
                events.append({'source': relative, 'status': 'duplicate', 'assetId': duplicate['id']})
                continue
            # Match an existing exact filename only if unique, avoiding parallel records.
            if not old and not previous.get('duplicate'):
                same_name = [r for r in records.values() if r.get('name') == name and r.get('extension') == extension[1:]]
                if len(same_name) > 1: raise ValueError('Multiple records share this filename; requires identity review')
                old = same_name[0] if same_name else None
            unchanged_bytes = old and old.get('sha256') == digest
            asset_id = old['id'] if old else 'work-minutes-' + sha(relative.casefold().encode('utf-8'))[:20]
            record = copy.deepcopy(old) if old else {}
            source_date, sort_date, date_status, candidates = dated(name, body)
            company = old.get('company', '') if old else ''
            company = company or '、'.join(c for c in COMPANIES if c in name)
            topic = re.sub(r'^\d{8}\s*', '', Path(name).stem)
            if not unchanged_bytes:
                record = {k: v for k, v in record.items() if k not in ('storage', 'processing', 'dateCandidates')}
                record.update(date=source_date, published=source_date or sort_date, sortDate=sort_date or source_date,
                              dateStatus=date_status, dateCandidates=candidates if date_status == 'needs_review' else [])
                record['processing'] = {'status': 'source_extracted', 'textAvailable': True, 'summary': '', 'summaryOnly': False}
            processing = record.setdefault('processing', {})
            content_path = 'data/research/processed/' + asset_id + '.json'
            content = read(root / content_path, {}) if unchanged_bytes else {}
            content.update(assetId=asset_id, type='work_minutes', title=name, date=record.get('date', source_date),
                           company=company, topic=topic, body=body, preview=body[:500], previewTruncated=len(body) > 500,
                           source={'name': '用户提供 WORK 纪要', 'fileName': name, 'relativePath': relative, 'sha256': digest},
                           extraction={'method': method, 'reviewed': False}, bodySha256=body_digest)
            record.update(id=asset_id, name=name, company=company, topic=topic, format='document', extension=extension[1:],
                          sha256=digest, bytes=len(data), sourceRelativePath=relative)
            if not old:
                record.update(sourceType='work_document', sourceName='用户提供 WORK 纪要', sourceUrl='', sourceTopics=[],
                              sectors=sector_ids(name), classificationReviewed=False, durationSeconds=None)
            processing.update(textAvailable=True, contentPath=content_path, bodyAvailable=True, bodySha256=body_digest,
                              extractionMethod=method, searchText=' '.join([company, topic]))
            write_json_if_changed(root / content_path, content, indent=2)
            if not old or old != record: changed_paths.add(content_path)
            if old and old.get('sha256') != digest:
                hashes.pop(old.get('sha256'), None)
                body_hashes.pop(old.get('processing', {}).get('bodySha256'), None)
            records[asset_id] = record
            hashes[digest] = record
            body_hashes[body_digest] = record
            seen_assets.add(asset_id)
            pending[relative] = {**file_info, 'sha256': digest, 'assetId': asset_id, 'bodySha256': body_digest}
            status = 'updated' if old else 'added'
            counts[status] += 1
            events.append({'source': relative, 'status': status, 'assetId': asset_id, 'dateStatus': record.get('dateStatus')})
        except Exception as error:
            counts['failed'] += 1
            events.append({'source': relative, 'status': 'failed', 'reason': str(error)})
    library['records'] = sorted(records.values(), key=lambda r: (r.get('sortDate') or r.get('published', ''), r['id']), reverse=True)
    library['counts'] = dict(Counter(r['format'] for r in library['records']))
    if library != original:
        library['generatedAt'] = now()
        library['workSync'] = {'preparedAt': now(), 'source': 'WORK/纪要', **dict(counts)}
        if write_json_if_changed(library_path, library): changed_paths.add('data/research/library.json')
    # Discovery failures do not advance an individual checkpoint.
    counts['failed'] = sum(e['status'] == 'failed' for e in events)
    report = {'schemaVersion': 1, 'runAt': now(), 'sourceDir': str(source_dir), 'phase': 'prepared',
              'counts': dict(counts), 'events': events, 'changedPaths': sorted(changed_paths),
              'files': pending, 'publicationVerified': False}
    write_json_if_changed(private_dir / 'pending.json', report, indent=2)
    with (private_dir / 'runs.jsonl').open('a', encoding='utf-8') as handle: handle.write(json.dumps(report, ensure_ascii=False) + '\n')
    return report

def acknowledge(private_dir, root, commit, verification):
    private_dir, root = Path(private_dir), Path(root)
    pending = read(private_dir / 'pending.json')
    receipt = read(verification)
    if not re.fullmatch(r'[a-f0-9]{40}', commit) or receipt.get('commit') != commit or receipt.get('verified') is not True:
        raise ValueError('Actual connector read-back verification is required')
    for relative in pending['changedPaths']:
        if receipt.get('files', {}).get(relative) != sha((root / relative).read_bytes()):
            raise ValueError('Missing or mismatched remote read-back for ' + relative)
    state_path = private_dir / 'state.json'
    state = read(state_path, {'schemaVersion': 1, 'files': {}})
    state['files'].update(pending['files'])
    state.update(lastVerifiedAt=now(), lastVerifiedCommit=commit, sourceDir=pending['sourceDir'])
    write_json_if_changed(state_path, state, indent=2)
    result = {'runAt': now(), 'phase': 'verified', 'commit': commit, 'counts': pending['counts'], 'publicationVerified': True}
    with (private_dir / 'runs.jsonl').open('a', encoding='utf-8') as handle: handle.write(json.dumps(result, ensure_ascii=False) + '\n')
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path)
    parser.add_argument('--private-dir', type=Path, required=True)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--ack', action='store_true')
    parser.add_argument('--commit')
    parser.add_argument('--verification', type=Path)
    args = parser.parse_args()
    try:
        report = acknowledge(args.private_dir, args.root, args.commit or '', args.verification) if args.ack else prepare(args.source_dir, args.private_dir, args.root)
        print(json.dumps({k: v for k, v in report.items() if k not in ('events', 'files')}, ensure_ascii=False))
    except Exception as error:
        args.private_dir.mkdir(parents=True, exist_ok=True)
        with (args.private_dir / 'runs.jsonl').open('a', encoding='utf-8') as handle:
            handle.write(json.dumps({'runAt': now(), 'phase': 'failed', 'reason': str(error), 'publicationVerified': False}, ensure_ascii=False) + '\n')
        raise
