"""Check the small export receipt against the actual generated export bytes."""
import hashlib
import json
import tempfile
from pathlib import Path
from build_research_shards import build

with tempfile.TemporaryDirectory(prefix='market-sync-receipt-') as folder:
    root = Path(folder)
    updates = root / 'data/research/updates'
    updates.mkdir(parents=True)
    header = '时间,原始发布时间,标题,内容,原文链接\n'
    for name in ('商社-市场观点.csv', '全部-市场观点.csv'):
        (root / 'data' / name).write_text(header, encoding='utf-8')
    batch = 'data/research/updates/fixture-views.csv'
    (root / batch).write_text(header + '2026-10-19 09:00,2026-10-19T09:00:01+0800,测试,真实正文,https://wx.zsxq.com/group/1/topic/12345\n', encoding='utf-8')
    (updates / 'manifest.json').write_text(json.dumps({'coverageTo': '2026-10-19T09:00:01+0800', 'files': {'views': [batch], 'all_views': []}}), encoding='utf-8')
    manifest = build(root)
    receipt = manifest['marketViewsExport']
    raw = (root / receipt['path']).read_bytes()
    assert receipt['bytes'] == len(raw)
    assert receipt['sha256'] == hashlib.sha256(raw).hexdigest()
    assert receipt['gitBlobSha1'] == hashlib.sha1(b'blob ' + str(len(raw)).encode('ascii') + b'\0' + raw).hexdigest()
    assert receipt['totalRows'] == 1
    assert receipt['coverageTo'] == manifest['coverageTo']
    assert manifest['indexedUpdateFiles'] == [batch]
    assert not (root / 'data/research/market-views-recent-300.json').exists()
    print('export receipt: PASS (bytes, sha256, Git blob SHA, count, coverage, indexed batches)')
