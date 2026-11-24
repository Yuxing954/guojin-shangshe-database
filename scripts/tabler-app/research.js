// Native Tabler research screens. Classification and attachment permissions stay in the original models.
const KINDS = [['digest', '观点摘要'], ['views', '商社观点'], ['all_views', '全部观点'], ['minutes', '纪要文库']];
const safePath = value => typeof value === 'string' && /^data\/[\w\u3400-\u9fff./ -]+\.(?:json|csv)$/.test(value) && !value.split('/').includes('..');
export function researchLink(value) {
  try { if (typeof value === 'string' && value.trim().startsWith('{')) value = JSON.parse(value); const u = new URL(typeof value === 'object' ? value.link : value); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function parseResearchCSV(text) {
  const rows = []; let row = [], value = '', quoted = false;
  text = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (quoted) { if (c === '"' && text[i + 1] === '"') { value += '"'; i++; } else if (c === '"') quoted = false; else value += c; } else if (c === '"') quoted = true; else if (c === ',') { row.push(value); value = ''; } else if (c === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; } else value += c; }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  const headings = rows.shift() || [];
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headings.map((h, i) => [h, r[i] ?? ''])));
}
export function normalizeResearchRecord(raw, kind, M, sourceKind = kind) {
  const published = raw['原始发布时间'] || raw['时间'] || raw['日期'] || '';
  const originalTitle = M.plainContent(raw['标题'] || ''), content = M.plainContent(raw['内容'] || raw['摘要'] || '');
  const title = kind !== 'minutes' && raw['内容'] ? M.recoverTitle(originalTitle, content) : originalTitle;
  return { kind, sourceKind, title, legacyTitles: title === originalTitle ? [] : [originalTitle], published, date: published.slice(0, 10), content, author: raw['作者'] || '', sector: raw['覆盖板块'] || '', company: raw['相关标的'] || '', url: researchLink(raw['原文链接'] || raw['下载链接']), file: raw['文件名'] || '', batch: raw['更新批次'] || '', truncated: raw['正文已截断'] === true, state: raw['内容状态'] || '' };
}
export function uniqueResearchRecords(records) {
  const seen = new Set(), bodies = new Set(), titles = new Set();
  return records.filter(r => {
    const topic = String(r.url || '').match(/\/topic\/(\d+)/)?.[1] || '';
    const key = r.kind + ':' + (r.kind === 'minutes' ? r.library?.occurrenceKey || r.id || topic || r.published + '|' + r.title + '|' + r.file : topic || r.url || r.published + '|' + r.title);
    if (seen.has(key)) return false;
    if (r.kind === 'views' || r.kind === 'all_views') {
      const title = r.kind + ':' + r.published + '|' + r.title, body = r.kind + ':' + String(r.content || '').replace(/\r\n?/g, '\n').trim();
      if (titles.has(title) || r.content && bodies.has(body)) return false;
      titles.add(title); if (r.content) bodies.add(body);
    }
    seen.add(key); return true;
  });
}

