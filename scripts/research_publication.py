"""Keep earnings-call materials out of the public research catalog."""
import json
import re
from collections import Counter

CALL_TITLE = re.compile(r'业绩[^。！？\n]{0,12}(?:电话会|电话会议)|(?:财报|季度业绩)[^。！？\n]{0,6}电话会|\bearnings\s+(?:conference\s+)?calls?\b', re.I)


def call_material(row):
    return any(CALL_TITLE.search(str(row.get(key) or ''))
               for key in ('标题', '文件名', '类型', 'name', 'title'))


def clean_library(root):
    path = root / 'data/research/library.json'
    if not path.exists():
        return
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    records = data['records']
    kept = [row for row in records if not call_material(row)]
    if len(kept) == len(records):
        return
    data['records'] = kept
    data['counts'] = dict(Counter(row['format'] for row in kept))
    # Scan receipts describe the original observation window.
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
