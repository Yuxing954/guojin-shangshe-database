// Market and disclosure views use the original quote and calendar models with native Tabler components.
const beijingToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const clock = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '时间未登记';
const benchmarks = [{ code: '000001.SH', name: '上证指数', index: true }, { code: '399006.SZ', name: '创业板指', index: true }, { code: '000688.SH', name: '科创50', index: true }, { code: 'HSI.HI', name: '恒生指数', index: true }];

export function requestQuotes(codes, signal, M, K) {
  return new Promise((resolve, reject) => {
    const mapping = codes.map(code => [code, K.quoteCode(code)]).filter(([, q]) => /^(?:sh\d{6}|sz\d{6}|bj\d{6}|hk(?:\d{5}|HSI)|us[A-Z][A-Z0-9.-]*)$/.test(q));
    if (!mapping.length) { resolve({}); return; }
    const tag = document.createElement('script'); let done = false, timer;
    const cleanup = () => { signal?.removeEventListener('abort', abort); clearTimeout(timer); tag.onload = tag.onerror = null; tag.remove(); for (const [, q] of mapping) { try { delete window['v_' + q]; } catch { window['v_' + q] = undefined; } } };
    const finish = (error, value) => { if (done) return; done = true; cleanup(); error ? reject(error) : resolve(value); };
    const abort = () => finish(new DOMException('已取消报价读取', 'AbortError'));
    for (const [, q] of mapping) { try { delete window['v_' + q]; } catch { window['v_' + q] = undefined; } }
    timer = setTimeout(() => finish(Error('报价连接超时')), 12000);
    tag.charset = 'gbk'; tag.src = 'https://qt.gtimg.cn/q=' + mapping.map(([, q]) => q).join(',') + '&_=' + Date.now();
    tag.onload = () => { const result = {}, retrievedAt = new Date().toISOString(); for (const [code, q] of mapping) { const value = M.parse(window['v_' + q], code, retrievedAt); if (value) result[code] = value; } finish(null, result); };
    tag.onerror = () => finish(Error('腾讯行情连接失败'));
    if (signal?.aborted) { abort(); return; } signal?.addEventListener('abort', abort, { once: true }); document.head.append(tag);
  });
}
function requestChart(url, signal) {
  return new Promise((resolve, reject) => {
    const name = '__tabler_chart_' + Date.now() + '_' + Math.floor(Math.random() * 1e6), script = document.createElement('script'); let done = false, timer;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); script.onload = script.onerror = null; script.remove(); try { delete window[name]; } catch { window[name] = undefined; } };
    const finish = (error, value) => { if (done) return; done = true; cleanup(); error ? reject(error) : resolve(value); };
    const abort = () => finish(new DOMException('已取消走势读取', 'AbortError'));
    timer = setTimeout(() => finish(Error('走势连接超时')), 15000);
    script.charset = 'gbk'; script.src = url + '&_var=' + name + '&r=' + Date.now();
    script.onload = () => { const result = window[name]; finish(result?.data ? null : Error('来源未返回有效走势'), result); };
    script.onerror = () => finish(Error('走势连接失败'));
    if (signal?.aborted) { abort(); return; } signal?.addEventListener('abort', abort, { once: true }); document.head.append(script);
  });
}

