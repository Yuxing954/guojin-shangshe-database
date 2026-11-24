import { finite, unique, currencyLabel, csv, domesticSelection, domesticEvidence, domesticCsv, catalogData } from './company-helpers.js';

export async function renderCompany(container, api) {
  const esc = api.esc, num = api.num;
  const domesticModel = window.DomesticHotelModel;
  const overseasModel = window.OverseasHotelModel;
  const databaseModel = window.CompanyDatabaseModel;
  const overviewModel = window.CompanyOverviewModel;
  if (!domesticModel || !overseasModel || !databaseModel || !overviewModel) throw new Error('公司数据模型尚未加载');
  const params = new URLSearchParams(location.search);
  const overseas = /overseas-hotel/.test(location.pathname) || params.get('market') === 'overseas';
  const metrics = ['RevPAR', 'ADR', 'OCC'];
  const metricIds = ['revpar', 'adr', 'occ'];
  const colors = ['#066fd1', '#2fb344', '#f59f00', '#ae3ec9'];
  const requestedCompany = params.get('company') || params.get('db') || (overseas ? 'marriott' : 'hworld');
  const requestedTab = params.get('tab');
  const state = {
    company: requestedCompany,
    peers: params.has('peers') ? unique(params.get('peers').split(',').filter(Boolean)) : [requestedCompany],
    tab: overseas ? (['financial', 'brands', 'profile', 'details'].includes(requestedTab) ? requestedTab : 'operating') : (['catalog', 'financial', 'details'].includes(requestedTab) ? 'catalog' : requestedTab === 'profile' ? 'profile' : 'operating'),
    kind: params.get('kind') === '同店' ? '同店' : '全部',
    frequency: ['累计', '年初累计'].includes(params.get('frequency') || params.get('mode')) ? '累计' : '单季度',
    from: params.get('from') || '', to: params.get('to') || params.get('quarter') || '',
    range: ['8', '12', '20', 'all', 'custom'].includes(params.get('range')) ? params.get('range') : params.has('from') ? 'custom' : '12',
    metric: metricIds.includes(params.get('cwMetric') || params.get('peerMetric')) ? (params.get('cwMetric') || params.get('peerMetric')) : 'revpar',
    display: (params.get('display') || params.get('opDisplay') || params.get('peerDisplay')) === 'change' ? 'change' : 'value',
    dimensions: {}, region: params.get('region') || params.get('peerRegion') || '全球',
    financeRegion: params.get('financeRegion') || '集团', financePeriod: params.get('financePeriod') || '',
    catalogMetric: params.get('metric') || 'revenue', catalogFrequency: params.get('frequency') && !['单季度', '累计'].includes(params.get('frequency')) ? params.get('frequency') : '',
    catalogSeries: params.get('series') || '', catalogFrom: params.get('yearFrom') || '', catalogTo: params.get('yearTo') || '',
    forecast: params.get('forecast') === '1', pending: params.get('pending') === '1', page: 1,
    sheet: params.get('sheet') || '', brandView: params.get('brand') || 'scale',
  };
  state.dimensions[requestedCompany] = Object.fromEntries(['region', 'currency', 'category', 'mode'].map(key => [key, params.get(key === 'mode' ? 'operation' : key)]).filter(([, value]) => value));
  let manifest, revision = 0, lastDownload = null;
  const cache = new Map(), catalogCache = new Map(), evidence = new Map();
  const $ = selector => container.querySelector(selector);
  const selection = (name, label, values, selected, attrs = '') => '<div class="col-12 col-sm-6 col-lg-auto"><label class="form-label" for="company-' + esc(name) + '">' + esc(label) + '</label><select class="form-select" id="company-' + esc(name) + '" data-field="' + esc(name) + '" ' + attrs + '>' + values.map(value => { const [key, text] = Array.isArray(value) ? value : [value, value]; return '<option value="' + esc(key) + '"' + (String(key) === String(selected) ? ' selected' : '') + '>' + esc(text) + '</option>'; }).join('') + '</select></div>';
  const empty = text => '<div class="empty"><p class="empty-title">' + esc(text) + '</p></div>';
  const value = (number, digits = 2) => finite(number) ? num(number, digits) : '—';
  const signed = (number, unit, digits = 1) => finite(number) ? (number > 0 ? '+' : '') + num(number, digits) + unit : '—';
  const table = (headers, rows) => '<div class="table-responsive"><table class="table card-table table-vcenter"><thead><tr>' + headers.map(header => '<th>' + header + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  const nav = () => {
    const tabs = overseas ? [['operating', '经营指标'], ['financial', '财务数据'], ['brands', '品牌与管线'], ['profile', '公司资料'], ['details', '工作簿原表']] : [['operating', '经营指标'], ['catalog', '财务与开店'], ['profile', '公司资料']];
    return '<ul class="nav nav-tabs mb-3" role="tablist">' + tabs.map(([id, label]) => '<li class="nav-item"><button class="nav-link' + (state.tab === id ? ' active' : '') + '" type="button" role="tab" aria-selected="' + (state.tab === id) + '" data-company-tab="' + id + '">' + label + '</button></li>').join('') + '</ul>';
  };
  const sourceButton = (title, records) => {
    const key = String(evidence.size);
    evidence.set(key, { title, records: records.filter(Boolean) });
    return '<button class="btn btn-sm btn-ghost-secondary" type="button" data-company-source="' + key + '">来源</button>';
  };
  function evidenceDialog(key) {
    const item = evidence.get(key); if (!item) return;
    const labels = { name: '记录', period: '报告期', value: '数值', prior: '上年同期', change: '同比', changeUnit: '同比单位', sample: '样本', region: '地区', category: '档次', operation: '经营模式', currency: '币种', pdf_page: 'PDF物理页码', note: '来源说明', comparison_basis: '比较基准', change_type: '变化口径', where: '原文定位', workbookCell: '工作簿单元格', method: '披露或复算', basis: '统计口径', locator: '定位', pages: '报告页码', report: '报告', sourceId: '来源ID', verification: '核验层级', rawValue: '原始值', formula: '原始公式', sourceConflict: '基期或来源差异', originalSource: '原底稿记录', screenshotLocator: '真实截图定位', unit: '单位', status: '状态', periodBasis: '期间口径', frequency: '频率' };
    const html = item.records.length ? item.records.map(record => '<div class="mb-4"><dl class="row mb-0">' + Object.entries(record).filter(([key, val]) => !['url', 'source'].includes(key) && val !== undefined && val !== null && val !== '').map(([key, val]) => '<dt class="col-sm-3 text-secondary">' + esc(labels[key] || key) + '</dt><dd class="col-sm-9 text-break">' + esc(typeof val === 'object' ? JSON.stringify(val) : String(val)) + '</dd>').join('') + '</dl>' + (/^https?:\/\//i.test(record.url || '') ? '<a class="btn btn-outline-primary mt-2" target="_blank" rel="noopener noreferrer" href="' + esc(record.url) + '">查看原始来源</a>' : '') + '</div>').join('') : empty('当前记录未提供可读来源');
    api.dialog(item.title, html);
  }
  function header() {
    api.setHeader({ title: overseas ? '海外酒店公司' : '重点公司', pretitle: '公司数据库', actions: '<a class="btn' + (!overseas ? ' btn-primary' : '') + '" href="company-database.html?company=hworld">国内酒店</a><a class="btn' + (overseas ? ' btn-primary' : '') + '" href="overseas-hotels.html?company=marriott">海外酒店</a>' });
  }
  function normalize() {
    const ids = manifest.companies.map(company => company.id);
    if (!ids.includes(state.company)) state.company = overseas ? ids[0] : 'hworld';
    state.peers = state.peers.filter(id => ids.includes(id));
    if (!state.peers.length && !params.has('peers') && revision === 1) state.peers = [state.company];
    if (state.peers.length && !state.peers.includes(state.company)) state.company = state.peers[0];
    if (!manifest.quarters.includes(state.to)) state.to = manifest.quarters.at(-1);
    if (state.range !== 'custom') {
      const quarters = manifest.quarters.filter(quarter => quarter <= state.to);
      state.from = state.range === 'all' ? quarters[0] : quarters.slice(-Number(state.range))[0];
    }
    const periods = domesticModel.range(manifest.quarters, state.from, state.to);
    state.from = periods[0]; state.to = periods.at(-1);
  }
  function save() {
    const query = new URLSearchParams(location.search);
    const values = { company: state.company, peers: state.peers.join(','), tab: state.tab, from: state.from, to: state.to, range: state.range, kind: overseas ? '' : state.kind, frequency: state.frequency, cwMetric: state.metric, display: state.display };
    if (overseas) Object.assign(values, { mode: state.frequency === '累计' ? '年初累计' : '单季度', region: state.region, financeRegion: state.financeRegion, financePeriod: state.financePeriod, sheet: state.sheet, brand: state.brandView, quarter: state.to });
    else {
      const dims = state.dimensions[state.company] || {};
      Object.assign(values, { sampleView: '3', region: dims.region, currency: dims.currency, category: dims.category, operation: dims.mode });
      if (state.tab === 'catalog') Object.assign(values, { metric: state.catalogMetric, frequency: state.catalogFrequency, series: state.catalogSeries, yearFrom: state.catalogFrom, yearTo: state.catalogTo, forecast: state.forecast ? '1' : '', pending: state.pending ? '1' : '' });
    }
    query.delete('db');
    for (const [key, val] of Object.entries(values)) { if (val === '' || val == null) query.delete(key); else query.set(key, String(val)); }
    history.replaceState(null, '', location.pathname + (query.size ? '?' + query : '') + location.hash);
  }
  function shell() {
    evidence.clear(); lastDownload = null;
    const company = manifest.companies.find(item => item.id === state.company);
    container.innerHTML = '<div class="card mb-3"><div class="card-body"><div class="row g-3 align-items-end">' + selection('primary', '公司', manifest.companies.map(item => [item.id, item.name + ' · ' + (item.ticker || item.code || '')]), state.company) + '<div class="col"><div class="text-secondary small">' + esc(company.english || company.englishName || '') + '</div><div class="mt-1">' + esc(company.ticker || company.code || '') + '</div></div><div class="col-auto"><a class="btn" href="research.html?kind=views&amp;q=' + encodeURIComponent(company.name) + '">相关研究</a></div></div>' + (state.tab === 'operating' ? '<div class="mt-3 pt-3 border-top"><span class="form-label mb-2">公司比较</span><div class="d-flex flex-wrap gap-3">' + manifest.companies.map(item => '<label class="form-check form-check-inline mb-0"><input class="form-check-input" type="checkbox" data-peer="' + item.id + '"' + (state.peers.includes(item.id) ? ' checked' : '') + '><span class="form-check-label">' + esc(item.name) + '</span></label>').join('') + '</div></div>' : '') + '</div></div>' + nav() + '<div data-company-body></div>';
  }
  async function loadCompany(id) {
    if (!cache.has(id)) {
      const company = manifest.companies.find(item => item.id === id);
      cache.set(id, api.json(company.file).catch(error => { cache.delete(id); throw error; }));
    }
    return cache.get(id);
  }
  function periodControls(extra = '') {
    return '<div class="card mb-3"><div class="card-body"><div class="row g-3 align-items-end">' + (overseas ? '' : selection('kind', '样本', [['全部', '全部酒店'], ['同店', '同店酒店']], state.kind)) + selection('frequency', '期间', [['单季度', '单季度'], ['累计', overseas ? '年初累计' : '累计']], state.frequency) + selection('range', '范围', [['8', '近2年'], ['12', '近3年'], ['20', '近5年'], ['all', '全部历史'], ['custom', '自定义']], state.range) + selection('from', '起始季度', manifest.quarters, state.from) + selection('to', '截至季度', manifest.quarters.slice().reverse(), state.to) + selection('metric', '趋势指标', metricIds.map((id, index) => [id, metrics[index]]), state.metric) + selection('display', '图表显示', [['value', '数值'], ['change', '同比']], state.display) + extra + '<div class="col-auto ms-lg-auto"><button class="btn btn-outline-primary" type="button" data-download>导出当前数据</button></div></div></div></div>';
  }
  function chartCard(id, title, subtitle, periods, unit, color, precision = 2) {
    return { html: '<div class="col-12 col-lg-6"><div class="card"><div class="card-header"><div><h3 class="card-title">' + esc(title) + '</h3><div class="text-secondary small mt-1">' + esc(subtitle) + '</div></div></div><div class="card-body"><div class="chart-lg" data-company-chart="' + id + '"></div></div></div></div>', id, periods, unit, color, precision };
  }
  function drawCharts(charts) {
    for (const chart of charts) {
      const target = $('[data-company-chart="' + chart.id + '"]');
      if (chart.periods.some(point => finite(point.value))) api.chart(target, chart.periods, { unit: chart.unit, color: chart.color, precision: chart.precision });
      else target.innerHTML = empty('所选范围暂无披露数据');
    }
  }
  const chartGrid = charts => charts.map(chart => charts.length === 1 ? chart.html.replace('col-12 col-lg-6', 'col-12') : chart.html).join('');
  async function domesticOperating(run) {
    const data = await Promise.all(state.peers.map(loadCompany)); if (run !== revision) return;
    const periods = domesticModel.range(manifest.quarters, state.from, state.to), index = metricIds.indexOf(state.metric);
    const selections = data.map(item => ({ data: item, ...domesticSelection(domesticModel, item, state, state.dimensions[item.company.id]) }));
    selections.forEach(item => state.dimensions[item.data.company.id] = item.filters);
    const series = new Map(selections.map(item => [item.data.company.id, domesticModel.series(item.data.rows, item.filters, periods, state.frequency)]));
    const activeScopes = selections.map(s=>[s.data.company.name,s.filters.region,s.filters.category,s.filters.mode,s.filters.currency].filter(Boolean).join(' · '));
    let scope = '<details class="card mb-3 scope-disclosure"><summary><strong>经营口径</strong> <span class="text-secondary small ms-2">' + esc(activeScopes.join(' / ')) + '</span></summary><div class="card-body pt-0">';
    for (const selected of selections) {
      const id = selected.data.company.id;
      scope += '<div class="row g-3 align-items-end' + (selections.length > 1 ? ' mb-3' : '') + '"><div class="col-12 col-lg-2"><div class="form-label">' + esc(selected.data.company.name) + '</div><span class="badge bg-blue-lt">' + esc(state.kind === '全部' ? '全部酒店' : '同店酒店') + '</span></div>' + [['region', '地区'], ['category', '档次'], ['mode', '经营模式'], ['currency', '币种']].map(([key, label]) => selection('dim-' + id + '-' + key, label, selected.options[key].length ? selected.options[key] : [['', '暂无披露']], selected.filters[key], 'data-dimension="' + key + '" data-owner="' + id + '"' + (!selected.options[key].length ? ' disabled' : ''))).join('') + '</div>';
    }
    scope += '</div></details>';
    const charts = selections.map((selected, companyIndex) => {
      const metricUnit = index === 2 ? '%' : currencyLabel(selected.filters.currency);
      const unit = state.display === 'change' ? index === 2 ? '百分点' : '%' : metricUnit;
      const points = series.get(selected.data.company.id).map(period => ({ period: period.period, label: period.period, value: period.records[index]?.[state.display === 'change' ? 'change' : 'value'] ?? null }));
      return chartCard(selected.data.company.id, selected.data.company.name + ' · ' + metrics[index] + (state.display === 'change' ? '同比' : ''), [selected.filters.region, selected.filters.category, selected.filters.mode, state.kind, state.frequency, unit].filter(Boolean).join(' · '), points, unit, colors[companyIndex], index === 2 || state.display === 'change' ? 1 : 2);
    });
    const latestRows = selections.map(selected => {
      const latest = series.get(selected.data.company.id).at(-1);
      return '<tr><td><strong>' + esc(selected.data.company.name) + '</strong><div class="text-secondary small">' + esc([selected.filters.region, selected.filters.category, selected.filters.mode].join(' · ')) + '</div></td><td class="text-nowrap">' + esc(latest?.period || '') + '</td>' + (latest?.records || [null, null, null]).map((record, metricIndex) => '<td class="text-end text-nowrap"><div class="h3 mb-1">' + value(record?.value, metricIndex === 2 ? 1 : 2) + (record ? '<span class="text-secondary small ms-1">' + esc(metricIndex === 2 ? '%' : currencyLabel(selected.filters.currency)) + '</span>' : '') + '</div><div class="text-secondary small">同比 ' + signed(record?.change, metricIndex === 2 ? ' pct' : '%') + '</div></td>').join('') + '<td>' + sourceButton(selected.data.company.name + ' · ' + (latest?.period || ''), (latest?.records || []).map(record => domesticEvidence(selected.data, record))) + '</td></tr>';
    });
    const historyRows = periods.slice().reverse().flatMap(quarter => selections.map(selected => {
      const point = series.get(selected.data.company.id).find(item => item.quarter === quarter);
      return '<tr><td class="text-nowrap">' + esc(point.period) + '</td><td>' + esc(selected.data.company.name) + '</td><td><span class="text-secondary small">' + esc([selected.filters.region, selected.filters.category, selected.filters.mode, selected.filters.currency].join(' · ')) + '</span></td>' + point.records.map((record, metricIndex) => '<td class="text-end text-nowrap">' + value(record?.value, metricIndex === 2 ? 1 : 2) + '<div class="text-secondary small">' + signed(record?.change, metricIndex === 2 ? ' pct' : '%') + '</div></td>').join('') + '<td>' + sourceButton(selected.data.company.name + ' · ' + point.period, point.records.map(record => domesticEvidence(selected.data, record))) + '</td></tr>';
    }));
    $('[data-company-body]').innerHTML = periodControls() + scope + '<div class="card mb-3"><div class="card-header"><h3 class="card-title">当期经营指标</h3><div class="card-actions text-secondary small">' + esc(state.kind + ' · ' + state.frequency) + '</div></div>' + table(['公司 / 口径', '报告期', 'RevPAR', 'ADR', 'OCC', ''], latestRows) + '</div><div class="row row-cards mb-3">' + chartGrid(charts) + '</div><div class="card"><div class="card-header"><h3 class="card-title">历史经营数据</h3><div class="card-actions text-secondary">' + periods.length + '期</div></div>' + table(['报告期', '公司', '口径 / 币种', 'RevPAR', 'ADR', 'OCC', ''], historyRows) + '</div>';
    lastDownload = () => api.download('国内酒店_经营数据_' + state.from + '_' + state.to + '.csv', domesticCsv(data, series), 'text/csv;charset=utf-8');
    drawCharts(charts);
  }
  async function overseasOperating(run) {
    const data = await Promise.all(state.peers.map(loadCompany)); if (run !== revision) return;
    const mode = state.frequency === '累计' ? '年初累计' : '单季度';
    const regions = unique(data.flatMap(item => overseasModel.operating(item.operating, { mode }).map(row => row.region)));
    if (!regions.includes(state.region)) state.region = regions.includes('全球') ? '全球' : regions[0] || '';
    const periods = overseasModel.range(manifest.quarters, state.from, state.to), index = metricIds.indexOf(state.metric);
    const selected = data.map(item => ({ data: item, rows: overseasModel.operating(item.operating, { mode, region: state.region }).filter(row => periods.includes(row.quarter)) }));
    const charts = selected.map((item, companyIndex) => {
      const unit = state.display === 'change' ? index === 2 ? '百分点' : '%' : index === 2 ? '%' : '美元';
      return chartCard(item.data.company.id, item.data.company.name + ' · ' + metrics[index] + (state.display === 'change' ? '同比' : ''), [state.region, '可比酒店', mode, unit].join(' · '), periods.map(period => { const row = item.rows.find(row => row.quarter === period); return { period, label: period, value: row?.[state.display === 'change' ? 'changes' : 'values']?.[index] ?? null }; }), unit, colors[companyIndex], index === 2 || state.display === 'change' ? 1 : 2);
    });
    const records = periods.slice().reverse().flatMap(period => selected.map(item => ({ company: item.data.company, row: item.rows.find(row => row.quarter === period), period })));
    const rows = records.map(({ company, row, period }) => '<tr><td class="text-nowrap">' + esc(row?.period || period) + '</td><td>' + esc(company.name) + '</td><td class="text-nowrap">' + esc(state.region) + '</td>' + metrics.map((metric, metricIndex) => '<td class="text-end text-nowrap">' + value(row?.values?.[metricIndex], metricIndex === 2 ? 1 : 2) + '<div class="text-secondary small">' + signed(row?.changes?.[metricIndex], metricIndex === 2 ? ' pct' : '%') + '</div></td>').join('') + '<td>' + sourceButton(company.name + ' · ' + period, row ? [{ ...row, url: row.source }] : []) + '</td></tr>');
    $('[data-company-body]').innerHTML = periodControls(selection('region', '地区', regions, state.region)) + '<div class="row row-cards mb-3">' + chartGrid(charts) + '</div><div class="card"><div class="card-header"><h3 class="card-title">可比酒店经营数据</h3><div class="card-actions text-secondary small">RevPAR / ADR：美元 · OCC：% · OCC同比：百分点</div></div>' + table(['期间', '公司', '地区', 'RevPAR', 'ADR', 'OCC', ''], rows) + '</div>';
    lastDownload = () => api.download('海外酒店_经营数据_' + state.from + '_' + state.to + '.csv', csv(['公司', '报告期', '季度', '期间口径', '地区', '原地区', '样本组', '币种', 'RevPAR', 'RevPAR同比%', 'ADR', 'ADR同比%', 'OCC%', 'OCC同比百分点', '来源URL', '原文定位', '工作簿定位', '说明'], records.filter(item => item.row).map(({ company, row }) => [company.name, row.period, row.quarter, row.mode, row.region, row.originalRegion, row.group, row.currency || 'USD', row.values[0], row.changes[0], row.values[1], row.changes[1], row.values[2], row.changes[2], row.source, row.where, row.workbookCell, row.note])), 'text/csv;charset=utf-8');
    drawCharts(charts);
  }
  async function domesticCatalog(run) {
    if (!catalogCache.has(state.company)) catalogCache.set(state.company, catalogData(api, state.company, databaseModel, overviewModel).catch(error => { catalogCache.delete(state.company); throw error; }));
    const loaded = await catalogCache.get(state.company); if (run !== revision) return;
    const { catalog, rows, sourceMap } = loaded;
    const available = catalog.metrics.filter(metric => rows.some(row => row.metric === metric.id));
    if (!available.some(metric => metric.id === state.catalogMetric)) state.catalogMetric = available[0]?.id || '';
    const metric = available.find(item => item.id === state.catalogMetric);
    const frequencies = unique(rows.filter(row => row.metric === state.catalogMetric).map(row => row.frequency));
    if (!frequencies.includes(state.catalogFrequency)) state.catalogFrequency = frequencies.includes('季度') ? '季度' : frequencies[0];
    const candidate = databaseModel.filter(rows, { metric: state.catalogMetric, frequency: state.catalogFrequency, forecast: state.forecast, pending: state.pending });
    const series = databaseModel.series(candidate);
    if (!series.some(item => item.key === state.catalogSeries)) state.catalogSeries = series[0]?.key || '';
    const years = unique(candidate.map(row => row.period.slice(0, 4))).sort();
    if (state.catalogFrom && !years.includes(state.catalogFrom)) state.catalogFrom = '';
    if (state.catalogTo && !years.includes(state.catalogTo)) state.catalogTo = '';
    const filtered = databaseModel.filter(rows, { metric: state.catalogMetric, frequency: state.catalogFrequency, series: state.catalogSeries, from: state.catalogFrom, to: state.catalogTo, forecast: state.forecast, pending: state.pending });
    const shown = filtered.slice().reverse();
    const pageSize = 30, pages = Math.max(1, Math.ceil(shown.length / pageSize)); state.page = Math.min(state.page, pages);
    const showRows = shown.slice((state.page - 1) * pageSize, state.page * pageSize);
    const sourceRecord = row => ({ ...(sourceMap.get(row.sourceId) || {}), ...row, name: loaded.company.name + ' · ' + row.period + ' · ' + metric.name, url: row.reportUrl || sourceMap.get(row.sourceId)?.url || '' });
    const control = '<div class="card mb-3"><div class="card-body"><div class="row g-3 align-items-end">' + selection('catalogMetric', '指标', available.map(item => [item.id, item.category + ' · ' + item.name]), state.catalogMetric) + selection('catalogFrequency', '频率', frequencies, state.catalogFrequency) + selection('catalogFrom', '起始年份', [['', '全部年份'], ...years], state.catalogFrom) + selection('catalogTo', '截至年份', [['', '全部年份'], ...years.slice().reverse()], state.catalogTo) + '<div class="col-auto ms-lg-auto"><button class="btn btn-outline-primary" data-download type="button">导出当前序列</button></div><div class="col-12"><label class="form-label" for="company-catalogSeries">统计范围 / 币种 / 期间口径</label><select class="form-select" data-field="catalogSeries" id="company-catalogSeries">' + series.map(item => '<option value="' + esc(item.key) + '"' + (item.key === state.catalogSeries ? ' selected' : '') + '>' + esc(item.label) + '</option>').join('') + '</select></div><div class="col-auto"><label class="form-check"><input class="form-check-input" type="checkbox" data-field="forecast"' + (state.forecast ? ' checked' : '') + '><span class="form-check-label">显示模型预测</span></label></div><div class="col-auto"><label class="form-check"><input class="form-check-input" type="checkbox" data-field="pending"' + (state.pending ? ' checked' : '') + '><span class="form-check-label">显示待核验记录</span></label></div></div></div></div>';
    const tableRows = showRows.map(row => {
      const growth = overviewModel.yoy(rows, row);
      return '<tr><td class="text-nowrap">' + esc(row.period) + '</td><td class="text-end text-nowrap">' + value(row.value) + '</td><td>' + esc(row.unit) + '</td><td>' + esc(row.currency || '—') + '</td><td class="text-nowrap">' + (growth ? signed(growth.value, growth.unit) : '—') + (growth ? '<div class="text-secondary small">' + esc(growth.kind) + '</div>' : '') + '</td><td>' + esc(row.periodBasis) + '</td><td><span class="badge ' + (row.status === 'forecast' ? 'bg-yellow-lt' : row.status === 'pending' ? 'bg-red-lt' : 'bg-secondary-lt') + '">' + esc(databaseModel.labels[row.status] || row.status) + '</span>' + (row.sourceConflict ? '<div class="text-warning small">基期或来源差异</div>' : '') + '</td><td>' + sourceButton(loaded.company.name + ' · ' + row.period, [sourceRecord(row), growth?.prior ? { ...sourceRecord(growth.prior), name: '同比基期 · ' + growth.prior.period } : null]) + '</td></tr>';
    });
    const actual = filtered.filter(row => row.status !== 'forecast' && row.status !== 'pending');
    const points = actual.map(row => ({ period: row.period, label: row.period, value: row.value }));
    const selected = series.find(item => item.key === state.catalogSeries), unit = actual[0]?.unit || filtered[0]?.unit || metric?.unit || '';
    $('[data-company-body]').innerHTML = control + '<div class="card mb-3"><div class="card-header"><div><h3 class="card-title">' + esc(loaded.company.name + ' · ' + (metric?.name || '综合数据')) + '</h3><div class="text-secondary small mt-1">' + esc(selected?.label || '') + '</div></div></div><div class="card-body"><div class="chart-lg" data-company-chart="catalog"></div></div></div><div class="card"><div class="card-header"><h3 class="card-title">序列明细</h3><div class="card-actions text-secondary small">' + filtered.length + ' 条</div></div>' + (tableRows.length ? table(['报告期', '数值', '单位', '币种', '同比', '期间口径', '状态', ''], tableRows) : empty('当前筛选暂无披露数据')) + '<div class="card-footer d-flex align-items-center"><span class="text-secondary">第 ' + state.page + ' / ' + pages + ' 页</span><div class="btn-list ms-auto"><button type="button" class="btn btn-sm" data-page="-1"' + (state.page <= 1 ? ' disabled' : '') + '>上一页</button><button type="button" class="btn btn-sm" data-page="1"' + (state.page >= pages ? ' disabled' : '') + '>下一页</button></div></div></div>';
    lastDownload = () => api.download(loaded.company.name + '_' + metric.name + '.csv', databaseModel.csv(filtered, catalog.metrics), 'text/csv;charset=utf-8');
    drawCharts([{ id: 'catalog', periods: points, unit, color: colors[0], precision: 2 }]);
  }
  async function overseasFinance(run) {
    const data = await loadCompany(state.company); if (run !== revision) return;
    const regions = unique(data.finance.map(row => row.region));
    if (!regions.includes(state.financeRegion)) state.financeRegion = regions[0] || '';
    const matrix = overseasModel.financeMatrix(data.finance, state.financeRegion), periods = matrix.periods.slice().reverse();
    if (!state.financePeriod || state.financePeriod === 'latest') state.financePeriod = periods[0] || '';
    const periodOptions = periods.includes(state.financePeriod) ? periods : [[state.financePeriod, state.financePeriod + ' · 未披露'], ...periods];
    const current = matrix.rows.filter(row => row.period === state.financePeriod);
    const tableRows = current.map(row => { const change = overseasModel.financialChange(data.finance, row); return '<tr><td>' + esc(row.metric) + '</td><td class="text-end">' + value(row.value) + '</td><td>' + esc(row.unit) + '</td><td>' + esc(change?.label || '—') + '</td><td><span class="badge bg-secondary-lt">' + esc(row.method) + '</span></td><td>' + sourceButton(data.company.name + ' · ' + row.metric, [{ ...row, url: row.source }, change?.base ? { ...change.base, name: '同比基期', url: change.base.source } : null]) + '</td></tr>'; });
    const revenue = matrix.rows.filter(row => row.metric === '营业收入'), seriesGroups = new Map();
    const periodBasis = period => /Q[1-4]$/.test(period) ? '单季度' : /H1$/.test(period) ? '上半年累计' : /9M$/.test(period) ? '前三季累计' : /FY$/.test(period) ? '全年' : period;
    for (const row of revenue) { const key = JSON.stringify([row.unit, row.basis, row.region, periodBasis(row.period)]); if (!seriesGroups.has(key)) seriesGroups.set(key, []); seriesGroups.get(key).push(row); }
    const charts = [...seriesGroups.values()].map((rows, index) => chartCard('finance-' + index, '营业收入 · ' + rows[0].region, periodBasis(rows[0].period) + ' · ' + rows[0].basis + ' · ' + rows[0].unit, rows.slice().sort((a, b) => overseasModel.periodRank(a.period) - overseasModel.periodRank(b.period)).map(row => ({ period: row.period, label: row.period, value: row.value })), rows[0].unit, colors[index % colors.length], 0));
    $('[data-company-body]').innerHTML = '<div class="card mb-3"><div class="card-body"><div class="row g-3 align-items-end">' + selection('financeRegion', '范围', regions, state.financeRegion) + selection('financePeriod', '报告期', periodOptions, state.financePeriod) + '<div class="col-auto ms-lg-auto"><button class="btn btn-outline-primary" type="button" data-download>导出财务数据</button></div></div></div></div><div class="card mb-3"><div class="card-header"><h3 class="card-title">' + esc(data.company.name + ' · ' + state.financePeriod + ' · ' + state.financeRegion) + '</h3></div>' + (tableRows.length ? table(['指标', '金额', '单位', '同比', '披露或复算', ''], tableRows) : empty('本期暂无财务披露')) + '</div><div class="row row-cards">' + chartGrid(charts) + '</div>';
    lastDownload = () => api.download(data.company.name + '_财务数据.csv', csv(['公司', '报告期', '范围', '指标', '金额', '单位', '口径', '披露或复算', '来源URL', '原文定位', '工作簿定位'], matrix.rows.map(row => [data.company.name, row.period, row.region, row.metric, row.value, row.unit, row.basis, row.method, row.source, row.where, row.workbookCell])), 'text/csv;charset=utf-8');
    drawCharts(charts);
  }
  async function overseasBrands(run) {
    const data = await loadCompany(state.company); if (run !== revision) return;
    const choices = [['scale', '品牌规模'], ['metrics', '品牌经营'], ['pipeline', '开发管线'], ['capital', '收费与资本']];
    if (!choices.some(([key]) => key === state.brandView)) state.brandView = 'scale';
    let headers, records, rows;
    if (state.brandView === 'metrics') {
      records = data.brandMetrics || [];
      headers = ['品牌 / 范围', '报告期', '口径', 'RevPAR（美元）', 'ADR（美元）', 'OCC（%）', ''];
      rows = records.map(row => '<tr><td>' + esc(row.label) + '</td><td>' + esc(row.period || '') + '</td><td>' + esc(row.basis || '') + '</td>' + metrics.map((name, index) => '<td class="text-end">' + value(row.values?.[index], index === 2 ? 1 : 2) + '<div class="text-secondary small">' + signed(row.changes?.[index], index === 2 ? ' pct' : '%') + '</div></td>').join('') + '<td>' + sourceButton(data.company.name + ' · ' + row.label, [{ ...row, url: row.source || data.source }]) + '</td></tr>');
    } else if (state.brandView === 'capital') {
      records = data.capital || []; headers = ['类别', '字段', '原披露值', ''];
      rows = records.flatMap(row => (row.fields || []).map(([key, val]) => '<tr><td>' + esc(row.section) + '</td><td>' + esc(key) + '</td><td>' + esc(String(val ?? '—')) + '</td><td>' + sourceButton(data.company.name + ' · ' + row.section, [{ ...row, url: row.source || data.source }]) + '</td></tr>'));
    } else {
      records = state.brandView === 'pipeline' ? data.pipeline || [] : data.brandScale || [];
      headers = ['品牌 / 范围', '报告期', '酒店数（家）', '客房数（间）', ''];
      rows = records.map(row => '<tr><td>' + esc(row.label) + '</td><td>' + esc(row.period || data.snapshotPeriod || '—') + '</td><td class="text-end">' + value(row.properties, 0) + '</td><td class="text-end">' + value(row.rooms, 0) + '</td><td>' + sourceButton(data.company.name + ' · ' + row.label, [{ ...row, period: row.period || data.snapshotPeriod || '', url: row.source || data.source }]) + '</td></tr>');
    }
    $('[data-company-body]').innerHTML = '<div class="card"><div class="card-header"><h3 class="card-title">' + esc(data.company.name) + '</h3><div class="card-actions"><button class="btn btn-outline-primary" type="button" data-download>导出当前数据</button></div></div><div class="card-body border-bottom"><div class="row g-3">' + selection('brandView', '类别', choices, state.brandView) + '</div></div>' + (rows.length ? table(headers, rows) : empty('当前类别未披露数据')) + '</div>';
    lastDownload = () => api.download(data.company.name + '_' + choices.find(([key]) => key === state.brandView)[1] + '.csv', csv(['公司', '类别', '原始字段'], records.map(row => [data.company.name, state.brandView, row])), 'text/csv;charset=utf-8');
  }
  async function profile(run) {
    const data = overseas ? await loadCompany(state.company) : await api.json('data/companies/profiles.json'); if (run !== revision) return;
    const company = manifest.companies.find(item => item.id === state.company), info = overseas ? data.profile : data.companies[state.company];
    const items = overseas ? (Array.isArray(info) ? info.map((text, index) => [['公司概况', '业务结构', '经营情况'][index] || '业务 ' + (index + 1), text]) : Object.entries(info || {}).map(([key, val]) => [key, typeof val === 'object' ? JSON.stringify(val) : String(val)])) : [['业务定位', info.positioning], ['业务介绍', info.intro], ['业务板块', (info.businessLines || []).join(' · ')], ...((info.businessLogic || []).map((text, index) => ['业务 ' + (index + 1), text]))];
    $('[data-company-body]').innerHTML = '<div class="card"><div class="card-header"><h3 class="card-title">' + esc(company.name) + '</h3><div class="card-actions"><a class="btn btn-sm" href="data-notes.html#companies">数据来源与说明</a></div></div><div class="card-body"><dl class="row mb-0">' + items.filter(([, val]) => val).map(([key, val]) => '<dt class="col-md-3">' + esc(key) + '</dt><dd class="col-md-9">' + esc(val) + '</dd>').join('') + '</dl></div></div>';
  }
  async function overseasRaw(run) {
    const sheets = manifest.sheets || [];
    if (!sheets.some(item => item.name === state.sheet)) state.sheet = sheets[0]?.name || '';
    const sheet = sheets.find(item => item.name === state.sheet); if (!sheet) { $('[data-company-body]').innerHTML = empty('暂无工作簿原表'); return; }
    const data = await api.json(sheet.file); if (run !== revision) return;
    const size = 30, pages = Math.max(1, Math.ceil(data.rows.length / size)); state.page = Math.min(state.page, pages);
    const cols = data.columns || Math.max(0, ...data.rows.flatMap(row => row.cells.map(cell => cell.c)));
    const colName = index => { let label = ''; for (let i = index; i > 0; i = Math.floor((i - 1) / 26)) label = String.fromCharCode(65 + (i - 1) % 26) + label; return label; };
    const values = row => Array.from({ length: cols }, (_, index) => row.cells.find(cell => cell.c === index + 1)?.v ?? null);
    const rows = data.rows.slice((state.page - 1) * size, state.page * size).map(row => '<tr><td class="text-secondary">' + esc(row.r) + '</td>' + values(row).map(val => '<td class="text-nowrap">' + esc(val == null ? '—' : String(val)) + '</td>').join('') + '</tr>');
    $('[data-company-body]').innerHTML = '<div class="card"><div class="card-header"><h3 class="card-title">四集团归档工作簿</h3><div class="card-actions"><button class="btn btn-outline-primary" data-download type="button">导出当前原表</button></div></div><div class="card-body border-bottom"><div class="row g-3">' + selection('sheet', '工作表', sheets.map(item => item.name), state.sheet) + '</div></div>' + table(['原表行', ...Array.from({ length: cols }, (_, index) => colName(index + 1))], rows) + '<div class="card-footer d-flex align-items-center"><span class="text-secondary">第 ' + state.page + ' / ' + pages + ' 页</span><div class="btn-list ms-auto"><button class="btn btn-sm" type="button" data-page="-1"' + (state.page === 1 ? ' disabled' : '') + '>上一页</button><button class="btn btn-sm" type="button" data-page="1"' + (state.page >= pages ? ' disabled' : '') + '>下一页</button></div></div></div>';
    lastDownload = () => api.download('海外酒店_' + state.sheet + '.csv', csv(['原表行', ...Array.from({ length: cols }, (_, index) => colName(index + 1))], data.rows.map(row => [row.r, ...values(row)])), 'text/csv;charset=utf-8');
  }
  async function render() {
    const run = ++revision; normalize(); shell(); save();
    $('[data-company-body]').innerHTML = '<div class="card"><div class="card-body text-secondary"><span class="spinner-border spinner-border-sm me-2" role="status" aria-label="正在读取"></span>正在读取公司数据…</div></div>';
    try {
      if (state.tab === 'operating') {
        if (!state.peers.length) { $('[data-company-body]').innerHTML = '<div class="card">' + empty('请选择至少一家公司') + '</div>'; return; }
        await (overseas ? overseasOperating(run) : domesticOperating(run));
      } else if (state.tab === 'catalog') await domesticCatalog(run);
      else if (state.tab === 'financial') await overseasFinance(run);
      else if (state.tab === 'brands') await overseasBrands(run);
      else if (state.tab === 'details') await overseasRaw(run);
      else await profile(run);
      if (run === revision) save();
    } catch (error) {
      if (run !== revision) return;
      $('[data-company-body]').innerHTML = '<div class="alert alert-danger" role="alert"><h4 class="alert-title">公司数据读取失败</h4><div>' + esc(error.message || '请稍后重试') + '</div><button class="btn btn-sm mt-3" type="button" data-company-retry>重新读取</button></div>';
    }
  }
  container.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('[data-peer]')) {
      state.peers = target.checked ? unique([...state.peers, target.dataset.peer]) : state.peers.filter(id => id !== target.dataset.peer);
      if (state.peers.length && !state.peers.includes(state.company)) state.company = state.peers[0];
    } else if (target.matches('[data-dimension]')) {
      const id = target.dataset.owner, key = target.dataset.dimension;
      state.dimensions[id] = { ...state.dimensions[id], [key]: target.value };
    } else if (target.matches('[data-field]')) {
      const field = target.dataset.field;
      if (field === 'primary') { state.company = target.value; state.peers = [target.value]; state.catalogSeries = ''; }
      else state[field] = target.type === 'checkbox' ? target.checked : target.value;
      if (field === 'from' || field === 'to') { state.range = 'custom'; if (state.from > state.to) { if (field === 'from') state.to = state.from; else state.from = state.to; } }
      if (field === 'kind' || field === 'frequency') state.dimensions = {};
      if (field === 'catalogMetric' || field === 'catalogFrequency') state.catalogSeries = '';
      if (field === 'catalogFrom' && state.catalogTo && state.catalogFrom > state.catalogTo) state.catalogTo = state.catalogFrom;
      if (field === 'catalogTo' && state.catalogFrom && state.catalogTo < state.catalogFrom) state.catalogFrom = state.catalogTo;
    } else return;
    state.page = 1; render();
  });
  container.addEventListener('click', event => {
    const source = event.target.closest('[data-company-source]'); if (source) { evidenceDialog(source.dataset.companySource); return; }
    const tab = event.target.closest('[data-company-tab]'); if (tab) { state.tab = tab.dataset.companyTab; state.page = 1; render(); return; }
    const page = event.target.closest('[data-page]'); if (page) { state.page += Number(page.dataset.page); render(); return; }
    if (event.target.closest('[data-download]')) { if (lastDownload) lastDownload(); return; }
    if (event.target.closest('[data-company-retry]')) { render(); }
  });
  header();
  try {
    manifest = await api.json(overseas ? 'data/companies/overseas-hotels.json' : 'data/companies/domestic-hotels.json');
    if (location.pathname.includes('-comparison.html') && !params.has('peers')) state.peers = manifest.companies.map(company => company.id);
    await render();
  } catch (error) {
    container.innerHTML = '<div class="alert alert-danger">公司目录读取失败。' + esc(error.message || '') + '<button class="btn btn-sm ms-3" type="button" data-company-init-retry>重试</button></div>';
    $('[data-company-init-retry]').onclick = () => location.reload();
  }
}