export async function renderResearch(container, api) {
  const { esc, json, text, setHeader } = api, M = globalThis.ResearchModel, L = globalThis.ResearchLibrary;
  container._researchListeners?.abort();
  const listeners = new AbortController(); container._researchListeners = listeners;
  const params = new URLSearchParams(location.search), pageSize = 20;
  let kind = KINDS.some(([k]) => k === params.get('kind')) ? params.get('kind') : params.get('asset') ? 'minutes' : params.get('topic') || params.get('record') ? 'views' : 'digest';
  let entries = [], briefs = [], library = {}, sync = {}, manifest = {}, recentMeta = {}, page = 1, filtered = [], loading = false, articleToken = 0;
  let loadedHistory = false, fullRecent = false, sourceState = '近期列表';
  const filter = { q: params.get('q') || '', sector: params.get('sector') || '', from: params.get('from') || '', to: params.get('to') || '', format: params.get('format') || '', state: params.get('state') || '', scope: params.get('scope') === 'all' || params.get('state') === 'awaiting_file' ? 'all' : 'archived', sort: params.get('sort') === 'asc' ? 'asc' : 'desc' };
  if (['7', '30'].includes(params.get('range')) && !filter.from && !filter.to && M) { const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); filter.from = M.lowerDate(today, params.get('range')); filter.to = today; }
  const $ = selector => container.querySelector(selector);
  const plain = v => M.plainContent(v || '');
  const localJSON = p => { if (!safePath(p)) throw Error('无效数据路径'); return json(p); };
  const localCSV = async p => { if (!safePath(p)) throw Error('无效数据路径'); return parseResearchCSV(await text(p)); };
  const labels = id => M.sectors.find(s => s[0] === id)?.[1] || id;
  const spinner = '<div class="card"><div class="card-body py-5 text-center text-secondary" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>正在读取研究资料…</div></div>';
  setHeader({ title: '观点与纪要', pretitle: 'RESEARCH LIBRARY', actions: '<a class="btn" href="data-notes.html#research">数据说明</a>' });
  container.innerHTML = spinner;
  if (!M || !L) { container.innerHTML = '<div class="alert alert-danger">研究分类模块加载失败，请刷新重试。</div>'; return; }
  const recentEntries = data => (data.dbs || []).flatMap(db => (db.rows || []).flatMap(r => db.id === 'views' ? [normalizeResearchRecord(r, 'views', M), normalizeResearchRecord(r, 'all_views', M, 'views')] : [normalizeResearchRecord(r, db.id, M)]));
  function saveURL(record) {
    const query = new URLSearchParams(); if (kind !== 'digest') query.set('kind', kind);
    for (const [k, v] of Object.entries(filter)) if (v && !(k === 'sort' && v === 'desc') && !(k === 'scope' && (v === 'archived' || kind !== 'minutes')) && !(kind !== 'minutes' && ['format', 'state'].includes(k))) query.set(k, v);
    if (record) { const topic = M.topic(record); if (topic) query.set('topic', topic); else query.set('record', record.title); if (record.file) query.set('file', record.file); if (record.id) query.set('asset', record.id); }
    history.replaceState(null, '', location.pathname + (query.size ? '?' + query : ''));
  }
  function notice(message, danger = false, retry = false) { $('#research-status').innerHTML = message ? '<div class="alert ' + (danger ? 'alert-warning' : 'alert-info') + ' mb-3" role="status">' + esc(message) + (retry ? '<button class="btn btn-sm ms-2" type="button" data-action="reload">重新加载</button>' : '') + '</div>' : ''; }
  function sourceAnchor(url, label = '原始来源') { const safe = researchLink(url); return safe ? '<a class="btn btn-sm" target="_blank" rel="noopener noreferrer" href="' + esc(safe) + '">' + esc(label) + '</a>' : ''; }
  function renderControls() {
    container.innerHTML = '<div id="research-status" aria-live="polite"></div><div class="card"><div class="card-header"><ul class="nav nav-tabs card-header-tabs" role="tablist">' + KINDS.map(([k, label]) => '<li class="nav-item"><button class="nav-link' + (kind === k ? ' active' : '') + '" type="button" role="tab" data-kind="' + k + '" aria-selected="' + (kind === k) + '">' + label + '</button></li>').join('') + '</ul></div><div class="card-body border-bottom"><form id="research-filter"><div class="row g-3 align-items-end"><div class="col-12 col-md-5"><label class="form-label" for="research-query">搜索</label><input class="form-control" type="search" id="research-query" data-filter="q" placeholder="标题、公司或正文关键词" value="' + esc(filter.q) + '"></div><div class="col-6 col-md-3"><label class="form-label" for="research-sector">行业</label><select class="form-select" id="research-sector" data-filter="sector"><option value="">全部行业</option>' + M.sectors.map(([id, label]) => '<option value="' + id + '"' + (filter.sector === id ? ' selected' : '') + '>' + label + '</option>').join('') + '</select></div><div class="col-6 col-md-2"><label class="form-label" for="research-sort">排序</label><select class="form-select" id="research-sort" data-filter="sort"><option value="desc"' + (filter.sort === 'desc' ? ' selected' : '') + '>最新在前</option><option value="asc"' + (filter.sort === 'asc' ? ' selected' : '') + '>最早在前</option></select></div><div class="col-12 col-md-2"><button class="btn w-100" type="button" data-action="reset">重置筛选</button></div></div><details class="mt-3"' + (filter.from || filter.to || filter.format || filter.state ? ' open' : '') + '><summary class="text-secondary">日期与资料筛选</summary><div class="row g-3 mt-1"><div class="col-6 col-md-3"><label class="form-label" for="research-from">开始日期</label><input id="research-from" type="date" class="form-control" data-filter="from" value="' + esc(filter.from) + '"></div><div class="col-6 col-md-3"><label class="form-label" for="research-to">结束日期</label><input id="research-to" type="date" class="form-control" data-filter="to" value="' + esc(filter.to) + '"></div><div class="col-6 col-md-3" data-minute-filter><label class="form-label" for="research-format">资料类型</label><select id="research-format" class="form-select" data-filter="format"><option value="">全部类型</option><option value="document">文档</option><option value="audio">录音</option></select></div><div class="col-6 col-md-3" data-minute-filter><label class="form-label" for="research-scope">收录范围</label><select id="research-scope" class="form-select" data-filter="scope"><option value="archived">已归档资料</option><option value="all">全部登记资料</option></select></div><div class="col-12 col-md-6" data-minute-filter><label class="form-label" for="research-state">处理状态</label><select class="form-select" id="research-state" data-filter="state"><option value="">全部状态</option>' + Object.entries(L.states).map(([id, label]) => '<option value="' + esc(id) + '">' + esc(label) + '</option>').join('') + '</select></div></div></details></form></div><div class="card-body py-3 border-bottom d-flex flex-wrap align-items-center gap-2"><strong id="research-count"></strong><span id="research-range" class="text-secondary"></span><button class="btn btn-sm ms-auto" type="button" data-action="export">导出当前结果</button></div><div id="research-results"></div><div class="card-footer d-flex align-items-center flex-wrap gap-3"><span class="text-secondary" id="research-page"></span><div class="btn-list ms-auto"><button class="btn btn-sm" type="button" data-action="prev">上一页</button><button class="btn btn-sm" type="button" data-action="next">下一页</button></div></div></div><div class="d-flex flex-wrap align-items-center gap-3 mt-3" id="research-history"><span class="text-secondary small" id="research-freshness"></span><div class="btn-list ms-auto"><button class="btn" type="button" data-action="recent">加载完整近期列表</button><button class="btn" type="button" data-action="history">加载全部历史</button></div></div>';
    for (const key of ['format', 'scope', 'state']) $('[data-filter="' + key + '"]').value = filter[key];
    $('#research-filter').addEventListener('submit', e => e.preventDefault());
    container.addEventListener('input', e => { if (e.target.dataset.filter === 'q') { filter.q = e.target.value; page = 1; renderResults(); } }, { signal: listeners.signal });
    // Search already updates on input. Its blur/change must not replace a result button mid-click.
    container.addEventListener('change', e => { const key = e.target.dataset.filter; if (key && key !== 'q') { filter[key] = e.target.value; if (key === 'state' && filter.state === 'awaiting_file') { filter.scope = 'all'; $('[data-filter="scope"]').value = 'all'; } page = 1; renderResults(); } }, { signal: listeners.signal });
    container.addEventListener('click', onClick, { signal: listeners.signal });
  }
  function renderResults() {
    const invalid = filter.from && filter.to && filter.from > filter.to;
    for (const b of container.querySelectorAll('[data-kind]')) { b.classList.toggle('active', b.dataset.kind === kind); b.setAttribute('aria-selected', String(b.dataset.kind === kind)); }
    for (const field of container.querySelectorAll('[data-minute-filter]')) field.hidden = kind !== 'minutes';
    const f = { ...filter, kind, format: kind === 'minutes' ? filter.format : '', state: kind === 'minutes' ? filter.state : '' };
    if (kind === 'digest') filtered = invalid ? [] : briefs.filter(r => L.briefMatches(r, f));
    else filtered = invalid ? [] : entries.filter(r => r.library ? r.kind === kind && L.matches(r.library, f) : M.matches(r, f) && (!f.state || f.state === 'awaiting_file' && r.state) && !(kind === 'minutes' && filter.scope === 'archived'));
    const stamp = r => r.sortDate || r.published || r.date || '';
    filtered.sort((a, b) => filter.sort === 'asc' ? stamp(a).localeCompare(stamp(b)) : stamp(b).localeCompare(stamp(a)));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); page = Math.min(page, pages);
    const view = filtered.slice((page - 1) * pageSize, page * pageSize);
    $('#research-count').textContent = filtered.length.toLocaleString('zh-CN') + (kind === 'minutes' ? ' 份资料' : ' 条观点');
    $('#research-range').textContent = kind === 'digest' ? '已审阅摘要' : kind === 'minutes' ? filter.scope === 'archived' ? '已归档资料' : '全部登记资料' : sourceState;
    $('#research-page').textContent = filtered.length ? '第 ' + ((page - 1) * pageSize + 1) + '–' + Math.min(page * pageSize, filtered.length) + ' 条 / 共 ' + filtered.length.toLocaleString('zh-CN') + ' 条' : '暂无匹配记录';
    $('[data-action="prev"]').disabled = page <= 1; $('[data-action="next"]').disabled = page >= pages;
    $('[data-action="export"]').disabled = !filtered.length;
    $('[data-action="recent"]').hidden = kind === 'digest' || kind === 'minutes' || fullRecent || loadedHistory;
    $('[data-action="history"]').hidden = kind === 'digest' || kind === 'minutes' || loadedHistory;
    $('#research-freshness').textContent = kind === 'minutes' ? library.indexUpdatedAt || library.generatedAt ? '资料索引更新 ' + (library.indexUpdatedAt || library.generatedAt).slice(0, 10) : '' : recentMeta.updatedAt ? '近期列表更新 ' + recentMeta.updatedAt.replace('T', ' ').slice(0, 16) : '';
    if (!view.length) $('#research-results').innerHTML = '<div class="empty"><div class="empty-header">' + (invalid ? '日期范围无效' : '暂无结果') + '</div><p class="empty-title">' + (invalid ? '开始日期晚于结束日期' : '未找到匹配的研究资料') + '</p><div class="empty-action"><button class="btn btn-primary" type="button" data-action="reset">重置筛选</button></div></div>';
    else if (kind === 'digest') $('#research-results').innerHTML = '<div class="list-group list-group-flush">' + view.map((r, i) => '<article class="list-group-item p-4"><div class="d-flex flex-wrap gap-2 align-items-center mb-2"><span class="badge bg-blue-lt">' + esc(labels(r.sector === 'consumer' ? '商社' : r.sector)) + '</span><span class="text-secondary small">' + esc(r.date) + '</span></div><h3 class="mb-2">' + esc(r.title) + '</h3><p class="mb-3">' + esc(r.conclusion) + '</p><button class="btn btn-sm" type="button" data-record="' + ((page - 1) * pageSize + i) + '">阅读观点与依据</button></article>').join('') + '</div>';
    else $('#research-results').innerHTML = '<div class="table-responsive"><table class="table card-table table-vcenter"><thead><tr><th>标题</th><th class="text-nowrap">行业</th><th class="text-nowrap">' + (kind === 'minutes' ? '资料日期 / 状态' : '发布时间（北京时间）') + '</th><th class="w-1">操作</th></tr></thead><tbody>' + view.map((r, i) => {
      const index = (page - 1) * pageSize + i, tags = M.sectorIds(r).map(labels).slice(0, 2), stored = r.library && L.storageLink(r.library);
      const state = r.library ? L.states[r.library.processing?.status] || '状态待核对' : kind === 'minutes' ? r.state || M.labels[M.format(r)] : '';
      const date = r.library?.dateStatus === 'needs_review' ? '日期待核对' : kind === 'minutes' ? r.date || '日期待补充' : M.publicationTime(r.published);
      const subtitle = kind === 'minutes' ? [r.library?.extension?.toUpperCase(), L.bytes(r.library?.bytes), L.duration(r.library?.durationSeconds)].filter(Boolean).join(' · ') : M.preview(r).slice(0, 110);
      return '<tr><td><button class="btn btn-link p-0 text-start fw-medium text-wrap" type="button" data-record="' + index + '">' + esc(r.title || '未命名资料') + '</button>' + (subtitle ? '<div class="text-secondary small mt-1">' + esc(subtitle) + '</div>' : '') + '</td><td class="text-nowrap">' + tags.map(t => '<div class="small">' + esc(t) + '</div>').join('') + '</td><td class="text-nowrap small">' + esc(date) + (state ? '<div class="mt-1"><span class="badge bg-secondary-lt">' + esc(state) + '</span></div>' : '') + '</td><td><div class="btn-list flex-nowrap"><button class="btn btn-sm" type="button" data-record="' + index + '">阅读</button>' + (stored ? '<a class="btn btn-sm" href="' + esc(stored) + '" target="_blank" rel="noopener noreferrer">原件</a>' : '') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>';
    saveURL();
  }
  async function loadRecent() {
    const payload = await json('data/research/recent.json');
    const rows = uniqueResearchRecords(recentEntries(payload));
    entries = entries.filter(r => r.kind === 'minutes').concat(rows.filter(r => r.kind !== 'minutes'));
    fullRecent = true; sourceState = '完整近期列表';
  }
  async function loadHistory() {
    if (loadedHistory) return;
    const index = await json('data/research/market-views-all.json');
    if (!Array.isArray(index.parts)) throw Error('历史索引格式错误');
    const result = []; let done = 0;
    for (let start = 0; start < index.parts.length; start += 3) {
      const group = await Promise.all(index.parts.slice(start, start + 3).map(part => localJSON(part.path)));
      for (const payload of group) {
        if (!Array.isArray(payload.items)) throw Error('历史分片格式错误');
        for (const item of payload.items) {
          if (!item.record) continue;
          result.push(normalizeResearchRecord(item.record, 'all_views', M, item.kind));
          if (item.kind === 'views') result.push(normalizeResearchRecord(item.record, 'views', M));
        }
      }
      done += group.length; notice('正在读取历史资料 ' + done + ' / ' + index.parts.length + '…');
    }
    entries = entries.filter(r => r.kind === 'minutes').concat(uniqueResearchRecords(result));
    loadedHistory = true; fullRecent = true; sourceState = '全部历史'; notice('');
  }
  async function fullRecord(record) {
    if (!record.truncated) return record;
    const target = M.topic(record), match = r => (target ? M.topic(r) === target : r.title === record.title && r.published === record.published) && r.kind === record.kind;
    try { if (!fullRecent && !loadedHistory) await loadRecent(); const full = entries.find(match); if (full && !full.truncated) return full; } catch { /* Try the source batch below. */ }
    const paths = Object.values(sync.files || {}).flat().filter(p => p === record.batch || record.batch && p.includes(record.batch));
    for (const path of paths) {
      const rows = (await localCSV(path)).map(r => normalizeResearchRecord(r, record.kind, M, record.sourceKind));
      const found = rows.find(match); if (found) return found;
    }
    return record;
  }
  async function openRecord(record) {
    const token = ++articleToken;
    if (kind === 'digest') {
      const detail = '<div class="text-secondary small mb-3">' + esc(record.date) + ' · ' + esc(labels(record.sector)) + '</div><p class="lead">' + esc(record.conclusion) + '</p>' + (record.evidence || []).map(e => '<p>' + esc(e.text) + '</p>').join('') + (record.boundary ? '<h3>分歧与边界</h3><p>' + esc(record.boundary) + '</p>' : '') + ((record.watch || []).length ? '<h3>后续观察</h3><ul>' + record.watch.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') + '<h3>原始观点</h3><div class="list-group">' + (record.sources || []).map(s => '<a class="list-group-item list-group-item-action" href="' + esc(L.topicHref(s)) + '"><div>' + esc(s.title) + '</div><small class="text-secondary">' + esc(M.publicationTime(s.publishedAt || s.date)) + '</small></a>').join('') + '</div>';
      api.dialog(record.title, detail); return;
    }
    const original = record.library && L.storageLink(record.library);
    const dlg = api.dialog(record.title, '<div class="text-secondary small mb-3">' + esc(record.kind === 'minutes' ? record.library?.dateStatus === 'needs_review' ? '日期待核对' : record.date : '发布 ' + M.publicationTime(record.published) + '（北京时间）') + '</div><div class="btn-list mb-3">' + sourceAnchor(record.url) + (original ? sourceAnchor(original, '打开原件') : '') + '<button class="btn btn-sm" data-copy-record type="button">复制正文</button><button class="btn btn-sm" data-download-record type="button">下载文字</button></div><div class="text-secondary small mb-3" data-reading-state>正在读取正文…</div><div class="lh-lg text-break" style="white-space:pre-wrap" data-record-body></div>');
    saveURL(record);
    if (!dlg) return;
    const body = dlg.querySelector('[data-record-body]'), status = dlg.querySelector('[data-reading-state]');
    let bodyText = record.content || '';
    const show = (value, label) => { bodyText = plain(value); body.textContent = bodyText; status.textContent = label; };
    dlg.addEventListener('close', () => { articleToken++; saveURL(); }, { once: true });
    dlg.querySelector('[data-copy-record]').addEventListener('click', async e => { try { await navigator.clipboard.writeText(record.title + '\n\n' + bodyText); e.target.textContent = '已复制'; } catch { status.textContent = '复制失败，可下载文字。'; } });
    dlg.querySelector('[data-download-record]').addEventListener('click', () => api.download(record.title.replace(/[\\/:*?"<>|]/g, '_') + '.txt', record.title + '\n\n' + bodyText, 'text/plain;charset=utf-8'));
    if (record.kind !== 'minutes') {
      show(record.content || '该条记录未收录正文，请查看原始来源。', record.truncated ? '内容预览 · 正在读取完整原文' : '原文');
      try { const full = await fullRecord(record); if (articleToken !== token) return; show(full.content || bodyText, full.truncated ? '内容预览 · 完整原文未读取，可查看原始来源' : '完整原文'); } catch { if (articleToken === token) status.textContent = '完整原文读取失败，当前显示已保存预览。'; }
      return;
    }
    const item = record.library;
    if (!item) { show(record.content || '该附件尚未提取正文。', record.state || (M.format(record) === 'audio' ? '会议录音 · 未转写' : '附件登记')); return; }
    show(item.processing?.preview || item.processing?.summary || '暂无已提取文字，可查看原始来源或已开放的原件。', L.states[item.processing?.status] || '资料登记');
    if (!item.processing?.textAvailable || !L.safeLocalPath(item.processing?.contentPath)) return;
    try {
      const payload = await localJSON(item.processing.contentPath);
      if (articleToken !== token) return;
      if (![item.id, item.canonicalId, record.id].filter(Boolean).includes(payload.assetId)) throw Error('资料与正文不匹配');
      if (L.hasPublishedText(item) && typeof payload.body === 'string') {
        if (payload.bodySha256 !== item.processing.bodySha256) throw Error('正文版本不匹配');
        if (globalThis.crypto?.subtle) {
          // sync_work_minutes.py hashes NFKC text with all whitespace removed.
          const normalizedBody = payload.body.normalize('NFKC').replace(/[\s\u001c-\u001f\u0085]/gu, '');
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedBody));
          if ([...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('') !== item.processing.bodySha256) throw Error('正文校验失败');
        }
        if (articleToken !== token) return;
        show(payload.body, '完整提取文字 · ' + (L.states[item.processing.status] || item.processing.status));
      } else {
        const preview = L.preview(payload); show(preview.text || bodyText, preview.truncated ? '原文预览 · 完整内容请查看原件' : '已提取文字');
      }
    } catch { if (articleToken === token) status.textContent = '正文读取或校验失败，当前显示已保存摘要。'; }
  }
  function exportRows() {
    const headers = kind === 'digest' ? ['日期', '行业', '标题', '观点', '依据', '边界'] : ['发布时间', '标题', '行业', '公司', '内容', '来源链接', '文件名', '状态'];
    const rows = filtered.map(r => kind === 'digest' ? [r.date, labels(r.sector), r.title, r.conclusion, (r.evidence || []).map(e => e.text).join('\n'), r.boundary] : [r.published, r.title, M.sectorIds(r).map(labels).join(' / '), r.company, r.content, r.url, r.file, r.truncated ? '预览，正文未完整读取' : r.library ? L.states[r.library.processing?.status] : r.state]);
    const cell = v => { const value = String(v ?? ''); return '"' + (/^[\s]*[=+@]/.test(value) || /^[\s]*-(?!\d+(?:\.\d+)?\s*$)/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"'; };
    api.download('国金商社-' + KINDS.find(([k]) => k === kind)[1] + '.csv', '\uFEFF' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  }
  async function onClick(event) {
    const kindButton = event.target.closest('[data-kind]');
    if (kindButton) { kind = kindButton.dataset.kind; page = 1; notice(''); renderResults(); return; }
    const recordButton = event.target.closest('[data-record]'); if (recordButton) { await openRecord(filtered[Number(recordButton.dataset.record)]); return; }
    const b = event.target.closest('[data-action]'); if (!b) return;
    if (b.dataset.action === 'reload') { await renderResearch(container, api); return; }
    if (b.dataset.action === 'reset') { Object.assign(filter, { q: '', sector: '', from: '', to: '', format: '', state: '', scope: 'archived', sort: 'desc' }); for (const field of container.querySelectorAll('[data-filter]')) field.value = filter[field.dataset.filter]; page = 1; notice(''); renderResults(); }
    else if (b.dataset.action === 'prev' || b.dataset.action === 'next') { page += b.dataset.action === 'prev' ? -1 : 1; renderResults(); }
    else if (b.dataset.action === 'export') exportRows();
    else if (['recent', 'history'].includes(b.dataset.action) && !loading) {
      loading = true; b.disabled = true; const old = b.textContent; b.textContent = '正在读取…';
      try { if (b.dataset.action === 'recent') await loadRecent(); else await loadHistory(); page = 1; notice(''); renderResults(); }
      catch { notice('资料读取失败，当前列表仍可浏览。请重试。', true); }
      finally { loading = false; b.disabled = false; b.textContent = old; }
    }
  }
  try {
    const results = await Promise.allSettled([json('data/research/recent-preview.json'), json('data/research/updates/manifest.json'), json('data/research/market-briefs.json'), json('data/research/library.json'), json('data/research/work-minutes.json'), json('data-manifest.json')]);
    if ([0, 2, 3, 4].every(i => results[i].status !== 'fulfilled')) throw Error('研究来源读取失败');
    const get = i => results[i].status === 'fulfilled' ? results[i].value : null;
    recentMeta = get(0) || {}; sync = get(1) || {}; briefs = get(2)?.briefs || []; manifest = get(5) || {};
    entries = uniqueResearchRecords(recentEntries(recentMeta));
    const records = new Map((get(3)?.records || []).map(r => [r.id, r])); for (const r of get(4)?.records || []) records.set(r.id, r);
    library = { ...(get(3) || {}), records: [...records.values()] };
    entries = L.mergeEntries(entries, library.records.flatMap(L.entries), M.topic);
    renderControls(); renderResults();
    const missing = []; if (!get(0)) missing.push('近期观点'); if (!get(2)) missing.push('观点摘要'); if (!get(3) || !get(4)) missing.push('部分纪要索引'); if (!get(1)) missing.push('完整原文索引');
    if (missing.length) notice(missing.join('、') + '读取失败，已加载资料仍可浏览。', true, true);
    if (params.get('topic') || params.get('record') || params.get('asset')) {
      const find = () => entries.find(r => r.kind === kind && (params.get('topic') ? (r.library?.sourceTopics || [M.topic(r)]).includes(params.get('topic')) : !params.get('record') || [r.title, ...(r.legacyTitles || [])].includes(params.get('record'))) && (!params.get('file') || r.file === params.get('file') || params.get('file').split('；').includes(r.file)) && (!params.get('asset') || [r.id, ...(r.library?.aliases || [])].includes(params.get('asset'))));
      let record = find(); if (!record && kind !== 'minutes') { try { notice('正在查找历史观点…'); await loadHistory(); record = find(); renderResults(); notice(''); } catch { notice('历史观点读取失败，请重试。', true); } }
      if (record) await openRecord(record); else notice('未找到这条资料，可通过标题或公司搜索。', true);
    }
  } catch {
    container.innerHTML = '<div class="card"><div class="empty"><p class="empty-title">研究文库读取失败</p><p class="empty-subtitle text-secondary">请重试加载。</p><div class="empty-action"><button type="button" class="btn btn-primary" data-retry>重新加载</button></div></div></div>';
    container.querySelector('[data-retry]').addEventListener('click', () => renderResearch(container, api), { once: true });
  }
}
