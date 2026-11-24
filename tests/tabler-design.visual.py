"""Compare the fixed-data sparkline screenshot; never regenerate the reference in CI."""
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from functools import partial
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
reference = root / "tests/visual/tabler-spark.png"
with TemporaryDirectory() as tmp, sync_playwright() as runtime:
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = runtime.chromium.launch(executable_path=os.getenv("TABLER_BROWSER_EXECUTABLE") or None)
    page = browser.new_page(viewport={"width": 400, "height": 500}, device_scale_factor=1)
    url = f"http://127.0.0.1:{server.server_port}"
    page.route("**/fixture", lambda route: route.fulfill(content_type="text/html",body='<meta charset="utf-8"><link rel="stylesheet" href="/scripts/vendor/tabler/tabler.min.css"><link rel="stylesheet" href="/scripts/tabler-app/app.css"><main style="width:320px"></main>'))
    page.goto(url + "/fixture")
    page.evaluate("""async () => {
      const {metricCard} = await import('/scripts/tabler-app/common.js');
      document.querySelector('main').innerHTML=metricCard({label:'RevPAR',unit:'元',value:'0',period:'26W47',change:0,changeLabel:'同比',points:[3,6,2,null,0,4,5].map(value=>({value}))});
    }""")
    actual = Path(tmp) / 'actual.png'
    page.locator('.desk-spark').screenshot(path=str(actual))
    image = Image.open(actual).convert('RGB')
    expected = Image.open(reference).convert('RGB')
    assert image.size == expected.size
    diff = ImageChops.difference(image,expected)
    error = max(ImageStat.Stat(diff).mean)
    if error >= 0.8:
        evidence = root / 'test-results'
        evidence.mkdir(exist_ok=True)
        image.save(evidence / 'tabler-spark-actual.png')
        diff.save(evidence / 'tabler-spark-difference.png')
        raise AssertionError(f"Unexpected sparkline appearance: {error:.3f}")
    browser.close()
    server.shutdown()
