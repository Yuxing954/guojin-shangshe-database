export function dutyfreeHolidayExportRows(data, rows = data.records) {
  return rows.map(row => ({ ...row, sourceFile: row.sourceFile || data.sourceFile || '', sourceVersion: data.sourceVersion || '', sourceDescription: data.source || '', units: 'sales:亿元; shoppers:万人次; items:万件; spend:元/人次; daily_sales:亿元/日; daily_shoppers:万人次/日; yoy:%' }));
}

export async function renderIndustry(container, api) {
  if (typeof container.__industryDispose === 'function') container.__industryDispose();
  const { esc, num, numeric, json, text, parseCSV, tableCard, options } = api;
  const H = window.HotelMetrics, G = window.HotelGroupsModel, T = window.TravelModel, C = window.CruiseAnalysisModel, D = window.DiningModel;
  if (!H || !G || !T || !C || !D) throw new Error('行业数据模型尚未加载');
  const sectors = [['hotel', '酒店'], ['dutyfree', '免税'], ['travel', '旅游'], ['tourism', '三峡游轮'], ['dining', '餐饮'], ['recruitment', '企业招聘']];
  const names = Object.fromEntries([...sectors, ['gold', '黄金']]);
  const routeMap = { 'hotel-dashboard.html': 'hotel', 'hotel-groups.html': 'hotel', 'hotel-holiday-dashboard.html': 'hotel', 'hotel-weekly-product.html': 'hotel', 'dutyfree-dashboard.html': 'dutyfree', 'travel-dashboard.html': 'travel', 'cruise-dashboard.html': 'tourism', 'dining.html': 'dining', 'recruitment.html': 'recruitment', 'gold-jewelry.html': 'gold' };
  const viewSets = { hotel: [['overview', '经营概览'], ['cities', '地区与档次'], ['structure', '供给结构'], ['annual', '酒店年鉴'], ['groups', '酒店集团'], ['holiday', '假期数据']], dutyfree: [['monthly', '离岛免税'], ['korea', '韩国免税'], ['holidays', '假期数据']], travel: [['domestic', '国内旅游'], ['inbound', '入境旅游'], ['outbound', '出境旅游']], tourism: [['overview', '行业运行'], ['audience', '游客结构'], ['operators', '船公司']], dining: [['industry', '行业数据'], ['brands', '品牌跟踪']], recruitment: [['overview', '全国招聘']], gold: [['overview', '黄金指标']] };
  function route() {
    const path = location.pathname.split('/').pop(), p = new URLSearchParams(location.search), hash = location.hash.slice(1), hp = new URLSearchParams(hash), nested = new URLSearchParams(p.get('panelView') || '');
    const sector = routeMap[path] || (names[hash] ? hash : names[p.get('panelSector')] ? p.get('panelSector') : 'hotel');
      const fallback = path === 'hotel-groups.html' ? 'groups' : path === 'hotel-holiday-dashboard.html' ? 'holiday' : path === 'dining.html' ? 'brands' : viewSets[sector][0][0];
    const wanted = hp.get('view') || p.get('view') || nested.get('view') || (viewSets[sector].some(([key]) => key === hash) ? hash : '') || fallback;
    return { sector, view: viewSets[sector].some(([key]) => key === wanted) ? wanted : fallback };
  }
  const p = new URLSearchParams(location.search), initial = route();
  for (const [key, value] of new URLSearchParams(p.get('panelView') || '')) if (!p.has(key)) p.set(key, value);
  for (const [key, value] of new URLSearchParams(location.hash.slice(1))) if (!p.has(key)) p.set(key, value);
  if (!p.has('period') && p.has('week')) p.set('period', p.get('week'));
  const state = { ...initial, metric: p.get('metric') || '', period: p.get('period') || '', window: p.get('window') || '24', region: p.get('region') || '全国', segment: p.get('segment') || '全部', band: p.get('band') || '15间及以上', groupMetric: p.get('groupMetric') || 'adr', year: p.get('year') || 'recent', scope: p.get('scope') || '', destination: p.get('destination') || '', category: p.get('category') || 'all', brand: p.get('brand') || '', holiday: p.get('holiday') || 'national-day', dimension: p.get('dimension') || 'hotel_tier', companyIndex: Number(p.get('companyIndex') || 6), display: p.get('display') || 'value', page: 1, cohort: p.get('cohort') || '' };
  state.holidays = p.get('holidays') !== 'false' ? 'true' : 'false';
  if (!['12', '13', '24', '26', '52', '156', 'all'].includes(state.window)) state.window = '24';
  let revision = 0, exportAction = null, disposed = false;
  const lifecycle = new AbortController();
  const sources = new Map(), cache = new Map(), $ = selector => container.querySelector(selector), unique = values => [...new Set(values)], finite = Number.isFinite;
  const field = (key, label, values, selected = state[key]) => '<div class="col-12 col-sm-6 col-lg-auto"><label class="form-label" for="industry-' + key + '">' + esc(label) + '</label><select class="form-select" id="industry-' + key + '" data-industry-field="' + key + '">' + options(values, selected) + '</select></div>';
  const controls = content => api.filterBar(content,'<button class="btn btn-outline-primary" type="button" data-industry-export>'+api.icon('download')+'导出当前数据</button>');
  const windowControl = () => field('window', '趋势范围', [['12', '近12期'], ['13', '近13期'], ['24', '近24期'], ['26', '近26期'], ['52', '近52期'], ['156', '近156期'], ['all', '全部历史']]);
  const yearControl = years => field('year', '年份', [['recent', '2023年以来'], ['all', '全部年份'], ...years.slice().sort().reverse()]);
  const signed = (value, unit = '%', digits = 1) => finite(value) ? (value > 0 ? '+' : '') + num(value, digits) + unit : '—';
  const browserLink = (file, label) => '<a class="list-group-item list-group-item-action d-flex align-items-center justify-content-between" href="dashboard.html?file=' + encodeURIComponent(file) + '"><span>' + esc(label) + '</span>' + api.icon('arrow') + '</a>';
  const databaseLinks = (entries, title = '相关数据表') => '<div class="card mt-3"><div class="card-header"><h3 class="card-title">' + esc(title) + '</h3></div><div class="list-group list-group-flush">' + entries.map(([file, label]) => browserLink(file, label)).join('') + '</div></div>';
  const source = (title, records) => { const id = String(sources.size); sources.set(id, { title, records: records.filter(Boolean) }); return '<button type="button" class="btn btn-sm btn-ghost-secondary" data-industry-source="' + id + '">来源</button>'; };
  const sourceOf = (data, ids) => unique((Array.isArray(ids) ? ids : [ids]).filter(Boolean)).map(id => (data.sources || []).find(item => item.id === id)).filter(Boolean);
  const sliced = rows => state.window === 'all' ? rows : rows.slice(-Number(state.window));
  const exportRows = (rows, filename) => { exportAction = () => api.download(filename + '.csv', api.csv(rows, unique(rows.flatMap(row => Object.keys(row)))), 'text/csv;charset=utf-8'); };
  const metricValue = (row, key) => key === 'occupancy_rate' || key === 'chain_rate' ? H.metric(row, key) == null ? null : H.metric(row, key) * 100 : H.metric(row, key);
  const rowSource = (file, row, extra = {}) => ({ name: row.source || '原始记录', file, ...row, ...extra });
  function kpis(items) {
    const width = ({1:12,2:6,4:3})[items.length] || 4;
    return '<div class="row row-deck row-cards mb-3">'+items.map(item=>'<div class="col-sm-6 col-xl-'+width+'">'+api.metricCard({...item,value:num(item.value,item.precision??2),changeLabel:item.change!==undefined?'同比':''})+'</div>').join('')+'</div>';
  }
  function plot(id, title, points, unit, subtitle = '', config = {}) {
    return { id, points, config: { label: title, unit, precision: 2, ...config }, html: '<div class="col-12 col-lg-6">'+api.chartCard(title,subtitle,'<div class="chart-lg" data-industry-chart="'+esc(id)+'"></div>')+'</div>' };
  }
  const plotsHtml = plots => '<div class="row row-cards mb-3">' + plots.map(item => plots.length === 1 ? item.html.replace('col-12 col-lg-6', 'col-12') : item.html).join('') + '</div>';
  function table(title, columns, rows, actions = '') {
    const count = 40, pages = Math.max(1, Math.ceil(rows.length / count)); state.page = Math.min(state.page, pages);
    return tableCard({ title, columns, rows: rows.slice((state.page - 1) * count, state.page * count), actions, footer: api.pagination(state.page,pages,rows.length,'data-industry-page') });
  }
  const ncol = (key, label, digits = 2) => ({ key, label, numeric: true, render: value => num(value, digits) });
  const sourcecol = { key: '_source', label: '来源', render: value => value || '' };
  function finish(html, plots = []) {
    $('[data-industry-body]').innerHTML = html;
    for (const item of plots) api.chart($('[data-industry-chart="' + item.id + '"]'), item.points, item.config);
  }
  function save() {
    const query = new URLSearchParams(location.search);
    for (const key of ['view', 'metric', 'period', 'window', 'region', 'segment', 'band', 'groupMetric', 'year', 'scope', 'destination', 'category', 'brand', 'holiday', 'dimension', 'companyIndex', 'display', 'cohort', 'holidays']) { if (state[key] === '' || state[key] == null) query.delete(key); else query.set(key, state[key]); }
    query.delete('embed'); query.delete('panelView'); query.delete('panelSector');
    const hash = location.pathname.endsWith('/industry.html') ? '#' + state.sector : '#view=' + state.view;
    history.replaceState(null, '', location.pathname + '?' + query + hash);
  }
  async function csvFile(file) {
    if (!cache.has(file)) cache.set(file, text(file).then(parseCSV).catch(error => { cache.delete(file); throw error; }));
    return cache.get(file);
  }
  async function overviewData() { return json('data/industry/overview.json'); }
  function metricEvidence(data, metric, point) {
    return [{ ...point, name: metric.label, unit: metric.unit, scope: metric.scope }, ...sourceOf(data, [point.sourceId, ...(point.sourceIds || []), point.changeSourceId])];
  }
  async function hotelOverview(run) {
    const [data, weekly] = await Promise.all([overviewData(), csvFile('data/hotel_industry_weekly.csv')]); if (run !== revision) return;
    const metrics = data.sectors.find(item => item.id === 'hotel').metrics;
    if (!metrics.some(item => item.id === state.metric)) state.metric = 'hotel_revpar';
    const primary = metrics.find(item => item.id === state.metric), week = point => point.periodLabel.split(' ')[0];
    const periods = primary.points.map(week); if (!periods.includes(state.period)) state.period = periods.at(-1);
    const current = metrics.map(metric => ({ metric, point: metric.points.find(point => week(point) === state.period) }));
    const points = sliced(primary.points.filter(point => week(point) <= state.period));
    const chart = plot('hotel-main', primary.label + ' · 全国', points.map(point => ({ period: week(point), label: point.periodLabel, value: point.value })), primary.unit, '全国 · 全部档次 · 周度');
    const rows = weekly.filter(row => row.period_id === state.period && row.region === '全国').sort((a, b) => ['全部', '经济型', '中档型', '高档型', '豪华型'].indexOf(a.segment) - ['全部', '经济型', '中档型', '高档型', '豪华型'].indexOf(b.segment)).map(row => {
      const prior = weekly.find(item => item.period_id === H.priorPeriod(row) && item.region === row.region && item.segment === row.segment);
      return { ...row, revpar: H.metric(row, 'revpar'), adr: H.metric(row, 'adr'), occupancy_rate: metricValue(row, 'occupancy_rate'), revpar_yoy: H.change(row, prior, 'revpar'), adr_yoy: H.change(row, prior, 'adr'), occupancy_change: H.change(row, prior, 'occupancy_rate'), _source: source('酒店周度 · ' + row.segment, [rowSource('data/hotel_industry_weekly.csv', row), prior ? rowSource('data/hotel_industry_weekly.csv', prior, { name: '同比基周' }) : null]) };
    });
    const history = points.slice().reverse().map(point => ({ period: point.periodLabel, value: point.value, change: point.change, basis: point.basis, quality: point.quality, _source: source(primary.label, metricEvidence(data, primary, point)) }));
    exportRows(points.map(point => ({ 指标: primary.label, 单位: primary.unit, 数据期间: point.periodLabel, 起始日: point.startDate, 截止日: point.endDate, 数值: point.value, 同比: point.change, 同比单位: primary.id === 'hotel_occ' ? '百分点' : '%', 口径: primary.scope, 来源: sourceOf(data, point.sourceId) })), '全国酒店_' + state.metric);
    finish(controls(field('period', '数据周', periods.slice().reverse()) + field('metric', '趋势指标', metrics.map(metric => [metric.id, metric.shortLabel || metric.label])) + windowControl()) + kpis(current.map(({ metric, point }) => ({ label: metric.shortLabel || metric.label, value: point?.value, unit: metric.unit, change: point?.change, changeUnit: metric.id === 'hotel_occ' ? ' pct' : '%', period: point?.periodLabel, basis: '全国 · 全部档次' }))) + plotsHtml([chart]) + tableCard({ title: '全国分档次 · ' + state.period, columns: [{ key: 'segment', label: '档次' }, ncol('revpar', 'RevPAR（元）'), { key: 'revpar_yoy', label: '同比', render: val => signed(val) }, ncol('adr', 'ADR（元）'), { key: 'adr_yoy', label: '同比', render: val => signed(val) }, ncol('occupancy_rate', 'OCC（%）', 1), { key: 'occupancy_change', label: '同比（pct）', render: val => signed(val, ' pct') }, sourcecol], rows }) + '<div class="mt-3">' + table('历史数据 · ' + primary.label, [{ key: 'period', label: '数据周' }, ncol('value', primary.label + '（' + primary.unit + '）'), { key: 'change', label: primary.id === 'hotel_occ' ? '同比（pct）' : '同比（%）', render: val => signed(val, primary.id === 'hotel_occ' ? ' pct' : '%') }, sourcecol], history) + '</div>', [chart]);
  }
  async function hotelCities(run) {
    const data = await csvFile('data/hotel_industry_weekly.csv'); if (run !== revision) return;
    const regions = unique(data.map(row => row.region)).sort((a, b) => a === '全国' ? -1 : b === '全国' ? 1 : a.localeCompare(b, 'zh'));
    if (!regions.includes(state.region)) state.region = '全国';
    const segments = unique(data.filter(row => row.region === state.region).map(row => row.segment)); if (!segments.includes(state.segment)) state.segment = segments.includes('全部') ? '全部' : segments[0];
    const own = H.sorted(data.filter(row => row.region === state.region && row.segment === state.segment)), periods = own.map(row => row.period_id);
    if (!periods.includes(state.period)) state.period = periods.at(-1);
    const specs = [['revpar', 'RevPAR', '元'], ['adr', 'ADR', '元'], ['occupancy_rate', 'OCC', '%']];
    if (!specs.some(([key]) => key === state.metric)) state.metric = 'revpar';
    const [metric, label, unit] = specs.find(([key]) => key === state.metric), index = H.index(own, ['period_id']);
    const selected = H.windowRows(own, state.period, state.window), latest = index.get(state.period), prior = index.get(H.priorPeriod(latest));
    const chart = plot('city', state.region + ' · ' + label, selected.map(row => ({ period: row.period_id, label: row.period_id, value: metricValue(row, metric) })), unit, state.segment + ' · 周度');
    const rows = selected.slice().reverse().map(row => ({ ...row, occupancy_rate: metricValue(row, 'occupancy_rate'), adr: H.metric(row, 'adr'), revpar: H.metric(row, 'revpar'), change: H.change(row, index.get(H.priorPeriod(row)), metric), _source: source('地区酒店数据', [rowSource('data/hotel_industry_weekly.csv', row)]) }));
    const ranking = H.rank(data.filter(row => row.period_id === state.period && row.segment === state.segment && row.region !== '全国'), metric).map(row => ({ ...row, value: metricValue(row, metric), _source: source(row.region, [rowSource('data/hotel_industry_weekly.csv', row)]) }));
    exportRows(selected, '酒店_' + state.region + '_' + state.segment);
    finish(controls(field('region', '地区', regions) + field('segment', '档次', segments) + field('period', '数据周', periods.slice().reverse()) + field('metric', '指标', specs.map(([id, name]) => [id, name])) + windowControl()) + kpis(specs.map(([key, name, measure]) => ({ label: name, value: metricValue(latest, key), unit: measure, change: H.change(latest, prior, key), changeUnit: key === 'occupancy_rate' ? ' pct' : '%', period: latest?.period_id, basis: state.region + ' · ' + state.segment }))) + plotsHtml([chart]) + table('历史经营数据', [{ key: 'period_id', label: '数据周' }, { key: 'start_date', label: '开始日' }, { key: 'end_date', label: '结束日' }, ncol('revpar', 'RevPAR（元）'), ncol('adr', 'ADR（元）'), ncol('occupancy_rate', 'OCC（%）', 1), { key: 'change', label: label + '同比', render: val => signed(val, metric === 'occupancy_rate' ? ' pct' : '%') }, sourcecol], rows) + '<div class="mt-3">' + tableCard({ title: '地区排名 · ' + label + ' · ' + state.period, columns: [{ key: 'region', label: '地区' }, ncol('value', label + '（' + unit + '）'), sourcecol], rows: ranking }) + '</div>', [chart]);
  }
  async function hotelSupply(run) {
    const rows = await csvFile('data/hotel_supply_weekly.csv'); if (run !== revision) return;
    const regions = unique(rows.map(row => row.region)); if (!regions.includes(state.region)) state.region = regions.includes('全国') ? '全国' : regions[0];
    const bands = unique(rows.map(row => row.room_band)); if (!['15间及以上', ...bands].includes(state.band)) state.band = '15间及以上';
    const periods = unique(rows.filter(row => row.region === state.region).map(row => row.period_id)).sort(); if (!periods.includes(state.period)) state.period = periods.at(-1);
    const own = periods.map(period => { const selected = rows.filter(row => row.region === state.region && row.period_id === period); return state.band === '15间及以上' ? H.supply15Plus(selected) : selected.find(row => row.room_band === state.band); }).filter(Boolean);
    const specs = [['room_count', '客房数', '间'], ['hotel_count', '酒店数', '家'], ['chain_room_count', '连锁客房数', '间'], ['chain_rate', '客房连锁化率', '%']]; if (!specs.some(([key]) => key === state.metric)) state.metric = 'room_count';
    const [metric, label, unit] = specs.find(([key]) => key === state.metric), selected = H.windowRows(own, state.period, state.window), index = H.index(own, ['period_id']), latest = index.get(state.period), prior = index.get(H.priorPeriod(latest));
    const chart = plot('supply', label, selected.map(row => ({ period: row.period_id, label: row.period_id, value: metricValue(row, metric) })), unit, state.region + ' · ' + state.band);
    const tableRows = selected.slice().reverse().map(row => ({ ...row, room_count: H.metric(row, 'room_count'), hotel_count: H.metric(row, 'hotel_count'), chain_room_count: H.metric(row, 'chain_room_count'), chain_rate: metricValue(row, 'chain_rate'), _source: source('酒店供给结构', [rowSource('data/hotel_supply_weekly.csv', row, { calculation: state.band === '15间及以上' ? '15—29、30—69、70—149、150间及以上四档完整值加总；任一档缺失则留空' : '原始档位', chainRate: '连锁客房数 / 客房数 × 100' })]) }));
    exportRows(tableRows.map(({ _source, ...row }) => row), '酒店供给_' + state.region + '_' + state.band);
    finish(controls(field('region', '地区', regions) + field('band', '房量规模', ['15间及以上', ...bands]) + field('period', '数据周', periods.slice().reverse()) + field('metric', '指标', specs.map(([key, name]) => [key, name])) + windowControl()) + kpis(specs.slice(0, 3).map(([key, name, measure]) => ({ label: name, value: metricValue(latest, key), unit: measure, change: H.change(latest, prior, key), period: state.period, basis: state.region + ' · ' + state.band }))) + plotsHtml([chart]) + table('供给历史', [{ key: 'period_id', label: '数据周' }, ncol('hotel_count', '酒店数（家）', 0), ncol('room_count', '客房数（间）', 0), ncol('chain_room_count', '连锁客房数（间）', 0), ncol('chain_rate', '客房连锁化率（%）'), sourcecol], tableRows) + databaseLinks([['data/hotel-investment-monthly.json', '住宿餐饮业固定资产投资'], ['data/hotel_supply_weekly.csv', '全部规模档位原始数据']]), [chart]);
  }
  async function hotelGroups(run) {
    const rows = await csvFile('data/hotel_group_weekly.csv'); if (run !== revision) return;
    if (!G.weeklyMetrics[state.groupMetric]) state.groupMetric = 'adr';
    const periods = G.periods(rows); if (!periods.includes(state.period)) state.period = periods.at(-1);
    const spec = G.weeklyMetrics[state.groupMetric], groupSeries = Object.entries(G.groups).map(([id, name]) => ({ name, series: G.series(rows, id, state.groupMetric) }));
    const series = groupSeries.map(item => ({ name: item.name, points: G.windowRows(item.series, state.period, state.window, periods).map(row => ({ period: row.period, label: row.period, value: row.value })) }));
    const chart = plot('groups', spec.name + ' · 酒店集团', [], spec.unit, '全国 · 酒店之家 · ' + (['adr', 'heat', 'price'].includes(state.groupMetric) ? '按入住日期统计' : '周度样本'), { series });
    const tableRows = groupSeries.flatMap(item => G.windowRows(item.series, state.period, state.window, periods).map(row => ({ group: item.name, ...row, _source: source(item.name + ' · ' + row.period, [{ name: '酒店之家集团周度数据', file: 'data/hotel_group_weekly.csv', ...row, field: spec.field, periodBasis: item.series.periodBasis, unit: spec.unit }]) }))).sort((a, b) => b.period.localeCompare(a.period) || a.group.localeCompare(b.group, 'zh'));
    exportAction = () => api.download('酒店集团_' + spec.name + '.csv', G.csv(rows, state.groupMetric, state.period, state.window));
    finish(controls(field('groupMetric', '指标', Object.entries(G.weeklyMetrics).map(([key, metric]) => [key, metric.name])) + field('period', '数据周', periods.slice().reverse()) + windowControl()) + kpis(groupSeries.map(item => { const point = G.observation(item.series, state.period); return { label: item.name + ' · ' + spec.name, value: point?.value, unit: spec.unit, change: point?.yoy?.value, period: state.period, basis: item.series.periodBasis }; })) + plotsHtml([chart]) + table('集团周度明细', [{ key: 'period', label: '数据周' }, { key: 'group', label: '集团' }, ncol('value', spec.name + '（' + spec.unit + '）'), { key: 'yoy', label: '同周同比', render: val => signed(val?.value) }, sourcecol], tableRows), [chart]);
  }
  async function hotelAnnual(run) {
    const [data, shares] = await Promise.all([json('data/hotel-association-annual.json'), csvFile('data/hotel_market_share_annual.csv')]); if (run !== revision) return;
    const years = data.years.map(String); if (!years.includes(state.year)) state.year = years.at(-1);
    const specs = [['rooms_wan', '酒店客房数', '万间'], ['hotels_wan', '酒店数', '万家'], ['chain_rate', '客房连锁化率', '%']]; if (!specs.some(([key]) => key === state.metric)) state.metric = 'rooms_wan';
    const index = years.indexOf(state.year), [metric, label, unit] = specs.find(([key]) => key === state.metric);
    const plotItem = plot('annual', label, years.map((year, i) => ({ period: year, label: year, value: data[metric][i] })), unit, '中国大陆 · 15间客房及以上');
    const annualRows = years.map((year, i) => ({ year, rooms: data.rooms_wan[i], hotels: data.hotels_wan[i], chain_rate: data.chain_rate[i], chain_store_rate: data.chain_store_rate[i], room_growth: data.rooms_growth[i], _source: source('酒店年鉴 · ' + year, [...Object.values(data.sources), { name: '原表定位', locators: data.locators, file: 'data/hotel-association-annual.json' }]) })).reverse();
    const rank = shares.filter(row => row.year === state.year).map(row => ({ ...row, market_share_pct: numeric(row.market_share_pct) })).sort((a, b) => (b.market_share_pct ?? -1) - (a.market_share_pct ?? -1));
    exportRows(annualRows.map(({ _source, ...row }) => row), '酒店年鉴');
    finish(controls(field('year', '年份', years.slice().reverse()) + field('metric', '趋势指标', specs.map(([key, name]) => [key, name]))) + kpis(specs.map(([key, name, measure]) => ({ label: name, value: data[key][index], unit: measure, period: state.year, basis: '15间客房及以上' }))) + plotsHtml([plotItem]) + table('全国酒店年度数据', [{ key: 'year', label: '年份' }, ncol('hotels', '酒店数（万家）'), ncol('rooms', '客房数（万间）'), ncol('room_growth', '客房数同比（%）'), ncol('chain_rate', '客房连锁化率（%）'), ncol('chain_store_rate', '酒店连锁化率（%）'), sourcecol], annualRows) + '<div class="mt-3">' + tableCard({ title: '集团市占率 · ' + state.year, columns: [{ key: 'group', label: '集团' }, ncol('market_share_pct', '市占率（%）'), { key: 'source', label: '来源' }], rows: rank }) + '</div>' + databaseLinks([['data/hotel-association-annual.json', '省市、品牌、集团与规模档位原表'], ['data/hotel_market_share_annual.csv', '历史集团市占率']]), [plotItem]);
  }
  async function hotelHoliday(run) {
    const all = await csvFile('data/hotel_holiday_daily.csv'); if (run !== revision) return;
    const holidays = unique(all.map(row => row.holiday_id)); if (!holidays.includes(state.holiday)) state.holiday = holidays.includes('national-day') ? 'national-day' : holidays[0];
    const dimensions = unique(all.filter(row => row.holiday_id === state.holiday).map(row => row.dimension)); if (!dimensions.includes(state.dimension)) state.dimension = dimensions[0];
    const candidates = all.filter(row => row.holiday_id === state.holiday && row.dimension === state.dimension), segments = unique(candidates.map(row => row.segment)); if (!segments.includes(state.segment)) state.segment = segments.includes('全部') ? '全部' : segments[0];
    const rows = candidates.filter(row => row.segment === state.segment).sort((a, b) => Number(a.period_day) - Number(b.period_day));
    const specs = [['revpar', 'RevPAR', '元'], ['adr', 'ADR', '元'], ['occupancy_rate', 'OCC', '%']]; if (!specs.some(([key]) => key === state.metric)) state.metric = 'revpar';
    const [metric, label, unit] = specs.find(([key]) => key === state.metric), change = (row, key) => H.change(row, { [key]: row['baseline_' + key] }, key);
    // Preserve the original holiday dashboard's arithmetic daily mean.
    const mean = key => { const values = rows.map(row => numeric(row[key])).filter(value => value !== null); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; };
    const current = Object.fromEntries(specs.map(([key]) => [key, mean(key)])), base = Object.fromEntries(specs.map(([key]) => [key, mean('baseline_' + key)]));
    const series = [{ name: '本期', points: rows.map(row => ({ period: '第' + row.period_day.padStart(2, '0') + '天', label: row.current_date, value: metricValue(row, metric) })) }, { name: '对标期', points: rows.map(row => ({ period: '第' + row.period_day.padStart(2, '0') + '天', label: row.baseline_date, value: metricValue({ [metric]: row['baseline_' + metric] }, metric) })) }];
    const chart = plot('holiday', (rows[0]?.holiday_name || '') + ' · ' + label, [], unit, state.segment + ' · 按假期日序对齐', { series });
    const tableRows = rows.map(row => ({ ...row, revpar: numeric(row.revpar), adr: numeric(row.adr), occupancy_rate: metricValue(row, 'occupancy_rate'), baseline: metricValue({ [metric]: row['baseline_' + metric] }, metric), change: change(row, metric), _source: source('酒店假期原表', [{ name: row.source_file, file: 'data/hotel_holiday_daily.csv', ...row, comparison: '按假期日序对齐', valueUnit: metric === 'occupancy_rate' ? '%' : '元', comparisonUnit: metric === 'occupancy_rate' ? '百分点' : '%' }]) }));
    exportRows(rows, '酒店假期_' + state.holiday + '_' + state.segment);
    finish(controls(field('holiday', '假期', holidays.map(id => [id, all.find(row => row.holiday_id === id).holiday_name])) + field('dimension', '分类', dimensions.map(key => [key, key === 'hotel_tier' ? '酒店档次' : '城市线级'])) + field('segment', '样本', segments) + field('metric', '趋势指标', specs.map(([key, name]) => [key, name]))) + kpis(specs.map(([key, name, measure]) => ({ label: '假期日均 ' + name, value: metricValue(current, key), unit: measure, change: H.change(current, base, key), changeUnit: key === 'occupancy_rate' ? ' pct' : '%', period: rows[0]?.current_date + ' — ' + rows.at(-1)?.current_date, basis: state.segment + ' · 日均计算' }))) + plotsHtml([chart]) + table('假期逐日数据', [{ key: 'period_day', label: '假期日序' }, { key: 'current_date', label: '本期日期' }, { key: 'baseline_date', label: '对标日期' }, ncol('revpar', 'RevPAR（元）'), ncol('adr', 'ADR（元）'), ncol('occupancy_rate', 'OCC（%）', 1), ncol('baseline', label + '对标值'), { key: 'change', label: label + '变化', render: val => signed(val, metric === 'occupancy_rate' ? ' pct' : '%') }, sourcecol], tableRows), [chart]);
  }
  const basisNames = { monthly: '单月', combined: '1—2月合并', ytd: '年初累计', cumulative: '年初累计', year: '全年', point: '交易日', quarter: '单季' };
  const dutyfreeFiles = [
    ['data/dutyfree/hainan.json', '海南离岛免税'], ['data/dutyfree/ctg_dutyfree.json', '中国中免'],
    ['data/dutyfree/airport.json', '机场免税'], ['data/dutyfree/city_dutyfree.json', '市内免税'],
    ['data/dutyfree/companies.json', '公司数据库'], ['data/dutyfree/policy.json', '政策与额度'],
    ['data/dutyfree/members.json', '会员与客户'], ['data/dutyfree/category.json', '商品品类'],
    ['data/dutyfree/channel.json', '渠道跟踪'], ['data/dutyfree/events.json', '事件记录'],
    ['data/dutyfree/monthly-provenance.json', '月度数据来源与计算依据'], ['data/dutyfree/sources.json', '完整来源目录']
  ];
  async function sectorOverview(run) {
    const data = await overviewData(); if (run !== revision) return;
    const metrics = data.sectors.find(item => item.id === state.sector)?.metrics || [];
    if (!metrics.length) throw new Error('当前板块暂无指标记录');
    if (!metrics.some(item => item.id === state.metric)) state.metric = metrics[0].id;
    const metric = metrics.find(item => item.id === state.metric), bases = unique(metric.points.map(point => point.basis || 'monthly'));
    if (!bases.includes(state.scope)) state.scope = bases.includes('monthly') ? 'monthly' : bases[0];
    const own = metric.points.filter(point => (point.basis || 'monthly') === state.scope).slice().sort((a, b) => a.period.localeCompare(b.period));
    const periods = own.map(point => point.period); if (!periods.includes(state.period)) state.period = periods.at(-1);
    const selected = sliced(own.filter(point => point.period <= state.period)), current = own.find(point => point.period === state.period);
    const chart = plot('sector', metric.label, selected.map(point => ({ period: point.period, label: point.periodLabel, value: point.value })), metric.unit, metric.scope + ' · ' + basisNames[state.scope]);
    const featured = state.sector === 'dutyfree' ? ['dutyfree_sales', 'dutyfree_shoppers', 'dutyfree_spend'] : [metric.id];
    const cards = featured.map(id => { const m = metrics.find(item => item.id === id), point = m?.points.find(item => item.period === state.period && (item.basis || 'monthly') === state.scope); return { label: m?.label, value: point?.value, unit: m?.unit, period: point?.periodLabel || current?.periodLabel, changeText: point?.changeLabel || '', basis: (id === 'dutyfree_spend' ? '同期间金额 ÷ 人次 · 测算' : m?.scope) }; });
    const rows = selected.slice().reverse().map(point => ({ ...point, basisLabel: basisNames[point.basis] || point.basis, _source: source(metric.label + ' · ' + point.periodLabel, metricEvidence(data, metric, point)) }));
    exportRows(selected.map(point => ({ 指标: metric.label, 单位: metric.unit, 统计范围: metric.scope, ...point, sources: metricEvidence(data, metric, point) })), names[state.sector] + '_' + metric.label);
    const links = state.sector === 'dutyfree' ? databaseLinks(dutyfreeFiles, '免税分类数据库') : state.sector === 'dining' ? databaseLinks([['data/dining/observations.json', '餐饮品牌经营跟踪原表'], ['data/industry/overview.json', '行业全部指标与计算来源']]) : databaseLinks([['data/gold-jewelry/observations.json', '黄金珠宝指标与历史资料'], ['data/gold-jewelry/company-operations.json', '黄金珠宝公司经营'], ['data/industry/overview.json', '行业指标原始记录']]);
    finish(controls(field('metric', '指标', metrics.map(item => [item.id, item.label])) + field('scope', '期间口径', bases.map(key => [key, basisNames[key] || key])) + field('period', '数据期间', own.slice().reverse().map(point => [point.period, point.periodLabel])) + windowControl()) + kpis(cards) + plotsHtml([chart]) + table(metric.label + ' · 历史数据', [{ key: 'periodLabel', label: '数据期间' }, ncol('value', '数值（' + metric.unit + '）', metric.precision ?? 2), { key: 'changeLabel', label: '原始同比说明' }, { key: 'basisLabel', label: '期间口径' }, { key: 'quality', label: '数据状态' }, sourcecol], rows) + links, [chart]);
  }
  async function dutyfreeKorea(run) {
    const data = await json('data/dutyfree/korea.json'); if (run !== revision) return;
    const K = window.KoreaDutyfree; if (!K) throw new Error('韩国免税数据模型尚未加载');
    if (!K.scopes[state.cohort]) state.cohort = 'total';
    const all = K.derive(data), own = all.filter(row => row.scope === state.cohort), periods = own.map(row => row.period);
    if (!periods.includes(state.period)) state.period = periods.at(-1);
    const selected = K.series(all.filter(row => row.period <= state.period), state.cohort, state.window), latest = own.find(row => row.period === state.period);
    const specs = [['salesUsd', '免税销售额', '亿美元', 1e8], ['shoppers', '购物人次', '万人次', 1e4], ['spendUsd', '客单价 · 测算', '美元/人次', 1]];
    if (!specs.some(([key]) => key === state.metric)) state.metric = 'salesUsd';
    const [metric, label, unit, divisor] = specs.find(([key]) => key === state.metric);
    const chart = plot('korea', label, selected.map(row => ({ period: row.period, label: row.period, value: finite(row[metric]) ? row[metric] / divisor : null })), unit, '韩国 · ' + K.scopes[state.cohort]);
    const precision = { raw: '原始值', 'provider-rounded': '转引值已舍入', derived: '计算值', estimated: '由舍入值测算', calculated: '同月原值计算', unavailable: '基期缺失' };
    const rows = selected.slice().reverse().map(row => ({ ...row, sales: finite(row.salesUsd) ? row.salesUsd / 1e8 : null, shoppersWan: finite(row.shoppers) ? row.shoppers / 1e4 : null, precision: precision[row[metric + 'Precision']] || row[metric + 'Precision'] || '缺失', _source: source('韩国免税 · ' + row.period + ' · ' + K.scopes[state.cohort], [{ name: data.sourceName, file: 'data/dutyfree/korea.json', ...row, valueUnit: metric === 'salesUsd' ? '美元' : metric === 'shoppers' ? '人次' : '美元/人次', calculation: '客单价 = 同组销售额 ÷ 同组人次；同比仅比较上年同月同组' }, ...sourceOf(data, [row.salesUsdSource, row.shoppersSource])]) }));
    exportRows(K.exports(selected), '韩国免税_' + K.scopes[state.cohort]);
    finish(controls(field('cohort', '顾客分类', Object.entries(K.scopes)) + field('metric', '趋势指标', specs.map(([key, name]) => [key, name])) + field('period', '数据月', periods.slice().reverse()) + windowControl()) + kpis(specs.map(([key, name, measure, scale]) => ({ label: name, value: finite(latest?.[key]) ? latest[key] / scale : null, unit: measure, change: latest?.[key + 'Yoy'], period: state.period, basis: K.scopes[state.cohort] + ' · ' + (precision[latest?.[key + 'YoyMethod']] || '') }))) + plotsHtml([chart]) + table('韩国免税月度明细', [{ key: 'period', label: '月份' }, ncol('sales', '销售额（亿美元）', 3), ncol('salesUsdYoy', '销售额同比（%）', 1), ncol('shoppersWan', '购物人次（万）', 2), ncol('shoppersYoy', '人次同比（%）', 1), ncol('spendUsd', '客单价（美元/人次）'), { key: 'precision', label: '当前指标精度' }, sourcecol], rows) + databaseLinks([['data/dutyfree/korea.json', '韩国免税美元原值、转引精度与来源']]), [chart]);
  }
  async function dutyfreeHolidays(run) {
    const data = await json('data/dutyfree/holidays.json'); if (run !== revision) return;
    const holidays = unique(data.records.map(row => row.holiday)), years = unique(data.records.map(row => String(row.year)));
    if (!['all', ...holidays].includes(state.holiday)) state.holiday = 'all';
    if (!['all', ...years].includes(state.year)) state.year = years.slice().sort().at(-1);
    const rows = data.records.filter(row => (state.holiday === 'all' || row.holiday === state.holiday) && (state.year === 'all' || String(row.year) === state.year)).slice().sort((a, b) => b.year - a.year || b.period.localeCompare(a.period));
    const tableRows = rows.map(row => ({ ...row, kindLabel: row.kind === 'holiday' ? '完整假期' : '阶段记录', _source: source('离岛免税 · ' + row.year + row.holiday, [{ name: data.sourceFile || '免税假期原表', file: 'data/dutyfree/holidays.json', ...row, units: '购物金额：亿元；购物人次：万人次；客单价：元/人次；日均依原表天数计算' }, row.web_source]) }));
    exportRows(dutyfreeHolidayExportRows(data, rows), '离岛免税假期_' + state.year + '_' + state.holiday);
    finish(controls(field('year', '年份', [['all', '全部年份'], ...years.slice().sort().reverse()]) + field('holiday', '假期或阶段', [['all', '全部假期'], ...holidays])) + '<div class="alert alert-info">完整假期与首日、前几日等阶段记录分别保留。每条记录的天数、披露同比与日均同比使用原始口径。</div>' + table('离岛免税假期数据', [{ key: 'year', label: '年份' }, { key: 'holiday', label: '假期' }, { key: 'kindLabel', label: '记录类型' }, { key: 'period', label: '日期范围' }, ncol('days', '天数', 0), ncol('sales', '金额（亿元）'), ncol('shoppers', '人次（万）'), ncol('spend', '客单价（元）'), ncol('daily_sales', '日均金额（亿元）'), ncol('daily_yoy', '日均金额同比（%）'), ncol('reported_sales_yoy', '披露金额同比（%）'), sourcecol], tableRows) + databaseLinks([['data/dutyfree/holidays.json', '假期全字段、单元格与公式']]) );
  }
  function travelEvidence(data, row, extra = {}) {
    const ids = unique([row.sourceId, row.comparisonSourceId, row.foreignInSourceId, ...(row.sourceIds || []), ...(row.comparisonSourceIds || []), ...Object.entries(row).filter(([key, value]) => /SourceIds$/.test(key) && Array.isArray(value)).flatMap(([, value]) => value)]);
    return [{ name: '旅游数据原始记录', file: 'data/tourism/dashboard.json', ...row, ...extra }, ...sourceOf(data, ids)];
  }
  async function travelDomestic(run) {
    const data = await json('data/tourism/dashboard.json'); if (run !== revision) return;
    const scopes = [['quarter', '全国 · 单季'], ['ytd', '全国 · 年初累计'], ['holiday', '全国 · 假期'], ['changbai', '长白山 · 月度'], ['jiuzhai', '九寨沟 · 日度'], ...data.domestic.scenicOther.flatMap(item => [[item.id, item.name + ' · 月度'], ...(item.ytd?.length ? [[item.id + '-ytd', item.name + ' · 累计']] : [])])];
    if (!scopes.some(([key]) => key === state.scope)) state.scope = 'quarter';
    if (state.scope === 'quarter' || state.scope === 'ytd') {
      const years = unique(data.domestic.quarters.map(row => String(row.year))); if (!['recent', 'all', ...years].includes(state.year)) state.year = 'recent';
      const rows = T.domesticQuarterRows(data, state.year, state.scope).slice().sort((a, b) => a.period.localeCompare(b.period));
      const specs = [['trips', '国内出游人次', '亿人次'], ['spend', '国内出游花费', '亿元'], ['perTrip', '人均出游花费 · 测算', '元/人次']]; if (!specs.some(([key]) => key === state.metric)) state.metric = 'trips';
      const [key, label, unit] = specs.find(([key]) => key === state.metric), latest = rows.at(-1), basis = state.scope === 'quarter' ? '单季' : '年初累计';
      const chart = plot('travel-domestic', label, rows.map(row => ({ period: row.period, label: row.period, value: row[key] })), unit, basis);
      const tableRows = rows.slice().reverse().map(row => ({ ...row, basis: row.tripsBasis + '；' + row.spendBasis, _source: source(row.period + ' · ' + basis, travelEvidence(data, row, { unit: '人次：亿人次；花费：亿元；人均花费：元/人次' })) }));
      exportRows(rows.map(row => ({ ...row, 期间口径: basis, 人次单位: '亿人次', 花费单位: '亿元', 人均花费单位: '元/人次', sources: travelEvidence(data, row) })), '国内旅游_' + basis);
      finish(controls(field('scope', '数据系列', scopes) + yearControl(years) + field('metric', '趋势指标', specs.map(([key, name]) => [key, name]))) + kpis(specs.map(([key, name, unit]) => ({ label: name, value: latest?.[key], unit, change: latest?.[key + 'YoY'], period: latest?.period, basis: basis + ' · ' + (latest?.[key + 'Basis'] || '') }))) + plotsHtml([chart]) + table('国内旅游 · ' + basis, [{ key: 'period', label: '期间' }, ncol('trips', '出游（亿人次）'), ncol('tripsYoY', '人次同比（%）'), ncol('spend', '花费（亿元）'), ncol('spendYoY', '花费同比（%）'), ncol('perTrip', '人均花费（元）'), ncol('perTripYoY', '人均同比（%）'), { key: 'basis', label: '数值口径' }, sourcecol], tableRows) + databaseLinks([['data/tourism/dashboard.json', '旅游综合数据库与景区可获得性说明']]), [chart]);
      return;
    }
    if (state.scope === 'holiday') {
      const all = data.domestic.holidays, years = unique(all.map(row => String(row.year))), holidays = unique(all.map(row => row.holiday));
      if (!['all', ...years].includes(state.year)) state.year = years.slice().sort().at(-1);
      if (!['all', ...holidays].includes(state.holiday)) state.holiday = 'all';
      const rows = all.filter(row => (state.year === 'all' || String(row.year) === state.year) && (state.holiday === 'all' || row.holiday === state.holiday)).slice().sort((a, b) => b.year - a.year || b.order - a.order);
      const tableRows = rows.map(row => ({ ...row, _source: source('国内旅游 · ' + row.period, travelEvidence(data, row)) }));
      exportRows(rows.map(row => ({ ...row, sources: travelEvidence(data, row) })), '国内旅游假期');
      finish(controls(field('scope', '数据系列', scopes) + field('year', '年份', [['all', '全部年份'], ...years.slice().sort().reverse()]) + field('holiday', '假期', [['all', '全部假期'], ...holidays])) + table('国内假期旅游 · 总量与日均', [{ key: 'period', label: '假期' }, ncol('days', '天数', 0), ncol('trips', '出游（亿人次）'), ncol('tripsYoY', '披露人次同比（%）'), ncol('spend', '花费（亿元）'), ncol('spendYoY', '披露花费同比（%）'), ncol('dailyTrips', '日均人次（亿）'), ncol('dailySpend', '日均花费（亿元）'), ncol('perTrip', '人均花费（元）'), sourcecol], tableRows));
      return;
    }
    const cumulative = state.scope.endsWith('-ytd'), enterprise = data.domestic.scenicOther.find(item => item.id === state.scope.replace(/-ytd$/, ''));
    const records = state.scope === 'changbai' ? data.domestic.changbai : state.scope === 'jiuzhai' ? data.domestic.jiuzhai : (cumulative ? enterprise?.ytd : enterprise?.records) || [];
    const label = state.scope === 'changbai' ? '长白山景区' : state.scope === 'jiuzhai' ? '九寨沟景区' : enterprise?.name || '景区';
    const frequency = state.scope === 'jiuzhai' ? 'day' : 'month', unit = state.scope === 'jiuzhai' ? '人次' : enterprise?.unit || '万人次';
    const years = unique(records.map(row => row.period.slice(0, 4))); if (!['recent', 'all', ...years].includes(state.year)) state.year = 'recent';
    const rows = sliced(T.continuous(T.yearRows(records, state.year), frequency)), latest = rows.at(-1), basis = (enterprise?.basis || '景区披露客流') + (cumulative ? ' · 年初累计' : frequency === 'day' ? ' · 日度' : ' · 单月');
    const chart = plot('scenic', label, rows.map(row => ({ period: row.period, label: row.period, value: row.value })), unit, basis);
    const tableRows = rows.slice().reverse().map(row => ({ ...row, _source: source(label + ' · ' + row.period, travelEvidence(data, row, { unit, basis })) }));
    exportRows(rows.map(row => ({ 景区或企业: label, 单位: unit, 口径: basis, ...row, sources: travelEvidence(data, row) })), label + '_' + (cumulative ? '累计' : '期间'));
    finish(controls(field('scope', '数据系列', scopes) + yearControl(years) + windowControl()) + kpis([{ label, value: latest?.value, unit, change: latest?.change, period: latest?.period, basis }]) + plotsHtml([chart]) + table(label + ' · 原始期间数据', [{ key: 'period', label: '期间' }, { key: 'value', label: '客流（' + unit + '）', numeric: true, render: (value, row) => esc(row.qualifier || '') + num(value, 2) }, ncol('change', '同比（%）'), { key: 'changeBasis', label: '同比依据' }, { key: 'valueBasis', label: '数值口径' }, sourcecol], tableRows), [chart]);
  }
  async function travelInbound(run) {
    const data = await json('data/tourism/dashboard.json'); if (run !== revision) return;
    const scopes = { q1: '第一季度 · 单季', q3: '第三季度 · 单季', h1: '上半年', annual: '全年' };
    if (!scopes[state.scope]) state.scope = 'q3';
    const rows = T.borderRows(data, state.scope), specs = [['total', '出入境查验总人次'], ['foreign', '外国人出入境查验人次'], ['foreignIn', '外国人入境人次'], ['visaFree', '外国人免签入境人次']];
    if (!specs.some(([key]) => key === state.metric)) state.metric = 'foreignIn';
    const [key, label] = specs.find(([key]) => key === state.metric), latest = rows.at(-1), chart = plot('inbound', label, rows.map(row => ({ period: row.period, label: row.period, value: row[key] })), '万人次', scopes[state.scope] + ' · 国家移民管理局口径');
    const tableRows = rows.slice().reverse().map(row => ({ ...row, _source: source('出入境查验 · ' + row.period, travelEvidence(data, row)) }));
    const tourists = data.inbound.tourists.slice().reverse().map(row => ({ ...row, _source: source('入境旅游 · ' + row.period, travelEvidence(data, row)) }));
    exportRows(rows.map(row => ({ 统计范围: '出入境查验', 期间口径: scopes[state.scope], 单位: '万人次；占比为%', ...row, sources: travelEvidence(data, row) })), '出入境查验_' + state.scope);
    finish(controls(field('scope', '期间口径', Object.entries(scopes)) + field('metric', '趋势指标', specs)) + kpis([['foreignIn', '外国人入境', 'foreignInYoY'], ['visaFree', '外国人免签入境', 'visaYoY'], ['foreign', '外国人出入境查验', 'foreignYoY']].map(([key, label, change]) => ({ label, value: latest?.[key], unit: '万人次', change: latest?.[change], period: latest?.period, basis: scopes[state.scope] }))) + plotsHtml([chart]) + table('出入境查验 · ' + scopes[state.scope], [{ key: 'period', label: '期间' }, { key: 'total', label: '总人次（万）', numeric: true, render: (val, row) => esc(row.totalQualifier || '') + num(val, 1) }, ncol('foreign', '外国人（万）'), ncol('foreignIn', '外国人单向入境（万）'), ncol('visaFree', '免签入境（万）'), ncol('visaShare', '免签占入境比重（%）'), { key: 'note', label: '口径与修订说明' }, sourcecol], tableRows) + '<div class="mt-3">' + tableCard({ title: '文旅部 · 入境旅游人数 · 完整年度', columns: [{ key: 'period', label: '年度' }, ncol('total', '入境旅游（万人次）'), ncol('totalYoY', '同比（%）'), ncol('foreign', '外国游客（万人次）'), ncol('hmt', '港澳台游客（万人次）'), sourcecol], rows: tourists }) + '</div>', [chart]);
  }
  async function travelOutbound(run) {
    const data = await json('data/tourism/dashboard.json'); if (run !== revision) return;
    const destinations = data.outbound.destinations, scopes = [['month', '单月'], ['ytd', '年初累计'], ['annual', '完整年度']];
    if (!destinations.some(item => item.name === state.destination)) state.destination = destinations[0].name;
    if (!scopes.some(([key]) => key === state.scope)) state.scope = 'month';
    const destination = destinations.find(item => item.name === state.destination), years = unique(destination.records.map(row => row.period.slice(0, 4)));
    if (!['recent', 'all', ...years].includes(state.year)) state.year = 'recent';
    const rows = state.scope === 'annual' ? T.yearRows(T.annualRows(destination), state.year) : T.outboundRows(destination, state.year, state.scope), latest = rows.at(-1), unit = destination.unit || '万人次', basis = scopes.find(([key]) => key === state.scope)[1];
    const enrich = row => {
      if (state.scope !== 'ytd') return row;
      const month = row.period.slice(5, 7), year = Number(row.period.slice(0, 4)), inputs = destination.records.filter(item => [year, year - 1].includes(Number(item.period.slice(0, 4))) && item.period.slice(5, 7) <= month);
      return { ...row, changeBasis: '年初至同月全部月份完整时累计；同比使用上年同期间完整累计值', sourceIds: unique(inputs.map(item => item.sourceId)), calculationInputs: inputs };
    };
    const enriched = rows.map(enrich), chart = plot('outbound', '中国访客赴' + state.destination, rows.map(row => ({ period: row.period, label: row.period, value: row.value })), unit, basis + (destination.basis ? ' · ' + destination.basis : ''));
    const tableRows = enriched.slice().reverse().map(row => ({ ...row, _source: source(state.destination + ' · ' + row.period, travelEvidence(data, row, { unit, scope: basis })) }));
    exportRows(enriched.map(row => ({ 目的地: state.destination, 单位: unit, 期间口径: basis, ...row, sources: travelEvidence(data, row) })), '出境旅游_' + state.destination + '_' + basis);
    const national = data.outbound.nationalAnnual.slice().reverse().map(row => ({ ...row, _source: source('全国出境旅游 · ' + row.period, travelEvidence(data, row)) }));
    const mainland = data.inbound.border.filter(row => finite(row.mainlandOut)).slice().reverse().map(row => ({ ...row, scopeLabel: ({ annual: '全年', h1: '上半年', q1: '第一季度', q3: '第三季度' })[row.scope], _source: source('内地居民单向出境 · ' + row.period, travelEvidence(data, row)) }));
    finish(controls(field('destination', '目的地', destinations.map(item => item.name)) + field('scope', '期间口径', scopes) + yearControl(years)) + kpis([{ label: '中国访客赴' + state.destination, value: latest?.value, unit, change: latest?.change, period: latest?.period, basis }]) + plotsHtml([chart]) + table('目的地客流 · ' + state.destination, [{ key: 'period', label: '期间' }, ncol('value', '客流（' + unit + '）', 4), ncol('change', '同口径同比（%）'), { key: 'changeBasis', label: '计算依据' }, sourcecol], tableRows) + '<div class="row row-cards mt-1"><div class="col-lg-6">' + tableCard({ title: '文旅部 · 全国出境旅游人数', columns: [{ key: 'period', label: '年度' }, ncol('value', '人数（万人次）'), ncol('change', '披露同比（%）'), sourcecol], rows: national }) + '</div><div class="col-lg-6">' + tableCard({ title: '国家移民管理局 · 内地居民单向出境', columns: [{ key: 'period', label: '期间' }, { key: 'scopeLabel', label: '统计口径' }, ncol('mainlandOut', '人次（万）'), ncol('mainlandOutYoY', '同比（%）'), sourcecol], rows: mainland }) + '</div></div>', [chart]);
  }
  async function cruise(run) {
    const [industry, details] = await Promise.all([json('data/tourism/three-gorges-cruises.json'), json('data/tourism/three-gorges-details.json')]); if (run !== revision) return;
    const model = C.create(industry, details), periods = model.periods;
    if (!periods.includes(state.period)) state.period = periods.at(-1);
    const chosen = model.windowPeriods(state.period, state.window), evidence = (period, extra = {}) => {
      const record = model.at(period), previous = model.at(C.previousYear(period));
      const ids = unique([...(record.industry?.sourceIds || []), record.detail?.sourceId, ...(previous.industry?.sourceIds || []), previous.detail?.sourceId]);
      return [{ name: '三峡游轮 · ' + period, file: 'data/tourism/three-gorges-cruises.json', industry: record.industry, detail: record.detail, ...extra }, ...ids.map(id => model.sourceById.get(id)).filter(Boolean)];
    };
    const baseControl = field('period', '数据月', periods.slice().reverse()) + windowControl();
    if (state.view === 'overview') {
      if (!['monthly', 'ytd'].includes(state.scope)) state.scope = 'monthly';
      const specs = [['passengers', '客运量', '万人', 'passengersYoY'], ['sailings', '发船量', '艘次', 'sailingsYoY'], ['load', '平均载客率', '%', 'loadYoYPp']];
      if (!specs.some(([key]) => key === state.metric)) state.metric = 'passengers';
      const [key, label, unit] = specs.find(([key]) => key === state.metric), basis = state.scope === 'monthly' ? '单月' : '年初累计', current = model.at(state.period).industry?.[state.scope];
      const rows = chosen.map(period => ({ period, ...(model.at(period).industry?.[state.scope] || {}), status: model.at(period).industry?.status, _source: source('三峡游轮 · ' + period + ' · ' + basis, evidence(period, { scope: basis })) }));
      const chart = plot('cruise-main', label, rows.map(row => ({ period: row.period, label: row.period, value: row[key] })), unit, basis + ' · 省际游轮');
      exportRows(chosen.map(period => ({ 数据月: period, 期间口径: basis, ...model.at(period).industry?.[state.scope], 单位: industry.units, sources: evidence(period) })), '三峡游轮_' + basis);
      finish(controls(field('scope', '期间口径', [['monthly', '单月'], ['ytd', '年初累计']]) + field('metric', '趋势指标', specs.map(([key, label]) => [key, label])) + baseControl) + kpis(specs.map(([key, label, unit, growth]) => ({ label, value: current?.[key], unit, change: current?.[growth], changeUnit: key === 'load' ? ' pct' : '%', period: state.period, basis }))) + plotsHtml([chart]) + table('三峡游轮运行 · ' + basis, [{ key: 'period', label: '月份' }, ncol('passengers', '客运量（万人）', 4), ncol('passengersYoY', '客运同比（%）'), ncol('sailings', '发船（艘次）', 0), ncol('sailingsYoY', '发船同比（%）'), ncol('load', '载客率（%）'), ncol('loadYoYPp', '载客率同比（pct）'), ncol('nonOvernightPassengers', '非跨夜客运（万人）', 4), sourcecol], rows.slice().reverse()) + databaseLinks([['data/tourism/three-gorges-cruises.json', '游轮完整行业数据与字段来源'], ['data/tourism/three-gorges-details.json', '游客与公司原始月表']]), [chart]);
      return;
    }
    if (state.view === 'audience') {
      const specs = [['senior', '60岁以上国内游客占比', '%'], ['minor', '18岁以下国内游客占比', '%'], ['foreignShare', '境外游客占总客流比重', '%'], ['foreign', '境外客运量', '万人'], ['domestic', '国内客运量', '万人']];
      if (!specs.some(([key]) => key === state.metric)) state.metric = 'senior';
      const [key, label, unit] = specs.find(([key]) => key === state.metric), latest = model.audience(state.period), rows = chosen.map(period => model.audience(period));
      const chart = plot('cruise-audience', label, rows.map(row => ({ period: row.period, label: row.period, value: row[key] })), unit, '月度 · 年龄占比以国内游客为分母');
      const ages = details.ageLabels.map((name, index) => ({ name, value: model.at(state.period).detail?.ages[index] ?? null, _source: source('国内游客年龄 · ' + state.period, evidence(state.period, { ageCategory: name })) }));
      const tableRows = rows.slice().reverse().map(row => ({ ...row, _source: source('游客结构 · ' + row.period, evidence(row.period, { calculations: '18岁以下 = 12岁以下 + 12—18岁；同比取上年同月，同占比相减为百分点' })) }));
      exportAction = () => api.download('三峡游轮_游客结构.csv', model.csv(state.period, 'audience', state.companyIndex, state.window));
      finish(controls(field('metric', '趋势指标', specs.map(([key, name]) => [key, name])) + baseControl) + kpis([{ label: '60岁以上国内游客占比', value: latest.senior, unit: '%', change: latest.seniorDelta, changeUnit: ' pct', period: state.period, basis: '国内游客' }, { label: '18岁以下国内游客占比', value: latest.minor, unit: '%', change: latest.minorDelta, changeUnit: ' pct', period: state.period, basis: '两年龄段加总测算' }, { label: '境外游客占比', value: latest.foreignShare, unit: '%', change: latest.foreignShareDelta, changeUnit: ' pct', period: state.period, basis: '全部客流' }]) + plotsHtml([chart]) + tableCard({ title: '国内游客年龄结构 · ' + state.period, columns: [{ key: 'name', label: '年龄' }, ncol('value', '占比（%）'), sourcecol], rows: ages }) + '<div class="mt-3">' + table('游客结构历史', [{ key: 'period', label: '月份' }, ncol('domestic', '国内客运（万人）'), ncol('foreign', '境外客运（万人）'), ncol('foreignYoY', '境外同比（%）'), ncol('foreignShare', '境外占比（%）'), ncol('senior', '60岁以上（%）'), ncol('minor', '18岁以下（%）'), sourcecol], tableRows) + '</div>', [chart]);
      return;
    }
    if (!Number.isInteger(Number(state.companyIndex)) || Number(state.companyIndex) < 0 || Number(state.companyIndex) >= details.companyLabels.length) state.companyIndex = 6;
    state.companyIndex = Number(state.companyIndex);
    const latest = model.company(state.period, state.companyIndex), specs = [['value', '客运量', '万人'], ['share', '行业份额', '%'], ['yoy', '同月客运量同比 · 测算', '%']];
    if (!specs.some(([key]) => key === state.metric)) state.metric = 'value';
    const [key, label, unit] = specs.find(([key]) => key === state.metric), series = details.companyLabels.map((name, index) => ({ name, points: chosen.map(period => ({ period, label: period, value: model.company(period, index)[key] })) }));
    const chart = plot('cruise-companies', label + ' · 船公司比较', [], unit, '湖北籍省际游轮 · 不含非跨夜游', { series });
    const rank = model.ranking(state.period).map(row => ({ ...row, _source: source(row.name + ' · ' + row.period, evidence(row.period, row)) }));
    const rows = chosen.map(period => model.company(period, state.companyIndex)).reverse().map(row => ({ ...row, _source: source(row.name + ' · ' + row.period, evidence(row.period, row)) }));
    exportAction = () => api.download('三峡游轮_船公司.csv', model.csv(state.period, 'operators', state.companyIndex, state.window));
    finish(controls(field('companyIndex', '重点公司', details.companyLabels.map((name, index) => [index, name])) + field('metric', '比较指标', specs.map(([key, name]) => [key, name])) + baseControl) + kpis([{ label: latest.name + ' · 客运量', value: latest.value, unit: '万人', change: latest.yoy, period: state.period, basis: '同比由两年同月舍入值测算' }, { label: '行业份额', value: latest.share, unit: '%', change: latest.shareDelta, changeUnit: ' pct', period: state.period, basis: latest.shareStatus }, { label: '较行业增速', value: latest.excess, unit: 'pct', period: state.period, basis: '公司测算同比减行业披露同比' }]) + plotsHtml([chart]) + tableCard({ title: '船公司当月排名 · ' + state.period, columns: [{ key: 'name', label: '公司' }, ncol('value', '客运量（万人）'), ncol('yoy', '同比（%）'), ncol('share', '行业份额（%）'), { key: 'shareStatus', label: '份额口径' }, sourcecol], rows: rank }) + '<div class="mt-3">' + table(latest.name + ' · 历史明细', [{ key: 'period', label: '月份' }, ncol('value', '客运量（万人）'), ncol('prior', '上年同月（万人）'), ncol('yoy', '同比（%）'), ncol('share', '份额（%）'), ncol('shareDelta', '份额同比（pct）'), sourcecol], rows) + '</div>', [chart]);
  }
  async function diningBrands(run) {
    const data = await json('data/dining/observations.json'); if (run !== revision) return;
    const categories = unique(data.brands.map(brand => brand.category)), years = unique(data.periods.map(period => period.id.slice(0, 4)));
    if (!['all', ...categories].includes(state.category)) state.category = 'all';
    if (!['all', ...years].includes(state.year)) state.year = 'all';
    const filtered = D.filtered(data, { category: state.category, year: state.year, holidays: state.holidays === 'true' });
    if (!['all', ...filtered.brands.map(brand => brand.id)].includes(state.brand)) state.brand = 'all';
    const rows = filtered.records.filter(row => state.brand === 'all' || row.brandId === state.brand), brand = filtered.brands.find(item => item.id === state.brand);
    const tableRows = rows.map(row => { const b = data.brands.find(brand => brand.id === row.brandId); return { ...row, brand: b.name, category: b.category, metricLabel: D.metric(data, row, b), periodLabel: (row.sourcePeriodLabel || row.periodLabel || row.period).replace('（原图合并）', ''), _source: source(b.name + ' · ' + row.periodLabel, [{ name: '品牌经营原始记录', file: 'data/dining/observations.json', ...row }, D.source(data, row)]) }; });
    const charts = [], controlsForMetric = [];
    if (brand) {
      const groups = unique(rows.filter(row => row.scope === 'month').map(row => D.metric(data, row, brand) + '|' + row.unit));
      if (!groups.includes(state.metric)) state.metric = groups[0] || '';
      if (groups.length) {
        const [label, unit] = state.metric.split('|');
        const monthly = D.monthly(data, brand.id).filter(row => state.year === 'all' || row.period.startsWith(state.year)).map(row => { const record = data.records.find(item => item.brandId === brand.id && item.period === row.period && item.scope === 'month'); return { ...row, value: record && D.metric(data, record, brand) + '|' + record.unit === state.metric ? row.value : null }; });
        charts.push(plot('dining-brand', brand.name + ' · ' + label, monthly, unit, '仅单月记录 · 季度及合并期间见原表'));
        controlsForMetric.push(field('metric', '趋势口径', groups.map(key => [key, key.replace('|', ' · ')])));
      }
    }
    const exportData = D.csvRows(data, { category: state.category, year: state.year, holidays: state.holidays === 'true' }).filter(row => !brand || row['品牌'] === brand.name);
    exportRows(exportData, '餐饮品牌_' + (brand?.name || state.category));
    finish(controls(field('category', '业态', [['all', '全部业态'], ...categories]) + field('brand', '品牌', [['all', '全部品牌'], ...filtered.brands.map(brand => [brand.id, brand.name])]) + field('year', '年份', [['all', '全部年份'], ...years.slice().sort().reverse()]) + field('holidays', '假期记录', [['true', '包含假期'], ['false', '仅常规期间']]) + controlsForMetric.join('')) + (charts.length ? plotsHtml(charts) : '') + table('品牌经营跟踪 · ' + rows.length + ' 条原始记录', [{ key: 'periodLabel', label: '原始期间' }, { key: 'brand', label: '品牌' }, { key: 'category', label: '业态' }, { key: 'metricLabel', label: '指标口径' }, { key: 'raw', label: '原始展示值' }, { key: 'scope', label: '期间类型', render: val => esc(({ month: '单月', quarter: '季度', holiday: '假期', ytd: '累计' })[val] || val) }, { key: 'dataNature', label: '数据性质' }, { key: 'metricNote', label: '口径补充' }, sourcecol], tableRows) + databaseLinks([['data/dining/observations.json', '全部品牌、期间、原文与来源状态']]), charts);
  }
  async function recruitment(run) {
    const data = await json('data/recruitment/observations.json'); if (run !== revision) return;
    const years = unique(data.rows.map(row => row.month.slice(0, 4))); if (!['recent', 'all', ...years].includes(state.year)) state.year = 'recent';
    const rows = sliced(T.yearRows(data.rows.map(row => ({ ...row, period: row.month })), state.year)), latest = rows.at(-1), specs = [['posts', '招聘岗位数', '万个', 1e4], ['salary', '平均招聘年薪', '万元/年', 1e4]];
    if (!specs.some(([key]) => key === state.metric)) state.metric = 'posts';
    if (!['value', 'change'].includes(state.display)) state.display = 'value';
    const [key, label, unit, divisor] = specs.find(([key]) => key === state.metric), chartUnit = state.display === 'change' ? '%' : unit;
    const chart = plot('recruitment', label + (state.display === 'change' ? ' · 同比' : ''), rows.map(row => ({ period: row.month, label: row.month, value: state.display === 'change' ? row[key + '_yoy'] : finite(row[key]) ? row[key] / divisor : null })), chartUnit, '全国 · 周度数据合并月度 · 通联 Datayes');
    const tableRows = rows.slice().reverse().map(row => ({ ...row, postsWan: finite(row.posts) ? row.posts / 1e4 : null, salaryWan: finite(row.salary) ? row.salary / 1e4 : null, _source: source('企业招聘 · ' + row.month, [{ name: data.source, file: 'data/recruitment/observations.json', ...row, unit: '岗位数：个；招聘薪酬：元/年；同比：%', indicatorIds: data.indicatorIds, notes: data.notes }, ...(data.sources || [])]) }));
    exportRows(rows.map(row => ({ ...row, 单位: '岗位数：个；招聘薪酬：元/年；同比：%', 来源: data.source, 周度合并说明: data.notes })), '企业招聘_全国');
    finish(controls(yearControl(years) + field('metric', '指标', specs.map(([key, name]) => [key, name])) + field('display', '展示', [['value', '数值'], ['change', '同比']]) + windowControl()) + kpis(specs.map(([key, label, unit, divisor]) => ({ label, value: finite(latest?.[key]) ? latest[key] / divisor : null, unit, change: latest?.[key + '_yoy'], period: latest?.month, basis: '全国 · 月内 ' + (latest?.weeks ?? '—') + ' 个周度样本' }))) + plotsHtml([chart]) + table('企业招聘月度数据', [{ key: 'month', label: '月份' }, ncol('postsWan', '招聘岗位（万个）'), ncol('posts_yoy', '岗位同比（%）'), ncol('salaryWan', '招聘年薪（万元/年）'), ncol('salary_yoy', '年薪同比（%）'), ncol('weeks', '本期周数', 0), ncol('prior_weeks', '上年同期周数', 0), sourcecol], tableRows) + databaseLinks([['data/recruitment/observations.json', '全国招聘原始周表、月表与聚合说明']]), [chart]);
  }
  async function render() {
    if (disposed) return;
    const run = ++revision; sources.clear(); exportAction = null;
    const title = names[state.sector] + '数据';
    api.setHeader({ title, pretitle: '行业数据库', actions: '<a class="btn" href="data-notes.html#' + state.sector + '">' + api.icon('book') + '来源说明</a>' });
    container.innerHTML = api.tabs(sectors.map(([id, name]) => [id, name, 'industry.html#' + id]), state.sector, '行业分类') + '<div class="card mb-3"><div class="card-header"><ul class="nav nav-tabs card-header-tabs" aria-label="数据视图">' + viewSets[state.sector].map(([id, name]) => '<li class="nav-item"><button class="nav-link' + (id === state.view ? ' active' : '') + '" type="button" data-industry-view="' + id + '"' + (id === state.view ? ' aria-current="page"' : '') + '>' + esc(name) + '</button></li>').join('') + '</ul></div></div><div data-industry-body></div>';
    api.loading($('[data-industry-body]'));
    try {
      const handlers = { hotel: { overview: hotelOverview, cities: hotelCities, structure: hotelSupply, annual: hotelAnnual, groups: hotelGroups, holiday: hotelHoliday }, dutyfree: { monthly: sectorOverview, korea: dutyfreeKorea, holidays: dutyfreeHolidays }, travel: { domestic: travelDomestic, inbound: travelInbound, outbound: travelOutbound }, tourism: { overview: cruise, audience: cruise, operators: cruise }, dining: { industry: sectorOverview, brands: diningBrands }, recruitment: { overview: recruitment }, gold: { overview: sectorOverview } };
      await handlers[state.sector][state.view](run);
      if (run === revision) save();
    } catch (error) {
      if (run !== revision) return;
      api.failure($('[data-industry-body]'), error, render);
    }
  }
  const handleChange = event => {
    const control = event.target.closest('[data-industry-field]'); if (!control) return;
    state[control.dataset.industryField] = control.value; state.page = 1;
    render();
  };
  const handleClick = event => {
    const evidence = event.target.closest('[data-industry-source]'); if (evidence) { const item = sources.get(evidence.dataset.industrySource); if (item) api.sourceDialog(item.title, item.records); return; }
    const view = event.target.closest('[data-industry-view]'); if (view) { state.view = view.dataset.industryView; state.page = 1; state.scope = ''; state.metric = ''; state.period = ''; render(); return; }
    if (event.target.closest('[data-industry-export]')) { if (exportAction) exportAction(); return; }
    const page = event.target.closest('[data-industry-page]'); if (page && !page.disabled) { state.page = Math.max(1, state.page + Number(page.dataset.industryPage)); render(); }
  };
  const handleHash = () => {
    if (disposed) return;
    const next = route();
    if (next.sector !== state.sector || next.view !== state.view) { Object.assign(state, next, { page: 1, period: '', metric: '', scope: '', year: 'recent' }); render(); }
  };
  container.onchange = handleChange;
  container.onclick = handleClick;
  window.addEventListener('hashchange', handleHash, { signal: lifecycle.signal });
  container.__industryDispose = () => {
    if (disposed) return;
    disposed = true; revision++; lifecycle.abort(); sources.clear(); exportAction = null;
    if (container.onchange === handleChange) container.onchange = null;
    if (container.onclick === handleClick) container.onclick = null;
  };
  await render();
}
