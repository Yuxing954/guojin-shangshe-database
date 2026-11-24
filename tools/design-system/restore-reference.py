"""Restore the four reference pages; fail on upstream revisions rather than silently changing the design baseline."""
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import quote

manifest = json.loads(Path(__file__).with_name('official-assets.json').read_text('utf8'))
destination = Path(sys.argv[1]) if len(sys.argv)>1 else Path('.cache/tabler-official')

def restore(entry):
    path = destination / entry['path']
    if path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256']:
        return
    with urlopen('https://preview.tabler.io/' + ('' if entry['path']=='index.html' else quote(entry['path'])),timeout=60) as response:
        content = response.read()
    if hashlib.sha256(content).hexdigest() != entry['sha256']:
        raise ValueError('Reference revision differs: ' + entry['path'])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)

with ThreadPoolExecutor(max_workers=8) as workers:
    list(workers.map(restore, manifest))
print('Verified',len(manifest),'official files at',destination.resolve())
