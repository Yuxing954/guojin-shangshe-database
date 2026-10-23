"""Validate the vendored snapshot without fetching or changing market data."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1]
vendor = root / "etf-radar"
files = [p for p in vendor.rglob("*") if p.is_file()]
assert len(files) == 4976, len(files)
for path in vendor.rglob("*.json"):
    json.loads(path.read_text(encoding="utf-8"))
class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ("href", "src"):
            if attrs.get(key):
                self.links.append(attrs[key])
for page in (vendor / "docs").glob("*.html"):
    parser = Links()
    parser.feed(page.read_text(encoding="utf-8"))
    for link in parser.links:
        url = urlsplit(link)
        if url.scheme or url.netloc or not url.path:
            continue
        target = page.parent / unquote(url.path)
        assert target.is_file() or target.is_dir(), (page, link)
stocks = json.loads((vendor / "docs/data/stock/stocks.json").read_text(encoding="utf-8"))
stock = next(s for s in stocks if s["code"] == "601939")
assert "银行" in stock.get("industries", [stock["industry"]])
assert (vendor / "docs/data/stock/holders/stock/601939.json").is_file()
print(f"Verified {len(files)} original files, JSON, HTML dependencies and 601939 detail data.")
