(function () {
  'use strict';
  var M = HotelMetrics, data = {}, ix = {}, periods = new Map(), regions = [];
  var state = { view: 'overview', region: '全国', week: '', base: 'auto', window: '12', supplyWindow: '156', investmentWindow: '156', metric: 'revpar', mode: 'combo' };
  var followLatest = true, latestWeek = '';
  var SEGS = ['经济型', '中档型', '高档型', '豪华型'];
  var GROUPS = ['华住', '首旅如家', '锦江酒店（中国区）', '亚朵'];
  var BANDS = ['15-29间', '30-69间', '70-149间', '150间及以上'];
  var weekly = [], seriesCache = new Map();
  var COLORS = ['#2167a0', '#368575', '#b9854c', '#b85460', '#7a68a6', '#5485a5'];
  var META = { revpar: { label: 'RevPAR', abbr: 'RevPAR', unit: '元' }, occupancy_rate: { label: 'OCC', abbr: 'OCC', unit: '%' }, adr: { label: 'ADR', abbr: 'ADR', unit: '元' } };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v, digits) { return M.num(v) == null ? '—' : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function display(row, field) { var v = M.metric(row, field); return field === 'occupancy_rate' && v != null ? v * 100 : v; }
  function delta(v, field) {
    if (M.num(v) == null) return '<span class="hd-neutral">—</span>';
    var unit = field === 'occupancy_rate' || field === 'chain_rate' ? ' 个百分点' : '%';
    return '<span class="' + (v > 0 ? 'hd-positive' : v < 0 ? 'hd-negative' : 'hd-neutral') + '">' + (v > 0 ? '+' : '') + fmt(v, 1) + unit + '</span>';
  }
  function labelChange() { return state.base === 'auto' ? '同比' : '对比变化'; }
  function valueUnit(field) { return field === 'occupancy_rate' || field === 'chain_rate' ? '%' : field.indexOf('hotel_count') >= 0 ? '家' : field.indexOf('room_count') >= 0 ? '间' : '元'; }
  function row(region, segment, week) { return ix.industry.get(region + '|' + segment + '|' + week); }
  function series(region, segment) { return seriesCache.get(region + '|' + segment) || []; }
  function calendar(range) { return M.windowRows(weekly, state.week, range || state.window); }
  function hasValues(r, fields) { return fields.some(function (f) { return M.metric(r, f) != null; }); }
  function availableWeeks() {
    if (state.view === 'overview') return weekly.filter(function (p) { return hasValues(row(state.region, '全部', p.period_id), ['adr','occupancy_rate','revpar']); });
    if (state.view === 'cities') return weekly.filter(function (p) { return regions.some(function (r) { return r !== '全国' && hasValues(row(r, '全部', p.period_id), ['adr','occupancy_rate','revpar']); }); });
    return weekly.filter(function (p) { return hasValues(row('全国', '全部', p.period_id), ['hotel_count_15plus','room_count_15plus']) || (data.group && GROUPS.some(function (g) { return hasValues(ix.group.get(g + '|全国|' + p.period_id), ['stay_adr','hotel_count','room_count']); })); });
  }
  function selectionOptions() {
    var allowed = availableWeeks(), before = state.week;
    if (!allowed.length) allowed = weekly;
    if (!allowed.some(function (p) { return p.period_id === state.week; })) {
      var earlier = allowed.filter(function (p) { return p.period_id <= state.week; });
      state.week = (earlier[earlier.length - 1] || allowed[0]).period_id;
      followLatest = false; state.base = 'auto';
    }
    $('selection-note').hidden = before === state.week;
    $('selection-note').textContent = before === state.week ? '' : M.weekLabel(before) + '在当前视图暂无数据，已切至' + M.weekLabel(state.week);
    var newest = allowed[allowed.length - 1];
    $('week-select').innerHTML = option('latest', '最新周 · ' + M.weekLabel(newest.period_id)) + allowed.slice().reverse().map(function (p) { return option(p.period_id, M.weekLabel(p.period_id)); }).join('');
    if (followLatest) state.week = newest.period_id;
    $('week-select').value = followLatest ? 'latest' : state.week;
    compareOptions();
  }
  function baseWeek() { return state.base === 'auto' ? M.priorPeriod(periods.get(state.week)) : state.base; }
  function periodLabel(p) { return p ? M.weekLabel(p.period_id) + '（' + p.start_date + ' — ' + p.end_date + '）' : '暂无数据'; }
  function blankTable(id, message, cols) { $(id).innerHTML = '<tbody><tr><td colspan="' + cols + '" class="hd-empty">' + esc(message) + '</td></tr></tbody>'; }
  function option(value, text) { return '<option value="' + esc(value) + '">' + esc(text) + '</option>'; }
  function fetchRows(file) {
    return fetch('data/' + file, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (text) { var rows = M.csv(text); if (!rows.length) throw new Error('没有有效记录'); return rows; });
  }
  function saveState() { var saved = Object.assign({}, state, { week: followLatest ? 'latest' : state.week, rangeVersion: '12w' }); history.replaceState(null, '', '#' + new URLSearchParams(saved).toString()); }
  function switchView(view) {
    document.querySelector('.hd-toolbar').hidden=view==='annual';
    $('period-note').hidden=view==='annual';
    $('selection-note').hidden=true;
    $('asof').hidden=view==='annual';
    document.querySelector('.hd-footer').hidden=view==='annual';
    state.view = view;
    $('weekly-export').hidden = view !== 'overview';
    document.querySelectorAll('.hd-tab').forEach(function (b) { var active = b.dataset.view === view; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
    document.querySelectorAll('.hd-view').forEach(function (s) { s.hidden = s.id !== 'view-' + view; });
    refresh();
  }
  function compareOptions() {
    var p = periods.get(state.week), prior = M.priorPeriod(p);
    var options = option('auto', '同比基周 · ' + M.weekLabel(prior));
    Array.from(periods.values()).filter(function (r) { return Number(r.year) === Number(p.year) - 1; }).reverse().forEach(function (r) {
      options += option(r.period_id, periodLabel(r));
    });
    $('compare-select').innerHTML = options;
    if (state.base !== 'auto' && !Array.from($('compare-select').options).some(function (o) { return o.value === state.base; })) state.base = 'auto';
    $('compare-select').value = state.base;
  }
  function renderPeriod() {
    var base = periods.get(baseWeek());
    var selected = periods.get(state.week); $('period-note').textContent = (selected ? selected.start_date + '—' + selected.end_date : '暂无数据') + (state.base === 'auto' ? ' · 同周同比' : ' · 手动对比');
    $('period-note').title = '比较基周：' + (base ? periodLabel(base) : M.weekLabel(baseWeek()) + '（无基周记录）');
    $('mode-switch').querySelector('[data-mode="change"]').textContent = state.base === 'auto' ? '仅同比' : '仅对比变化';
  }
  function renderOverview() {
    var r = row(state.region, '全部', state.week), base = row(state.region, '全部', baseWeek());
    $('overview-title').textContent = state.region + '经营';
    $('region-select').value = state.region;
    $('core-kpis').innerHTML = ['revpar', 'occupancy_rate', 'adr'].map(function (field, i) {
      var meta = META[field], v = display(r, field), change = M.change(r, base, field);
      var isChange = state.mode === 'change' && change != null, main = isChange ? change : v;
      var unit = isChange ? (field === 'occupancy_rate' ? '百分点' : '%') : meta.unit;
      var cls = isChange && main != null ? (main > 0 ? ' hd-positive' : main < 0 ? ' hd-negative' : ' hd-neutral') : '';
      if (v == null) return '';
      return '<article class="board-stat hd-stat' + (i === 0 ? ' primary' : '') + '"><div class="hd-stat-label">' + meta.label + (isChange ? ' · ' + labelChange() : ' · 本周') + '</div><div class="hd-stat-value' + cls + '">' + (isChange && main > 0 ? '+' : '') + fmt(main, isChange ? 1 : 0) + '<small>' + unit + '</small></div><div class="hd-stat-change">' + (isChange ? '<span>本周</span>' + fmt(v, 0) + ' ' + meta.unit : change == null ? '基期缺失 · 暂无同比' : '<span>' + labelChange() + '</span>' + delta(change, field)) + '</div></article>';
    }).join('');
    renderTrend(); renderSegments();
    var hasScale = hasValues(r, ['hotel_count_15plus','room_count_15plus']);
    $('region-supply').innerHTML = hasScale ? '<div class="hd-scale">' + [['hotel_count_15plus', '15间及以上酒店'], ['room_count_15plus', '15间及以上房量']].map(function (item) { return supplyStat(r, base, item[0], item[1]); }).join('') + '</div>' : '<p class="hd-compact-empty">所选周暂无15间及以上供给数据</p>';
    $('segment-scale-table').parentElement.hidden = !hasScale;
    $('segment-scale-table').innerHTML = '<thead><tr><th>档次（15间及以上）</th>' + metricHead('hotel_count_15plus', '酒店数') + metricHead('room_count_15plus', '房量') + '</tr></thead><tbody>' + ['全部'].concat(SEGS).map(function (seg) {
      var s = row(state.region, seg, state.week);
      var b = row(state.region, seg, baseWeek());
      return hasValues(s, ['hotel_count_15plus','room_count_15plus']) ? '<tr><td>' + esc(seg) + '</td>' + metricCell(s, b, 'hotel_count_15plus') + metricCell(s, b, 'room_count_15plus') + '</tr>' : '';
    }).join('') + '</tbody>';

  }
  function renderTrend() {
    var rows = calendar(), fields = ['revpar','occupancy_rate','adr'];
    fields.forEach(function (field) { var enabled = rows.some(function (p) { return M.metric(row(state.region, '全部', p.period_id), field) != null; }); $('metric-switch').querySelector('[data-metric="' + field + '"]').disabled = !enabled; });
    if ($('metric-switch').querySelector('[data-metric="' + state.metric + '"]').disabled) state.metric = fields.find(function (f) { return !$('metric-switch').querySelector('[data-metric="' + f + '"]').disabled; }) || 'adr';
    $('metric-switch').querySelectorAll('button').forEach(function (b) { var active = b.dataset.metric === state.metric; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
    var field = state.metric, meta = META[field], isChange = state.mode === 'change' && rows.some(function (p) { return M.change(row(state.region, '全部', p.period_id), row(state.region, '全部', M.priorPeriod(p)), field) != null; });
    var current = rows.map(function (r) { return { x: r.period_id, date: r.start_date + ' — ' + r.end_date,
      y: !isChange ? display(row(state.region, '全部', r.period_id), field) : M.change(row(state.region, '全部', r.period_id), row(state.region, '全部', M.priorPeriod(r)), field) }; });
    if(['combo','value','change'].includes(state.mode)){
      const result=SiteCharts.drawPaired($('main-chart'),rows.map(r=>({period:r.period_id,x:Date.parse(r.start_date),value:display(row(state.region,'全部',r.period_id),field),change:M.change(row(state.region,'全部',r.period_id),row(state.region,'全部',M.priorPeriod(r)),field)})),{mode:state.mode,unit:meta.unit,changeUnit:field==='occupancy_rate'?'百分点':'%',changeLabel:labelChange(),name:meta.label,trimEmpty:true,precision:0,changePrecision:1,periodFormat:'week-short',gap:15*86400000});
      $('trend-caption').textContent=meta.label+' · '+(state.mode==='combo'?meta.unit+' / '+(field==='occupancy_rate'?'百分点':'%'):state.mode==='change'?(field==='occupancy_rate'?'百分点':'%'):meta.unit);$('history-note').textContent=result.points.length?result.points[0].text.split('\n')[0]+' — '+result.points.at(-1).text.split('\n')[0]:'';return;
    }
    var lines = [{ name: state.region + (!isChange ? ' · 本期绝对值' : ' · 同周同比'), color: COLORS[0], pts: current }];
    if (!isChange) lines.push({ name: '去年同周号', color: '#71869b', dash: true, pts: rows.map(function (r) {
      return { x: r.period_id, y: display(row(state.region, '全部', M.priorPeriod(r)), field) };
    }) });
    var unit = isChange ? (field === 'occupancy_rate' ? '百分点' : '%') : meta.unit;
    $('trend-caption').textContent = meta.label + ' · ' + unit ;
    lineChart('main-chart', lines, { unit: unit, occupancy: !isChange && field === 'occupancy_rate', zero: isChange });
    var plotted = M.chartSeries(lines), plottedRows = plotted.length ? plotted[0].pts : [];
    $('history-note').textContent = plottedRows.length ? '有效区间 ' + plottedRows[0].x + ' — ' + plottedRows[plottedRows.length - 1].x : '所选范围暂无数据。';
  }
  function metricCell(r, base, field) {
    var v = field === 'chain_rate' ? M.metric(r, field) == null ? null : M.metric(r, field) * 100 : display(r, field), change = M.change(r, base, field);
    var digits = ['revpar','occupancy_rate','adr','stay_adr'].includes(field) || field.indexOf('count') >= 0 ? 0 : 1;
    if (v == null) return '<td class="hd-neutral">暂无数据</td>';
    if (state.mode === 'change' && change == null) return '<td><strong>' + fmt(v, digits) + ' ' + valueUnit(field) + '</strong><small>绝对值 · 基期缺失</small></td>';
    if (state.mode === 'change') return '<td><strong>' + delta(change, field) + '</strong><small>本周 ' + fmt(v, digits) + ' ' + valueUnit(field) + '</small></td>';
    return '<td><strong>' + fmt(v, digits) + ((field === 'occupancy_rate' || field === 'chain_rate') && v != null ? '%' : '') + '</strong><small>' + labelChange() + ' ' + delta(change, field) + '</small></td>';
  }
  function metricHead(field, title) {
    var changeUnit = field === 'occupancy_rate' || field === 'chain_rate' ? '百分点' : '%';
    return '<th>' + title + (state.mode === 'change' ? labelChange() + '（' + changeUnit + '）<br>本周（' + valueUnit(field) + '）' : '（' + valueUnit(field) + '）<br>' + labelChange() + '（' + changeUnit + '）') + '</th>';
  }
  function operatingFields(rows) { return ['revpar','occupancy_rate','adr'].filter(function (f) { return rows.some(function (r) { return M.metric(r, f) != null; }); }); }
  function operatingHead(first, fields) { var names = {revpar:'RevPAR',occupancy_rate:'OCC',adr:'ADR'}; return '<thead><tr><th>' + first + '</th>' + fields.map(function (f) { return metricHead(f,names[f]); }).join('') + '</tr></thead>'; }
  function renderSegments() {
    var fields = operatingFields(SEGS.map(function (seg) { return row(state.region, seg, state.week); }));
    $('segment-table').innerHTML = operatingHead('档次', fields) + '<tbody>' + SEGS.map(function (seg) {
      var r = row(state.region, seg, state.week), b = row(state.region, seg, baseWeek());
      return hasValues(r, fields) ? '<tr><td>' + esc(seg) + '</td>' + fields.map(function (f) { return metricCell(r, b, f); }).join('') + '</tr>' : '';
    }).join('') + '</tbody>';
    drawSegments();
  }
  function drawSegments() {
    var rows = calendar(), field = state.metric, meta = META[field];
    var points = rows.map(function (p) { return { period: p.period_id, x: Date.parse(p.start_date), values: SEGS.map(function (seg, i) {
      var current = row(state.region, seg, p.period_id), base = row(state.region, seg, M.priorPeriod(p));
      return { name: seg, color: COLORS[i], value: display(current, field), change: M.change(current, base, field) };
    }) }; });
    var hasValue = points.some(function (p) { return p.values.some(function (s) { return s.value != null; }); });
    var hasChange = points.some(function (p) { return p.values.some(function (s) { return s.change != null; }); });
    var fallback = state.mode === 'change' && !hasChange && hasValue, mode = fallback ? 'value' : state.mode;
    var changeUnit = field === 'occupancy_rate' ? '百分点' : '%';
    $('segment-chart-caption').textContent = state.region + ' · ' + meta.label + ' · ' + (mode === 'combo' ? meta.unit + ' / 同周同比（' + changeUnit + '）' : mode === 'change' ? '同周同比（' + changeUnit + '）' : '数值（' + meta.unit + '）') + (fallback ? ' · 基期缺失' : '');
    if (!hasValue && !hasChange) { $('segment-chart').innerHTML = '<div class="hd-empty">所选范围暂无分档次数据</div>'; return; }
    SiteCharts.drawPaired($('segment-chart'), points, { mode: mode, unit: meta.unit, changeUnit: changeUnit, changeLabel: '同周同比', name: state.region + '分档次' + meta.label, trimEmpty:true,precision:0,changePrecision:1,periodFormat:'week-short', gap: 15 * 86400000 });
  }
  var cityMetric = 'revpar';
  var cityOrder = 'desc';
  function cityMetricName(field) { return field === 'revpar' ? 'RevPAR' : field === 'occupancy_rate' ? '入住率 OCC' : '平均房价 ADR'; }
  function cityValue(row, field) {
    var v = display(row, field);
    return v == null ? null : v;
  }
  function cityFormattedValue(row, field) {
    var v = cityValue(row, field);
    if (v == null) return '暂无数据';
    return fmt(v, field === 'occupancy_rate' ? 1 : 0) + ' ' + valueUnit(field);
  }
  function cityScore(row, base, field) {
    if (state.mode === 'change') return M.change(row, base, field);
    return cityValue(row, field);
  }
  function renderCities() {
    var field = cityMetric;
    var all = regions.filter(function (r) { return r !== '全国'; }).map(function (region) {
      var r = row(region, '全部', state.week), b = row(region, '全部', baseWeek());
      return { region: region, row: r, base: b, value: cityValue(r, field), change: M.change(r, b, field), score: cityScore(r, b, field) };
    }).filter(function (c) { return c.value != null; });
    var national = row('全国', '全部', state.week), nationalBase = row('全国', '全部', baseWeek());
    var nationalValue = cityValue(national, field), nationalChange = M.change(national, nationalBase, field);
    var nationalScore = cityScore(national, nationalBase, field);
    var comparable = all.filter(function (c) { return c.change != null; });
    var comparableNational = state.mode === 'change' ? nationalChange != null : nationalValue != null;
    var benchmarkScore = state.mode === 'change' ? nationalChange : nationalValue;
    var above = comparableNational ? all.filter(function (c) {
      var score = state.mode === 'change' ? c.change : c.value;
      return score != null && score > benchmarkScore;
    }).length : null;
    var ranked = all.slice().sort(function (a, b) {
      if (a.score == null && b.score != null) return 1;
      if (a.score != null && b.score == null) return -1;
      if (a.score != null && b.score != null && a.score !== b.score) return (cityOrder === 'asc' ? 1 : -1) * (a.score - b.score);
      return a.region.localeCompare(b.region, 'zh-CN');
    });
    var query = $('city-search').value.trim();
    var shown = ranked.filter(function (c) { return c.region.includes(query); });
    shown.forEach(function (c) { c.rank = ranked.indexOf(c) + 1; });
    var modeLabel = state.mode === 'change' ? labelChange() : '绝对值';
    var compareUnit = field === 'occupancy_rate' ? '个百分点' : '%';
    var mainValue = state.mode === 'change'
      ? (nationalChange == null ? '基期缺失' : delta(nationalChange, field))
      : cityFormattedValue(national, field);
    var mainLabel = state.mode === 'change' ? '全国' + cityMetricName(field) + labelChange() : '全国' + cityMetricName(field);
    var aboveText = above == null ? '全国基准暂无可比数据' : '高于全国';
    $('city-summary').innerHTML =
      '<span>' + mainLabel + ' <b>' + mainValue + '</b></span>' +
      '<span>有本周数据 <b>' + all.length + ' 城</b></span>' +
      '<span>' + (state.mode === 'change' ? '可比基期' : labelChange() + '可比') + ' <b>' + comparable.length + ' 城</b></span>' +
      '<span>' + aboveText + ' <b>' + (above == null ? '—' : above + ' 城') + '</b></span>' +
      (ranked.some(function(c){return c.score != null;}) ? '<span>当前最高 <b>' + esc(ranked.filter(function(c){return c.score != null;}).slice().sort(function(a,b){return b.score-a.score;})[0].region) + '</b></span>' : '');
    document.querySelectorAll('[data-city-metric]').forEach(function (button) {
      var active = button.dataset.cityMetric === field;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('city-guide').textContent = state.mode === 'change'
      ? (state.base === 'auto' ? '当前显示去年同周同比；' : '当前显示所选基周的对比变化；') +
        (field === 'occupancy_rate' ? '入住率变化按百分点计算。' : '价格变化按百分比计算。') +
        ' 全国行作为基准；无去年同期数据的城市仍显示本周值并标注基期缺失。'
      : '当前显示本周绝对值；副行显示' + labelChange() + '。全国行作为基准，点击城市名可查看该城市详情。';
    var header = '<thead><tr><th>排名 / 城市</th><th>' + esc(cityMetricName(field)) + (state.mode === 'change' ? labelChange() + '（' + compareUnit + '）' : '（' + valueUnit(field) + '）') + '</th><th>与全国比较</th></tr></thead>';
    function primaryValue(r, b) {
      var v = cityValue(r, field), ch = M.change(r, b, field);
      if (v == null) return '<strong class="hd-neutral">暂无数据</strong>';
      if (state.mode === 'change' && ch != null) return '<strong>' + delta(ch, field) + '</strong><small>本周 ' + esc(cityFormattedValue(r, field)) + '</small>';
      if (state.mode === 'change') return '<strong>' + esc(cityFormattedValue(r, field)) + '</strong><small>' + labelChange() + '基期缺失</small>';
      return '<strong>' + esc(cityFormattedValue(r, field)) + '</strong><small>' + (ch == null ? labelChange() + '基期缺失' : labelChange() + ' ' + delta(ch, field)) + '</small>';
    }
    function comparison(score, benchmark, missing) {
      if (score == null || benchmark == null || missing) return '<span class="hd-city-badge is-muted">基期缺失</span>';
      if (Math.abs(score - benchmark) < 0.0000001) return '<span class="hd-city-badge is-muted">与全国持平</span>';
      return score > benchmark ? '<span class="hd-city-badge is-up">高于全国</span>' : '<span class="hd-city-badge is-down">低于全国</span>';
    }
    function rowHtml(region, r, b, rank) {
      var isNational = region === '全国';
      var score = cityScore(r, b, field);
      return '<tr' + (isNational ? ' class="hd-benchmark"' : '') + '><td>' +
        (isNational ? '<strong>全国基准</strong>' : '<span class="hd-row-rank">' + rank + '</span><button class="hd-city-link" type="button" data-region="' + esc(region) + '" aria-label="查看' + esc(region) + '详情">' + esc(region) + '</button>') +
        '</td><td class="hd-city-value">' + primaryValue(r, b) + '</td><td>' +
        (isNational ? '<span class="hd-city-badge is-national">对比基准</span>' : comparison(score, nationalScore, state.mode === 'change' && M.change(r, b, field) == null)) +
        '</td></tr>';
    }
    $('city-table').innerHTML = header + '<tbody>' +
      (nationalValue != null ? rowHtml('全国', national, nationalBase) : '') +
      shown.map(function (c) { return rowHtml(c.region, c.row, c.base, c.rank); }).join('') +
      (!shown.length ? '<tr><td colspan="3" class="hd-empty">' + (query ? '没有匹配的城市，请检查城市名称。' : '本周暂无可对比城市数据。') + '</td></tr>' : '') +
      '</tbody>';
  }
  function cardAvailable(id, available, message) {
    var card = $(id), notice = card.querySelector('.hd-module-notice');
    if (!notice) { notice = document.createElement('p'); notice.className = 'hd-module-notice hd-compact-empty'; card.appendChild(notice); }
    Array.from(card.children).forEach(function (child) { if (!child.classList.contains('hd-card-head') && child !== notice) child.hidden = !available; });
    notice.hidden = available; notice.textContent = message;
  }
  function renderGroups() {
    if (!data.group) return;
    $('group-period').textContent = M.weekLabel(state.week) + ' · 全国';
    var rows = GROUPS.map(function (g) { return ix.group.get(g + '|全国|' + state.week); });
    var validGroups = GROUPS.filter(function (g, i) { return hasValues(rows[i], ['stay_adr','hotel_count','room_count']); });
    cardAvailable('group-card',validGroups.length>0,'所选周暂无集团数据 · 集团周度记录自2024年起');
    if (!validGroups.length) { blankTable('group-table', '所选周暂无集团记录', 6); return; }
    else {
      $('group-table').innerHTML = '<thead><tr><th>集团</th>' + metricHead('stay_adr', 'ADR') + '<th>酒店数（家）</th><th>房量（间）</th><th>价格指数</th><th>热度指数</th></tr></thead><tbody>' + validGroups.map(function (g) {
        var r = ix.group.get(g + '|全国|' + state.week), b = ix.group.get(g + '|全国|' + baseWeek());
        return '<tr><td>' + esc(g) + '</td>' + metricCell(r, b, 'stay_adr') + '<td>' + fmt(M.metric(r, 'hotel_count'), 0) + '</td><td>' + fmt(M.metric(r, 'room_count'), 0) + '</td><td>' + fmt(M.metric(r, 'stay_price_index'), 2) + '</td><td>' + fmt(M.metric(r, 'stay_heat_index'), 2) + '</td></tr>';
      }).join('') + '</tbody>';
    }
    drawGroups();
  }
  function drawGroups() {
    if (!data.group) return;
    var field = $('group-metric').value, isChange = state.mode === 'change' && calendar().some(function (p) { return GROUPS.some(function (g) { return M.change(ix.group.get(g+'|全国|'+p.period_id),ix.group.get(g+'|全国|'+M.priorPeriod(p)),field) != null; }); });
    var unit = isChange ? '%' : valueUnit(field), title = field === 'stay_adr' ? 'ADR（入住日期）' : field === 'hotel_count' ? '酒店数量' : '房间数量';
    $('group-chart-caption').textContent = title + ' · ' + (isChange ? '同周同比（%）' : '绝对值（' + unit + '）' + (state.mode === 'change' ? ' · 基期缺失' : ''));
    lineChart('group-chart', GROUPS.map(function (g, i) {
      var full = M.sorted(data.group.filter(function (r) { return r.group === g && r.region === '全国'; }));
      return { name: g, color: COLORS[i], pts: calendar().filter(function (r) { return full.length && r.period_id >= full[0].period_id; }).map(function (r) {
        var current = ix.group.get(g + '|全国|' + r.period_id);
        return { x: r.period_id, y: isChange ? M.change(current, ix.group.get(g + '|全国|' + M.priorPeriod(r)), field) : M.metric(current, field),change:M.change(current,ix.group.get(g+'|全国|'+M.priorPeriod(r)),field) };
      }) };
    }), { unit: unit, zero: isChange, forceLine: true });
  }
  function renderSupply() {
    if (!data.supply) return;
    var r = ix.supply15.get('全国|' + state.week), base = ix.supply15.get('全国|' + baseWeek()), rooms = M.metric(r, 'room_count');
    $('supply-period').textContent = M.weekLabel(state.week) + ' · 周度 · 15间及以上 · 酒店之家';
    cardAvailable('supply-card',hasValues(r,['hotel_count','room_count','chain_room_count']),'所选周暂无15间及以上供给数据');
    if (!hasValues(r,['hotel_count','room_count','chain_room_count'])) return;
    $('supply-stats').innerHTML = [['hotel_count','全国酒店'], ['room_count','全国房量'], ['chain_room_count','连锁房量'], ['chain_rate','房量连锁率']].map(function (item) { return supplyStat(r, base, item[0], item[1]); }).join('');
    if (!r) blankTable('supply-table', '所选周暂无供给结构记录；供给数据自2022W31起。', 5);
    else $('supply-table').innerHTML = '<thead><tr><th>酒店规模</th>' + metricHead('hotel_count','酒店数') + metricHead('room_count','房量') + '<th>占全国房量（%）</th>' + metricHead('chain_rate','房量连锁率') + '</tr></thead><tbody>' + BANDS.map(function (band) {
      var b = ix.supply.get('全国|' + band + '|' + state.week), prior = ix.supply.get('全国|' + band + '|' + baseWeek()), count = M.metric(b, 'room_count');
      if (!hasValues(b,['hotel_count','room_count','chain_room_count'])) return '';
      return '<tr><td>' + esc(band) + '</td>' + metricCell(b, prior, 'hotel_count') + metricCell(b, prior, 'room_count') + '<td>' + fmt(count != null && rooms ? count / rooms * 100 : null, 1) + '%</td>' + metricCell(b, prior, 'chain_rate') + '</tr>';
    }).join('') + '</tbody>';
    if (!$('supply-table').querySelector('tbody tr')) blankTable('supply-table','所选周未提供分规模明细',5);
    drawSupply();
  }
  function supplyStat(r, base, field, title) {
    var v = M.metric(r, field), change = M.change(r, base, field), isRate = field === 'chain_rate';
    if (isRate && v != null) v *= 100;
    if (v == null) return '';
    var isChange = state.mode === 'change' && change != null, current = fmt(v, isRate ? 1 : 0) + ' ' + valueUnit(field);
    return '<div><span>' + title + (isChange ? ' · ' + labelChange() : ' · 本周') + '</span><b>' + (isChange ? delta(change, field) : current) + '</b><small>' + (isChange ? '本周 ' + current : change == null ? '基期缺失 · 暂无同比' : labelChange() + ' ' + delta(change, field)) + '</small></div>';
  }
  function drawSupply() {
    if (!data.supply) return;
    var enabled = Array.from($('supply-metric').options).filter(function(o){ var valid=calendar(state.supplyWindow).some(function(p){return M.metric(ix.supply15.get('全国|'+p.period_id),o.value)!=null;});o.disabled=!valid;return valid; });
    if(enabled.length && $('supply-metric').selectedOptions[0].disabled) $('supply-metric').value=enabled[0].value;
    var field = $('supply-metric').value, isChange = state.mode === 'change' && calendar(state.supplyWindow).some(function (p) { return M.change(ix.supply15.get('全国|'+p.period_id),ix.supply15.get('全国|'+M.priorPeriod(p)),field) != null; });
    var title = field === 'hotel_count' ? '酒店数量' : field === 'chain_room_count' ? '连锁房量' : '房间数量';
    $('supply-chart-caption').textContent = title + ' · 15间及以上 · ' + (isChange ? '同周同比（%）' : '绝对值（' + valueUnit(field) + '）' + (state.mode === 'change' ? ' · 基期缺失' : ''));
    lineChart('supply-chart', [{ name: '全国 · 15间及以上' + (isChange ? ' · 同周同比' : ''), color: COLORS[0], pts: calendar(state.supplyWindow).map(function (r) { return { x: r.period_id, date: r.start_date + ' — ' + r.end_date, change:M.change(ix.supply15.get('全国|'+r.period_id),ix.supply15.get('全国|'+M.priorPeriod(r)),field), y: isChange ? M.change(ix.supply15.get('全国|' + r.period_id), ix.supply15.get('全国|' + M.priorPeriod(r)), field) : M.metric(ix.supply15.get('全国|' + r.period_id), field) }; }) }], { unit: isChange ? '%' : valueUnit(field), zero: isChange });
  }
  function renderInvestment() {
    if (!data.investment) return;
    var cutoff = periods.get(state.week).end_date;
    var rows = M.sorted(data.investment.observations).filter(function (r) { return r.end_date <= cutoff; }), r = rows[rows.length - 1];
    $('investment-period').textContent = r ? r.period_id.slice(0,4) + '年1—' + Number(r.period_id.slice(5)) + '月 · 累计 · 全国' : '所选数据周之前暂无投资数据';
    var hasAmount = r && M.num(r.amount_cny_100m) != null;
    $('investment-stats').innerHTML = '<div><span>投资完成额累计同比</span><b>' + delta(r ? r.yoy_pct : null, 'investment') + '</b><small>国家统计局 · Choice转引</small></div><div><span>同期累计完成额（亿元）</span><b>' + (hasAmount ? fmt(r.amount_cny_100m, 1) : '暂无数据') + '</b><small>' + (hasAmount ? '国家统计局公报 · 原披露值' : '金额未取得') + '</small></div>';
    var weeks = calendar(state.investmentWindow), start = weeks.length ? weeks[0].start_date : cutoff;
    var field = $('supply-metric').value;
    var title = field === 'hotel_count' ? '酒店数量' : field === 'chain_room_count' ? '连锁房量' : '房间数量';
    var points = M.investmentWindow(data.investment.observations, cutoff, 'all').map(function (p) {
      var date = new Date(p.period_id + '-01T00:00:00Z');
      return { x: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0,10), y:M.num(p.yoy_pct), date:p.period_id.slice(0,4)+'年1—'+Number(p.period_id.slice(5))+'月' };
    }).filter(function (p) { return p.x >= start && p.x <= cutoff; });
    var lines = [{name:'住宿和餐饮业投资 · 月度累计同比（右轴）', color:'#ac863d', axis:'right', gap:65*86400000, pts:points}];
    if (ix.supply15) lines.unshift({name:title+' · 周度同周同比（左轴）', color:COLORS[0], gap:15*86400000, pts:weeks.map(function (p) {
      return {x:p.end_date, date:M.weekLabel(p.period_id)+'（'+p.end_date+'）', y:M.change(ix.supply15.get('全国|'+p.period_id),ix.supply15.get('全国|'+M.priorPeriod(p)),field)};
    })});
    $('investment-chart-caption').textContent = title+'同比 / 住宿和餐饮业投资累计同比（%） · 15间及以上 / 不含农户';
    lineChart('investment-chart', lines, {unit:'%', time:true, forceLine:true, dualAxis:true, leftTitle:'酒店供给同比（%）', rightTitle:'投资累计同比（%）'});
    $('investment-table').innerHTML = '<thead><tr><th>累计期间</th><th>累计同比（%）</th><th>完成额（亿元）</th></tr></thead><tbody>' + rows.slice().reverse().map(function (p) { return '<tr><td>'+p.period_id.slice(0,4)+'年1—'+Number(p.period_id.slice(5))+'月</td><td>'+delta(p.yoy_pct,'investment')+'</td><td>'+(M.num(p.amount_cny_100m)==null?'暂无数据':fmt(p.amount_cny_100m,1))+'</td></tr>';}).join('') + '</tbody>';
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
  function refresh() { if(state.view==='annual'){window.HotelAnnual.render(); saveState(); return;} selectionOptions(); renderPeriod(); if(state.view==='overview') renderOverview(); else if(state.view==='cities') renderCities(); else { renderGroups(); renderSupply(); renderInvestment(); } saveState(); }
  async function exportWeekly() {
    var start = $('export-start').value, end = $('export-end').value;
    var tiered = $('export-scope').value === 'segments', error = $('export-error');
    error.textContent = '';
    if (!periods.has(start) || !periods.has(end) || start > end) { error.textContent = '开始周不能晚于结束周。'; return; }
    var rows = data.industry.filter(function (r) { return r.period_id >= start && r.period_id <= end && r.region === '全国' && (tiered ? SEGS.includes(r.segment) : r.segment === '全部'); }).sort(function (a,b) { return a.period_id.localeCompare(b.period_id); });
    if (!rows.length) { error.textContent = '所选范围暂无数据。'; return; }
    var submit = $('export-form').querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = '正在生成…';
    try {
      var X = HotelExcel, columns = [{label:'数据周',width:14},{label:'开始日期',width:15,format:'date'},{label:'结束日期',width:15,format:'date'},{label:'RevPAR（元）',format:'number'},{label:'RevPAR同比',format:'change'},{label:'OCC',format:'percent'},{label:'OCC同比（百分点）',width:20,format:'points'},{label:'ADR（元）',format:'number'},{label:'ADR同比',format:'change'},{label:'同比基周',width:14}];
      var specs = (tiered ? SEGS : ['全部']).filter(function (s) { return rows.some(function (r) { return r.segment === s; }); }).map(function (s) {
        return { name:s==='全部'?'全国经营':s, title:'全国酒店周度经营'+(s==='全部'?'':' · '+s), subtitle:start+' 至 '+end+' · 来源：酒店之家', note:'同周号同比，未调整节假日错期；缺失值留空。OCC为入住率，变化单位为百分点。', columns:columns,
          rows:rows.filter(function (r) { return r.segment === s; }).map(function (r) { var id=M.priorPeriod(r), b=row(r.region,r.segment,id); return [r.period_id,X.date(r.start_date),X.date(r.end_date),M.metric(r,'revpar'),M.change(r,b,'revpar')==null?null:M.change(r,b,'revpar')/100,M.metric(r,'occupancy_rate'),M.change(r,b,'occupancy_rate'),M.metric(r,'adr'),M.change(r,b,'adr')==null?null:M.change(r,b,'adr')/100,id]; }) };
      });
      var originals = new Map();
      rows.forEach(function (r) { originals.set(r.period_id+'|'+r.segment,r); var b=row(r.region,r.segment,M.priorPeriod(r)); if(b) originals.set(b.period_id+'|'+b.segment,b); });
      specs.push(X.raw(Array.from(originals.values()).sort(function(a,b){return a.period_id.localeCompare(b.period_id);})));
      await X.download(specs,'酒店周度数据_'+(tiered?'全国分档次_':'全国_')+start+'_'+end);
      $('weekly-export-dialog').close();
    } catch (e) { error.textContent = e.message || '导出失败，请重试。'; }
    finally { submit.disabled=false; submit.textContent='导出'; }
  }
  function openWeeklyExport() {
    var options = weekly.map(function (p) { return option(p.period_id,M.weekLabel(p.period_id)+' · '+p.start_date+' — '+p.end_date); }).join('');
    $('export-start').innerHTML = options; $('export-end').innerHTML = options;
    var range = calendar();
    $('export-start').value = range.length ? range[0].period_id : state.week;
    $('export-end').value = state.week; $('export-error').textContent = '';
    var dialog = $('weekly-export-dialog'), height = window.innerHeight, top = Math.min(64, height * 0.08);
    // Embedded panels grow with their content; position against the visible parent viewport.
    try {
      if (window.parent !== window && window.frameElement) {
        height = window.parent.innerHeight;
        top = Math.max(16, Math.min(64, height * 0.08) - window.frameElement.getBoundingClientRect().top);
        var visibleTop = top + window.frameElement.getBoundingClientRect().top;
        dialog.style.setProperty('--export-max-height', Math.max(160, height - visibleTop - 16) + 'px');
      } else dialog.style.setProperty('--export-max-height', Math.max(160, height - top - 16) + 'px');
    } catch (e) { dialog.style.setProperty('--export-max-height', '85vh'); }
    dialog.style.setProperty('--export-top', top + 'px');
    dialog.showModal();
  }
  function init(rows) {
    data.industry = rows; ix.industry = M.index(rows, ['region', 'segment', 'period_id']);
    rows.forEach(function (r) { var k=r.region+'|'+r.segment; if(!seriesCache.has(k)) seriesCache.set(k,[]); seriesCache.get(k).push(r); });
    M.sorted(rows.filter(function (r) { return r.segment === '全部'; })).forEach(function (r) { periods.set(r.period_id, r); });
    weekly = Array.from(periods.values()).sort(function (a,b) { return a.period_id.localeCompare(b.period_id); });
    regions = Array.from(new Set(rows.map(function (r) { return r.region; }))).filter(function (r) { return r !== '全国'; }).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }); regions.unshift('全国');
    var latest = M.sorted(rows.filter(function (r) { return r.region === '全国' && r.segment === '全部'; })).pop();
    latestWeek = latest.period_id; state.week = latestWeek;
    var saved = new URLSearchParams(location.hash.slice(1));
    if (regions.includes(saved.get('region'))) state.region = saved.get('region');
    if (periods.has(saved.get('week'))) { state.week = saved.get('week'); followLatest = false; }
    if (['overview', 'cities', 'structure', 'annual'].includes(saved.get('view'))) state.view = saved.get('view');
    if (['12', '13', '26', '52', '156', 'all'].includes(saved.get('window')) && (saved.get('window') !== '52' || saved.get('rangeVersion') === '12w')) state.window = saved.get('window');
    if (['12','13','26','52','156','all'].includes(saved.get('supplyWindow'))) state.supplyWindow=saved.get('supplyWindow');
    if (['12','13','26','52','156','all'].includes(saved.get('investmentWindow'))) state.investmentWindow=saved.get('investmentWindow');
    if (META[saved.get('metric')]) state.metric = saved.get('metric');
    if (['combo', 'value', 'change'].includes(saved.get('mode'))) state.mode = saved.get('mode');
    if (periods.has(saved.get('base'))) state.base = saved.get('base');
    SiteUI.asOf($('asof'), latest.end_date, []);
    $('week-select').innerHTML = option('latest', '最新周 · ' + M.weekLabel(latestWeek)) + Array.from(periods.values()).reverse().map(function (r) { return option(r.period_id, M.weekLabel(r.period_id)); }).join('');
    $('week-select').value = followLatest ? 'latest' : state.week; $('region-select').innerHTML = regions.map(function (r) { return option(r, r); }).join(''); $('history-start').value = state.window;
    compareOptions(); $('dashboard').hidden = false;
    $('weekly-export').onclick = openWeeklyExport;
    $('export-cancel').onclick = function () { $('weekly-export-dialog').close(); };
    $('export-form').onsubmit = function (event) { event.preventDefault(); exportWeekly(); };
    document.querySelectorAll('.hd-tab[data-view]').forEach(function (b) { b.onclick = function () { switchView(b.dataset.view); }; });
    var holidayTab = $('holiday-dashboard-tab');
    if (holidayTab) holidayTab.addEventListener('click', function (event) {
      event.preventDefault(); saveState();
      var target = new URL('hotel-holiday-dashboard.html', location.href);
      if (new URLSearchParams(location.search).get('embed') === '1') target.searchParams.set('embed', '1');
      var saved = new URLSearchParams(location.hash.slice(1)); saved.set('view', 'holiday');
      target.hash = saved.toString(); location.href = target.href;
    });
    $('week-select').onchange = function () { followLatest = this.value === 'latest'; state.week = followLatest ? latestWeek : this.value; state.base = 'auto'; compareOptions(); refresh(); };
    $('compare-select').onchange = function () { state.base = this.value; refresh(); };
    $('region-select').onchange = function () { state.region = this.value; refresh(); };
    function setWindow() { state.window = this.value; ['history-start','segment-window','group-window'].forEach(function (id) { $(id).value = state.window; }); renderTrend(); drawSegments(); drawGroups(); drawSupply(); renderInvestment(); saveState(); }
    ['history-start','segment-window','group-window'].forEach(function (id) { $(id).value = state.window; $(id).onchange = setWindow; });
    $('investment-window').value=state.investmentWindow; $('investment-window').onchange=function(){state.investmentWindow=this.value;renderInvestment();saveState();};
    $('supply-window').value=state.supplyWindow; $('supply-window').onchange=function(){state.supplyWindow=this.value;drawSupply();saveState();};
    function bindSwitch(id, attr) {
      var buttons = $(id).querySelectorAll('button');
      function active() { buttons.forEach(function (b) { var isActive = b.dataset[attr] === state[attr]; b.classList.toggle('active', isActive); b.setAttribute('aria-pressed', isActive); }); }
      buttons.forEach(function (b) { b.onclick = function () {
        state[attr] = b.dataset[attr]; active();
        if (attr === 'mode') {
          refresh();
        } else { renderTrend(); drawSegments(); saveState(); }
      }; }); active();
    }
    bindSwitch('metric-switch', 'metric'); bindSwitch('mode-switch', 'mode');
    $('group-metric').onchange = drawGroups; $('supply-metric').onchange = function () { drawSupply(); renderInvestment(); };
    $('city-search').oninput = renderCities; $('city-order').onchange = function () { cityOrder = $('city-order').value; renderCities(); };
    document.querySelectorAll('[data-city-metric]').forEach(function (button) { button.onclick = function () { cityMetric = button.dataset.cityMetric; renderCities(); }; });
    $('city-table').onclick = function (event) { var b = event.target.closest('[data-region]'); if (!b) return; state.region = b.dataset.region; switchView('overview'); $('region-select').focus(); };
    window.addEventListener('hotel:switch-view', function(event) { if(['overview','cities','structure','annual'].includes(event.detail))switchView(event.detail); });
    switchView(state.view);
  }
  function error(id, message, cols) { blankTable(id, message, cols); }
  // Secondary sources fail independently so the primary operating view remains usable.
  var extra = [
    { name: 'group', file: 'hotel_group_weekly.csv', keys: ['group', 'region', 'period_id'], render: renderGroups, table: 'group-table', cols: 6, label: '集团' },
    { name: 'supply', file: 'hotel_supply_weekly.csv', keys: ['region', 'room_band', 'period_id'], render: renderSupply, table: 'supply-table', cols: 5, label: '供给' },
    { name: 'share', file: 'hotel_market_share_annual.csv', keys: ['group', 'year'], render: renderShare, table: 'share-table', cols: 3, label: '市占率' }
  ];
  extra.forEach(function (source) { blankTable(source.table, '正在读取' + source.label + '数据…', source.cols); });
  var primary = fetchRows('hotel_industry_weekly.csv').then(init).catch(function (e) {
    $('asof').textContent = '经营数据读取失败'; $('load-error').hidden = false;
    $('load-error').textContent = '经营数据暂时无法读取。';
    var button = document.createElement('button'); button.textContent = '重试'; button.onclick = function () { location.reload(); }; $('load-error').appendChild(button);
    throw e;
  });
  extra.forEach(function (source) {
    Promise.all([fetchRows(source.file), primary]).then(function (result) {
      ix[source.name] = M.index(result[0], source.keys); data[source.name] = result[0];
      if(source.name==='supply') { var buckets=new Map(); result[0].forEach(function (r) {var k=r.region+'|'+r.period_id;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r);}); ix.supply15=new Map(); data.industry.filter(function(r){return r.segment==='全部';}).forEach(function(r){var k=r.region+'|'+r.period_id;ix.supply15.set(k,M.supply15Plus(buckets.get(k)||[],r));}); }
      if(source.name==='share') source.render(); else if(state.view==='structure') refresh();
    }).catch(function () { error(source.table, source.label + '数据暂时无法读取，可重新加载后重试。', source.cols); if(source.name==='supply'||source.name==='group') cardAvailable(source.name+'-card',false,source.label+'数据读取失败，请重新加载'); });
  });
  fetch('data/hotel-investment-monthly.json', {cache:'no-cache'}).then(function (r) {if (!r.ok) throw new Error('HTTP '+r.status); return r.json();}).then(function (json) {
    if (!json.observations || !json.observations.length) throw new Error('没有有效记录');
    M.index(json.observations, ['period_id']);
    return primary.then(function () { data.investment = json; renderInvestment(); });
  }).catch(function () { $('investment-period').textContent = '投资数据读取失败'; $('investment-stats').textContent = '投资数据暂时无法读取，请重新加载后重试。'; blankTable('investment-table','投资数据读取失败',3); });
  var resizePending = false;
  window.addEventListener('resize', function () {
    if (!data.industry || resizePending) return;
    resizePending = true;
    requestAnimationFrame(function () { resizePending = false; renderTrend(); drawSegments(); drawGroups(); drawSupply(); renderInvestment(); if (data.share) renderShare(); });
  });

  function svgEl(name, attrs, text) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text; return e;
  }
  function lineChart(id, lines, opt) {
    opt = opt || {}; var host = $(id); host.innerHTML = ''; lines = M.chartSeries(lines);
    if(!opt.forceLine&&state.mode==='combo'&&lines.some(s=>s.pts.some(p=>Number.isFinite(p.change)))){const keys=[...new Set(lines.flatMap(s=>s.pts.map(p=>p.x)))].sort();SiteCharts.drawPaired(host,keys.map((key,i)=>({period:key,x:i,values:lines.map(s=>{const p=s.pts.find(p=>p.x===key);return {name:s.name,value:p?.y,change:p?.change,color:s.color};})})),{unit:opt.unit,changeUnit:opt.occupancy?'百分点':'%',changeLabel:labelChange(),name:lines.map(s=>s.name).join('、'),precision:0,changePrecision:1,periodFormat:'week-short'});return;}
    var xs = Array.from(new Set(lines.flatMap(function (s) { return s.pts.map(function (p) { return p.x; }); }))).sort();
    var values = lines.flatMap(function (s) { return s.pts.map(function (p) { return M.num(p.y); }); }).filter(function (v) { return v != null; });
    if (!values.length) { host.innerHTML = '<div class="hd-empty">所选范围暂无有效数据</div>'; return; }
    var W = Math.max(300, host.clientWidth - 40), H = 300, L = 76, R = opt.dualAxis ? 76 : 28, T = opt.dualAxis ? 36 : 24, B = 40, min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (opt.zero) { min = Math.min(0, min); max = Math.max(0, max); }
    var leftValues = opt.dualAxis ? lines.filter(function(s){return s.axis!=='right';}).flatMap(function(s){return s.pts.map(function(p){return M.num(p.y);});}).filter(function(v){return v!=null;}) : values;
    var scale=SiteCharts.niceScale(leftValues,{zero:opt.zero,min:opt.occupancy?0:undefined,max:opt.occupancy?100:undefined});min=scale.min;max=scale.max;
    var rightScale = opt.dualAxis ? SiteCharts.niceScale(lines.filter(function(s){return s.axis==='right';}).flatMap(function(s){return s.pts.map(function(p){return M.num(p.y);});}).filter(function(v){return v!=null;}),{}) : null;
    var positions = new Map(xs.map(function (x, i) { return [x, i]; }));
    function px(x) { return L + (opt.time ? (Date.parse(x)-Date.parse(xs[0])) / Math.max(1,Date.parse(xs[xs.length-1])-Date.parse(xs[0])) : positions.get(x) / Math.max(1, xs.length - 1)) * (W - L - R); }
    function py(y, series) { var selected = rightScale && series && series.axis==='right' ? rightScale : scale; return T + (selected.max - y) / (selected.max - selected.min) * (H - T - B); }
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', role: 'img', 'aria-label': lines.map(function (s) { return s.name; }).join('、') + '走势，单位' + opt.unit, tabindex: '0' });
    host.appendChild(svg);
    if (opt.dualAxis) {
      svg.appendChild(svgEl('text',{x:L,y:16,'text-anchor':'start','font-size':11,fill:COLORS[0]},opt.leftTitle));
      svg.appendChild(svgEl('text',{x:W-R,y:16,'text-anchor':'end','font-size':11,fill:'#ac863d'},opt.rightTitle));
      rightScale.ticks.forEach(function(v){var y=T+(rightScale.max-v)/(rightScale.max-rightScale.min)*(H-T-B);svg.appendChild(svgEl('text',{x:W-R+8,y:y+4,'text-anchor':'start','font-size':11,fill:'#ac863d'},rightScale.format(v)));});
    }
    var axisDigits = opt.unit === '%' || opt.unit === '百分点' ? 1 : 0;
    for (var i = 0; i < scale.ticks.length; i++) {
      var v = scale.ticks[i], y = py(v);
      svg.appendChild(svgEl('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: '#edf0f5' }));
      svg.appendChild(svgEl('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: opt.dualAxis ? COLORS[0] : '#8a94a5' }, scale.format(v)));
    }
    if (min < 0 && max > 0) svg.appendChild(svgEl('line', { x1: L, x2: W - R, y1: py(0), y2: py(0), stroke: '#c3c9d8', 'stroke-dasharray': '4 4' }));
    Array.from(new Set([0, Math.round((xs.length - 1) / 3), Math.round((xs.length - 1) * 2 / 3), xs.length - 1])).forEach(function (i) {
      svg.appendChild(svgEl('text', { class: 'site-period-tick', x: px(xs[i]), y: H - 10, 'text-anchor': opt.time && i === 0 ? 'start' : opt.time && i === xs.length - 1 ? 'end' : 'middle', 'font-size': 11, fill: '#8a94a5' }, ChartPeriod.format(xs[i])));
    });
    lines.forEach(function (s) {
      var path = '', started = false, previous = null;
      s.pts.forEach(function (p) { if (M.num(p.y) == null) { started = false; previous = null; return; } if(opt.time && previous && Date.parse(p.x)-Date.parse(previous)>s.gap) started=false; path += (started ? 'L' : 'M') + px(p.x).toFixed(1) + ' ' + py(p.y,s).toFixed(1); started = true; previous=p.x; });
      var attrs = { d: path, fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      if (s.dash) attrs['stroke-dasharray'] = '5 5'; svg.appendChild(svgEl('path', attrs));
      s.pts.forEach(function(p,i){if(M.num(p.y)!=null&&(i%Math.max(1,Math.ceil(s.pts.length/60))===0||i===s.pts.length-1))svg.appendChild(svgEl('circle',{cx:px(p.x),cy:py(p.y,s),r:3.2,fill:'white',stroke:s.color,'stroke-width':1.8}));});
    });
    var legend = document.createElement('div'); legend.className = 'hd-legend';
    legend.innerHTML = lines.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + (s.dash ? '（虚线）' : '') + '</span>'; }).join(''); host.appendChild(legend);
    var maps = lines.map(function(s){return new Map(s.pts.map(function(p){return [p.x,p];}));});
    SiteCharts.attach(host, xs.map(function(key){
      var firstIndex=maps.findIndex(function(map){var p=map.get(key);return p&&M.num(p.y)!=null;}), first=firstIndex>=0?maps[firstIndex].get(key):null;
      return {x:px(key),y:first?py(first.y,lines[firstIndex]):T,labels:lines.flatMap(function(s,i){var p=maps[i].get(key);return p&&M.num(p.y)!=null?[{x:px(key),y:py(p.y,s),text:fmt(p.y,opt.zero||id==='investment-chart'?1:0)+(opt.zero||id==='investment-chart'?(opt.unit||''):''),kind:opt.zero||id==='investment-chart'?'change':'value',color:s.color}]:[];}),text:M.weekLabel(first&&first.date?first.date:key)+'\n'+lines.map(function(s,i){var p=maps[i].get(key);return s.name+'：'+fmt(p?p.y:null,opt.zero||id==='investment-chart'?1:0)+' '+(opt.unit||'');}).join('\n')};
    }));

  }
})();






