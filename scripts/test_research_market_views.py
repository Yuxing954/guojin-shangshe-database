#!/usr/bin/env python3
"""Contract and generated-output tests for the complete mini-program market-view export."""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_research_shards import _publication_utc, market_view_export


def make_row(kind, number, days_ago):
    published = (dt.datetime(2026, 10, 13, 12, tzinfo=dt.timezone(dt.timedelta(hours=8)))
                 - dt.timedelta(days=days_ago)).isoformat()
    topic_number = (10000 if kind == 'views' else 20000) + number
    return {
        '原始发布时间': published,
        '时间': published[:19],
        '标题': f'{kind}-{number}',
        '内容': f'body-{kind}-{number}',
        '原文链接': f'https://wx.zsxq.com/group/1/topic/{topic_number}',
    }


def test_contract():
    views = [make_row('views', i, i) for i in range(305)]
    all_views = [make_row('all_views', i, -1 if i == 0 else i + 306) for i in range(5)]
    complete = market_view_export(
        {'views': views, 'all_views': all_views},
        '2026-10-13T12:00:00+0800',
    )
    assert complete['totalRows'] == 310
    assert len(complete['items']) == 310
    assert complete['items'][0]['kind'] == 'all_views'
    assert {item['kind'] for item in complete['items']} == {'views', 'all_views'}
    assert all(item['record']['内容'] for item in complete['items'])
    assert all(item['topicId'] for item in complete['items'])
    print('synthetic contract: PASS (310 complete rows, full-row fields preserved)')


def read_json(root, path):
    return json.loads((root / path).read_text(encoding='utf-8-sig'))


def verify_generated(root):
    root = Path(root).resolve()
    archive = read_json(root, 'data/research/archive/manifest.json')
    updates = read_json(root, 'data/research/updates/manifest.json')
    complete = read_json(root, 'data/research/market-views-all.json')

    assert archive.get('coverageTo') == updates.get('coverageTo'), (
        f"archive coverage {archive.get('coverageTo')} != updates coverage {updates.get('coverageTo')}"
    )
    coverage = archive.get('coverageTo')
    assert complete.get('coverageTo') == coverage
    full_items = complete.get('items')
    assert isinstance(full_items, list)
    expected_total = sum(archive['databases'][kind]['rows'] for kind in ('views', 'all_views'))
    assert complete.get('totalRows') == expected_total == len(full_items)

    previous = None
    for index, item in enumerate(full_items):
        assert item.get('kind') in ('views', 'all_views'), f'invalid kind at item {index}'
        row = item.get('record')
        assert isinstance(row, dict), f'missing full source row at item {index}'
        published = str(row.get('原始发布时间') or row.get('时间') or row.get('日期') or '')
        assert item.get('publishedAt') == published, f'publishedAt mismatch at item {index}'
        assert item.get('topicId'), f'missing topicId at item {index}'
        topic = re.search(r'/topic/(\d+)', str(row.get('原文链接') or ''))
        if topic:
            assert item['topicId'] == topic.group(1), f'topicId mismatch at item {index}'
        moment = _publication_utc(item['publishedAt'])
        if previous is not None:
            assert previous >= moment, f'full export is not newest-first at item {index}'
        previous = moment

    print(
        'generated complete export: PASS '
        f'(coverageTo={coverage}, full={len(full_items)}, archive={expected_total})'
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-generated', action='store_true')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    test_contract()
    if args.verify_generated:
        verify_generated(args.root)


if __name__ == '__main__':
    main()
