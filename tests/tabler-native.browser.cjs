// Native Tabler behavior acceptance. Network quotes deliberately fail: no test price is shown as live.
// Run in CI with NODE_PATH pointing to Playwright. The server is self-contained and uses a random port.
// TABLER_NATIVE_SUITE=core|research|market|layout (default: all); SITE_SCREENSHOT_DIR is optional.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, '');
const data = name => JSON.parse(read(name));
const load = name => import('data:text/javascript;base64,' + Buffer.from(read('scripts/tabler-app/' + name + '.js')).toString('base64'));
const M = require('../scripts/research-model.js');
const L = require('../scripts/research-library-model.js');
const Z = require('../scripts/zsxq-content.js');
const Q = require('../scripts/quotes/quotes-model.js');
const E = require('../scripts/calendar/earnings-calendar-model.js');
const I = require('../scripts/calendar/important-calendar-model.js');
const suite = process.env.TABLER_NATIVE_SUITE || 'all';
assert(['all', 'core', 'research', 'market', 'layout'].includes(suite), 'Unknown TABLER_NATIVE_SUITE');
const screenshotDir = process.env.SITE_SCREENSHOT_DIR;
if (screenshotDir) fs.mkdirSync(screenshotDir, {recursive: true});
const server = http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/workspace.html' : pathname));
    if (!file.startsWith(root + path.sep)) {res.writeHead(403).end(); return;}
    const types = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2'};
    fs.readFile(file, (error, body) => {res.writeHead(error ? 404 : 200, {'Content-Type': types[path.extname(file)] || 'text/plain;charset=utf-8', 'Cache-Control': 'no-store'}); res.end(error ? 'missing' : body);});
  } catch {res.writeHead(400).end();}
});

