// Native Tabler regression contracts. These test data semantics, not the removed UI.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, '');
const data = name => JSON.parse(read(name));
const load = name => import('data:text/javascript;base64,' + Buffer.from(read('scripts/tabler-app/' + name + '.js')).toString('base64'));
const Z = require('../scripts/zsxq-content.js');
const M = require('../scripts/research-model.js');
const L = require('../scripts/research-library-model.js');
const E = require('../scripts/calendar/earnings-calendar-model.js');
const I = require('../scripts/calendar/important-calendar-model.js');
globalThis.location = {href: 'https://native.example.test/workspace.html'};
globalThis.ZsxqContent = Z;
globalThis.DailyAnnouncements = require('../scripts/daily-announcements.js');

test('native entrances load official Tabler and preserve the pure business models', () => {
  const pages = ['workspace.html', 'industry.html', 'macro.html', 'company-database.html', 'research.html', 'daily.html', 'quotes.html', 'earnings.html', 'dashboard.html', 'search.html'];
  for (const page of pages) {
    const html = read(page);
    const styles = Array.from(html.matchAll(/<link\b[^>]*href="([^"]+\.css(?:\?[^"]*)?)"/g), m => m[1].split('?')[0]);
    assert.deepEqual(styles, ['scripts/vendor/tabler/tabler.min.css', 'scripts/tabler-app/app.css'], page + ' must have one native stylesheet stack');
    assert.match(html, /type="module"[^>]*src="scripts\/tabler-app\/app\.js|src="scripts\/tabler-app\/app\.js[^>]*type="module"/, page);
    assert.doesNotMatch(html, /src="scripts\/(?:site-shell|site-ui|workspace|research|daily|quotes|dashboard|industry)\.js/, page + ' must not run the retired UI');
  }
  const research = read('research.html'), market = read('quotes.html');
  for (const script of ['research-model.js', 'research-library-model.js', 'zsxq-content.js']) assert(research.includes(script), script + ' remains the classification/content authority');
  for (const script of ['quotes-model.js', 'quotes-poller.js', 'market-kline.js', 'earnings-calendar-model.js', 'important-calendar-model.js']) assert(market.includes(script), script + ' remains available');
});

test('missing values remain missing, zero remains zero, and CSV is lossless and formula safe', async () => {
  const A = await load('common');
  for (const value of [null, undefined, '', '  ', '\t\n', 'not available', NaN, Infinity]) {
    assert.equal(A.numeric(value), null, String(value));
    assert.equal(A.num(value), '—', String(value));
  }
  for (const value of [0, '0', '0.00']) {assert.equal(A.numeric(value), 0); assert.equal(A.num(value), '0');}
  assert.equal(A.numeric('1,234.50'), 1234.5);
  const rows = [
    {name: '甲,乙', value: 0, text: '第一行\n第二行 "引号"'},
    {name: '=HYPERLINK("https://invalid.test")', value: null, laterOnly: '后续行独有字段'},
    {name: '\t+SUM(1,1)', value: '-12.5', laterOnly: {source: '原始披露', date: '2026-09'}},
    {name: '@SUM(A1:A2)', value: '-2+3'}
  ];
  const output = A.csv(rows), parsed = A.parseCSV(output);
  assert(output.startsWith('\uFEFF'));
  assert.equal(parsed.length, rows.length);
  assert.equal(parsed[0].name, rows[0].name);
  assert.equal(parsed[0].text, rows[0].text);
  assert.equal(parsed[0].value, '0');
  assert.equal(parsed[1].value, '');
  assert.equal(parsed[1].laterOnly, rows[1].laterOnly, 'later fields must survive export');
  assert.equal(parsed[2].laterOnly, JSON.stringify(rows[2].laterOnly));
  assert.equal(parsed[2].value, '-12.5', 'real negative numbers remain numbers');
  for (const index of [1, 2, 3]) assert(parsed[index].name.startsWith("'"), 'formula-like text is escaped');
  assert.equal(parsed[3].value, "'-2+3");
  assert.equal(A.esc('<img src=x onerror="bad">'), '&lt;img src=x onerror=&quot;bad&quot;&gt;');
  for (const value of ['', undefined, null, 'javascript:alert(1)', 'data:text/html,bad', 'https://user:pass@example.test/']) assert.equal(A.safeHref(value), '', String(value));
  assert.equal(A.safeHref('data/industry/overview.json'), 'https://native.example.test/data/industry/overview.json');
});

test('JSON exploration preserves scalar metadata, nested tables, mixed arrays, null and zero', async () => {
  const {extractTables} = await load('explorer');
  const payload = {
    title: '完整元数据样本', checkedAt: '核对时点样本', count: 0,
    records: [{name: '甲', value: 0, note: null}, {name: '乙', value: null, laterOnly: '后续字段样本'}],
    metadata: {publisher: '标量来源样本', unit: '元'},
    series: {CN: {period: '2026-Q3', value: 0, basis: '单季样本'}},
    mixed: ['混合数组文字样本', {name: '混合对象样本', value: 7}, 0, false, null],
    nested: [{name: '父层', observations: [{period: '2026-08', value: 0}, {period: '2026-09', value: null}]}]
  };
  const tables = extractTables(payload), serialized = JSON.stringify(tables);
  for (const sentinel of ['完整元数据样本', '核对时点样本', '后续字段样本', '标量来源样本', '单季样本', '混合数组文字样本', '混合对象样本', '2026-09']) assert(serialized.includes(sentinel), sentinel + ' must be reachable in a table');
  assert(tables.some(t => t.rows.some(r => r.name === '甲' && r.value === 0 && r.note === null)));
  assert(tables.some(t => t.rows.some(r => r.period === '2026-09' && r.value === null)));
  const identifiers = tables.map(t => t.id);
  assert.equal(new Set(identifiers).size, identifiers.length, 'table selectors are unique');
  const travel = data('data/tourism/dashboard.json');
  const travelTables = extractTables(travel);
  for (const key of ['quarters', 'quarterYtd', 'holidays']) if (travel.domestic?.[key]?.length) assert.deepEqual(travelTables.find(t => t.id === 'domestic.' + key)?.rows, travel.domestic[key], key + ' original table is retained');
});

test('research normalization retains content, links, source kinds and the original classification', async () => {
  const R = await load('research');
  const input = {'标题': '华住集团经营跟踪', '原始发布时间': '2026-11-20T01:02:03Z', '时间': '2026-11-20', '内容': '完整第一段\n\n完整第二段，数值为0。', '覆盖板块': '旅游酒店', '相关标的': '华住集团', '原文链接': 'https://wx.zsxq.com/topic/12345678901234567', '正文已截断': false};
  const view = R.normalizeResearchRecord(input, 'views', M), all = R.normalizeResearchRecord(input, 'all_views', M, 'views');
  assert.equal(view.content, Z.plain(input['内容']));
  assert.equal(view.published, input['原始发布时间']);
  assert.equal(view.url, input['原文链接']);
  assert(M.sectorIds(view).includes('travel'));
  assert.equal(all.sourceKind, 'views');
  assert.equal(R.uniqueResearchRecords([view, all, {...view}]).length, 2, 'source view is retained in both intended tabs without duplicate records');
  assert.equal(R.researchLink('{"link":"https://example.test/report"}'), 'https://example.test/report');
  for (const url of ['javascript:alert(1)', 'https://user:secret@example.test/report', '/unregistered/local/file']) assert.equal(R.researchLink(url), '');
  const recent = data('data/research/recent-preview.json');
  for (const db of recent.dbs) for (const row of db.rows.slice(0, 10)) {
    const r = R.normalizeResearchRecord(row, db.id, M);
    assert.equal(r.content, M.plainContent(row['内容'] || row['摘要'] || ''));
    assert.deepEqual(M.sectorIds(r), M.sectorIds({title: r.title, sector: row['覆盖板块'] || '', company: row['相关标的'] || ''}));
  }
});

test('every published WORK minute has the exact verified full body and safe original permissions', () => {
  const rows = data('data/research/work-minutes.json').records.filter(L.hasPublishedText);
  assert(rows.length > 0, 'published bodies are part of the real dataset');
  for (const item of rows) {
    const payload = data(item.processing.contentPath);
    assert.equal(payload.assetId, item.id);
    assert.equal(typeof payload.body, 'string');
    assert.equal(payload.bodySha256, item.processing.bodySha256);
    const normalized = payload.body.normalize('NFKC').replace(/[\s\u001c-\u001f\u0085]/gu, '');
    assert.equal(crypto.createHash('sha256').update(normalized).digest('hex'), item.processing.bodySha256, item.name);
    if (L.storageLink(item)) assert.match(L.storageLink(item), /^https:\/\//);
    assert.equal(L.storageLink({...item, storage: {...item.storage, permissionsReviewed: false}}), '', 'unreviewed originals must not become downloadable');
    assert.equal(L.storageLink({...item, storage: {...item.storage, downloadAllowed: false}}), '');
  }
});

test('published daily dates, complete text and actual announcement/date rules are preserved', async () => {
  const D = await load('daily');
  const dates = data('data/daily/index.json').dates.slice().sort();
  assert.equal(new Set(dates).size, dates.length);
  for (const date of dates) assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  const date = dates.at(-1), report = data('data/daily/onepage/' + date + '.json'), original = data('data/daily/' + date + '.json'), inventory = data('data/daily/resources/' + date + '.json');
  assert.equal(report.date, date); assert.equal(original.date, date); assert.equal(inventory.date, date);
  const output = D.dailyPlainText(report, inventory, original, true);
  assert(output.includes(report.headline));
  for (const rows of Object.values(original.sections)) for (const row of rows) if (row.body || row.summary) assert(output.includes(Z.plain(row.body || row.summary)), 'every original body survives the full download');
  const synthetic = {date: '2026-11-20', earningsUpcoming: [{date: '2026-11-19', company: 'past'}, {date: '2026-11-20', company: 'today'}, {date: '2026-11-23', company: 'third'}, {date: '2026-11-24', company: 'later'}]};
  assert.deepEqual(D.dailyUpcoming(synthetic).map(r => r.company), ['today', 'third']);
  const announcements = D.dailyAnnouncements({companyAnnouncements: [{verified: false, url: 'https://example.test/not-verified'}, {verified: true, url: 'javascript:alert(1)'}]});
  assert.equal(announcements.length, 0);
});

test('calendar events retain actual versus expected dates, evidence and source time zones', () => {
  const snapshot = E.validateSnapshot(data('data/earnings-calendar.json'));
  const companies = data('data/coverage-companies.json').companies.map(r => ({...r, code: E.code(r.code)}));
  const rows = E.rows(companies, snapshot, ''), events = E.eventsFor(rows);
  assert(events.length > 0);
  for (const event of events) {
    assert.equal(event.date, event.kind === 'formal' ? event.actual || event.expected : event.announcementDate);
    assert(snapshot.records.some(r => r.id === event.id), 'no invented disclosure event');
  }
  const csv = E.csv(rows, '2026-11-24');
  assert(csv.includes('实际披露日') && csv.includes('公告发布日期') && csv.includes('来源核验时间'));
  const important = I.validate(data('data/important-calendar.json'));
  const month = important.coverageStart.slice(0, 7), selected = I.select(important, {month});
  assert(selected.length > 0);
  for (const event of selected) {
    assert.match(event.beijingDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(event.sourceUrl, /^https:\/\//);
    assert(event.timezone, 'original timezone is retained');
  }
});
