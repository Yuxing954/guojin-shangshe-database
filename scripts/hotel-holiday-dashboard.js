(function () {
  'use strict';
  var M = window.HotelMetrics, $ = function (id) { return document.getElementById(id); };
  var holidayNames = {
    'spring-festival': '春节', qingming: '清明', 'mid-autumn': '中秋',
    'dragon-boat': '端午', 'national-day': '国庆'
  };
  var state = { rows: [], record: null, segment: '全部', metric: 'revpar', mode: 'combo' };
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(value) { return M.num(value); }
  function average(rows, field) {
    var values = rows.map(function (r) { return num(r[field]); }).filter(function (v) { return v != null; });
    return values.length ? values.reduce(function (a, b) { return a + b; }, 0) / values.length : null;
  }
  function summarize(rows) {
    return {
      occupancy_rate: average(rows, 'occupancy_rate'),
      adr: average(rows, 'adr'),
      revpar: average(rows, 'revpar')
    };
  }
  function difference(now, base, field) {
    if (now == null || base == null) return null;
    if (field === 'occupancy_rate') return (now - base) * 100;
    return base === 0 ? null : (now / base - 1) * 100;
  }
  function fmt(value, field) {
    if (value == null) return '—';
    if (field === 'occupancy_rate') return (value * 100).toFixed(0) + '%';
    return value.toFixed(0);
  }
  function fmtChange(value, field) {
    if (value == null) return '—';
    var positive = value > 0 ? '+' : '';
    return positive + value.toFixed(1) + (field === 'occupancy_rate' ? '个百分点' : '%');
  }
  function deltaClass(value) { return value == null || value === 0 ? 'hd-neutral' : value > 0 ? 'hd-positive' : 'hd-negative'; }
  function activeRows() {
    var holiday = $('holiday-select').value, dimension = $('dimension-select').value, segment = state.segment;
    return state.rows.filter(function (r) { return r.holiday_id === holiday && r.dimension === dimension && (segment === '*' || r.segment === segment); });
  }
  function selectedRecords() {
    return activeRows().filter(function (r) { return r.segment === state.segment || state.segment === '*'; }).sort(function (a, b) { return Number(a.period_day) - Number(b.period_day); });
  }
  function holidayInfo(id) {
    var c = state.record && state.record.coverage && state.record.coverage[id];
    return c || null;
  }
  function periodText(id, dimension) {
    var c = holidayInfo(id), sheets = c && c.sheets;
    var sheet = sheets && sheets[dimension === 'hotel_tier' ? '分档位' : '分线级'];
    if (!sheet) return '';
    return sheet.currentStart + ' 至 ' + sheet.currentEnd + ' 对比 ' + sheet.baselineStart + ' 至 ' + sheet.baselineEnd + ' · 按假期日序对齐';
  }
  function renderOptions() {
    var holiday = $('holiday-select').value || 'national-day';
    var dimension = $('dimension-select').value || 'hotel_tier';
    $('holiday-select').innerHTML = Object.keys(holidayNames).map(function (id) { return '<option value="' + id + '">' + holidayNames[id] + '</option>'; }).join('');
    $('holiday-select').value = holiday;
    $('dimension-select').value = dimension;
    var segments = Array.from(new Set(state.rows.filter(function (r) { return r.holiday_id === holiday && r.dimension === dimension; }).map(function (r) { return r.segment; })));
    var old = state.segment;
    segments.sort(function (a, b) {
      var order = ['全部', '经济型', '中档型', '高档型', '豪华型', '一线城市', '新一线城市', '二线城市', '三线城市', '四线及以下城市'];
      return order.indexOf(a) - order.indexOf(b);
    });
    state.segment = segments.indexOf(old) >= 0 ? old : (segments.indexOf('全部') >= 0 ? '全部' : (segments[0] || ''));
    $('holiday-segments').innerHTML = segments.map(function (s) {
      return '<button type="button" data-segment="' + esc(s) + '" class="' + (s === state.segment ? 'active' : '') + '" aria-pressed="' + (s === state.segment) + '">' + esc(s === '全部' ? '全国整体' : s) + '</button>';
    }).join('');
  }
  function kpi(label, now, base, field) {
    var diff = difference(now, base, field);
    return '<article class="hd-stat"><div class="hd-stat-label">' + label + '</div><div class="hd-stat-value">' + fmt(now, field) + '</div><div class="hd-stat-change"><span>对标 ' + fmt(base, field) + '</span><strong class="' + deltaClass(diff) + '">' + esc(fmtChange(diff, field)) + '</strong></div></article>';
  }
  function renderKpis(records) {
    var now = summarize(records), baseRows = records.map(function (r) { return { occupancy_rate: r.baseline_occupancy_rate, adr: r.baseline_adr, revpar: r.baseline_revpar }; });
    var base = summarize(baseRows);
    $('holiday-kpis').innerHTML = [
      ['假期日均OCC', 'occupancy_rate'], ['假期日均 ADR（元）', 'adr'], ['假期日均 RevPAR（元）', 'revpar']
    ].filter(function (item) { return now[item[1]] != null; }).map(function (item) {
      return kpi(item[0], now[item[1]], base[item[1]], item[1]);
    }).join('');
  }
  function metricValue(row, field, baseline) {
    if (!baseline) return num(row[field]);
    return num(row['baseline_' + field]);
  }
  function renderChart(records) {
    var field = state.metric, title = field === 'occupancy_rate' ? 'OCC' : field === 'adr' ? 'ADR' : 'RevPAR';
    var unit = field === 'occupancy_rate' ? '%' : '元', changeUnit = field === 'occupancy_rate' ? '百分点' : '%';
    var sorted = records.slice().sort(function (a, b) { return Number(a.period_day) - Number(b.period_day); });
    var changeLabel = sorted.length ? comparisonLabel(sorted[0]) : '同比';
    if (field === 'occupancy_rate' && changeLabel === '同比') changeLabel = '同比变化';
    $('trend-title').textContent = '假期每日 ' + title;
    $('trend-note').textContent = state.segment === '全部' ? '全国整体' : state.segment;
    $('trend-caption').textContent = (state.mode === 'combo' ? '本期数值（' + unit + '）＋' + changeLabel + '（' + changeUnit + '）' :
      state.mode === 'change' ? changeLabel + '（' + changeUnit + '）' : '本期 / 对标期（' + unit + '）') + ' · 按假期日序对齐';

    var chartRows = sorted.map(function (r) {
      var now = metricValue(r, field, false), base = metricValue(r, field, true);
      var value = field === 'occupancy_rate' && now != null ? now * 100 : now;
      var baseline = field === 'occupancy_rate' && base != null ? base * 100 : base;
      var item = { x: Number(r.period_day), period: '第' + r.period_day + '天', value: value, change: difference(now, base, field) };
      if (state.mode === 'value') item.values = [{ name: '本期', value: value }, { name: '对标期', value: baseline }];
      return item;
    });
    var host = $('holiday-chart');
    var result = SiteCharts.drawPaired(host, chartRows, { mode: state.mode, name: title, unit: unit,
      changeUnit: changeUnit, changeLabel: changeLabel, precision: 0, changePrecision: 1, gap: 1.5 });
    result.points.forEach(function (point, index) {
      var r = sorted[index], now = metricValue(r, field, false), base = metricValue(r, field, true);
      point.text = ['第' + r.period_day + '天', '本期 ' + r.current_date + '：' + fmt(now, field),
        '对标 ' + r.baseline_date + '：' + fmt(base, field),
        changeLabel + ' ' + fmtChange(difference(now, base, field), field)].join(String.fromCharCode(10));
    });
    SiteCharts.attach(host, result.points);
  }
  function renderSummary(rows) {
    var segments = Array.from(new Set(rows.map(function (r) { return r.segment; }))).sort(function (a, b) { return a === '全部' ? -1 : b === '全部' ? 1 : a.localeCompare(b, 'zh-CN'); });
    var body = segments.map(function (segment) {
      var group = rows.filter(function (r) { return r.segment === segment; }), now = summarize(group);
      var base = summarize(group.map(function (r) { return { occupancy_rate: r.baseline_occupancy_rate, adr: r.baseline_adr, revpar: r.baseline_revpar }; }));
      return '<tr><td><strong>' + esc(segment) + '</strong></td>' + ['occupancy_rate', 'adr', 'revpar'].map(function (field) {
        var delta = difference(now[field], base[field], field);
        return '<td>' + fmt(now[field], field) + '<small>对标 ' + fmt(base[field], field) + ' · <span class="' + deltaClass(delta) + '">' + esc(fmtChange(delta, field)) + '</span></small></td>';
      }).join('') + '</tr>';
    }).join('');
    $('summary-table').innerHTML = '<thead><tr><th>对标对象</th><th>OCC</th><th>ADR（元）</th><th>RevPAR（元）</th></tr></thead><tbody>' + body + '</tbody>';
  }
  function renderHolidayOverview(dimension) {
    var body = Object.keys(holidayNames).map(function (id) {
      var rows = state.rows.filter(function (r) { return r.holiday_id === id && r.dimension === dimension && r.segment === '全部'; });
      var now = summarize(rows), base = summarize(rows.map(function (r) { return { occupancy_rate: r.baseline_occupancy_rate, adr: r.baseline_adr, revpar: r.baseline_revpar }; }));
      var c = holidayInfo(id), sheet = c && c.sheets && c.sheets[dimension === 'hotel_tier' ? '分档位' : '分线级'];
      var period = sheet ? sheet.currentStart + '—' + sheet.currentEnd + ' / ' + sheet.baselineStart + '—' + sheet.baselineEnd : '—';
      return '<tr><td><strong>' + holidayNames[id] + '</strong></td><td>' + period + '</td>' + ['occupancy_rate', 'adr', 'revpar'].map(function (field) {
        var delta = difference(now[field], base[field], field);
        return '<td>' + fmt(now[field], field) + '<small>对标 ' + fmt(base[field], field) + ' · <span class="' + deltaClass(delta) + '">' + esc(fmtChange(delta, field)) + '</span></small></td>';
      }).join('') + '</tr>';
    }).join('');
    $('holiday-overview-table').innerHTML = '<thead><tr><th>假期</th><th>本期 / 对标期</th><th>日均OCC</th><th>日均 ADR（元）</th><th>日均 RevPAR（元）</th></tr></thead><tbody>' + body + '</tbody>';
  }
  function comparisonLabel(row) {
    return Number(row.current_year) - Number(row.baseline_year) === 1 ? '同比' : '对标变化';
  }
  function renderDaily(records) {
    var rows = records.slice().sort(function (a, b) { return Number(a.period_day) - Number(b.period_day); });
    var fields = ['occupancy_rate', 'adr', 'revpar'];
    $('daily-table').innerHTML = '<thead><tr><th>假期日序</th><th>酒店档位 / 城市线级</th><th>本期日期</th><th>对标日期</th><th>本期 OCC（%）</th><th>对标 OCC（%）</th><th>本期 ADR（元）</th><th>对标 ADR（元）</th><th>本期 RevPAR（元）</th><th>对标 RevPAR（元）</th></tr></thead><tbody>' + rows.map(function (r) {
      return '<tr><td>第' + esc(r.period_day) + '天' + (r.day_label ? ' · ' + esc(r.day_label) : '') + '</td><td>' + esc(r.segment) + '</td><td>' + esc(r.current_date) + '</td><td>' + esc(r.baseline_date) + '</td>' + fields.map(function (field) {
        var now = metricValue(r, field, false), base = metricValue(r, field, true);
        var change = difference(now, base, field);
        var label = field === 'occupancy_rate' ? '较对标期' : comparisonLabel(r);
        return '<td>' + fmt(now, field) + '<small class="' + deltaClass(change) + '">' + label + ' ' + esc(fmtChange(change, field)) + '</small></td><td>' + fmt(base, field) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
  }
  function render() {
    renderOptions();
    var holiday = $('holiday-select').value, dimension = $('dimension-select').value;
    var matching = state.rows.filter(function (r) { return r.holiday_id === holiday && r.dimension === dimension; });
    var selected = selectedRecords();
    $('period-note').textContent = periodText(holiday, dimension);
    var baselineYear = (matching[0] && matching[0].baseline_year) || '';
    $('asof').innerHTML = '<b>' + holidayNames[holiday] + ' · ' + ((matching[0] && matching[0].current_year) || '') + '年对标' + baselineYear + '年</b>酒店之家';
    renderHolidayOverview(dimension);
    renderKpis(selected);
    $('holiday-metric-select').value = state.metric;
    renderChart(selected);
    renderSummary(matching);
    renderDaily(selected);
    var saved = new URLSearchParams(location.hash.slice(1));
    saved.set('view', 'holiday'); saved.set('holiday', holiday);
    saved.set('holidayDimension', dimension); saved.set('holidaySegment', state.segment); saved.set('holidayMetric', state.metric); saved.set('holidayMode', state.mode);
    history.replaceState(null, '', location.pathname + location.search + '#' + saved.toString());
  }
  async function exportHoliday() {
    var button = $('holiday-export'), label = button.textContent;
    button.disabled = true; button.textContent = '正在生成…'; $('holiday-export-error').textContent = '';
    try {
      var rows = state.rows.slice().sort(function(a,b){return a.holiday_id.localeCompare(b.holiday_id)||a.dimension.localeCompare(b.dimension)||a.segment.localeCompare(b.segment,'zh-CN')||a.period_day-b.period_day;});
      var X = HotelExcel;
      var columns=[{label:'假期',width:12},{label:'对比维度',width:14},{label:'分组',width:20},{label:'假期第几天',width:14},{label:'本期日期',width:15,format:'date'},{label:'对标日期',width:15,format:'date'},{label:'本期RevPAR（元）',width:20,format:'number'},{label:'对标RevPAR（元）',width:20,format:'number'},{label:'RevPAR变化',format:'change'},{label:'本期OCC',format:'percent'},{label:'对标OCC',format:'percent'},{label:'OCC变化（百分点）',width:22,format:'points'},{label:'本期ADR（元）',width:18,format:'number'},{label:'对标ADR（元）',width:18,format:'number'},{label:'ADR变化',format:'change'}];
      var specs=['hotel_tier','city_tier'].map(function(d){return {name:d==='hotel_tier'?'按酒店档次':'按城市线级',title:'酒店假期每日经营对比',subtitle:'全部已收录假期 · 来源：酒店之家',note:'按假期日序对齐；原始日期保留。变化为本期相对对标期，缺失值留空。',columns:columns,rows:rows.filter(function(r){return r.dimension===d;}).map(function(r){
        var rv=metricValue(r,'revpar',false), rb=metricValue(r,'revpar',true), ov=metricValue(r,'occupancy_rate',false), ob=metricValue(r,'occupancy_rate',true), av=metricValue(r,'adr',false), ab=metricValue(r,'adr',true);
        var dr=difference(rv,rb,'revpar'), da=difference(av,ab,'adr');
        return [r.holiday_name,d==='hotel_tier'?'酒店档次':'城市线级',r.segment,r.period_day,X.date(r.current_date),X.date(r.baseline_date),rv,rb,dr==null?null:dr/100,ov,ob,difference(ov,ob,'occupancy_rate'),av,ab,da==null?null:da/100];
      })};});
      specs.push(X.raw(rows)); await X.download(specs,'酒店假期经营数据');
    } catch(e) { $('holiday-export-error').textContent=e.message||'导出失败，请重试。'; }
    finally {button.disabled=false;button.textContent=label;}
  }
  function init(rows, record) {
    $('holiday-export').onclick = exportHoliday;
    state.rows = rows.map(function (r) {
      var row = Object.assign({}, r);
      ['period_day', 'current_year', 'baseline_year', 'occupancy_rate', 'adr', 'revpar'].forEach(function (f) { row[f] = num(row[f]); });
      row.baseline_occupancy_rate = num(r.baseline_occupancy_rate);
      row.baseline_adr = num(r.baseline_adr);
      row.baseline_revpar = num(r.baseline_revpar);
      return row;
    });
    state.record = record;
    if (!state.rows.length) throw new Error('假期经营数据为空');
    var savedHoliday = new URLSearchParams(location.hash.slice(1));
    $('holiday-select').innerHTML = Object.keys(holidayNames).map(function (id) { return '<option value="' + id + '">' + holidayNames[id] + '</option>'; }).join('');
    $('holiday-select').value = holidayNames[savedHoliday.get('holiday')] ? savedHoliday.get('holiday') : 'national-day';
    state.segment = savedHoliday.get('holidaySegment') || '全部';
    state.mode = 'combo';
    state.metric = ['revpar', 'adr', 'occupancy_rate'].includes(savedHoliday.get('holidayMetric')) ? savedHoliday.get('holidayMetric') : 'revpar';
    $('dimension-select').value = savedHoliday.get('holidayDimension') === 'city_tier' ? 'city_tier' : 'hotel_tier';
    ['holiday-select', 'dimension-select'].forEach(function (id) { $(id).addEventListener('change', render); });
    $('holiday-segments').addEventListener('click', function (event) {
      var button = event.target.closest('[data-segment]');
      if (button) { state.segment = button.dataset.segment; render(); }
    });
    $('holiday-metric-select').addEventListener('change', function (event) { state.metric = event.target.value; render(); });
    document.querySelectorAll('[data-weekly-view]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        var saved = new URLSearchParams(location.hash.slice(1));
        saved.set('view', link.dataset.weeklyView);
        var target = new URL('hotel-dashboard.html', location.href);
        if (new URLSearchParams(location.search).get('embed') === '1') target.searchParams.set('embed', '1');
        target.hash = saved.toString(); location.href = target.href;
      });
    });
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { renderChart(selectedRecords()); }, 120);
    });
    $('holiday-dashboard').hidden = false;
    render();
  }
  Promise.all([fetch('data/hotel_holiday_daily.csv', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }), fetch('data/hotel-holiday-import-record.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })])
    .then(function (result) { init(M.csv(result[0]), result[1]); })
    .catch(function (error) { $('load-error').hidden = false; $('load-error').textContent = '假期数据暂时无法读取：' + error.message; });
})();



