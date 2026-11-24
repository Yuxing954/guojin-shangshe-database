const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const L = require('../scripts/research-library-model.js');
const root = path.resolve(__dirname, '..');
const library = JSON.parse(fs.readFileSync(path.join(root, 'data/research/library.json'), 'utf8').replace(/^\uFEFF/, ''));
const work = JSON.parse(fs.readFileSync(path.join(root, 'data/research/work-minutes.json'), 'utf8').replace(/^\uFEFF/, ''));
// The WORK index overrides the same asset ID, and attachments may have multiple occurrences.
const merged = new Map([...library.records, ...work.records].map(r => [r.id, r]));
const archivedRecords = records => records.flatMap(L.entries).map(entry => entry.library).filter(r => L.matches(r, {scope: 'archived'})).sort((a, b) => (b.sortDate || b.published).localeCompare(a.sortDate || a.published));
const archived = archivedRecords([...merged.values()]);
const baseIds = new Set(library.records.map(r => r.id));
const workOnly = archived.find(r => !baseIds.has(r.id) && L.hasPublishedText(r) && L.storageLink(r));
const replacement = work.records.find(r => library.records.some(base => base.id === r.id && L.storageLink(base) && L.storageLink(r) && L.storageLink(base) !== L.storageLink(r)));
assert(archived.length > 0, 'Fixture must contain archived minutes');
assert(workOnly, 'Fixture must include a new WORK minute with text and an original');
assert(replacement, 'Fixture must include a WORK update to an existing original link');
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
    assert(requests.some(url => url.includes('/data/research/work-minutes.json')));
    assert(!requests.some(url => url.includes('/data/research/recent.json')), 'Minutes should not require full market history');
    assert.equal(await page.locator('#recent-more').isVisible(), false);
    assert.equal(await page.locator('.minute-table tbody tr').count(), Math.min(20, archived.length));
    assert.deepEqual(await page.locator('.minute-table .minute-title').allTextContents(), archived.slice(0, 20).map(r => r.name), 'Merged assets retain date order without duplicate IDs');
    assert((await page.locator('.minute-download').count()) > 0);
    await page.locator('[data-kind="views"]').click();
    await page.locator('[data-kind="minutes"]').click();
    assert.equal(await page.locator('#count').innerText(), count, 'Tab switching must not duplicate assets');
    await page.goto(base + '/research.html?kind=minutes');
    await page.waitForFunction(value => document.querySelector('#count').textContent === value, count);
    const first = workOnly;
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
    await page.locator('#search').fill(replacement.name);
    assert.equal(await page.locator('.minute-table tbody tr').count(), 1, 'An updated asset must not appear twice');
    assert.equal(await page.locator('.minute-download').getAttribute('href'), L.storageLink(replacement), 'WORK metadata replaces the older original link');
    await page.locator('#clear').click();
    if (process.env.RESEARCH_SCREENSHOT) await page.screenshot({path: process.env.RESEARCH_SCREENSHOT, fullPage: true});
    await page.goto(base + '/research.html?kind=minutes&asset=' + encodeURIComponent(first.id));
    await page.waitForSelector('#article-dialog[open]');
    assert.equal(await page.locator('#article-title').innerText(), first.name);
    for (const [failedPath, available] of [['library.json', work.records], ['work-minutes.json', library.records]]) {
      const route = '**/data/research/' + failedPath, remaining = archivedRecords(available);
      await page.route(route, request => request.abort());
      await page.goto(base + '/research.html?kind=minutes');
      await page.waitForSelector('#content:not([hidden])');
      assert.match(await page.locator('#status').innerText(), /纪要清单暂时无法读取/);
      assert.equal(await page.locator('#count').innerText(), remaining.length + ' 份资料', failedPath + ' failure preserves the other index');
      assert.deepEqual(await page.locator('.minute-table .minute-title').allTextContents(), remaining.slice(0, 20).map(r => r.name));
      await page.unroute(route);
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({archivedMinutes: archived.length, mergedIndexes: true, replacementPrecedence: true, initialLoad: true, directLink: true, tabSwitch: true, sourcePreview: true, verifiedDownloadLink: true, partialFailurePreservesAssets: true}));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
