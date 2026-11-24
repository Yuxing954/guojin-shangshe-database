// Native Tabler daily report. Published dates come exclusively from the existing daily index.
const RAW_SECTIONS = [['briefs', '研究简报'], ['views', '市场观点'], ['data', '行业数据'], ['news', '新闻']];
const RESOURCE_SECTIONS = [['segments', '新增观点'], ['minutes', '调研纪要'], ['audio', '会议录音'], ['reports', '研究资料']];
const sourceKey = value => String(value || '').split('#')[0].split('?')[0].replace(/\/$/, '');
const plain = value => globalThis.ZsxqContent?.plain(value) ?? String(value ?? '');
const safeLink = value => { try { if (typeof value !== 'string' || !value.trim()) return ''; const u = new URL(value, location.href); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } };

export function dailyUpcoming(report) {
  return (report.earningsUpcoming || []).filter(row => { const days = (Date.parse(row.date + 'T00:00:00+08:00') - Date.parse(report.date + 'T00:00:00+08:00')) / 86400000; return Number.isFinite(days) && days >= 0 && days <= 3; }).sort((a, b) => a.date.localeCompare(b.date));
}
export function dailyAnnouncements(report) {
  return globalThis.DailyAnnouncements?.rows(report) || (report.companyAnnouncements || []).filter(row => row.verified === true && /^https:\/\//.test(row.url || '')).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
}
export function dailyPlainText(report, inventory, original, includeOriginals = false) {
  if (!report) return '';
  const chunks = ['国金商社日报｜' + report.date, report.windowLabel || '截至北京时间18:00', report.headline || '', '【每日总结】\n' + plain(report.dailySummary || (report.dailySummaryPoints || []).join('\n') || report.headline)];
  if (report.focus?.length) chunks.push('【重点观点】\n' + report.focus.map(r => plain(r.title) + '\n' + plain(r.summary) + '\n' + (r.sources || []).map(s => [s.source, s.publishedAt, s.url].filter(Boolean).join(' · ')).join('\n')).join('\n\n'));
  if (report.industries?.length) chunks.push('【行业跟踪】\n' + report.industries.map(r => plain(r.title || r.name || r.industry || r.sector) + '\n' + plain(r.summary || r.content || r.body || '')).join('\n\n'));
  if (report.industryUpdates?.length) chunks.push('【行业重要数据】\n' + report.industryUpdates.map(r => plain(r.title) + '\n' + plain(r.summary) + '\n' + [r.source, r.publishedAt ? '发布 ' + r.publishedAt : r.availableAt ? '入库 ' + r.availableAt : '', r.url].filter(Boolean).join(' · ')).join('\n\n'));
  const announcements = dailyAnnouncements(report);
  if (announcements.length) chunks.push('【公司重要公告】\n' + announcements.map(r => r.company + '（' + r.code + '）｜' + r.title + '\n' + plain(r.summary) + '\n' + plain(r.impact) + '\n' + [r.source, r.publishedAt, r.url].filter(Boolean).join(' · ')).join('\n\n'));
  if (report.quiet) chunks.push(plain(report.quiet));
  const upcoming = dailyUpcoming(report);
  if (upcoming.length) chunks.push('【近期财报 · 未来3天】\n' + upcoming.map(r => [r.date, r.company, r.period, r.status, r.url].filter(Boolean).join(' · ')).join('\n'));
  if (inventory) for (const [key, title] of RESOURCE_SECTIONS) if (inventory.groups?.[key]?.length) chunks.push('【' + title + '】\n' + inventory.groups[key].map(r => [r.publishedAt, plain(r.title), r.status, r.url].filter(Boolean).join('\n')).join('\n\n'));
  if (includeOriginals) for (const [key, title] of RAW_SECTIONS) if (original?.sections?.[key]?.length) chunks.push('【原始内容 · ' + title + '】\n' + original.sections[key].map(r => [plain(r.title), r.publishedAt, plain(r.body || r.summary), r.url].filter(Boolean).join('\n')).join('\n\n'));
  return chunks.filter(Boolean).join('\n\n');
}

export async function renderDaily(container, api) {
  const { esc, json, setHeader } = api, params = new URLSearchParams(location.search);
  let dates = [], selected = '', report = null, original = null, inventory = null, generation = 0, rawSection = 'briefs';
  let rawStatus = 'loading', resourcesStatus = 'loading';
  const $ = selector => container.querySelector(selector);
  const dateText = value => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (globalThis.ResearchModel?.publicationTime) return globalThis.ResearchModel.publicationTime(value);
    return String(value).replace('T', ' ').slice(0, 16);
  };
  const source = (row, title = row?.source || '原始来源') => { const href = safeLink(row?.url || ''); return href ? '<a target="_blank" rel="noopener noreferrer" href="' + esc(href) + '">' + esc(title) + '</a>' : esc(title); };
  const textBlock = value => '<div class="lh-lg text-break" style="white-space:pre-wrap">' + esc(plain(value)) + '</div>';
  const errorBlock = (message, action) => '<div class="alert alert-warning" role="alert"><div class="d-flex align-items-center gap-3 flex-wrap"><span>' + esc(message) + '</span>' + (action ? '<button type="button" class="btn btn-sm ms-auto" data-daily-action="' + action + '">重试</button>' : '') + '</div></div>';
  const loadingBlock = label => '<div class="py-5 text-center text-secondary" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>' + label + '</div>';
  setHeader({ title: '商社日报', pretitle: 'DAILY RESEARCH', actions: '<a class="btn" href="research.html">观点与纪要</a>' });
  container.innerHTML = '<div class="card">' + loadingBlock('正在读取日报目录…') + '</div>';

  function shell() {
    container.innerHTML = '<div id="daily-status" aria-live="polite"></div><div class="card mb-3"><div class="card-body"><div class="row g-3 align-items-end"><div class="col-12 col-sm-5 col-lg-3"><label class="form-label" for="daily-date">日报日期</label><select class="form-select" id="daily-date">' + dates.map(d => '<option value="' + d + '">' + d + '</option>').join('') + '</select></div><div class="col-12 col-sm-7 col-lg-9"><div class="btn-list justify-content-sm-end"><button class="btn" type="button" data-daily-action="copy-link">复制链接</button><button class="btn" type="button" data-daily-action="copy">复制日报</button><button class="btn btn-primary" type="button" data-daily-action="download">下载全文</button></div></div></div></div></div><div id="daily-report"></div>';
    $('#daily-date').value = selected;
    $('#daily-date').addEventListener('change', event => load(event.target.value));
    container.addEventListener('click', handleClick);
  }
  function announce(message) { $('#daily-status').innerHTML = message ? '<div class="alert alert-info" role="status">' + esc(message) + '</div>' : ''; }
  function focusHTML() {
    const originals = new Map(Object.entries(report.originals || {}).map(([url, row]) => [sourceKey(url), row]));
    for (const rows of Object.values(original?.sections || {})) for (const row of rows) if (row.url && row.body) originals.set(sourceKey(row.url), row);
    return (report.focus || []).map((item, index) => '<details class="list-group-item p-4"><summary class="d-flex align-items-start gap-3"><span class="badge bg-blue-lt mt-1">' + String(index + 1).padStart(2, '0') + '</span><div class="flex-fill"><h3 class="mb-2">' + esc(plain(item.title)) + '</h3><p class="mb-0 text-secondary">' + esc(plain(item.summary)) + '</p></div></summary><div class="mt-4">' + (item.sources || []).map(s => {
      const full = originals.get(sourceKey(s.url));
      return '<div class="border-top pt-3 mt-3"><div class="small text-secondary mb-3">' + source(s) + (s.publishedAt ? ' · 发布 ' + esc(dateText(s.publishedAt)) : '') + '</div>' + (full?.body ? textBlock(full.body) : rawStatus === 'loading' ? '<p class="text-secondary">正在读取原文…</p>' : rawStatus === 'error' ? '<p class="text-secondary">原文读取失败。<button class="btn btn-sm ms-2" type="button" data-daily-action="raw-retry">重试</button></p>' : '<p class="text-secondary">本期未保存该来源的原文。</p>') + '</div>';
    }).join('') + '</div></details>').join('');
  }
  function reportHTML() {
    const summary = report.dailySummaryPoints?.length ? report.dailySummaryPoints.map((p, i) => '<div class="d-flex align-items-start gap-3' + (i ? ' mt-3' : '') + '"><span class="text-secondary fw-semibold">' + String(i + 1).padStart(2, '0') + '</span><div class="lh-lg">' + esc(plain(p)) + '</div></div>').join('') : textBlock(report.dailySummary || report.headline);
    const updates = report.industryUpdates || [], announcements = dailyAnnouncements(report), upcoming = dailyUpcoming(report);
    const sourcesLink = '<a class="small" href="data-notes.html#daily">数据说明</a>';
    return '<div class="row row-deck row-cards"><div class="col-12"><article class="card"><div class="card-header"><div><div class="subheader mb-2">' + esc(report.date) + ' · ' + esc(report.windowLabel || '截至北京时间18:00') + '</div><h2 class="card-title">' + esc(plain(report.headline || '商社日报')) + '</h2></div><span class="badge bg-blue-lt ms-auto">已发布</span></div><div class="card-body">' + summary + '</div></article></div><div class="col-12 col-lg-8"><div class="card"><div class="card-header"><h3 class="card-title">重点观点</h3><span class="badge bg-secondary-lt ms-auto">' + (report.focus || []).length + '</span></div><div class="list-group list-group-flush" id="daily-focus">' + (report.focus?.length ? focusHTML() : '<div class="card-body text-secondary">本期暂无入选重点观点。</div>') + '</div>' + (report.quiet ? '<div class="card-body border-top text-secondary">' + esc(plain(report.quiet)) + '</div>' : '') + '</div></div><div class="col-12 col-lg-4"><div class="card"><div class="card-header"><h3 class="card-title">近期财报</h3><span class="text-secondary small ms-auto">未来3天</span></div><div class="list-group list-group-flush">' + (upcoming.length ? upcoming.map(r => '<div class="list-group-item py-3"><div class="d-flex gap-3 justify-content-between"><strong>' + esc(r.company) + '</strong><span class="text-secondary">' + esc(r.date.slice(5)) + '</span></div><div class="small text-secondary mt-1">' + esc(r.period) + '</div><div class="small mt-2">' + source(r, r.status || '预约披露') + '</div></div>').join('') : '<div class="card-body text-secondary">暂无已登记披露安排。</div>') + '</div><div class="card-footer">' + sourcesLink + '</div></div></div>' + (updates.length ? '<div class="col-12"><div class="card"><div class="card-header"><h3 class="card-title">行业重要数据</h3><span class="badge bg-secondary-lt ms-auto">' + updates.length + '</span></div><div class="list-group list-group-flush">' + updates.map(r => '<article class="list-group-item p-4"><h3>' + esc(plain(r.title)) + '</h3>' + textBlock(r.summary) + '<div class="small text-secondary mt-3">' + source(r) + ' · ' + esc(r.publishedAt ? '发布 ' + dateText(r.publishedAt) : r.availableAt ? '入库 ' + dateText(r.availableAt) : '日期待补充') + '</div></article>').join('') + '</div></div></div>' : '') + (announcements.length ? '<div class="col-12"><div class="card"><div class="card-header"><h3 class="card-title">公司重要公告</h3></div><div class="list-group list-group-flush">' + announcements.map(r => '<article class="list-group-item p-4"><div class="small text-secondary mb-2">' + esc(r.company) + ' · ' + esc(r.code) + ' · ' + esc(r.category) + '</div><h3>' + esc(plain(r.title)) + '</h3>' + textBlock(r.summary) + (r.impact ? '<div class="mt-3">' + textBlock(r.impact) + '</div>' : '') + '<div class="small text-secondary mt-3">' + source(r) + ' · 发布 ' + esc(dateText(r.publishedAt)) + '</div></article>').join('') + '</div></div></div>' : '') + (report.industries?.length ? '<div class="col-12"><div class="card"><div class="card-header"><h3 class="card-title">行业跟踪</h3></div><div class="list-group list-group-flush">' + report.industries.map(r => '<article class="list-group-item p-4"><h3>' + esc(plain(r.title || r.name || r.industry || r.sector)) + '</h3>' + textBlock(r.summary || r.content || r.body || '') + (r.sources || []).map(s => '<div class="small mt-2">' + source(s) + '</div>').join('') + '</article>').join('') + '</div></div></div>' : '') + '<div class="col-12"><div class="card"><div class="card-header"><h3 class="card-title">当日资料</h3><span class="small text-secondary ms-auto" id="daily-resources-time"></span></div><div id="daily-resources">' + loadingBlock('正在读取当日资料…') + '</div></div></div><div class="col-12"><div class="card"><div class="card-header"><h3 class="card-title">原始内容</h3><span class="small text-secondary ms-auto">按原栏目保留</span></div><div id="daily-raw">' + loadingBlock('正在读取原始内容…') + '</div></div></div></div>';
  }
  function renderResources() {
    const host = $('#daily-resources'); if (!host) return;
    if (resourcesStatus === 'error') { host.innerHTML = '<div class="card-body">' + errorBlock('本期资料清单读取失败或尚未登记。', 'resources-retry') + '</div>'; return; }
    if (!inventory) return;
    const catalog = inventory.attachmentCatalog || {}, through = catalog.scan?.windowEnd || catalog.sourceThrough || inventory.sourceThrough || '';
    $('#daily-resources-time').textContent = through ? '附件登记至 ' + dateText(through) : '';
    const groups = RESOURCE_SECTIONS.filter(([key]) => inventory.groups?.[key]?.length);
    if (!groups.length) { host.innerHTML = '<div class="card-body text-secondary">' + (catalog.coverageStatus === 'complete' ? '本期无新增资料。' : '附件索引待补充。') + '</div>'; return; }
    host.innerHTML = '<div class="table-responsive"><table class="table card-table table-vcenter"><thead><tr><th>资料名称</th><th>类型</th><th class="text-nowrap">发布时间</th><th class="w-1">来源</th></tr></thead><tbody>' + groups.flatMap(([key, label]) => inventory.groups[key].map(row => '<tr><td><div class="text-break">' + esc(plain(row.title)) + '</div>' + (row.status ? '<div class="small text-secondary mt-1">' + esc(row.status) + '</div>' : '') + '</td><td class="text-nowrap"><span class="badge bg-secondary-lt">' + label + '</span></td><td class="text-nowrap small">' + esc(dateText(row.publishedAt) || '时间待补充') + '</td><td class="text-nowrap">' + source(row, '查看') + '</td></tr>')).join('') + '</tbody></table></div>' + (catalog.coverageStatus === 'pending' ? '<div class="card-footer text-secondary small">附件索引待补充</div>' : '');
  }
  function renderRaw() {
    const host = $('#daily-raw'); if (!host) return;
    if (rawStatus === 'error') { host.innerHTML = '<div class="card-body">' + errorBlock('原始内容读取失败。', 'raw-retry') + '</div>'; return; }
    if (!original) return;
    const rows = original.sections?.[rawSection] || [];
    host.innerHTML = '<div class="card-body border-bottom py-2"><ul class="nav nav-pills">' + RAW_SECTIONS.map(([key, label]) => '<li class="nav-item"><button class="nav-link' + (rawSection === key ? ' active' : '') + '" type="button" data-raw-section="' + key + '">' + label + '<span class="badge bg-secondary-lt ms-2">' + (original.sections?.[key] || []).length + '</span></button></li>').join('') + '</ul></div><div class="list-group list-group-flush">' + (rows.length ? rows.map(r => '<details class="list-group-item p-4"><summary><strong>' + esc(plain(r.title)) + '</strong><div class="small text-secondary mt-2">' + esc([r.sector, dateText(r.publishedAt)].filter(Boolean).join(' · ')) + '</div></summary><div class="mt-4">' + textBlock(r.body || r.summary || '该条记录没有正文。') + (r.url ? '<div class="mt-3 small">' + source(r) + '</div>' : '') + '</div></details>').join('') : '<div class="card-body text-secondary">本期此栏目无已收录内容。</div>') + '</div>';
    if (report?.focus?.length) $('#daily-focus').innerHTML = focusHTML();
  }
  async function loadRaw(date, token) {
    rawStatus = 'loading';
    try { const payload = await json('data/daily/' + date + '.json'); if (generation !== token) return; if (payload.date !== date || !payload.sections) throw Error('原始内容日期不匹配'); original = payload; rawStatus = 'ready'; }
    catch { if (generation !== token) return; rawStatus = 'error'; }
    renderRaw(); if (report?.focus?.length) $('#daily-focus').innerHTML = focusHTML();
  }
  async function loadResources(date, token) {
    resourcesStatus = 'loading';
    try { const payload = await json('data/daily/resources/' + date + '.json'); if (generation !== token) return; if (payload.date !== date || !payload.groups) throw Error('资料清单日期不匹配'); inventory = payload; resourcesStatus = 'ready'; }
    catch { if (generation !== token) return; resourcesStatus = 'error'; }
    renderResources();
  }
  async function load(date) {
    if (!dates.includes(date)) return;
    const token = ++generation; selected = date; report = null; original = null; inventory = null; rawStatus = 'loading'; resourcesStatus = 'loading';
    $('#daily-date').value = date; $('#daily-report').innerHTML = '<div class="card">' + loadingBlock('正在读取日报…') + '</div>'; announce('');
    for (const b of container.querySelectorAll('[data-daily-action="copy"],[data-daily-action="download"]')) b.disabled = true;
    history.replaceState(null, '', location.pathname + '?date=' + date);
    try {
      const payload = await json('data/daily/onepage/' + date + '.json'); if (token !== generation) return;
      if (payload.schemaVersion !== 2 || payload.date !== date) throw Error('日报日期或版本不匹配');
      report = payload; $('#daily-report').innerHTML = reportHTML();
      for (const b of container.querySelectorAll('[data-daily-action="copy"],[data-daily-action="download"]')) b.disabled = false;
      await Promise.allSettled([loadRaw(date, token), loadResources(date, token)]);
    } catch { if (token === generation) $('#daily-report').innerHTML = errorBlock('该期日报读取失败。', 'report-retry'); }
  }
  async function handleClick(event) {
    const section = event.target.closest('[data-raw-section]'); if (section) { rawSection = section.dataset.rawSection; renderRaw(); return; }
    const button = event.target.closest('[data-daily-action]'); if (!button) return;
    const action = button.dataset.dailyAction;
    if (action === 'report-retry') { await load(selected); return; }
    if (action === 'raw-retry') { await loadRaw(selected, generation); return; }
    if (action === 'resources-retry') { await loadResources(selected, generation); return; }
    if (action === 'copy-link') { try { const url = new URL(location.href); url.search = '?date=' + selected; url.hash = ''; await navigator.clipboard.writeText('国金商社日报｜' + selected + ' ' + url.href); announce('日报链接已复制。'); } catch { announce('链接复制失败，可直接复制地址栏。'); } return; }
    if (!report) return;
    if (action === 'copy') { try { await navigator.clipboard.writeText(dailyPlainText(report, inventory, original)); announce('日报已复制。'); } catch { announce('复制失败，可下载全文。'); } }
    if (action === 'download') {
      if (rawStatus === 'loading' || resourcesStatus === 'loading') { announce('原始内容仍在读取，请稍后下载。'); return; }
      if (rawStatus === 'error') { announce('原始内容读取失败，请先重试后下载完整内容。'); return; }
      if (resourcesStatus === 'error') { announce('资料清单读取失败，请先重试后下载完整内容。'); return; }
      api.download('国金商社日报-' + report.date + '.txt', dailyPlainText(report, inventory, original, true), 'text/plain;charset=utf-8');
    }
  }
  try {
    const index = await json('data/daily/index.json');
    if (!Array.isArray(index.dates)) throw Error('目录格式错误');
    dates = [...new Set(index.dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort((a, b) => b.localeCompare(a));
    if (!dates.length) { container.innerHTML = '<div class="card"><div class="empty"><p class="empty-title">暂无已发布日报</p></div></div>'; return; }
    selected = dates.includes(params.get('date')) ? params.get('date') : dates[0]; shell(); await load(selected);
    if (params.get('date') && params.get('date') !== selected) announce('所选日期未发布，当前展示最新已发布日报。');
  } catch {
    container.innerHTML = errorBlock('日报目录读取失败。', 'index-retry');
    container.querySelector('[data-daily-action="index-retry"]').addEventListener('click', () => renderDaily(container, api), { once: true });
  }
}
