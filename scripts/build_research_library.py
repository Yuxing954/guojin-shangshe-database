"""Build a consumption attachment catalog without publishing signed download URLs."""
import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECTORS = [
    ('travel', r'酒店|旅游|文旅|携程|同程|首旅|锦江|华住|亚朵|宋城|景区|\bOTA\b'),
    ('dutyfree', r'免税|中免|海旅|海汽'),
    ('gold', r'珠宝|黄金(?:首饰|饰品|消费|零售)|中国黄金(?!周)|老铺|老凤祥|周大福|周大生|潮宏基|菜百|周六福|周生生|六福|梦金园'),
    ('dining', r'餐饮|茶饮|海底捞|小菜园|蜜雪|古茗|奈雪|瑞幸|百胜|九毛九|星巴克|麦当劳|霸王茶姬|达势|茶百道'),
    ('retail', r'零售|美护|美妆|医美|化妆品|开市客|山姆|永辉|泡泡玛特|毛戈平|珀莱雅|华熙|爱美客|贝泰妮|上美|巨子生物|名创优品|万辰|若羽臣|零食|本地生活|宠物|消费(?!者|电子|级?AI|级?3D|级?人工智能)'),
    ('education', r'教育|人服|人力资源|招聘|培训|中公|科锐|行动教育|东方教育|新东方|好未来'),
    ('commerce', r'电商|出海|跨境|亚马逊|阿里|拼多多|京东|焦点科技|吉宏|安克|赛维|东方甄选'),
    ('food', r'食品饮料|白酒|啤酒|乳业|乳制品|茅台|五粮液|汾酒|伊利|蒙牛|农夫山泉|东鹏饮料|调味品'),
    ('sports', r'体育|赛事|力盛|金陵|健身|运动场馆'),
    ('brandservices', r'青木科技|代运营|品牌孵化|品牌服务'),
]


def sector_ids(name, context=''):
    text = f'{name or ""} {context or ""}'
    # Generic retail/platform mentions are insufficient for unrelated technology reports.
    if re.search(r'新能源汽车|新能源车|电网|变压器|全栈AI|消费级AI|消费级3D|云栖|阿里云|AWS', text, re.I) and not re.search(r'酒店|旅游|免税|珠宝|餐饮|茶饮|美妆|化妆品|电商|跨境|食品饮料|白酒|乳业', text):
        return ['other']
    matches = [key for key, pattern in SECTORS if re.search(pattern, text, re.I)]
    return matches or ['other']


