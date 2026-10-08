(function () {
  'use strict';
  var M = HotelMetrics, data = {}, ix = {}, periods = new Map(), regions = [];
  var state = { view: 'overview', region: '全国', week: '', base: 'auto', window: '52', metric: 'revpar', mode: 'value' };
  var followLatest = true, latestWeek = '';
  var SEGS = ['经济型', '中档型', '高档型', '豪华型'];
  var GROUPS = ['华住', '首旅如家', '锦江酒店（中国区）', '亚朵'];
  var BANDS = ['15间以下', '15-29间', '30-69间', '70-149间', '150间及以上'];
  var COLORS = ['#5158aa', '#368575', '#b9854c', '#b85460', '#7a68a6', '#5485a5'];
  var META = { revpar: { label: '每间可售房收入', abbr: 'RevPAR', unit: '元' }, occupancy_rate: { label: '入住率', abbr: 'OCC', unit: '%' }, adr: { label: '平均房价', abbr: 'ADR', unit: '元' } };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v, digits) { return M.num(v) == null ? '—' : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function display(row, field) { var v = M.metric(row, field); return field === 'occupancy_rate' && v != null ? v * 100 : v; }
  function delta(v, field) {
    if (M.num(v) == null) return '<span class="hd-neutral">—</span>';
    var unit = field === 'occupancy_rate' ? ' 个百分点' : '%';
    return '<span class="' + (v > 0 ? 'hd-positive' : v < 0 ? 'hd-negative' : 'hd-neutral') + '">' + (v > 0 ? '+' : '') + fmt(v, 1) + unit + '</span>';
  }
  function labelChange() { return state.base === 'auto' ? '同比' : '对比变化'; }
  function row(region, segment, week) { return ix.industry.get(region + '|' + segment + '|' + week); }
  function series(region, segment) { return data.industry.filter(function (r) { return r.region === region && r.segment === segment; }); }
  function calendar() { return M.windowRows(Array.from(periods.values()), state.week, state.window); }
  function baseWeek() { return state.base === 'auto' ? M.priorPeriod(periods.get(state.week)) : state.base; }
  function periodLabel(p) { return p ? p.period_id + '（' + p.start_date + ' — ' + p.end_date + '）' : '暂无数据'; }
  function blankTable(id, message, cols) { $(id).innerHTML = '<tbody><tr><td colspan="' + cols + '" class="hd-empty">' + esc(message) + '</td></tr></tbody>'; }
  function option(value, text) { return '<option value="' + esc(value) + '">' + esc(text) + '</option>'; }
  function fetchRows(file) {
    return fetch('data/' + file, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (text) { var rows = M.csv(text); if (!rows.length) throw new Error('没有有效记录'); return rows; });
  }
  function saveState() { var saved = Object.assign({}, state, { week: followLatest ? 'latest' : state.week }); history.replaceState(null, '', '#' + new URLSearchParams(saved).toString()); }
  function switchView(view) {
    state.view = view;
    document.querySelectorAll('.hd-tab').forEach(function (b) { var active = b.dataset.view === view; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
    document.querySelectorAll('.hd-view').forEach(function (s) { s.hidden = s.id !== 'view-' + view; });
    saveState();
  }
  function compareOptions() {
    var p = periods.get(state.week), prior = M.priorPeriod(p);
    var options = option('auto', '去年同周号 · ' + prior);
    Array.from(periods.values()).filter(function (r) { return Number(r.year) === Number(p.year) - 1; }).reverse().forEach(function (r) {
      options += option(r.period_id, periodLabel(r));
    });
    $('compare-select').innerHTML = options;
    if (state.base !== 'auto' && !Array.from($('compare-select').options).some(function (o) { return o.value === state.base; })) state.base = 'auto';
    $('compare-select').value = state.base;
  }
  function renderPeriod() {
    var base = periods.get(baseWeek());
    $('period-note').innerHTML = '数据周：' + esc(periodLabel(periods.get(state.week))) + '<br>比较基周：' +
      esc(base ? periodLabel(base) : baseWeek() + '（无基周记录）') +
      (state.base === 'auto' ? ' · 同周号同比，未作节假日错期调整' : ' · <span class="hd-manual">手动基周 · 对比变化</span>');
  }
  function renderOverview() {
    var r = row(state.region, '全部', state.week), base = row(state.region, '全部', baseWeek());
    $('overview-title').textContent = state.region + '经营';
    $('region-select').value = state.region;
    $('core-kpis').innerHTML = ['revpar', 'occupancy_rate', 'adr'].map(function (field, i) {
      var meta = META[field], v = display(r, field), change = M.change(r, base, field);
      return '<article class="hd-stat' + (i === 0 ? ' primary' : '') + '"><div class="hd-stat-label">' + meta.label + ' <span>' + meta.abbr + '</span></div><div class="hd-stat-value">' + fmt(v, 1) + '<small>' + meta.unit + '</small></div><div class="hd-stat-change"><span>' + labelChange() + '</span>' + delta(change, field) + '</div></article>';
    }).join('');
    if (!r) $('takeaway').textContent = state.region + '在所选周暂无经营记录。可切换数据周查看。';
    else if (!base) $('takeaway').textContent = '比较基周暂无该地区记录；当前值保留，变化不计算。';
    else {
      $('takeaway').innerHTML = '量价一起看：入住率' + labelChange() + ' ' + delta(M.change(r, base, 'occupancy_rate'), 'occupancy_rate') +
        '，房价' + labelChange() + ' ' + delta(M.change(r, base, 'adr'), 'adr') + '，每房收入' + labelChange() + ' ' + delta(M.change(r, base, 'revpar'), 'revpar') + '。';
    }
    renderTrend(); renderSegments();
    $('region-supply').innerHTML = '<div class="hd-scale"><span>全部酒店<b>' + fmt(M.metric(r, 'hotel_count'), 0) + ' 家</b></span><span>全部房量<b>' + fmt(M.metric(r, 'room_count'), 0) + ' 间</b></span><span>15间及以上房量<b>' + fmt(M.metric(r, 'room_count_15plus'), 0) + ' 间</b></span></div>';
    $('segment-scale-table').innerHTML = '<thead><tr><th>档次（15间及以上）</th><th>酒店数（家）</th><th>房量（间）</th></tr></thead><tbody>' + ['全部'].concat(SEGS).map(function (seg) {
      var s = row(state.region, seg, state.week);
      return '<tr><td>' + esc(seg) + '</td><td>' + fmt(M.metric(s, 'hotel_count_15plus'), 0) + '</td><td>' + fmt(M.metric(s, 'room_count_15plus'), 0) + '</td></tr>';
    }).join('') + '</tbody>';
    var all = M.sorted(series(state.region, '全部'));
    function first(field) { var a = all.find(function (r) { return M.metric(r, field) != null; }); return a ? a.period_id : '暂无数据'; }
    $('coverage-note').textContent = state.region + '历史：' + all[0].period_id + ' — ' + all[all.length - 1].period_id + '，共' + all.length + '周。房价始于' + first('adr') + '；入住率 / 每房收入始于' + first('occupancy_rate') + '；酒店数量 / 房量始于' + first('hotel_count') + '。';
  }
  function renderTrend() {
    var rows = calendar(), field = state.metric, meta = META[field];
    var current = rows.map(function (r) { return { x: r.period_id, date: r.start_date + ' — ' + r.end_date,
      y: state.mode === 'value' ? display(row(state.region, '全部', r.period_id), field) : M.change(row(state.region, '全部', r.period_id), row(state.region, '全部', M.priorPeriod(r)), field) }; });
    var lines = [{ name: state.mode === 'value' ? state.region + ' · 本期' : '同周同比', color: COLORS[0], pts: current }];
    if (state.mode === 'value') lines.push({ name: '去年同周号', color: '#aab0c9', dash: true, pts: rows.map(function (r) {
      return { x: r.period_id, y: display(row(state.region, '全部', M.priorPeriod(r)), field) };
    }) });
    var unit = state.mode === 'change' ? (field === 'occupancy_rate' ? '百分点' : '%') : meta.unit;
    $('trend-caption').textContent = meta.label + '（' + meta.abbr + '） · ' + unit + (state.mode === 'change' ? ' · 未作节假日错期调整' : ' · 虚线为去年同周号');
    lineChart('main-chart', lines, { unit: unit, occupancy: state.mode === 'value' && field === 'occupancy_rate', zero: state.mode === 'change' });
    $('history-note').textContent = rows.length ? '展示 ' + rows[0].period_id + ' — ' + rows[rows.length - 1].period_id + ' · ' + rows.length + '周 · 范围截止所选周；缺失值留空，折线断开。' : '所选范围暂无数据。';
  }
  function metricCell(r, base, field) {
    var v = display(r, field);
    return '<td><strong>' + fmt(v, 1) + (field === 'occupancy_rate' && v != null ? '%' : '') + '</strong><small>' + delta(M.change(r, base, field), field) + '</small></td>';
  }
  function operatingHead(first) { return '<thead><tr><th>' + first + '</th><th>每房收入（元）<br>' + labelChange() + '（%）</th><th>入住率<br>' + labelChange() + '（百分点）</th><th>房价（元）<br>' + labelChange() + '（%）</th></tr></thead>'; }
  function renderSegments() {
    $('segment-table').innerHTML = operatingHead('档次') + '<tbody>' + SEGS.map(function (seg) {
      var r = row(state.region, seg, state.week), b = row(state.region, seg, baseWeek());
      return '<tr><td>' + esc(seg) + '</td>' + ['revpar', 'occupancy_rate', 'adr'].map(function (f) { return metricCell(r, b, f); }).join('') + '</tr>';
    }).join('') + '</tbody>';
    drawSegments();
  }
  function drawSegments() {
    var selected = $('segment-metric').value, field = selected === 'revpar_yoy' ? 'revpar' : selected, isChange = selected === 'revpar_yoy';
    lineChart('segment-chart', SEGS.map(function (seg, i) { return { name: seg, color: COLORS[i], pts: calendar().map(function (r) {
      var s = row(state.region, seg, r.period_id);
      return { x: r.period_id, y: isChange ? M.change(s, row(state.region, seg, M.priorPeriod(r)), field) : display(s, field) };
    }) }; }), { unit: isChange ? '%' : META[field].unit, zero: isChange, occupancy: field === 'occupancy_rate' });
  }
  function renderCities() {
    var all = regions.filter(function (r) { return r !== '全国'; }).map(function (region) {
      var r = row(region, '全部', state.week), b = row(region, '全部', baseWeek());
      return { region: region, row: r, base: b, revpar: M.metric(r, 'revpar'), occupancy_rate: M.metric(r, 'occupancy_rate'), adr: M.metric(r, 'adr'), revChange: M.change(r, b, 'revpar') };
    });
    var national = row('全国', '全部', state.week), nationalBase = row('全国', '全部', baseWeek()), nationalChange = M.change(national, nationalBase, 'revpar');
    var comparable = all.filter(function (c) { return c.revChange != null; });
    var higher = nationalChange == null ? null : comparable.filter(function (c) { return c.revChange > nationalChange; }).length;
    $('city-summary').innerHTML = '<span>全国每房收入' + labelChange() + ' <b>' + delta(nationalChange, 'revpar') + '</b></span><span>有可比数据 <b>' + comparable.length + ' / ' + all.length + ' 城</b></span><span>增幅高于全国 <b>' + (higher == null ? '—' : higher + ' 城') + '</b></span>';
    var sorted = M.rank(all, $('city-sort').value), query = $('city-search').value.trim();
    var shown = sorted.map(function (c, i) { c.rank = i + 1; return c; }).filter(function (c) { return c.region.includes(query); });
    function tr(region, r, b, rank) {
      return '<tr' + (region === '全国' ? ' class="hd-benchmark"' : '') + '><td>' + (region === '全国' ? '<strong>全国参照</strong>' : '<span class="hd-row-rank">' + rank + '</span><button class="hd-city-link" type="button" data-region="' + esc(region) + '">' + esc(region) + '</button>') + '</td>' + ['revpar', 'occupancy_rate', 'adr'].map(function (f) { return metricCell(r, b, f); }).join('') + '</tr>';
    }
    $('city-table').innerHTML = operatingHead('城市') + '<tbody>' + tr('全国', national, nationalBase) + shown.map(function (c) { return tr(c.region, c.row, c.base, c.rank); }).join('') + (!shown.length ? '<tr><td colspan="4" class="hd-empty">没有匹配的城市</td></tr>' : '') + '</tbody>';
  }
  function renderGroups() {
    if (!data.group) return;
    $('group-period').textContent = state.week + ' · 全国';
    var rows = GROUPS.map(function (g) { return ix.group.get(g + '|全国|' + state.week); });
    if (!rows.some(Boolean)) { blankTable('group-table', '所选周暂无集团记录；集团周度数据自2024年起。', 6); }
    else {
      $('group-table').innerHTML = '<thead><tr><th>集团</th><th>房价（元）<br>' + labelChange() + '（%）</th><th>酒店数（家）</th><th>房量（间）</th><th>价格指数</th><th>热度指数</th></tr></thead><tbody>' + GROUPS.map(function (g) {
        var r = ix.group.get(g + '|全国|' + state.week), b = ix.group.get(g + '|全国|' + baseWeek());
        return '<tr><td>' + esc(g) + '</td><td><strong>' + fmt(M.metric(r, 'stay_adr'), 1) + '</strong><small>' + delta(M.change(r, b, 'stay_adr'), 'stay_adr') + '</small></td><td>' + fmt(M.metric(r, 'hotel_count'), 0) + '</td><td>' + fmt(M.metric(r, 'room_count'), 0) + '</td><td>' + fmt(M.metric(r, 'stay_price_index'), 2) + '</td><td>' + fmt(M.metric(r, 'stay_heat_index'), 2) + '</td></tr>';
      }).join('') + '</tbody>';
    }
    drawGroups();
  }
  function drawGroups() {
    if (!data.group) return;
    var selected = $('group-metric').value, isChange = selected === 'stay_adr_yoy', field = isChange ? 'stay_adr' : selected;
    lineChart('group-chart', GROUPS.map(function (g, i) {
      var full = M.sorted(data.group.filter(function (r) { return r.group === g && r.region === '全国'; }));
      return { name: g, color: COLORS[i], pts: calendar().filter(function (r) { return full.length && r.period_id >= full[0].period_id; }).map(function (r) {
        var current = ix.group.get(g + '|全国|' + r.period_id);
        return { x: r.period_id, y: isChange ? M.change(current, ix.group.get(g + '|全国|' + M.priorPeriod(r)), field) : M.metric(current, field) };
      }) };
    }), { unit: isChange ? '%' : field === 'stay_adr' ? '元' : field === 'hotel_count' ? '家' : '间', zero: isChange });
  }
  function renderSupply() {
    if (!data.supply) return;
    var r = ix.supply.get('全国|全部|' + state.week), rooms = M.metric(r, 'room_count'), hotels = M.metric(r, 'hotel_count'), chain = M.metric(r, 'chain_room_count');
    $('supply-period').textContent = state.week + ' · 全部口径';
    $('supply-stats').innerHTML = '<div><span>全国酒店</span><b>' + fmt(hotels, 0) + ' 家</b></div><div><span>全国房量</span><b>' + fmt(rooms, 0) + ' 间</b></div><div><span>房量连锁率</span><b>' + fmt(rooms && chain != null ? chain / rooms * 100 : null, 1) + '%</b></div>';
    if (!r) blankTable('supply-table', '所选周暂无供给结构记录；供给数据自2022W31起。', 4);
    else $('supply-table').innerHTML = '<thead><tr><th>酒店规模</th><th>房量（间）</th><th>占全国房量</th><th>房量连锁率</th></tr></thead><tbody>' + BANDS.map(function (band) {
      var b = ix.supply.get('全国|' + band + '|' + state.week), count = M.metric(b, 'room_count'), c = M.metric(b, 'chain_room_count');
      return '<tr><td>' + esc(band) + '</td><td>' + fmt(count, 0) + '</td><td>' + fmt(count != null && rooms ? count / rooms * 100 : null, 1) + '%</td><td>' + fmt(count && c != null ? c / count * 100 : null, 1) + '%</td></tr>';
    }).join('') + '</tbody>';
    drawSupply();
  }
  function drawSupply() {
    if (!data.supply) return;
    var field = $('supply-metric').value;
    var full = M.sorted(data.supply.filter(function (r) { return r.region === '全国' && r.room_band === '全部'; }));
    lineChart('supply-chart', [{ name: '全国 · 全部口径', color: COLORS[0], pts: calendar().filter(function (r) { return full.length && r.period_id >= full[0].period_id; }).map(function (r) { return { x: r.period_id, y: M.metric(ix.supply.get('全国|全部|' + r.period_id), field) }; }) }], { unit: field === 'room_count' ? '间' : '家' });
  }
  function renderShare() {
    var years = Array.from(new Set(data.share.map(function (r) { return Number(r.year); }))).sort(function (a, b) { return a - b; }), latest = years[years.length - 1];
    $('share-year').textContent = latest + '年';
    var rows = data.share.filter(function (r) { return Number(r.year) === latest; });
    if (!M.validShares(rows)) { blankTable('share-table', '源表份额超出有效范围，口径待核验。', 3); $('share-chart').textContent = '暂无可展示的有效数据'; return; }
    var sum = rows.reduce(function (total, r) { return total + M.num(r.market_share_pct); }, 0);
    var priorValid = M.validShares(data.share.filter(function (r) { return Number(r.year) === latest - 1; }));
    $('share-table').innerHTML = '<thead><tr><th>集团</th><th>' + latest + '年份额</th><th>较' + (latest - 1) + '年（百分点）</th></tr></thead><tbody>' + rows.slice().sort(function (a, b) { return M.num(b.market_share_pct) - M.num(a.market_share_pct); }).map(function (r) {
      var prior = data.share.find(function (p) { return p.group === r.group && Number(p.year) === latest - 1; }), pv = prior && priorValid ? M.num(prior.market_share_pct) : null;
      return '<tr><td>' + esc(r.group) + '</td><td>' + fmt(r.market_share_pct, 1) + '%</td><td>' + delta(pv == null ? null : M.num(r.market_share_pct) - pv, 'occupancy_rate') + '</td></tr>';
    }).join('') + '<tr><td>六家合计</td><td>' + fmt(sum, 1) + '%</td><td>按原值加总</td></tr></tbody>';
    var groups = Array.from(new Set(data.share.map(function (r) { return r.group; })));
    var validYears = new Set(years.filter(function (y) { return M.validShares(data.share.filter(function (r) { return Number(r.year) === y; })); }));
    lineChart('share-chart', groups.map(function (g, i) { return { name: g, color: COLORS[i % COLORS.length], pts: years.map(function (y) {
      var r = data.share.find(function (r) { return r.group === g && Number(r.year) === y; }); return { x: String(y), y: r && validYears.has(y) ? M.num(r.market_share_pct) : null };
    }) }; }), { unit: '%' });
  }
  function refresh() { renderPeriod(); renderOverview(); renderCities(); renderGroups(); renderSupply(); saveState(); }
  function init(rows) {
    data.industry = rows; ix.industry = M.index(rows, ['region', 'segment', 'period_id']);
    M.sorted(rows.filter(function (r) { return r.segment === '全部'; })).forEach(function (r) { periods.set(r.period_id, r); });
    regions = Array.from(new Set(rows.map(function (r) { return r.region; }))).filter(function (r) { return r !== '全国'; }).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }); regions.unshift('全国');
    var latest = M.sorted(rows.filter(function (r) { return r.region === '全国' && r.segment === '全部'; })).pop();
    latestWeek = latest.period_id; state.week = latestWeek;
    var saved = new URLSearchParams(location.hash.slice(1));
    if (regions.includes(saved.get('region'))) state.region = saved.get('region');
    if (periods.has(saved.get('week'))) { state.week = saved.get('week'); followLatest = false; }
    if (['overview', 'cities', 'structure'].includes(saved.get('view'))) state.view = saved.get('view');
    if (['52', '156', 'all'].includes(saved.get('window'))) state.window = saved.get('window');
    if (META[saved.get('metric')]) state.metric = saved.get('metric');
    if (['value', 'change'].includes(saved.get('mode'))) state.mode = saved.get('mode');
    if (periods.has(saved.get('base'))) state.base = saved.get('base');
    $('asof').innerHTML = '最新数据截至<b>' + esc(latest.end_date) + ' · ' + esc(latest.period_id) + '</b>';
    $('week-select').innerHTML = option('latest', '最新周 · ' + latestWeek + ' · ' + latest.end_date) + Array.from(periods.values()).reverse().map(function (r) { return option(r.period_id, r.period_id + ' · ' + r.end_date); }).join('');
    $('week-select').value = followLatest ? 'latest' : state.week; $('region-select').innerHTML = regions.map(function (r) { return option(r, r); }).join(''); $('history-start').value = state.window;
    compareOptions(); $('dashboard').hidden = false;
    document.querySelectorAll('.hd-tab').forEach(function (b) { b.onclick = function () { switchView(b.dataset.view); }; });
    $('week-select').onchange = function () { followLatest = this.value === 'latest'; state.week = followLatest ? latestWeek : this.value; state.base = 'auto'; compareOptions(); refresh(); };
    $('compare-select').onchange = function () { state.base = this.value; refresh(); };
    $('region-select').onchange = function () { state.region = this.value; renderOverview(); saveState(); };
    function setWindow() { state.window = this.value; ['history-start','group-window','supply-window'].forEach(function (id) { $(id).value = state.window; }); renderTrend(); drawSegments(); drawGroups(); drawSupply(); saveState(); }
    ['history-start','group-window','supply-window'].forEach(function (id) { $(id).value = state.window; $(id).onchange = setWindow; });
    function bindSwitch(id, attr) {
      var buttons = $(id).querySelectorAll('button');
      function active() { buttons.forEach(function (b) { var isActive = b.dataset[attr] === state[attr]; b.classList.toggle('active', isActive); b.setAttribute('aria-pressed', isActive); }); }
      buttons.forEach(function (b) { b.onclick = function () { state[attr] = b.dataset[attr]; active(); renderTrend(); saveState(); }; }); active();
    }
    bindSwitch('metric-switch', 'metric'); bindSwitch('mode-switch', 'mode');
    $('segment-metric').onchange = drawSegments; $('group-metric').onchange = drawGroups; $('supply-metric').onchange = drawSupply;
    $('city-search').oninput = renderCities; $('city-sort').onchange = renderCities;
    $('city-table').onclick = function (event) { var b = event.target.closest('[data-region]'); if (!b) return; state.region = b.dataset.region; renderOverview(); switchView('overview'); $('region-select').focus(); };
    refresh(); switchView(state.view);
  }
  function error(id, message, cols) { blankTable(id, message, cols); }
  // Secondary sources fail independently so the primary operating view remains usable.
  var extra = [
    { name: 'group', file: 'hotel_group_weekly.csv', keys: ['group', 'region', 'period_id'], render: renderGroups, table: 'group-table', cols: 6, label: '集团' },
    { name: 'supply', file: 'hotel_supply_weekly.csv', keys: ['region', 'room_band', 'period_id'], render: renderSupply, table: 'supply-table', cols: 4, label: '供给' },
    { name: 'share', file: 'hotel_market_share_annual.csv', keys: ['group', 'year'], render: renderShare, table: 'share-table', cols: 3, label: '市占率' }
  ];
  extra.forEach(function (source) { blankTable(source.table, '正在读取' + source.label + '数据…', source.cols); });
  var primary = fetchRows('hotel_industry_weekly.csv').then(init).catch(function (e) {
    $('asof').textContent = '经营数据读取失败'; $('load-error').hidden = false;
    $('load-error').textContent = '经营数据暂时无法读取，请稍后重新加载。' + e.message;
    var button = document.createElement('button'); button.textContent = '重新加载'; button.onclick = function () { location.reload(); }; $('load-error').appendChild(button);
    throw e;
  });
  extra.forEach(function (source) {
    Promise.all([fetchRows(source.file), primary]).then(function (result) {
      ix[source.name] = M.index(result[0], source.keys); data[source.name] = result[0]; source.render();
    }).catch(function () { error(source.table, source.label + '数据暂时无法读取，可重新加载后重试。', source.cols); });
  });
  var resizePending = false;
  window.addEventListener('resize', function () {
    if (!data.industry || resizePending) return;
    resizePending = true;
    requestAnimationFrame(function () { resizePending = false; renderTrend(); drawSegments(); drawGroups(); drawSupply(); if (data.share) renderShare(); });
  });

  function svgEl(name, attrs, text) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text; return e;
  }
  function lineChart(id, lines, opt) {
    opt = opt || {}; var host = $(id); host.innerHTML = '';
    var xs = Array.from(new Set(lines.flatMap(function (s) { return s.pts.map(function (p) { return p.x; }); }))).sort();
    var values = lines.flatMap(function (s) { return s.pts.map(function (p) { return M.num(p.y); }); }).filter(function (v) { return v != null; });
    if (!values.length) { host.innerHTML = '<div class="hd-empty">所选范围暂无有效数据</div>'; return; }
    var W = Math.max(300, $('dashboard').clientWidth - 40), H = 280, L = 54, R = 22, T = 14, B = 32, min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (opt.zero) min = Math.min(0, min);
    var padding = (max - min) * .12 || 1; min -= padding; max += padding;
    if (opt.occupancy) { min = Math.max(0, min); max = Math.min(100, max); }
    if (max === min) max = min + 1;
    var positions = new Map(xs.map(function (x, i) { return [x, i]; }));
    function px(x) { return L + positions.get(x) / Math.max(1, xs.length - 1) * (W - L - R); }
    function py(y) { return T + (max - y) / (max - min) * (H - T - B); }
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', role: 'img', 'aria-label': lines.map(function (s) { return s.name; }).join('、') + '走势，单位' + opt.unit, tabindex: '0' });
    host.appendChild(svg);
    var axisDigits = opt.unit === '%' || opt.unit === '百分点' ? 1 : 0;
    for (var i = 0; i <= 4; i++) {
      var v = max - (max - min) * i / 4, y = py(v);
      svg.appendChild(svgEl('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: '#edf0f5' }));
      svg.appendChild(svgEl('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#8a94a5' }, fmt(v, axisDigits)));
    }
    if (min < 0 && max > 0) svg.appendChild(svgEl('line', { x1: L, x2: W - R, y1: py(0), y2: py(0), stroke: '#c3c9d8', 'stroke-dasharray': '4 4' }));
    Array.from(new Set([0, Math.round((xs.length - 1) / 3), Math.round((xs.length - 1) * 2 / 3), xs.length - 1])).forEach(function (i) {
      svg.appendChild(svgEl('text', { x: px(xs[i]), y: H - 10, 'text-anchor': 'middle', 'font-size': 11, fill: '#8a94a5' }, xs[i]));
    });
    lines.forEach(function (s) {
      var path = '', started = false;
      s.pts.forEach(function (p) { if (M.num(p.y) == null) { started = false; return; } path += (started ? 'L' : 'M') + px(p.x).toFixed(1) + ' ' + py(p.y).toFixed(1); started = true; });
      var attrs = { d: path, fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      if (s.dash) attrs['stroke-dasharray'] = '5 5'; svg.appendChild(svgEl('path', attrs));
    });
    var legend = document.createElement('div'); legend.className = 'hd-legend';
    legend.innerHTML = lines.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + (s.dash ? '（虚线）' : '') + '</span>'; }).join(''); host.appendChild(legend);
    var tip = document.createElement('div'); tip.className = 'hd-tip'; host.appendChild(tip);
    var guide = svgEl('line', { y1: T, y2: H - B, stroke: '#a3abc2', 'stroke-dasharray': '3 3', visibility: 'hidden' }); svg.appendChild(guide);
    var pointMaps = lines.map(function (s) { return new Map(s.pts.map(function (p) { return [p.x, p]; })); }), lastIndex = xs.length - 1;
    function show(index, clientX, clientY) {
      lastIndex = Math.max(0, Math.min(xs.length - 1, index)); var x = xs[lastIndex], firstPoint = pointMaps[0].get(x);
      guide.setAttribute('x1', px(x)); guide.setAttribute('x2', px(x)); guide.setAttribute('visibility', 'visible');
      tip.innerHTML = '<strong>' + esc(x) + '</strong>' + (firstPoint && firstPoint.date ? '<br>' + esc(firstPoint.date) : '') + lines.map(function (s, i) {
        var p = pointMaps[i].get(x); return '<br><span style="color:' + s.color + '">●</span> ' + esc(s.name) + '：' + fmt(p ? p.y : null, 1) + ' ' + esc(opt.unit);
      }).join(''); tip.style.display = 'block';
      var box = host.getBoundingClientRect(), rect = svg.getBoundingClientRect(), left = clientX == null ? (px(x) / W * rect.width + rect.left - box.left) : clientX - box.left + 12;
      tip.style.left = Math.max(0, Math.min(box.width - tip.offsetWidth - 8, left)) + 'px'; tip.style.top = (clientY == null ? 24 : Math.max(0, clientY - box.top - 30)) + 'px';
    }
    svg.addEventListener('pointermove', function (event) { var r = svg.getBoundingClientRect(); var x = (event.clientX - r.left) / r.width * W; show(Math.round((x - L) / (W - L - R) * (xs.length - 1)), event.clientX, event.clientY); });
    svg.addEventListener('pointerdown', function (event) { var r = svg.getBoundingClientRect(); show(Math.round(((event.clientX - r.left) / r.width * W - L) / (W - L - R) * (xs.length - 1)), event.clientX, event.clientY); });
    function hide() { tip.style.display = 'none'; guide.setAttribute('visibility', 'hidden'); }
    svg.addEventListener('pointerleave', hide); svg.addEventListener('blur', hide);
    svg.addEventListener('focus', function () { show(lastIndex); });
    svg.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(lastIndex + (e.key === 'ArrowLeft' ? -1 : 1)); } else if (e.key === 'Escape') hide(); });
  }
})();
