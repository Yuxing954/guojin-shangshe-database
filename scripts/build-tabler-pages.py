"""Build the shared native Tabler entry pages. Business data is never rewritten."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
MODELS = [
 'zsxq-content.js','research-model.js','research-library-model.js','daily-announcements.js',
 'domestic-hotels-model.js','overseas-hotels-model.js','company-database-model.js','company-overview-model.js',
 'quotes/quotes-model.js','quotes/quotes-poller.js','market-kline.js',
 'calendar/earnings-calendar-model.js','calendar/important-calendar-model.js',
 'hotel-metrics.js','hotel-groups-model.js','travel-model.js','cruise-analysis-model.js','dining-model.js','dutyfree-korea-model.js',
]

SHELL = '''<!DOCTYPE html>
<html lang="zh-CN" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#066fd1">
  <meta name="description" content="国金商社零售与社会服务研究数据库。行业经营、宏观数据、重点公司、观点纪要与每日研究。">
  <title>国金商社数据库</title>
  <link rel="icon" type="image/svg+xml" href="scripts/assets/brand/sinolink-mark.svg">
  <link rel="stylesheet" href="scripts/vendor/tabler/tabler.min.css?v=1.7.5">
  <link rel="stylesheet" href="scripts/tabler-app/app.css?v=20261125">
  <script>try{document.documentElement.dataset.bsTheme=localStorage.getItem('guojin-tabler-theme')==='dark'?'dark':'light';}catch(e){}</script>
  <script defer src="scripts/vendor/tabler/tabler.min.js?v=1.7.5"></script>
  __MODELS__
  <script type="module" src="scripts/tabler-app/app.js?v=20261125"></script>
</head>
<body>
  <div class="page"><div class="page-wrapper"><main class="page-body"><div class="container-xl"><div class="card"><div class="card-body text-center py-5"><div class="spinner-border text-primary mb-3" role="status"></div><h1 class="h3">国金商社数据库</h1><p class="text-secondary">正在读取数据…</p></div></div></div></main></div></div>
  <noscript>请启用 JavaScript 查看数据。<a href="data-manifest.json">下载数据目录</a></noscript>
</body>
</html>
'''

def build():
    scripts='\n  '.join('<script defer src="scripts/'+name+'"></script>' for name in MODELS)
    shell=SHELL.replace('__MODELS__',scripts)
    pages=re.findall(r"'([^']+\.html)':\[",(ROOT/'scripts/tabler-app/app.js').read_text())
    for page in pages:
        (ROOT/page).write_text(shell)
    # Keep existing legacy links, including query strings and anchors.
    redirects={'overseas.html':'industry.html#hotel','overseas-hotel-comparison.html':'overseas-hotels.html?peers=marriott,hyatt,ihg,hilton','domestic-hotel-comparison.html':'company-database.html?peers=jinjiang,btg,hworld,atour'}
    for page,target in redirects.items():
        (ROOT/page).write_text('<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>国金商社数据库</title><script>const u=new URL('+repr(target)+',location.href);for(const [k,v] of new URLSearchParams(location.search))u.searchParams.set(k,v);if(location.hash&&!u.hash)u.hash=location.hash;location.replace(u.href);</script><a href="'+target+'">打开数据库</a></html>')
    # The legacy index routes are still maintained by the original pure router.
    index=shell.replace('<script type="module"','<script defer src="scripts/site-ui.js"></script><script defer src="scripts/index-redirect.js"></script>\n  <script type="module"')
    (ROOT/'index.html').write_text(index)
    print(f'Built {len(set(pages))} Tabler entry pages and {len(redirects)} compatibility redirects')

if __name__=='__main__':build()