export async function renderQuotes(container, api) {
  if (location.hash === '#gold' || new URLSearchParams(location.search).get('panel') === 'gold') return renderGoldQuotes(container, api);
  const { esc, num, json, text, parseCSV, setHeader } = api, M = globalThis.QuotesModel, K = globalThis.SinolinkKline, P = globalThis.QuotesPoller;
  const params = new URLSearchParams(location.search), $ = s => container.querySelector(s);
  let companies = [], quotes = {}, selected = null, filtered = [], page = 1, pageSize = 25, historyRows = [], historyFailed = false, mode = params.get('source') === 'weekly' ? 'weekly' : 'quotes';
  let period = ['day', 'week', 'minute'].includes(params.get('period')) ? params.get('period') : 'day', automatic = true, active = true, poller, failure = false, lastRead = '', chartController = null, chartGeneration = 0, chartRows = [], chartInfo = '';
  const filter = { q: params.get('q') || '', market: params.get('market') || '', sector: params.get('sector') || '', sort: params.get('sort') || 'change-desc' };
  const tone = value => value > 0 ? 'text-red' : value < 0 ? 'text-green' : 'text-secondary';
  const signed = value => value == null || !Number.isFinite(Number(value)) ? '—' : (value > 0 ? '+' : '') + num(value, 2) + '%';
  setHeader({ title: '市场行情', pretitle: 'MARKET WATCH', actions: '<a class="btn" href="quotes.html?panel=gold#gold">伦敦金现</a><a class="btn" href="earnings.html">' + api.icon('calendar') + '财报日历</a>' });
  api.loading(container, '正在读取覆盖公司');
  if (!M || !K || !P) { api.failure(container, Error('行情模块未加载'), () => location.reload()); return; }
  const readLocal = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  function saveURL() { const p = new URLSearchParams(); for (const [key, v] of Object.entries(filter)) if (v && !(key === 'sort' && v === 'change-desc')) p.set(key, v); if (mode === 'weekly') p.set('source', mode); if (selected) p.set('symbol', selected.code); if (period !== 'day') p.set('period', period); history.replaceState(null, '', location.pathname + (p.size ? '?' + p : '')); }
  function status() { if (!$('#quote-status')) return; $('#quote-status').textContent = mode === 'weekly' ? historyFailed ? '历史周行情读取失败，可重新读取快照' : '历史周行情 · 按记录数据日期展示' : '腾讯来源报价（可能延迟） · ' + (failure ? '读取异常，保留已取得报价' : !automatic || document.hidden ? '自动读取已暂停' : '自动读取') + (lastRead ? ' · 最近读取 ' + clock(lastRead) + ' 北京时间' : ''); }
  function body() {
    container.innerHTML = '<div class="card mb-3"><div class="card-header"><ul class="nav nav-tabs card-header-tabs"><li class="nav-item"><button class="nav-link' + (mode === 'quotes' ? ' active' : '') + '" type="button" data-mode="quotes">来源行情</button></li><li class="nav-item"><button class="nav-link' + (mode === 'weekly' ? ' active' : '') + '" type="button" data-mode="weekly">历史周行情</button></li></ul></div><div class="card-body"><div class="row g-3 align-items-end"><div class="col-12 col-md-4"><label class="form-label" for="quote-query">公司 / 代码</label><input class="form-control" type="search" id="quote-query" data-quote-filter="q" placeholder="搜索覆盖公司" value="' + esc(filter.q) + '"></div><div class="col-6 col-md-3"><label class="form-label" for="quote-sector">行业</label><select class="form-select" id="quote-sector" data-quote-filter="sector">' + api.options([['', '全部行业'], ...new Set(companies.map(c => c.sector))], filter.sector) + '</select></div><div class="col-6 col-md-2"><label class="form-label" for="quote-market">市场</label><select class="form-select" id="quote-market" data-quote-filter="market">' + api.options([['', '全部市场'], ['CN', 'A股'], ['HK', '港股'], ['US', '美股']], filter.market) + '</select></div><div class="col-12 col-md-3"><label class="form-label" for="quote-sort">排序</label><select class="form-select" id="quote-sort" data-quote-filter="sort">' + api.options([['change-desc', '涨幅从高到低'], ['change-asc', '涨幅从低到高'], ['name', '公司名称']], filter.sort) + '</select></div></div><div class="d-flex align-items-center flex-wrap gap-3 mt-3"><div class="small text-secondary" id="quote-status" role="status"></div><div class="btn-list ms-auto"><button type="button" class="btn btn-sm" data-quote-action="pause">暂停自动读取</button><button type="button" class="btn btn-sm" data-quote-action="refresh">刷新行情</button><button type="button" class="btn btn-sm" data-quote-action="export">导出当前列表</button></div></div></div></div><div id="quote-benchmarks" class="row row-deck row-cards mb-3"></div><div class="row row-deck row-cards"><div class="col-12 col-xl-7"><div class="card"><div class="card-header"><h3 class="card-title">覆盖公司</h3><span class="small text-secondary ms-auto" id="quote-count"></span></div><div class="table-responsive"><table class="table card-table table-vcenter"><thead><tr><th>公司</th><th class="text-end">价格</th><th class="text-end" id="quote-change-heading">涨跌幅</th><th class="text-nowrap">来源时点</th></tr></thead><tbody id="quote-rows"></tbody></table></div><div class="card-footer d-flex align-items-center gap-3"><span class="small text-secondary" id="quote-page"></span><div class="btn-list ms-auto"><button class="btn btn-sm" data-quote-action="prev">上一页</button><button class="btn btn-sm" data-quote-action="next">下一页</button></div></div></div></div><div class="col-12 col-xl-5"><div class="card"><div class="card-header"><div><h3 class="card-title" id="quote-selected">选择公司</h3><div class="small text-secondary mt-1" id="quote-identity"></div></div><button class="btn btn-sm ms-auto" data-quote-action="source">来源</button></div><div class="card-body"><div id="quote-overview"></div><div class="btn-group w-100 mt-3" role="group" aria-label="走势图周期"><button class="btn btn-sm" type="button" data-period="minute">分时</button><button class="btn btn-sm" type="button" data-period="day">日线</button><button class="btn btn-sm" type="button" data-period="week">周线</button></div><div id="quote-chart" class="mt-3"></div><div class="small text-secondary mt-2" id="quote-chart-note" role="status"></div><div class="btn-list mt-3"><button type="button" class="btn btn-sm" data-quote-action="chart-refresh">刷新走势</button><button type="button" class="btn btn-sm" data-quote-action="chart-export">导出走势</button><a class="btn btn-sm" id="quote-research" href="research.html?kind=all_views">相关研究</a></div></div></div></div></div>';
    for (const node of container.querySelectorAll('[data-quote-filter]')) node.addEventListener(node.tagName === 'INPUT' ? 'input' : 'change', () => { filter[node.dataset.quoteFilter] = node.value; page = 1; renderTable(); saveURL(); });
    container.addEventListener('click', onClick); renderTable(); renderBenchmarks(); status();
  }
  const historicalQuotes = () => Object.fromEntries(historyRows.map(r => [r['证券代码'], { price: api.numeric(r['最新收盘价']), percent: api.numeric(r['周涨跌幅%']), asOf: String(r['数据日期'] || '').slice(0, 10), previousClose: api.numeric(r['上周收盘价']), change: api.numeric(r['周涨跌额']) }]));
  function displayQuotes() { return mode === 'weekly' ? historicalQuotes() : quotes; }
  function renderBenchmarks() {
    $('#quote-benchmarks').hidden = mode === 'weekly';
    if (mode === 'weekly') return;
    $('#quote-benchmarks').innerHTML = benchmarks.map(c => { const q = quotes[c.code]; return '<div class="col-6 col-md-3"><button class="card card-sm text-start w-100" type="button" data-symbol="' + c.code + '"><div class="card-body w-100"><div class="subheader">' + c.name + '</div><div class="d-flex justify-content-between align-items-baseline gap-2 mt-2"><div class="h2 mb-0">' + num(q?.price) + '</div><span class="' + tone(q?.percent) + '">' + signed(q?.percent) + '</span></div><div class="small text-secondary mt-2">' + esc(q?.asOf || '暂无报价') + '</div></div></button></div>'; }).join('');
  }
  function renderTable() {
    const current = displayQuotes(); filtered = M.filter(companies, current, filter); const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); page = Math.min(page, pages);
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize), breadth = M.breadth(filtered, current);
    $('#quote-count').textContent = filtered.length + ' 家 · ' + breadth.valid + ' 家有数据';
    $('#quote-change-heading').textContent = mode === 'weekly' ? '周涨跌幅' : '涨跌幅';
    $('#quote-page').textContent = page + ' / ' + pages + ' 页'; $('[data-quote-action="prev"]').disabled = page <= 1; $('[data-quote-action="next"]').disabled = page >= pages;
    $('[data-quote-action="pause"]').hidden = mode === 'weekly'; $('[data-quote-action="refresh"]').textContent = mode === 'weekly' ? '重新读取快照' : '刷新行情';
    $('#quote-rows').innerHTML = visible.map(c => { const q = current[c.code], meta = M.markets[M.market(c.code)]; return '<tr' + (selected?.code === c.code ? ' class="table-active"' : '') + '><td><button class="btn btn-link p-0 text-start fw-semibold" type="button" data-symbol="' + esc(c.code) + '">' + esc(c.name) + '</button><div class="small text-secondary">' + esc(c.code) + ' · ' + esc(c.sector) + '</div></td><td class="text-end text-nowrap">' + num(q?.price, meta.currency === 'HKD' ? 3 : 2) + '<div class="small text-secondary">' + meta.currency + '</div></td><td class="text-end text-nowrap ' + tone(q?.percent) + '">' + signed(q?.percent) + '</td><td class="small text-nowrap">' + esc(q?.asOf || '—') + '<div class="text-secondary">' + esc(mode === 'weekly' ? q ? '历史收盘快照' : '未登记' : q ? q.cached ? '本设备上次报价' : M.state(q) : '暂无报价') + '</div></td></tr>'; }).join('') || '<tr><td colspan="4" class="text-center text-secondary py-5">暂无匹配公司</td></tr>';
    if (selected) renderSelected(); status();
  }
  function renderSelected() {
    const c = selected, q = displayQuotes()[c.code], market = M.markets[M.market(c.code)];
    $('#quote-selected').textContent = c.name; $('#quote-identity').textContent = c.code + ' · ' + market.label + ' · ' + (c.index ? '点' : market.currency);
    $('#quote-overview').innerHTML = '<div class="d-flex align-items-baseline flex-wrap gap-3"><div class="h1 mb-0">' + num(q?.price, market.currency === 'HKD' ? 3 : 2) + '</div><span class="h3 mb-0 ' + tone(q?.percent) + '">' + signed(q?.percent) + '</span></div><div class="small text-secondary mt-2">' + esc(q?.asOf || '暂无来源报价') + ' · ' + esc(mode === 'weekly' ? '历史周行情' : market.timeLabel) + '</div><div class="row mt-3 g-3">' + [[mode === 'weekly' ? '上周收盘' : '前收', q?.previousClose], ['开盘', q?.open], ['最高', q?.high], ['最低', q?.low]].map(([label, value]) => '<div class="col-6"><span class="text-secondary small">' + label + '</span><span class="float-end">' + num(value) + '</span></div>').join('') + '</div>';
    $('#quote-research').href = 'research.html?kind=all_views&q=' + encodeURIComponent(M.researchKeyword(c));
  }
  async function select(code) { const company = companies.concat(benchmarks).find(c => c.code === code); if (!company) return; selected = company; chartRows = []; chartInfo = ''; renderTable(); saveURL(); await loadChart(); }
  async function loadChart() {
    if (!selected) return; chartController?.abort(); const controller = new AbortController(); chartController = controller; const generation = ++chartGeneration, company = selected;
    chartRows = []; $('[data-quote-action="chart-export"]').disabled = true;
    for (const b of container.querySelectorAll('[data-period]')) { b.classList.toggle('btn-primary', b.dataset.period === period); b.setAttribute('aria-pressed', String(b.dataset.period === period)); }
    if (mode === 'weekly') { $('#quote-chart').innerHTML = api.empty('该快照不包含历史走势'); $('#quote-chart-note').textContent = '数据日期见价格旁标注'; return; }
    $('#quote-chart').innerHTML = '<div class="py-5 text-center text-secondary"><span class="spinner-border spinner-border-sm me-2"></span>正在读取来源走势…</div>'; $('#quote-chart-note').textContent = '';
    try {
      const provider = quotes[company.code]?.providerCode, sourceCode = K.chartCode(company.code, provider), link = K.chartUrl(company.code, period, provider, 100, company.index);
      const payload = await requestChart(link, controller.signal);
      if (generation !== chartGeneration || company !== selected) return;
      const rows = period === 'minute' ? M.intraday(K.normalize(payload, 'm1', sourceCode), company.code) : M.candles(K.normalize(payload, period, sourceCode));
      if (rows.length < 2) throw Error('来源未返回足够的有效走势');
      chartRows = rows; const adjustment = M.adjustment(payload, sourceCode, period, company.index);
      chartInfo = (period === 'minute' ? '最近交易日分时' : adjustment + (period === 'day' ? ' · 日收盘' : ' · 周收盘')) + ' · ' + (company.index ? '点' : M.markets[M.market(company.code)].currency);
      const label = value => /^\d{12}$/.test(String(value)) ? value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6, 8) + ' ' + value.slice(8, 10) + ':' + value.slice(10, 12) : value;
      api.chart($('#quote-chart'), rows.map(r => ({ period: label(r[0]), value: Number(r[2]) })), { label: company.name + ' · ' + chartInfo, unit: company.index ? '点' : M.markets[M.market(company.code)].currency });
      $('#quote-chart-note').textContent = chartInfo + ' · ' + label(rows[0][0]) + ' — ' + label(rows.at(-1)[0]); $('[data-quote-action="chart-export"]').disabled = false;
    } catch (error) { if (controller.signal.aborted || generation !== chartGeneration) return; $('#quote-chart').innerHTML = api.empty('来源走势暂不可用'); $('#quote-chart-note').textContent = error.message; }
  }
  async function refresh(signal) {
    const all = companies.concat(benchmarks), incoming = await requestQuotes(all.map(c => c.code), signal, M, K).catch(error => { if (signal.aborted) throw error; return {}; });
    if (signal.aborted || !active) return false;
    failure = Object.keys(incoming).length < all.length;
    for (const c of all) { if (incoming[c.code]) quotes[c.code] = { ...M.accept(quotes[c.code], incoming[c.code]), cached: false }; else if (quotes[c.code]) quotes[c.code] = { ...quotes[c.code], failed: true }; }
    if (Object.keys(incoming).length) { lastRead = new Date().toISOString(); try { localStorage.setItem('sinolink.quotes.snapshot.v1', JSON.stringify({ at: Date.now(), quotes })); } catch { /* Quotation remains available without browser storage. */ } }
    renderTable(); renderBenchmarks(); status(); return !failure;
  }
  async function onClick(event) {
    const symbol = event.target.closest('[data-symbol]'); if (symbol) { await select(symbol.dataset.symbol); return; }
    const modeButton = event.target.closest('[data-mode]'); if (modeButton) { mode = modeButton.dataset.mode; for (const b of container.querySelectorAll('[data-mode]')) b.classList.toggle('active', b.dataset.mode === mode); page = 1; poller?.sync(); renderTable(); renderBenchmarks(); await loadChart(); saveURL(); return; }
    const p = event.target.closest('[data-period]'); if (p) { period = p.dataset.period; saveURL(); await loadChart(); return; }
    const b = event.target.closest('[data-quote-action]'); if (!b) return;
    const action = b.dataset.quoteAction;
    if (action === 'prev' || action === 'next') { page += action === 'prev' ? -1 : 1; renderTable(); }
    if (action === 'pause') { automatic = !automatic; b.textContent = automatic ? '暂停自动读取' : '恢复自动读取'; poller.sync(); status(); }
    if (action === 'refresh') { if (mode === 'weekly') { b.disabled = true; try { historyRows = parseCSV(await text('data/商社-覆盖标的本周行情.csv')); historyFailed = false; } catch { historyFailed = true; } finally { b.disabled = false; renderTable(); } } else if (!automatic) { b.disabled = true; try { await refresh(new AbortController().signal); } finally { b.disabled = false; } } else await poller.check(); }
    if (action === 'chart-refresh') await loadChart();
    if (action === 'export') {
      if (mode === 'weekly') { const allowed = new Set(filtered.map(c => c.code)); api.download('历史周行情.csv', api.csv(historyRows.filter(r => allowed.has(r['证券代码'])))); }
      else api.download('来源行情-' + beijingToday() + '.csv', M.csv(filtered, quotes));
    }
    if (action === 'chart-export' && chartRows.length) api.download((selected?.name || '证券') + '-' + period + '.csv', api.csv(chartRows.map(r => ({ '日期': r[0], '开盘': r[1], '收盘/价格': r[2], '最高': r[3], '最低': r[4], '成交量（原单位）': r[5], '价格币种': M.markets[M.market(selected.code)].currency, '口径': chartInfo, '来源': '腾讯行情' }))));
    if (action === 'source') api.sourceDialog('行情来源', mode === 'weekly' ? [{ name: '覆盖标的历史周行情', file: 'data/商社-覆盖标的本周行情.csv', note: '价格与周涨跌幅保留各记录数据日期；不是当前报价' }] : [{ name: '腾讯行情', url: 'https://qt.gtimg.cn/q=' + K.quoteCode(selected?.code || companies[0].code), note: '第三方来源报价，可能延迟；报价时间使用来源字段，读取时间单独显示', sourceTime: quotes[selected?.code]?.asOf || '', retrievedAt: quotes[selected?.code]?.retrievedAt || '' }]);
  }
  try {
    const directory = await json('data/coverage-companies.json'); companies = M.directory(directory);
    try { historyRows = parseCSV(await text('data/商社-覆盖标的本周行情.csv')); } catch { historyFailed = true; }
    const saved = readLocal('sinolink.quotes.snapshot.v1'), allowed = new Set(companies.concat(benchmarks).map(c => c.code));
    if (saved?.quotes && Number.isFinite(saved.at) && Date.now() - saved.at < 86400000) for (const [code, q] of Object.entries(saved.quotes)) if (allowed.has(code) && q.code === code && Number.isFinite(q.price) && q.price > 0 && M.timestamp(q.asOf)) quotes[code] = { ...q, cached: true };
    body();
    selected = companies.concat(benchmarks).find(c => c.code === params.get('symbol')) || companies.find(c => c.name.includes('华住')) || companies[0]; renderSelected(); saveURL(); loadChart();
    poller = P.create({ request: refresh, isActive: () => active && automatic && mode === 'quotes' && !document.hidden, onTick: status }); poller.sync();
    const visibility = () => { poller.sync(); if (document.hidden) chartController?.abort(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', () => { active = false; poller.pause(); chartController?.abort(); }, { once: true });
    window.addEventListener('pageshow', () => { active = true; poller.resume(); });
  } catch (error) { api.failure(container, error, () => renderQuotes(container, api)); }
}

async function renderGoldQuotes(container, api) {
  let interval = 'D', timer, observer, generation = 0;
  const source = 'https://www.tradingview.com/symbols/XAUUSD/?exchange=OANDA';
  api.setHeader({ title: '伦敦金现', pretitle: 'GOLD MARKET', actions: '<a class="btn" href="quotes.html">股票行情</a>' });
  container.innerHTML = '<div class="card"><div class="card-header"><div><h3 class="card-title">XAU / USD</h3><div class="text-secondary small mt-1">TradingView / OANDA · 美元 / 金衡盎司</div></div><div class="btn-group ms-auto" aria-label="金价周期"><button class="btn btn-sm btn-primary" data-gold-period="D">日线</button><button class="btn btn-sm" data-gold-period="W">周线</button><button class="btn btn-sm" data-gold-period="M">月线</button></div></div><div class="card-body"><div class="text-secondary small mb-3" id="gold-status" role="status"></div><div id="gold-chart" style="height:520px"></div></div><div class="card-footer d-flex align-items-center gap-3"><a class="btn btn-sm" href="' + source + '" target="_blank" rel="noopener noreferrer">打开原始图表</a><button class="btn btn-sm" type="button" id="gold-retry">重新连接</button><span class="small text-secondary ms-auto">报价时点与交易品种按来源显示</span></div></div>';
  const dispose = () => { generation++; clearTimeout(timer); observer?.disconnect(); container.querySelector('#gold-chart')?.replaceChildren(); };
  const load = () => {
    dispose(); const request = generation, host = container.querySelector('#gold-chart'), status = container.querySelector('#gold-status');
    status.textContent = '正在连接来源图表…';
    const wrap = document.createElement('div'); wrap.className = 'tradingview-widget-container'; wrap.style.height = '100%';
    const widget = document.createElement('div'); widget.className = 'tradingview-widget-container__widget'; widget.style.height = '100%'; wrap.append(widget); host.append(wrap);
    observer = new MutationObserver(() => { const frame = wrap.querySelector('iframe'); if (frame && request === generation) { frame.title = '伦敦金现 · TradingView / OANDA'; clearTimeout(timer); status.textContent = '来源图表 · TradingView / OANDA'; } }); observer.observe(wrap, { childList: true, subtree: true });
    const script = document.createElement('script'); script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'; script.async = true;
    script.textContent = JSON.stringify({ autosize: true, symbol: 'OANDA:XAUUSD', interval, timezone: 'Asia/Shanghai', theme: document.documentElement.dataset.bsTheme === 'dark' ? 'dark' : 'light', style: '1', locale: 'zh_CN', hide_side_toolbar: true, hide_volume: true, allow_symbol_change: false, save_image: false, calendar: false, support_host: 'https://www.tradingview.com' });
    const failed = () => { if (request === generation) status.textContent = '来源图表连接失败，请重试或打开原始图表。'; };
    script.onerror = failed; wrap.append(script); timer = setTimeout(failed, 20000);
  };
  container.querySelector('#gold-retry').addEventListener('click', load);
  container.addEventListener('click', event => { const button = event.target.closest('[data-gold-period]'); if (!button) return; interval = button.dataset.goldPeriod; for (const b of container.querySelectorAll('[data-gold-period]')) b.classList.toggle('btn-primary', b === button); load(); });
  window.addEventListener('pagehide', dispose, { once: true }); load();
}

export async function renderCalendar(container, api) {
  const { esc, json, setHeader } = api, M = globalThis.EarningsCalendar, I = globalThis.ImportantCalendar;
  const params = new URLSearchParams(location.search), $ = s => container.querySelector(s), today = beijingToday();
  let tab = params.get('tab') === 'important' ? 'important' : 'earnings', view = params.get('view') === 'month' ? 'month' : 'list';
  let month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : M?.validDate(params.get('date')) ? params.get('date').slice(0, 7) : today.slice(0, 7), page = 1, pageSize = 25;
  let pool = [], snapshot = null, important = null, all = [], filtered = [], visible = [], loadedArchive = false;
  const filter = { search: params.get('q') || '', sector: params.get('sector') || '', market: params.get('market') || '', status: params.get('status') || '' };
  const periodName = r => r.period?.slice(0, 4) + ' ' + (M.TYPES[M.reportType(r.period || '')] || r.period || '');
  setHeader({ title: '财报与重要日程', pretitle: 'RESEARCH CALENDAR', actions: '<a class="btn" href="quotes.html">' + api.icon('trend') + '市场行情</a>' });
  api.loading(container, '正在读取披露日程');
  if (!M || !I) { api.failure(container, Error('日历分类模块加载失败'), () => location.reload()); return; }
  function save() { const p = new URLSearchParams(); if (tab === 'important') p.set('tab', tab); if (view !== 'list') p.set('view', view); if (month !== today.slice(0, 7)) p.set('month', month); for (const [k, v] of Object.entries(filter)) if (v) p.set(k === 'search' ? 'q' : k, v); history.replaceState(null, '', location.pathname + (p.size ? '?' + p : '')); }
  function shell() {
    container.innerHTML = '<div id="calendar-status" role="status" aria-live="polite"></div><div class="card mb-3"><div class="card-header"><ul class="nav nav-tabs card-header-tabs"><li class="nav-item"><button class="nav-link' + (tab === 'earnings' ? ' active' : '') + '" data-calendar-tab="earnings">财报日历</button></li><li class="nav-item"><button class="nav-link' + (tab === 'important' ? ' active' : '') + '" data-calendar-tab="important">重要数据日程</button></li></ul></div><div class="card-body"><div class="row g-3 align-items-end"><div class="col-12 col-md-4"><label class="form-label" for="calendar-query">公司 / 关键词</label><input id="calendar-query" class="form-control" type="search" data-calendar-filter="search" value="' + esc(filter.search) + '" placeholder="公司、代码、报告期"></div><div class="col-6 col-md-3" data-earnings-filter><label class="form-label" for="calendar-sector">行业</label><select id="calendar-sector" class="form-select" data-calendar-filter="sector">' + api.options([['', '全部行业'], ...new Set(pool.map(r => r.sector))], filter.sector) + '</select></div><div class="col-6 col-md-2" data-earnings-filter><label class="form-label" for="calendar-market">市场</label><select id="calendar-market" class="form-select" data-calendar-filter="market">' + api.options([['', '全部市场'], 'A股', '港股', '美股'], filter.market) + '</select></div><div class="col-12 col-md-3"><label class="form-label" for="calendar-month">月份</label><input id="calendar-month" class="form-control" type="month" value="' + month + '"></div></div><div class="d-flex align-items-center flex-wrap gap-3 mt-3"><div class="btn-group" role="group" aria-label="日历视图"><button class="btn btn-sm" data-calendar-view="list">列表</button><button class="btn btn-sm" data-calendar-view="month">月历</button></div><div class="small text-secondary" id="calendar-source-time"></div><div class="btn-list ms-auto"><button class="btn btn-sm" data-calendar-action="archive">加载披露历史</button><button class="btn btn-sm" data-calendar-action="csv">导出 CSV</button><button class="btn btn-sm" data-calendar-action="ics">下载日历</button></div></div></div></div><div id="calendar-content"></div>';
    for (const field of container.querySelectorAll('[data-calendar-filter]')) field.addEventListener(field.tagName === 'INPUT' ? 'input' : 'change', () => { filter[field.dataset.calendarFilter] = field.value; page = 1; render(); });
    $('#calendar-month').addEventListener('change', event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) { month = event.target.value; page = 1; render(); } });
    container.addEventListener('click', onClick); render();
  }
  function alert(message) { $('#calendar-status').innerHTML = message ? '<div class="alert alert-warning">' + esc(message) + '</div>' : ''; }
  function selectedEvents() {
    if (tab === 'important') return important ? I.select(important, { month }).filter(e => !filter.search || [e.title, e.period, e.region, e.focus].join(' ').toLowerCase().includes(filter.search.toLowerCase())) : [];
    filtered = M.filter(all, { ...filter, today });
    return M.eventsFor(filtered).filter(e => e.date.startsWith(month));
  }
  function recordButton(e) { return '<button class="btn btn-sm btn-link text-wrap text-start p-0" type="button" data-calendar-record="' + esc(e.id) + '">' + esc(tab === 'important' ? e.title : e.name) + '</button>'; }
  function render() {
    for (const b of container.querySelectorAll('[data-calendar-tab]')) b.classList.toggle('active', b.dataset.calendarTab === tab);
    for (const b of container.querySelectorAll('[data-calendar-view]')) b.classList.toggle('btn-primary', b.dataset.calendarView === view);
    for (const field of container.querySelectorAll('[data-earnings-filter]')) field.hidden = tab !== 'earnings';
    $('[data-calendar-action="archive"]').hidden = tab !== 'earnings' || loadedArchive;
    $('#calendar-source-time').textContent = tab === 'earnings' ? 'Choice MCP · 数据更新 ' + clock(snapshot.updatedAt) + ' 北京时间' : important ? '官方日程 · 核验 ' + important.checkedAt : '';
    if (tab === 'important' && !important) { $('#calendar-content').innerHTML = '<div class="card"><div class="card-body text-secondary">正在读取重要日程…</div></div>'; return; }
    const events = selectedEvents();
    if (view === 'month') {
      const [year, nmonth] = month.split('-').map(Number), days = M.monthDays(year, nmonth - 1);
      $('#calendar-content').innerHTML = '<div class="card"><div class="card-header"><h3 class="card-title">' + esc(month) + '</h3><span class="badge bg-blue-lt ms-2">' + events.length + ' 项</span><div class="btn-list ms-auto"><button class="btn btn-sm" data-calendar-action="month-prev">上月</button><button class="btn btn-sm" data-calendar-action="today">本月</button><button class="btn btn-sm" data-calendar-action="month-next">下月</button></div></div><div class="table-responsive"><table class="table card-table table-bordered table-vcenter" style="min-width:840px;table-layout:fixed"><thead><tr>' + ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(d => '<th class="text-center">' + d + '</th>').join('') + '</tr></thead><tbody>' + Array.from({ length: 6 }, (_, week) => '<tr>' + days.slice(week * 7, week * 7 + 7).map(day => {
        const records = events.filter(r => (r.beijingDate || r.date) === day);
        return '<td class="align-top' + (day.slice(0, 7) !== month ? ' bg-secondary-lt' : '') + '" style="height:120px"><div class="mb-2' + (day === today ? ' text-primary fw-bold' : ' text-secondary') + '">' + Number(day.slice(8)) + '</div>' + records.slice(0, 3).map(r => '<div class="small mb-2">' + recordButton(r) + '<div class="text-secondary">' + esc(tab === 'important' ? r.beijingTime : r.dateLabel) + '</div></div>').join('') + (records.length > 3 ? '<button class="btn btn-link btn-sm p-0" data-calendar-day="' + day + '">另 ' + (records.length - 3) + ' 项</button>' : '') + '</td>';
      }).join('') + '</tr>').join('') + '</tbody></table></div></div>';
      visible = events;
    } else {
      visible = tab === 'important' ? events : (loadedArchive ? filtered : events).slice().sort((a, b) => (b.actual || b.expected || b.announcementDate || b.date || '').localeCompare(a.actual || a.expected || a.announcementDate || a.date || ''));
      const pages = Math.max(1, Math.ceil(visible.length / pageSize)); page = Math.min(page, pages); const rows = visible.slice((page - 1) * pageSize, page * pageSize);
      $('#calendar-content').innerHTML = '<div class="card"><div class="card-header"><h3 class="card-title">' + (tab === 'important' ? '重要数据发布' : loadedArchive ? '披露历史' : month + ' 披露安排') + '</h3><span class="badge bg-blue-lt ms-auto">' + visible.length + ' 项</span></div><div class="table-responsive"><table class="table card-table table-vcenter"><thead><tr>' + (tab === 'important' ? '<th>数据</th><th>统计期间</th><th>北京时间</th><th>地区</th><th>来源</th>' : '<th>公司</th><th>报告期</th><th>实际披露日</th><th>预计披露日</th><th>状态</th><th>来源</th>') + '</tr></thead><tbody>' + rows.map(r => tab === 'important' ? '<tr><td>' + recordButton(r) + '</td><td>' + esc(r.period) + '</td><td class="text-nowrap">' + esc(r.beijingDate + ' ' + r.beijingTime) + '</td><td>' + esc(r.region) + '</td><td><a target="_blank" rel="noopener noreferrer" href="' + esc(r.sourceUrl) + '">官方日程</a></td></tr>' : '<tr><td>' + recordButton(r) + '<div class="small text-secondary">' + esc(r.code) + ' · ' + esc(r.sector) + '</div></td><td class="text-nowrap">' + esc(periodName(r)) + '<div class="small text-secondary">' + esc(M.KINDS[r.kind]) + '</div></td><td class="text-nowrap">' + esc(r.actual || '—') + '</td><td class="text-nowrap">' + esc(r.expected || '—') + '</td><td class="text-nowrap"><span class="badge ' + (r.actual ? 'bg-green-lt' : 'bg-secondary-lt') + '">' + esc(M.status(r, today)) + '</span></td><td><button class="btn btn-link btn-sm p-0" data-calendar-record="' + esc(r.id) + '">来源</button></td></tr>').join('') + (rows.length ? '' : '<tr><td colspan="6" class="text-center text-secondary py-5">当前范围暂无已登记日程</td></tr>') + '</tbody></table></div><div class="card-footer d-flex align-items-center gap-3"><span class="small text-secondary">' + page + ' / ' + pages + ' 页</span><div class="btn-list ms-auto"><button class="btn btn-sm" data-calendar-action="prev"' + (page <= 1 ? ' disabled' : '') + '>上一页</button><button class="btn btn-sm" data-calendar-action="next"' + (page >= pages ? ' disabled' : '') + '>下一页</button></div></div></div>';
    }
    $('[data-calendar-action="csv"]').disabled = !visible.length; $('[data-calendar-action="ics"]').disabled = !visible.length; save();
  }
  function detail(id) {
    if (tab === 'important') { const r = I.select(important, { month }).find(e => e.id === id); if (r) api.sourceDialog(r.title, [{ name: r.title, period: r.period, beijingDate: r.beijingDate, beijingTime: r.beijingTime, sourceTimezone: r.timezone, sourceTime: r.date + ' ' + r.time, status: '官方日程，可能调整', note: r.focus, url: r.sourceUrl }]); return; }
    const r = all.find(e => e.id === id); if (!r) return;
    const sourceLink = M.url(r.url), html = '<div class="small text-secondary mb-3">' + esc(r.code) + ' · ' + esc(r.sector) + ' · ' + esc(periodName(r)) + '</div><span class="badge bg-blue-lt mb-3">' + esc(M.status(r, today)) + '</span><div class="datagrid mb-4">' + [['预计披露日', r.expected], ['实际披露日', r.actual], ['公告发布日期', r.announcementDate]].map(([k, v]) => '<div class="datagrid-item"><div class="datagrid-title">' + k + '</div><div class="datagrid-content">' + esc(v || '待公布') + '</div></div>').join('') + '</div><p>' + esc(r.title) + '</p><div class="text-secondary small mb-3">' + esc(r.source?.label || '来源未登记') + ' · 核验 ' + esc(clock(r.updatedAt)) + ' 北京时间</div>' + (sourceLink ? '<a class="btn btn-primary" href="' + esc(sourceLink) + '" target="_blank" rel="noopener noreferrer">公告原文</a>' : '<p class="text-secondary">公告原文链接待补充</p>') + ((r.reservations || []).length ? '<h3 class="mt-4">预约记录</h3><ul>' + r.reservations.map(x => '<li>' + esc(x.date) + (x.announcedAt ? ' · 公告 ' + esc(x.announcedAt) : '') + '</li>').join('') + '</ul>' : '') + ((r.history || []).length ? '<h3 class="mt-4">日期变更</h3><ul>' + r.history.map(h => '<li>' + esc(h.field) + '：' + esc(h.from || '待公布') + ' → ' + esc(h.to || '待公布') + ' · ' + esc(clock(h.observedAt)) + '</li>').join('') + '</ul>' : '') + (r.evidence ? '<details class="mt-4"><summary class="text-secondary">来源核验记录</summary><pre class="mt-3 text-wrap text-break small">' + esc(JSON.stringify(r.evidence, null, 2)) + '</pre></details>' : '');
    api.dialog(r.name + ' · 财报披露', html);
  }
  async function ensureImportant() {
    if (important) return;
    try { important = I.validate(await json('data/important-calendar.json')); alert(''); render(); } catch (error) { $('#calendar-content').innerHTML = '<div class="alert alert-warning">重要日程读取失败。<button class="btn btn-sm ms-2" data-calendar-action="important-retry">重试</button></div>'; }
  }
  async function onClick(event) {
    const t = event.target.closest('[data-calendar-tab]'); if (t) { tab = t.dataset.calendarTab; page = 1; render(); if (tab === 'important') await ensureImportant(); return; }
    const v = event.target.closest('[data-calendar-view]'); if (v) { view = v.dataset.calendarView; page = 1; render(); return; }
    const r = event.target.closest('[data-calendar-record]'); if (r) { detail(r.dataset.calendarRecord); return; }
    const day = event.target.closest('[data-calendar-day]'); if (day) { const records = selectedEvents().filter(e => (e.beijingDate || e.date) === day.dataset.calendarDay); const dialog = api.dialog(day.dataset.calendarDay, '<div class="list-group">' + records.map(e => '<div class="list-group-item">' + recordButton(e) + '<span class="small text-secondary ms-3">' + esc(tab === 'important' ? e.beijingTime : periodName(e) + ' · ' + e.dateLabel) + '</span></div>').join('') + '</div>'); dialog.addEventListener('click', e => { const row = e.target.closest('[data-calendar-record]'); if (row) { dialog.close(); detail(row.dataset.calendarRecord); } }); return; }
    const b = event.target.closest('[data-calendar-action]'); if (!b) return; const action = b.dataset.calendarAction;
    if (action === 'prev' || action === 'next') { page += action === 'prev' ? -1 : 1; render(); }
    if (action === 'month-prev' || action === 'month-next' || action === 'today') { month = action === 'today' ? today.slice(0, 7) : I.shift(month, action === 'month-prev' ? -1 : 1); $('#calendar-month').value = month; page = 1; render(); }
    if (action === 'important-retry') await ensureImportant();
    if (action === 'csv') api.download('国金商社日历-' + month + '.csv', tab === 'important' ? api.csv(visible.map(r => ({ '数据': r.title, '统计期间': r.period, '北京时间': r.beijingDate + ' ' + r.beijingTime, '地区': r.region, '来源': r.sourceUrl }))) : M.csv(visible, today));
    if (action === 'ics') api.download('国金商社日历-' + month + '.ics', tab === 'important' ? I.calendar(visible) : M.calendar(visible, { today, days: 3 }), 'text/calendar;charset=utf-8');
    if (action === 'archive') { b.disabled = true; b.textContent = '正在读取…'; try { const archive = M.validateSnapshot(await json('data/earnings-calendar-archive.json')), records = new Map(M.rows(pool, archive, '').map(r => [r.id, r])); for (const r of all) records.set(r.id, r); all = [...records.values()]; loadedArchive = true; page = 1; alert(''); render(); } catch { alert('披露历史读取失败，当前数据仍可浏览。'); b.disabled = false; b.textContent = '加载披露历史'; } }
  }
  try { const [directory, data] = await Promise.all([json('data/coverage-companies.json'), json('data/earnings-calendar.json')]); snapshot = M.validateSnapshot(data); pool = directory.companies.map(r => ({ ...r, code: M.code(r.code), market: /\.(SH|SZ|BJ)$/.test(r.code) ? 'A股' : /\.HK$/.test(r.code) ? '港股' : '美股' })); all = M.rows(pool, snapshot, ''); shell(); if (tab === 'important') await ensureImportant(); }
  catch (error) { api.failure(container, error, () => renderCalendar(container, api)); }
}