(async () => {
  const A = await load('common'), R = await load('research');
  globalThis.ZsxqContent = Z;
  globalThis.DailyAnnouncements = require('../scripts/daily-announcements.js');
  const D = await load('daily');
  const directory = data('data/coverage-companies.json'), companies = Q.directory(directory);
  const calendarPool = directory.companies.map(r => ({...r, code: E.code(r.code), market: /\.(SH|SZ|BJ)$/.test(r.code) ? 'A股' : /\.HK$/.test(r.code) ? '港股' : '美股'}));
  const snapshot = E.validateSnapshot(data('data/earnings-calendar.json'));
  const calendarRows = E.rows(calendarPool, snapshot, ''), calendarEvents = E.eventsFor(calendarRows);
  const monthCounts = new Map();
  for (const row of calendarEvents) monthCounts.set(row.date.slice(0, 7), (monthCounts.get(row.date.slice(0, 7)) || 0) + 1);
  const calendarMonth = [...monthCounts].sort((a, b) => b[1] - a[1])[0][0];
  const dates = data('data/daily/index.json').dates.slice().sort().reverse(), latestDate = dates[0];
  const work = data('data/research/work-minutes.json'), library = data('data/research/library.json');
  const minute = work.records.find(r => L.hasPublishedText(r) && L.storageLink(r));
  assert(minute, 'A real verified full minute is required for acceptance');
  const minutePayload = data(minute.processing.contentPath);
  const minuteEntries = [...new Map([...library.records, ...work.records].map(r => [r.id, r])).values()].flatMap(L.entries).filter(r => L.matches(r.library, {scope: 'archived'}));
  const recent = data('data/research/recent-preview.json');
  const recentEntries = R.uniqueResearchRecords(recent.dbs.flatMap(db => db.rows.flatMap(row => db.id === 'views' ? [R.normalizeResearchRecord(row, 'views', M), R.normalizeResearchRecord(row, 'all_views', M, 'views')] : [R.normalizeResearchRecord(row, db.id, M)])));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  const checks = [], pageErrors = [], externalRequests = [];
  try {
    browser = await chromium.launch({headless: true, ...(process.env.TABLER_BROWSER_EXECUTABLE ? {executablePath: process.env.TABLER_BROWSER_EXECUTABLE} : {})});
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
    context.setDefaultTimeout(25000);
    await context.route('https://**/*', async route => {externalRequests.push(route.request().url()); await route.abort();});
    // Capture the explicit copy action without depending on desktop clipboard permissions in CI.
    await context.addInitScript(() => {Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => {window.__nativeCopied = text;}}});});
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push({url: page.url(), message: error.message}));
    const waitText = (selector, text) => page.waitForFunction(({selector, text}) => document.querySelector(selector)?.textContent.includes(text), {selector, text});
    const waitCount = number => page.waitForFunction(number => Number(document.querySelector('#research-count')?.textContent.replace(/[^\d]/g, '')) === number, number);
    const go = async (route, selector) => {await page.goto(base + '/' + route, {waitUntil: 'domcontentloaded'}); await page.locator(selector).first().waitFor({state: 'visible'});};
    const closeDialog = async () => {await page.locator('dialog[open] .btn-close').click(); await page.locator('dialog[open]').waitFor({state: 'detached'});};
    const downloadText = async selector => {const pending = page.waitForEvent('download'); await page.locator(selector).click(); const item = await pending; const file = await item.path(); return {name: item.suggestedFilename(), text: fs.readFileSync(file, 'utf8')};};
    const shot = async name => {if (screenshotDir) await page.screenshot({path: path.join(screenshotDir, suite + '-' + name + '.png'), fullPage: false});};
    const safeDialogLinks = async () => {
      const hrefs = await page.locator('dialog[open] a[href]').evaluateAll(nodes => nodes.map(node => node.href));
      for (const href of hrefs) {const u = new URL(href); assert(['http:', 'https:'].includes(u.protocol)); assert(!u.username && !u.password);}
      return hrefs;
    };

    async function core() {
      const travel = data('data/tourism/dashboard.json');
      await go('workspace.html', '#home-metric');
      assert((await page.locator('#home-chart circle').count()) > 0, 'home chart is based on actual points');
      await page.locator('#home-metric').selectOption('travel');
      await page.locator('#home-range').selectOption('all');
      const quarters = travel.domestic.quarters.filter(row => row.scope === 'quarter').sort((a, b) => a.period.localeCompare(b.period));
      await page.waitForFunction(count => document.querySelectorAll('#home-chart circle').length === count, quarters.filter(r => Number.isFinite(r.trips)).length);
      const labels = await page.locator('#home-chart circle').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
      for (const row of quarters.filter(r => Number.isFinite(r.trips))) assert(labels.some(label => label.includes(row.period) && label.includes(A.num(row.trips, 2))), row.period + ' plotted value is original');
      await page.locator('#home-chart-source').click();
      const sourceIds = new Set(quarters.flatMap(r => [...(r.tripsSourceIds || []), ...(r.comparisonTripsSourceIds || [])]));
      const source = travel.sources.find(r => sourceIds.has(r.id) && r.url);
      assert(source, 'travel chart has an explicit source');
      assert((await safeDialogLinks()).includes(new URL(source.url, base).href));
      await closeDialog();

      await go('industry.html#hotel', '#industry-metric');
      await page.locator('#industry-metric').selectOption('hotel_occ');
      await waitText('[data-industry-body]', 'OCC');
      const hotelExport = A.parseCSV((await downloadText('[data-industry-export]')).text);
      const occupancy = data('data/industry/overview.json').sectors.find(s => s.id === 'hotel').metrics.find(m => m.id === 'hotel_occ');
      assert(hotelExport.length > 0);
      for (const row of hotelExport) {
        const sourceRow = occupancy.points.find(p => p.periodLabel === row['数据期间']);
        assert(sourceRow, 'exported period exists in original hotel observations');
        assert.equal(Number(row['数值']), sourceRow.value);
        assert.equal(row['单位'], '%');
        assert.equal(row['同比单位'], '百分点');
      }

      await go('dutyfree-dashboard.html?view=holidays', '#industry-holiday');
      await page.locator('#industry-year').selectOption('2026');
      await page.locator('#industry-holiday').selectOption('春节');
      await waitText('[data-industry-body]', '离岛免税假期数据');
      const holidaySource = data('data/dutyfree/holidays.json').records.filter(r => r.year === 2026 && r.holiday === '春节').sort((a, b) => b.period.localeCompare(a.period));
      const holidayCSV = A.parseCSV((await downloadText('[data-industry-export]')).text);
      assert.equal(holidayCSV.length, holidaySource.length);
      for (const sourceRow of holidaySource) {
        const row = holidayCSV.find(r => r.id === sourceRow.id);
        assert(row, 'full holiday and partial-stage records are kept distinct');
        assert.equal(Number(row.sales), sourceRow.sales);
        assert.equal(Number(row.daily_sales), sourceRow.daily_sales);
        assert.equal(row.source_cells, JSON.stringify(sourceRow.source_cells));
        if (sourceRow.web_source) assert.equal(row.web_source, JSON.stringify(sourceRow.web_source));
      }

      await go('dashboard.html?file=data%2Ftourism%2Fdashboard.json&table=domestic.quarters', '#data-tables');
      assert.equal(await page.locator('#data-tables').inputValue(), 'domestic.quarters');
      await page.locator('#data-query').fill('2026');
      const expected = travel.domestic.quarters.filter(row => Object.values(row).some(value => (value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)).includes('2026')));
      await page.waitForFunction(count => document.querySelector('#data-grid .card-footer')?.textContent.includes('共 ' + count.toLocaleString() + ' 条'), expected.length);
      const exported = A.parseCSV((await downloadText('#data-export')).text);
      assert.equal(exported.length, expected.length);
      for (const sourceRow of expected) {
        const row = exported.find(r => r.period === sourceRow.period);
        assert(row); assert.equal(Number(row.trips), sourceRow.trips);
        assert.equal(row.tripsSourceIds, JSON.stringify(sourceRow.tripsSourceIds));
        assert.equal(row.comparisonTripsSourceIds, JSON.stringify(sourceRow.comparisonTripsSourceIds));
      }
      await page.locator('#data-query').fill('NO_RESULT_NATIVE_8271');
      await waitText('#data-grid', '暂无匹配记录');
      assert.equal(A.parseCSV((await downloadText('#data-export')).text).length, 0, 'empty search exports no unrelated rows');
      await page.locator('#data-query').fill('');
      await page.locator('#data-tables').selectOption('domestic.holidays');
      await waitText('#data-grid', '第 1/');
      assert.equal(await page.locator('#data-grid tbody tr').count(), 25);
      const firstPage = await page.locator('#data-grid tbody tr').first().innerText();
      await page.locator('#data-grid [data-next]').click();
      assert.notEqual(await page.locator('#data-grid tbody tr').first().innerText(), firstPage, 'pagination changes the visible records');
      await page.locator('#data-grid [data-record]').first().click();
      const detail = await page.locator('dialog[open]').innerText();
      const originalRow = travel.domestic.holidays[25];
      assert(detail.includes(String(originalRow.period)));
      if (originalRow.sourceId) assert(detail.includes(originalRow.sourceId));
      if (originalRow.locator) assert(detail.includes(originalRow.locator));
      await closeDialog();
      await shot('data-explorer');
      checks.push('core: source-backed home chart, industry units, holiday exact export, complete JSON fields, filters and pagination');
    }

    async function research() {
      const briefs = data('data/research/market-briefs.json').briefs.filter(r => L.briefMatches(r, {})).sort((a, b) => b.date.localeCompare(a.date));
      await go('research.html', '#research-count');
      await waitCount(briefs.length);
      assert.equal(await page.locator('[data-kind][aria-selected=true]').getAttribute('data-kind'), 'digest');
      if (briefs.length) {
        await page.locator('#research-results [data-record]').first().click();
        const detail = await page.locator('dialog[open]').textContent();
        assert(detail.includes(briefs[0].conclusion));
        for (const evidence of briefs[0].evidence || []) assert(detail.includes(evidence.text));
        await safeDialogLinks(); await closeDialog();
      }
      await page.locator('[data-kind=views]').click();
      const views = recentEntries.filter(r => r.kind === 'views');
      await waitCount(views.length);
      const sector = M.sectors.map(s => s[0]).find(id => id !== 'other' && views.some(r => M.sectorIds(r).includes(id)));
      assert(sector, 'recent real views contain an original sector');
      await page.locator('#research-sector').selectOption(sector);
      const selected = views.filter(r => M.matches(r, {kind: 'views', sector}));
      await waitCount(selected.length);
      const exportRows = A.parseCSV((await downloadText('[data-action=export]')).text);
      assert.equal(exportRows.length, selected.length);
      for (const row of exportRows) assert(selected.some(r => r.title === row['标题']), 'sector export must not include other records');
      await page.locator('#research-query').fill('NO_RESULT_NATIVE_8271');
      await waitText('#research-results', '未找到匹配的研究资料');
      assert(await page.locator('[data-action=export]').isDisabled());
      await page.locator('[data-action=reset]').first().click();
      await waitCount(views.length);
      if (views.length > 20) {
        const first = await page.locator('#research-results [data-record]').first().innerText();
        await page.locator('[data-action=next]').click();
        assert.notEqual(await page.locator('#research-results [data-record]').first().innerText(), first);
        assert.match(await page.locator('#research-page').innerText(), /第 21/);
      }
      for (const kind of ['views', 'all_views']) {
        const record = recentEntries.find(r => r.kind === kind && !r.truncated && r.content && M.topic(r));
        assert(record, kind + ' fixture includes an untruncated real source');
        await go('research.html?kind=' + kind + '&topic=' + M.topic(record), 'dialog[open] [data-record-body]');
        await waitText('[data-reading-state]', '完整原文');
        assert.equal(await page.locator('[data-record-body]').textContent(), M.plainContent(record.content));
        assert((await safeDialogLinks()).includes(record.url));
        await closeDialog();
      }
      await go('research.html?kind=minutes&asset=' + encodeURIComponent(minute.id), 'dialog[open] [data-record-body]');
      await waitText('[data-reading-state]', '完整提取文字');
      const fullText = M.plainContent(minutePayload.body);
      assert.equal(await page.locator('[data-record-body]').textContent(), fullText, 'the complete verified body is displayed, not a 500-character preview');
      assert((await safeDialogLinks()).includes(L.storageLink(minute)));
      await page.locator('[data-copy-record]').click();
      assert.equal(await page.evaluate(() => window.__nativeCopied), minute.name + '\n\n' + fullText);
      const minuteDownload = await downloadText('[data-download-record]');
      assert.equal(minuteDownload.text, minute.name + '\n\n' + fullText);
      await shot('full-minute'); await closeDialog();
      await waitCount(minuteEntries.length);

      // A recent-view outage must preserve independently loaded minutes, and retry must not double-bind clicks.
      const previewRoute = '**/data/research/recent-preview.json';
      await page.route(previewRoute, route => route.abort());
      await go('research.html?kind=minutes', '#research-count');
      await waitCount(minuteEntries.length);
      await waitText('#research-status', '近期观点读取失败');
      await page.unroute(previewRoute);
      await page.locator('[data-action=reload]').click();
      await waitCount(minuteEntries.length);
      await page.waitForFunction(() => !document.querySelector('#research-status').textContent.trim());
      await page.locator('#research-query').fill(minute.name);
      await page.locator('#research-results [data-record]').first().click();
      await waitText('[data-reading-state]', '完整提取文字');
      assert.equal(await page.locator('dialog[open]').count(), 1);
      await closeDialog();

      const report = data('data/daily/onepage/' + latestDate + '.json'), raw = data('data/daily/' + latestDate + '.json'), resources = data('data/daily/resources/' + latestDate + '.json');
      await go('daily.html?date=2999-01-01', '#daily-date');
      await waitText('#daily-status', '所选日期未发布');
      assert.equal(await page.locator('#daily-date').inputValue(), latestDate);
      assert.deepEqual(await page.locator('#daily-date option').evaluateAll(nodes => nodes.map(n => n.value)), dates);
      assert((await page.locator('#daily-report').textContent()).includes(report.headline));
      const section = ['briefs', 'views', 'data', 'news'].find(key => raw.sections[key]?.some(r => r.body || r.summary));
      assert(section, 'published daily contains an original section');
      await page.locator('[data-raw-section=' + section + ']').click();
      const rawIndex = raw.sections[section].findIndex(r => r.body || r.summary);
      await page.locator('#daily-raw details summary').nth(rawIndex).click();
      assert.equal(await page.locator('#daily-raw details [style*="white-space"]').nth(rawIndex).textContent(), Z.plain(raw.sections[section][rawIndex].body || raw.sections[section][rawIndex].summary));
      const dailyDownload = await downloadText('[data-daily-action=download]');
      assert.equal(dailyDownload.text, D.dailyPlainText(report, resources, raw, true));
      await page.locator('[data-daily-action=copy]').click();
      assert.equal(await page.evaluate(() => window.__nativeCopied), D.dailyPlainText(report, resources, raw));
      const prior = dates.find(d => d !== latestDate && fs.existsSync(path.join(root, 'data/daily/onepage/' + d + '.json')));
      assert(prior, 'date switching has an actual published prior report');
      await page.locator('#daily-date').selectOption(prior);
      await waitText('#daily-report', data('data/daily/onepage/' + prior + '.json').headline);
      assert(new URL(page.url()).searchParams.get('date') === prior);
      const rawRoute = '**/data/daily/' + latestDate + '.json';
      await page.route(rawRoute, route => route.abort());
      await go('daily.html?date=' + latestDate, '#daily-date');
      await waitText('#daily-raw', '原始内容读取失败');
      await page.waitForFunction(() => !document.querySelector('#daily-resources .spinner-border'));
      await page.locator('[data-daily-action=download]').click();
      await waitText('#daily-status', '请先重试后下载完整内容');
      await page.unroute(rawRoute);
      await page.locator('#daily-raw [data-daily-action=raw-retry]').click();
      await page.locator('#daily-raw [data-raw-section]').first().waitFor();
      assert.equal((await downloadText('[data-daily-action=download]')).text, D.dailyPlainText(report, resources, raw, true));
      await shot('daily-report');
      checks.push('research: four original kinds, sector/empty filters, pagination, verified complete text, copy/download, partial outage and retry; daily: published-only dates, original columns, complete text and retry');
    }

    async function market() {
      await go('quotes.html', '#quote-rows tr');
      await waitText('#quote-status', '读取异常');
      await waitText('#quote-chart', '来源走势暂不可用');
      await page.locator('[data-quote-action=pause]').click();
      assert.match(await page.locator('#quote-count').innerText(), new RegExp('^' + companies.length + ' 家 · 0 家有数据$'));
      for (const text of await page.locator('#quote-rows tr td:nth-child(2)').allTextContents()) assert(text.startsWith('—'), 'failed source must not invent a zero or use historical prices');
      const requestsBefore = externalRequests.filter(url => url.includes('qt.gtimg.cn')).length;
      await page.locator('[data-quote-action=refresh]').click();
      await page.waitForFunction(() => !document.querySelector('[data-quote-action=refresh]').disabled);
      assert(externalRequests.filter(url => url.includes('qt.gtimg.cn')).length > requestsBefore, 'refresh performs a new source request');
      await page.locator('#quote-market').selectOption('CN');
      const aShares = Q.filter(companies, {}, {market: 'CN'});
      assert.match(await page.locator('#quote-count').innerText(), new RegExp('^' + aShares.length + ' 家'));
      await page.locator('#quote-query').fill('NO_RESULT_NATIVE_8271');
      await waitText('#quote-rows', '暂无匹配公司');
      await page.locator('#quote-query').fill(''); await page.locator('#quote-market').selectOption('');
      const weeklyRows = A.parseCSV(read('data/商社-覆盖标的本周行情.csv'));
      const historical = companies.map(c => ({company: c, row: weeklyRows.find(r => r['证券代码'] === c.code && A.numeric(r['最新收盘价']) !== null)})).find(r => r.row);
      assert(historical, 'coverage directory joins a real historical row');
      await page.locator('[data-mode=weekly]').click();
      await page.locator('#quote-query').fill(historical.company.code);
      await page.locator('#quote-rows [data-symbol]').first().click();
      assert.equal(await page.locator('#quote-overview .h1').innerText(), A.num(A.numeric(historical.row['最新收盘价']), Q.markets[Q.market(historical.company.code)].currency === 'HKD' ? 3 : 2));
      assert((await page.locator('#quote-overview').innerText()).includes(historical.row['数据日期'].slice(0, 10)));
      assert((await page.locator('#quote-overview').innerText()).includes('历史周行情'));
      assert((await page.locator('#quote-overview').innerText()).includes('上周收盘'));
      await waitText('#quote-chart', '该快照不包含历史走势');
      assert(await page.locator('[data-quote-action=chart-export]').isDisabled());
      const quoteCSV = A.parseCSV((await downloadText('[data-quote-action=export]')).text);
      assert.equal(quoteCSV.length, 1); assert.equal(quoteCSV[0]['证券代码'], historical.company.code); assert.equal(quoteCSV[0]['数据日期'], historical.row['数据日期']);
      assert.equal(quoteCSV[0]['最新收盘价'], historical.row['最新收盘价']);
      await page.locator('[data-quote-action=source]').click();
      assert((await safeDialogLinks()).includes(new URL('data/商社-覆盖标的本周行情.csv', base + '/').href));
      await closeDialog();
      await page.locator('[data-mode=quotes]').click();
      assert.equal(await page.locator('#quote-overview .h1').innerText(), '—', 'changing to source quotes must not reuse a historical close');

      await go('earnings.html?month=' + calendarMonth, '#calendar-query');
      const monthEvents = calendarEvents.filter(r => r.date.startsWith(calendarMonth));
      await waitText('#calendar-content .card-header', monthEvents.length + ' 项');
      const chosen = monthEvents[0];
      await page.locator('#calendar-query').fill(chosen.code);
      const filtered = monthEvents.filter(r => r.code === chosen.code);
      await waitText('#calendar-content .card-header', filtered.length + ' 项');
      await page.locator('#calendar-sector').selectOption(chosen.sector);
      await page.locator('#calendar-market').selectOption(chosen.market);
      const calendarCSV = A.parseCSV((await downloadText('[data-calendar-action=csv]')).text);
      assert.equal(calendarCSV.length, filtered.length);
      for (const row of calendarCSV) {
        const original = filtered.find(r => r.code === row['代码'] && r.period === row['报告期'] && (r.actual || '') === row['实际披露日'] && (r.expected || '') === row['预约披露日']);
        assert(original, 'filtered export preserves separate date semantics');
        assert.equal(row['公告发布日期'], original.announcementDate || '');
        assert.equal(row['来源核验时间'], original.updatedAt || '');
      }
      await page.locator('#calendar-content [data-calendar-record]').first().click();
      const dialogText = await page.locator('dialog[open]').innerText();
      assert(dialogText.includes('预计披露日') && dialogText.includes('实际披露日') && dialogText.includes('公告发布日期'));
      await safeDialogLinks(); await closeDialog();
      await page.locator('#calendar-query').fill('NO_RESULT_NATIVE_8271');
      await waitText('#calendar-content', '当前范围暂无已登记日程');
      assert(await page.locator('[data-calendar-action=csv]').isDisabled());
      await page.locator('#calendar-query').fill(''); await page.locator('#calendar-sector').selectOption(''); await page.locator('#calendar-market').selectOption('');
      await page.locator('[data-calendar-view=month]').click();
      assert.equal(await page.locator('#calendar-content tbody td').count(), 42);
      assert((await page.locator('#calendar-content [data-calendar-record]').count()) > 0);
      const important = I.validate(data('data/important-calendar.json')), importantMonth = important.coverageStart.slice(0, 7);
      await page.locator('#calendar-month').fill(importantMonth); await page.locator('#calendar-month').dispatchEvent('change');
      await page.locator('[data-calendar-tab=important]').click();
      await page.locator('[data-calendar-view=list]').click();
      const importantRows = I.select(important, {month: importantMonth});
      await waitText('#calendar-content .card-header', importantRows.length + ' 项');
      const calendarRecord = page.locator('#calendar-content [data-calendar-record]').first(), id = await calendarRecord.getAttribute('data-calendar-record');
      const importantFirst = importantRows.find(r => r.id === id);
      await calendarRecord.click();
      assert((await safeDialogLinks()).includes(importantFirst.sourceUrl));
      const importantText = await page.locator('dialog[open]').innerText();
      assert(importantText.includes(importantFirst.beijingDate) && importantText.includes(importantFirst.beijingTime) && importantText.includes(importantFirst.timezone));
      await closeDialog();
      const importantCSV = A.parseCSV((await downloadText('[data-calendar-action=csv]')).text);
      assert.equal(importantCSV.length, importantRows.length);
      for (const row of importantCSV) assert(importantRows.some(r => row['来源'] === r.sourceUrl && row['北京时间'] === r.beijingDate + ' ' + r.beijingTime));
      assert((await downloadText('[data-calendar-action=ics]')).text.includes('BEGIN:VEVENT'));
      await shot('calendar');
      checks.push('market: failed-source missing values, retry, market/empty filters, exact historical prices and exports; calendar: original month/company filters, disclosure dates, official time zones, sources, CSV and ICS');
    }

    async function layout() {
      const routes = [
        ['workspace', 'workspace.html', '#home-metric'],
        ['industry', 'industry.html#hotel', '#industry-metric'],
        ['macro', 'macro.html?view=indicators', '#app-content .card'],
        ['company', 'company-database.html', '#app-content .card'],
        ['research', 'research.html?kind=minutes', '#research-count'],
        ['daily', 'daily.html', '#daily-report .card'],
        ['quotes', 'quotes.html', '#quote-rows tr'],
        ['calendar', 'earnings.html?view=month&month=' + calendarMonth, '#calendar-content table'],
        ['data', 'dashboard.html?file=data%2Ftourism%2Fdashboard.json&table=domestic.quarters', '#data-grid table']
      ];
      for (const [name, route, selector] of routes) {
        await go(route, selector);
        await page.waitForFunction(() => !document.querySelector('#app-content .spinner-border'));
        assert.doesNotMatch(await page.locator('#app-content').innerText(), /数据暂时无法读取|研究文库读取失败|日报目录读取失败/, name + ' renders business content');
        assert.equal(await page.locator('#page-title').count(), 1);
        assert.equal(await page.locator('#main-content').count(), 1);
        const styles = await page.locator('link[rel=stylesheet]').evaluateAll(nodes => nodes.map(n => new URL(n.href).pathname));
        assert.deepEqual(styles, ['/scripts/vendor/tabler/tabler.min.css', '/scripts/tabler-app/app.css']);
        for (const width of [1440, 1024, 768, 390]) {
          await page.setViewportSize({width, height: 1000});
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const dimensions = await page.evaluate(() => ({width: innerWidth, scroll: document.documentElement.scrollWidth, bodyOverflowX: getComputedStyle(document.body).overflowX}));
          assert(dimensions.scroll <= dimensions.width + 1, name + ' page overflows at ' + width + ': ' + JSON.stringify(dimensions));
          assert.notEqual(dimensions.bodyOverflowX, 'hidden', 'whole-page overflow must not be hidden to pass responsive acceptance');
          assert(await page.locator('#page-title').isVisible(), name + ' title remains visible');
          if (width === 390) {
            await page.locator('.navbar-toggler').click();
            assert.equal(await page.locator('.navbar-toggler').getAttribute('aria-expanded'), 'true');
            assert(await page.locator('#navbar-menu a[href="research.html"]').isVisible());
            await page.locator('.navbar-toggler').click();
          }
          await shot(name + '-' + width);
        }
      }
      await go('research.html?kind=minutes&asset=' + encodeURIComponent(minute.id), 'dialog[open] [data-record-body]');
      await waitText('[data-reading-state]', '完整提取文字');
      for (const width of [1440, 1024, 768, 390]) {
        await page.setViewportSize({width, height: 1000});
        const box = await page.locator('dialog[open]').boundingBox();
        assert(box.x >= -1 && box.x + box.width <= width + 1, 'complete document dialog fits at ' + width);
        assert.equal(await page.locator('[data-record-body]').textContent(), M.plainContent(minutePayload.body));
        await shot('full-text-' + width);
      }
      await closeDialog();
      checks.push('layout: 1440/1024/768/390 across nine native entrances and complete-text dialog, bounded tables, one shell, responsive navigation');
    }

    for (const [name, run] of [['core', core], ['research', research], ['market', market], ['layout', layout]]) if (suite === 'all' || suite === name) await run();
    assert.deepEqual(pageErrors, [], 'no uncaught application errors');
    console.log(JSON.stringify({result: 'PASS', suite, checks, widths: suite === 'all' || suite === 'layout' ? [1440, 1024, 768, 390] : undefined, pageErrors}, null, 2));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); server.close(); process.exitCode = 1;});
