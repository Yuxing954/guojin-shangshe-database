"""Keep generated JSON unchanged when only build timestamps differ."""
import json
import os
import tempfile
from pathlib import Path


def write_json_if_changed(path, payload, volatile=(), indent=None):
    path = Path(path)
    try:
        previous = json.loads(path.read_text(encoding='utf-8-sig'))
    except (FileNotFoundError, ValueError):
        previous = None
    meaningful = lambda value: {k: v for k, v in value.items() if k not in volatile}
    if isinstance(previous, dict) and meaningful(previous) == meaningful(payload):
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=indent,
                      separators=None if indent else (',', ':')) + '\n'
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='\n',
                                     dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(text)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return True
