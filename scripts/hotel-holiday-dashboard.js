(function () {
  'use strict';
  var M = window.HotelMetrics, $ = function (id) { return document.getElementById(id); };
  var holidayNames = {
    'spring-festival': '春节', qingming: '清明', 'mid-autumn': '中秋',
    'dragon-boat': '端午', 'national-day': '国庆'
  };
  var state = { rows: [], record: null, segment: '全部', metric: 'revpar' };
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
    if (field === 'occupancy_rate') return (value * 100).toFixed(1) + '%';
    return value.toFixed(1);
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
      ['假期日均入住率', 'occupancy_rate'], ['假期日均 ADR（元）', 'adr'], ['假期日均 RevPAR（元）', 'revpar']
    ].filter(function (item) { return now[item[1]] != null; }).map(function (item) {
      return kpi(item[0], now[item[1]], base[item[1]], item[1]);
    }).join('');
  }
  function metricValue(row, field, baseline) {
    if (!baseline) return num(row[field]);
    return num(row['baseline_' + field]);
  }
  function renderChart(records) {
    var field = state.metric;
    var title = field === 'occupancy_rate' ? '入住率' : field === 'adr' ? 'ADR' : 'RevPAR';
    var unit = field === 'occupancy_rate' ? '%' : '元';
    var sorted = records.slice().sort(function (a, b) { return Number(a.period_day) - Number(b.period_day); });
    var values = sorted.flatMap(function (r) { return [metricValue(r, field, false), metricValue(r, field, true)]; }).filter(function (v) { return v != null; });
    var host = $('holiday-chart');
    $('trend-title').textContent = '假期每日' + title;
    $('trend-note').textContent = state.segment === '*' ? '当前查看全部分组' : state.segment;
    $('trend-caption').textContent = field === 'occupancy_rate' ? '入住率（%） · 按假期日序对齐 · 对照日期按源表保留' : title + '（元） · 按假期日序对齐 · 对照日期按源表保留';
    if (!sorted.length || !values.length) { host.innerHTML = '<div class="hd-empty">所选范围暂无有效数据</div>'; return; }

    var width = Math.max(300, host.clientWidth || 900), height = 280, left = 72, right = 28, top = 24, bottom = 36;
    var scale=SiteCharts.niceScale(values,{min:0,max:field==='occupancy_rate'?1:undefined}),min=scale.min,max=scale.max;
    var x = function (i) { return left + (sorted.length <= 1 ? 0 : i * (width - left - right) / (sorted.length - 1)); };
    var y = function (v) { return top + (max - v) * (height - top - bottom) / (max - min); };
    var svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="' + esc(title + '，本期与对标期按假期日序比较') + '"><title>' + esc(title + '，本期与对标期按假期日序比较') + '</title>';
    var axisDigits = field === 'occupancy_rate' ? 0 : 1;
    for (var tick = 0; tick < scale.ticks.length; tick++) {
      var value = scale.ticks[tick], yy = y(value);
      var axisLabel = field === 'occupancy_rate' ? SiteCharts.axisFormat(value*100,scale.step*100)+'%' : scale.format(value);
      svg += '<line x1="' + left + '" x2="' + (width - right) + '" y1="' + yy + '" y2="' + yy + '" stroke="#edf0f5"/>' +
        '<text x="' + (left - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="#8a94a5">' + axisLabel + '</text>';
    }
    var step = Math.max(1, Math.ceil(sorted.length / Math.max(2, Math.floor((width - left - right) / 100))));
    sorted.forEach(function (row, index) {
      if (index !== 0 && index !== sorted.length - 1 && index % step !== 0) return;
      var label = row.day_label || '第' + row.period_day + '天';
      svg += '<text x="' + x(index) + '" y="' + (height - 10) + '" text-anchor="middle" font-size="11" fill="#8a94a5">' + esc(label) + '</text>';
    });
    function path(baseline) {
      var d = '', started = false;
      sorted.forEach(function (row, index) {
        var value = metricValue(row, field, baseline);
        if (value == null) { started = false; return; }
        d += (started ? 'L' : 'M') + x(index).toFixed(1) + ',' + y(value).toFixed(1) + ' ';
        started = true;
      });
      return '<path d="' + d + '" fill="none" stroke="' + (baseline ? '#71869b' : '#2167a0') + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"' + (baseline ? ' stroke-dasharray="5 5"' : '') + '/>';
    }
    var dots = '', tooltipPoints = [];
    sorted.forEach(function (row, index) {
      var current = metricValue(row, field, false), baseline = metricValue(row, field, true), cx = x(index);
      var day = row.day_label ? '第' + row.period_day + '天 · ' + row.day_label : '第' + row.period_day + '天';
      var detail = [day, '本期 ' + row.current_date + '：' + fmt(current, field), '对标 ' + row.baseline_date + '：' + fmt(baseline, field)].join(String.fromCharCode(10));
      tooltipPoints.push({ x: cx, y: y(current == null ? baseline : current), text: detail });
      if (current != null) dots += '<circle cx="' + cx + '" cy="' + y(current) + '" r="3.5" fill="white" stroke="#2167a0" stroke-width="1.8"><title>' + esc(detail) + '</title></circle>';
      if (baseline != null) dots += '<circle cx="' + cx + '" cy="' + y(baseline) + '" r="3.5" fill="white" stroke="#71869b" stroke-width="1.8"><title>' + esc(detail) + '</title></circle>';
    });
    host.innerHTML = svg + path(true) + path(false) + dots + '</svg>' +
      '<div class="hd-legend"><span><i style="background:#2167a0"></i>本期</span><span><i style="background:#71869b"></i>对标期（虚线）</span><span>单位：' + unit + '</span></div>';
    if (window.SiteCharts) window.SiteCharts.attach(host, tooltipPoints);
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
    $('summary-table').innerHTML = '<thead><tr><th>对标对象</th><th>入住率</th><th>ADR（元）</th><th>RevPAR（元）</th></tr></thead><tbody>' + body + '</tbody>';
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
    $('holiday-overview-table').innerHTML = '<thead><tr><th>假期</th><th>本期 / 对标期</th><th>日均入住率</th><th>日均 ADR（元）</th><th>日均 RevPAR（元）</th></tr></thead><tbody>' + body + '</tbody>';
  }
  function renderDaily(records) {
    var rows = records.slice().sort(function (a, b) { return Number(a.period_day) - Number(b.period_day); });
    $('daily-table').innerHTML = '<thead><tr><th>假期日序</th><th>酒店档位 / 城市线级</th><th>本期日期</th><th>对标日期</th><th>本期 OCC</th><th>对标 OCC</th><th>本期 ADR</th><th>对标 ADR</th><th>本期 RevPAR</th><th>对标 RevPAR</th></tr></thead><tbody>' + rows.map(function (r) {
      return '<tr><td>第' + esc(r.period_day) + '天' + (r.day_label ? ' · ' + esc(r.day_label) : '') + '</td><td>' + esc(r.segment) + '</td><td>' + esc(r.current_date) + '</td><td>' + esc(r.baseline_date) + '</td><td>' + fmt(num(r.occupancy_rate), 'occupancy_rate') + '</td><td>' + fmt(num(r.baseline_occupancy_rate), 'occupancy_rate') + '</td><td>' + fmt(num(r.adr), 'adr') + '</td><td>' + fmt(num(r.baseline_adr), 'adr') + '</td><td>' + fmt(num(r.revpar), 'revpar') + '</td><td>' + fmt(num(r.baseline_revpar), 'revpar') + '</td></tr>';
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
    renderChart(selected);
    renderSummary(matching);
    renderDaily(selected);
    $('holiday-metric-switch').querySelectorAll('[data-metric]').forEach(function (button) {
      var active = button.dataset.metric === state.metric;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    var saved = new URLSearchParams(location.hash.slice(1));
    saved.set('view', 'holiday'); saved.set('holiday', holiday);
    saved.set('holidayDimension', dimension); saved.set('holidaySegment', state.segment); saved.set('holidayMetric', state.metric);
    history.replaceState(null, '', location.pathname + location.search + '#' + saved.toString());
  }
  function init(rows, record) {
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
    state.metric = ['revpar', 'adr', 'occupancy_rate'].includes(savedHoliday.get('holidayMetric')) ? savedHoliday.get('holidayMetric') : 'revpar';
    $('dimension-select').value = savedHoliday.get('holidayDimension') === 'city_tier' ? 'city_tier' : 'hotel_tier';
    ['holiday-select', 'dimension-select'].forEach(function (id) { $(id).addEventListener('change', render); });
    $('holiday-segments').addEventListener('click', function (event) {
      var button = event.target.closest('[data-segment]');
      if (button) { state.segment = button.dataset.segment; render(); }
    });
    $('holiday-metric-switch').addEventListener('click', function (event) {
      var button = event.target.closest('[data-metric]');
      if (button) { state.metric = button.dataset.metric; render(); }
    });
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



