const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const L = require('../scripts/research-library-model.js');
const root = path.resolve(__dirname, '..');
const library = JSON.parse(fs.readFileSync(path.join(root, 'data/research/library.json'), 'utf8').replace(/^\uFEFF/, ''));
const archived = library.records.filter(r => L.matches(r, {scope: 'archived'}));
assert(archived.length > 0, 'Fixture must contain archived minutes');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const type = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css'};
    res.setHeader('Content-Type', type[path.extname(file)] || 'text/plain');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless: true, ...(process.env.RESEARCH_BROWSER_EXECUTABLE ? {executablePath: process.env.RESEARCH_BROWSER_EXECUTABLE} : {})});
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(r.url()));
    const base = 'http://127.0.0.1:' + server.address().port;
    const count = archived.length + ' 份资料';
    await page.goto(base + '/research.html');
    await page.waitForSelector('#content:not([hidden])');
    await page.locator('[data-kind="minutes"]').click();
    await page.waitForFunction(value => document.querySelector('#count').textContent === value, count);
    assert(requests.some(url => url.includes('/data/research/library.json')));
    assert(!requests.some(url => url.includes('/data/research/recent.json')), 'Minutes should not require full market history');
    assert.equal(await page.locator('#recent-more').isVisible(), false);
    assert.equal(await page.locator('.minute-table tbody tr').count(), Math.min(20, archived.length));
    assert((await page.locator('.minute-download').count()) > 0);
    await page.locator('[data-kind="views"]').click();
    await page.locator('[data-kind="minutes"]').click();
    assert.equal(await page.locator('#count').innerText(), count, 'Tab switching must not duplicate assets');
    await page.goto(base + '/research.html?kind=minutes');
    await page.waitForFunction(value => document.querySelector('#count').textContent === value, count);
    const first = archived.filter(r => L.hasPublishedText(r)).sort((a, b) => (b.sortDate || b.published).localeCompare(a.sortDate || a.published))[0];
    assert(first, 'Fixture must contain original text');
    await page.locator('#search').fill(first.name);
    assert.equal(await page.locator('.minute-table tbody tr').count(), 1);
    assert.equal(await page.locator('.minute-download').getAttribute('href'), L.storageLink(first));
    await page.locator('.research-read').click();
    const processed = JSON.parse(fs.readFileSync(path.join(root, first.processing.contentPath), 'utf8'));
    const preview = L.preview(processed);
    await page.waitForFunction(value => document.querySelector('#article-body').textContent === value, preview.text + (preview.truncated ? '…' : ''));
    assert.equal(await page.locator('#article-source').getAttribute('href'), L.storageLink(first));
    assert(Array.from(preview.text).length <= 500);
    await page.locator('#close-article').click();
    await page.locator('#clear').click();
    if (process.env.RESEARCH_SCREENSHOT) await page.screenshot({path: process.env.RESEARCH_SCREENSHOT, fullPage: true});
    await page.goto(base + '/research.html?kind=minutes&asset=' + encodeURIComponent(first.id));
    await page.waitForSelector('#article-dialog[open]');
    assert.equal(await page.locator('#article-title').innerText(), first.name);
    await page.route('**/data/research/library.json', route => route.abort());
    await page.goto(base + '/research.html?kind=minutes');
    await page.waitForSelector('#content:not([hidden])');
    assert.match(await page.locator('#status').innerText(), /纪要清单暂时无法读取/);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({archivedMinutes: archived.length, initialLoad: true, directLink: true, tabSwitch: true, sourcePreview: true, verifiedDownloadLink: true, loadFailureVisible: true}));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
