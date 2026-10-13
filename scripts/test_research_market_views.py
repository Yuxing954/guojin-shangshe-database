#!/usr/bin/env python3
"""Contract tests for the mini-program recent/full market-view exports."""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_research_shards import market_view_exports


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


def main():
    views = [make_row('views', i, i) for i in range(305)]
    all_views = [make_row('all_views', i, -1 if i == 0 else i + 306) for i in range(5)]
    recent, complete = market_view_exports(
        {'views': views, 'all_views': all_views},
        '2026-10-13T12:00:00+0800',
        limit=300,
    )
    assert complete['totalRows'] == 310
    assert len(complete['items']) == 310
    assert recent['totalRows'] == complete['totalRows']
    assert len(recent['items']) == 300
    assert recent['items'] == complete['items'][:300]
    assert complete['items'][0]['kind'] == 'all_views'
    assert {item['kind'] for item in recent['items']} == {'views', 'all_views'}
    assert all(item['record']['内容'] for item in complete['items'])
    assert all(item['topicId'] for item in complete['items'])
    print('market-view exports: PASS (300 recent, 310 complete, full-row fields preserved)')


if __name__ == '__main__':
    main()