def build(topics_dir, root=ROOT):
    topics = {}
    for path in sorted(Path(topics_dir).glob('page-*.json')):
        payload = json.loads(path.read_text(encoding='utf-8-sig'))
        for topic in payload if isinstance(payload, list) else payload.get('topics', []):
            topics[str(topic['topic_id'])] = topic
    if not topics:
        raise ValueError('No source topics supplied')
    previous_path = Path(root) / 'data/research/library.json'
    previous = json.loads(previous_path.read_text(encoding='utf-8-sig')) if previous_path.exists() else {}
    previous_records = {item['id']: item for item in previous.get('records', [])}
    records = {}
    for tid, topic in topics.items():
        if topic.get('create_time', '')[:10] < '2026-09-03':
            continue
        group = str(topic.get('group', {}).get('group_id', ''))
        if group != '88888142214212':
            raise ValueError('Unexpected source group')
        talk = topic.get('talk') or topic
        for file in talk.get('files') or topic.get('files') or []:
            name = file.get('name', '')
            sectors = sector_ids(name, topic.get('title', ''))
            extension = Path(name).suffix.lower() or '.unknown'
            file_id = str(file.get('file_id', ''))
            if not re.fullmatch(r'\d+', file_id):
                continue
            audio = extension in ('.mp3', '.m4a', '.wav', '.aac')
            source_url = f'https://wx.zsxq.com/group/{group}/topic/{tid}'
            occurrence_key = '|'.join((file_id, tid, str(file.get('create_time') or ''), name))
            occurrence = {
                'occurrenceKey': occurrence_key, 'fileId': file_id, 'topicId': tid,
                'topicTitle': topic.get('title', ''), 'topicCreatedAt': topic.get('create_time', ''),
                'fileCreatedAt': file.get('create_time', ''), 'name': name,
                'extension': extension.lstrip('.'), 'format': 'audio' if audio else 'document',
                'bytes': file.get('size'), 'durationSeconds': file.get('duration') or None,
                'downloadCount': file.get('download_count'), 'sha256': file.get('hash') or '',
                'sha256Status': 'reported_by_zsxq_not_recomputed' if file.get('hash') else 'not_provided',
                'source': file.get('source', ''), 'sourceGroupId': group,
                'sourceName': '水木调研纪要-2.0', 'sourceUrl': source_url,
                'sectors': sectors, 'contentRead': False,
                'metadataStatus': 'metadata_only_attachment_unread'
            }
            record = {'id': 'zsxq-file-' + file_id, 'fileId': file_id, 'topicId': tid,
                      'name': name, 'format': 'audio' if audio else 'document',
                      'extension': extension.lstrip('.'), 'published': topic['create_time'][:19],
                      'date': topic['create_time'][:10], 'sectors': sectors,
                      'bytes': file.get('size'), 'durationSeconds': file.get('duration') or None,
                      'sha256': file.get('hash') or '',
                      'sourceName': '水木调研纪要-2.0', 'sourceUrl': source_url,
                      'occurrences': [occurrence],
                      'processing': {'status': 'awaiting_file', 'textAvailable': False}}
            old = previous_records.get(record['id'])
            if old and record['sha256'] and old.get('sha256') == record['sha256']:
                record['processing'] = old['processing']
                if old.get('storage'):
                    record['storage'] = old['storage']
                record['aliases'] = list(dict.fromkeys([record['id'], *old.get('aliases', [])]))
                record['sourceTopics'] = list(dict.fromkeys([tid, *old.get('sourceTopics', [])]))
                record['occurrences'] = list(old.get('occurrences', [])) + list(record.get('occurrences', []))
            if record['id'] not in records or record['published'] > records[record['id']]['published']:
                records[record['id']] = record
    for asset_id, old in previous_records.items():
        if asset_id not in records and old.get('sourceType') in ('onedrive_document', 'work_document'):
            # Manual content classification and unresolved dates must survive topic refreshes.
            records[asset_id] = old
        elif asset_id not in records:
            records[asset_id] = {**old, 'sectors': sector_ids(old.get('name', ''), old.get('topicTitle', ''))}
    ordered = sorted(records.values(), key=lambda item: (item['published'], item['id']), reverse=True)
    # The same bytes may be reposted under another file ID. Show one copy, retain all sources.
    groups = {}
    for record in ordered:
        key = (record['sha256'], record['extension']) if record['sha256'] else (record['id'], record['extension'])
        groups.setdefault(key, []).append(record)
    result = []
    for copies in groups.values():
        record = next((r for r in copies if r['processing'].get('textAvailable')), copies[0])
        record['sourceTopics'] = list(dict.fromkeys(tid for r in copies for tid in r.get('sourceTopics', [r.get('topicId')]) if tid))
        record['aliases'] = list(dict.fromkeys(alias for r in copies for alias in r.get('aliases', [r['id']])))
        occurrence_map = {}
        for source_record in copies:
            for occurrence in source_record.get('occurrences', []):
                key = occurrence.get('occurrenceKey') or '|'.join((str(occurrence.get('fileId', '')), str(occurrence.get('topicId', '')), str(occurrence.get('fileCreatedAt', '')), str(occurrence.get('name', ''))))
                occurrence_map[key] = occurrence
        record['occurrences'] = sorted(occurrence_map.values(), key=lambda item: (item.get('topicCreatedAt', ''), item.get('fileCreatedAt', ''), item.get('name', '')), reverse=True)
        result.append(record)
    result.sort(key=lambda item: (item['published'], item['id']), reverse=True)
    all_occurrences = [occurrence for item in result for occurrence in item.get('occurrences', [])]
    tz = timezone(timedelta(hours=8))
    now = datetime.now(tz)
    window_start = (now.date() - timedelta(days=2)).isoformat()
    topic_dates = sorted(t.get('create_time', '') for t in topics.values() if t.get('create_time'))
    oldest_topic = topic_dates[0] if topic_dates else ''
    latest_topic = topic_dates[-1] if topic_dates else ''
    if not oldest_topic or oldest_topic[:10] > window_start:
        raise ValueError(f'Attachment scan does not cover the full three-day window from {window_start}')
    window_topics = [t for t in topics.values() if t.get('create_time', '')[:10] >= window_start]
    window_files = [file for topic in window_topics for file in (topic.get('files') or [])
                    if re.fullmatch(r'\d+', str(file.get('file_id', '')))]
    page_count = len(list(Path(topics_dir).glob('page-*.json')))
    new_records = max(0, len(result) - len(previous_records))
    attachment_scan = {
        'observedAt': now.isoformat(timespec='seconds'), 'sourceGroup': '88888142214212',
        'sourceName': '水木调研纪要-2.0', 'topicsScanned': len(topics),
        'topicsInWindow': len(window_topics), 'topicPages': page_count,
        'topicPageOldest': oldest_topic, 'topicWindowFrom': window_start + 'T00:00:00+0800',
        'topicWindowTo': latest_topic, 'attachmentsObserved': len(window_files),
        'newRecords': new_records, 'existingRecordsRefreshed': max(0, len(window_files) - new_records),
        'attachmentContentRead': False, 'windowComplete': True, 'archiveHasMore': True
    }
    return {**({'ingestedBatch': previous['ingestedBatch']} if previous.get('ingestedBatch') else {}),
            'schemaVersion': 1, 'generatedAt': datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'),
            'coverage': {'from': min('2026-09-03', previous.get('coverage', {}).get('from', '2026-09-03')),
                         'to': max(max(t['create_time'] for t in topics.values())[:19], previous.get('coverage', {}).get('to', '')),
                         'lastScanTopicCount': len(topics), 'completeArchive': False},
            'counts': dict(Counter(item['format'] for item in result)),
            'sourceOccurrences': {
                'windowStart': min((item.get('topicCreatedAt', '')[:10] for item in all_occurrences if item.get('topicCreatedAt')), default=''),
                'windowEnd': max((item.get('topicCreatedAt', '')[:10] for item in all_occurrences if item.get('topicCreatedAt')), default=''),
                'total': len(all_occurrences),
                'audio': sum(item.get('format') == 'audio' for item in all_occurrences),
                'document': sum(item.get('format') == 'document' for item in all_occurrences),
                'metadataOnly': sum(item.get('contentRead') is False for item in all_occurrences),
                'completeForWindow': True
            }, 'attachmentScan': attachment_scan, 'records': result}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--topics-dir', required=True, type=Path)
    parser.add_argument('--root', default=ROOT, type=Path)
    args = parser.parse_args()
    data = build(args.topics_dir, args.root)
    target = args.root / 'data/research/library.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps({'records': len(data['records']), 'counts': data['counts'], 'coverage': data['coverage']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
