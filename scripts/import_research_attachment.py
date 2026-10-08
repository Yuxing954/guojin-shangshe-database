"""Import a verified PDF or an existing audio transcript; never invent a transcript."""
import argparse
import hashlib
import json
import math
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def verify_file(record, path):
    digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    if not record.get('sha256') or digest != record['sha256']:
        raise ValueError('Original file SHA256 differs from the source catalog')
    return digest


def extract_pdf(path):
    import pdfplumber
    with pdfplumber.open(path) as document:
        pages = [{'page': i + 1, 'text': page.extract_text(layout=False) or ''}
                 for i, page in enumerate(document.pages)]
    if not any(len(page['text'].strip()) >= 20 for page in pages):
        raise ValueError('PDF has no usable text layer; OCR is required before import')
    return pages


def read_transcript(path, duration):
    # ASR output must be supplied explicitly, linked to the verified original audio.
    data = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    segments = data.get('segments', [])
    if not segments:
        raise ValueError('No timestamped transcript segments')
    prior_start = -1
    out = []
    for segment in segments:
        start, end = segment.get('start'), segment.get('end')
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in (start, end)):
            raise ValueError('Transcript timestamps must be finite numbers')
        if start < 0 or end <= start or start < prior_start or duration and end > duration + 1:
            raise ValueError('Invalid transcript range or timestamps outside the original recording')
        text = segment.get('text', '').strip()
        if not text:
            raise ValueError('Empty transcript segment')
        out.append({'start': start, 'end': end, 'text': text, 'speaker': str(segment.get('speaker', ''))})
        prior_start = start
    return out


def import_asset(library_path, asset_id, original, transcript=None, reviewed=False, root=ROOT):
    library = json.loads(Path(library_path).read_text(encoding='utf-8-sig'))
    record = next((r for r in library['records'] if r['id'] == asset_id), None)
    if not record or not re.fullmatch(r'zsxq-file-\d+', asset_id):
        raise ValueError('Unknown asset ID')
    digest = verify_file(record, original)
    payload = {'schemaVersion': 1, 'assetId': asset_id, 'originalSha256': digest,
               'sourceUrl': record['sourceUrl'], 'reviewed': reviewed}
    if record['extension'] == 'pdf':
        payload.update(type='pdf', pages=extract_pdf(original))
        search_text = '\n'.join(page['text'] for page in payload['pages'])
        status = 'reviewed' if reviewed else 'extracted'
    elif record['format'] == 'audio':
        if not transcript:
            raise ValueError('Supply actual ASR output with --transcript; automatic speech recognition is not configured')
        payload.update(type='transcript', segments=read_transcript(transcript, record.get('durationSeconds')))
        search_text = '\n'.join(segment['text'] for segment in payload['segments'])
        status = 'reviewed' if reviewed else 'transcript_draft'
    else:
        raise ValueError('Only PDF and timestamped audio transcripts are supported')
    content_path = 'data/research/processed/' + asset_id + '.json'
    record['processing'] = {'status': status, 'textAvailable': True, 'contentPath': content_path,
                            'searchText': search_text, 'processedAt': datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')}
    output = Path(root) / content_path
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    Path(library_path).write_text(json.dumps(library, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    return {'id': asset_id, 'status': status, 'contentPath': content_path}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--library', type=Path, default=ROOT / 'data/research/library.json')
    parser.add_argument('--asset-id', required=True)
    parser.add_argument('--file', type=Path, required=True, help='Original PDF or audio; must match the source SHA256')
    parser.add_argument('--transcript', type=Path, help='Actual JSON ASR output: segments with start/end/text/speaker')
    parser.add_argument('--reviewed', action='store_true', help='Only after checking the original source, numbers and speaker attribution')
    args = parser.parse_args()
    print(json.dumps(import_asset(args.library, args.asset_id, args.file, args.transcript, args.reviewed), ensure_ascii=False))


if __name__ == '__main__':
    main()
