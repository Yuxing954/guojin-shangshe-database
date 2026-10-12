(function () {
  'use strict';
  var M = window.HotelMetrics, $ = function (id) { return document.getElementById(id); };
  var holidayNames = {
    'spring-festival': '春节', qingming: '清明', 'mid-autumn': '中秋',
    'dragon-boat': '端午', 'national-day': '国庆'
  };
  var state = { rows: [], record: null };
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
    var holiday = $('holiday-select').value, dimension = $('dimension-select').value, segment = $('segment-select').value;
    return state.rows.filter(function (r) { return r.holiday_id === holiday && r.dimension === dimension && (segment === '*' || r.segment === segment); });
  }
  function selectedRecords() {
    return activeRows().filter(function (r) { return r.segment === $('segment-select').value || $('segment-select').value === '*'; }).sort(function (a, b) { return Number(a.period_day) - Number(b.period_day); });
  }
  function holidayInfo(id) {
    var c = state.record && state.record.coverage && state.record.coverage[id];
    return c || null;
  }
  function periodText(id) {
    var c = holidayInfo(id), sheets = c && c.sheets, first = sheets && Object.values(sheets)[0];
    var dates = first ? first : null;
    if (!dates) return '';
    var years = Object.values(sheets).map(function (s) { return [s.currentStart, s.currentEnd, s.baselineStart, s.baselineEnd]; });
    var range = years[0] || [];
    return range[0] + ' 至 ' + range[1] + ' 对比 ' + range[2] + ' 至 ' + range[3] + ' · 按假期第几天对齐';
  }
  function renderOptions() {
    var holiday = $('holiday-select').value || 'national-day';
    var dimension = $('dimension-select').value || 'hotel_tier';
    $('holiday-select').innerHTML = Object.keys(holidayNames).map(function (id) { return '<option value="' + id + '">' + holidayNames[id] + '</option>'; }).join('');
    $('holiday-select').value = holiday;
    $('dimension-select').value = dimension;
    var segments = Array.from(new Set(state.rows.filter(function (r) { return r.holiday_id === holiday && r.dimension === dimension; }).map(function (r) { return r.segment; })));
    var old = $('segment-select').value;
    $('segment-select').innerHTML = segments.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
    $('segment-select').value = segments.indexOf(old) >= 0 ? old : (segments.indexOf('全部') >= 0 ? '全部' : (segments[0] || ''));
  }
  function kpi(label, now, base, field) {
    var diff = difference(now, base, field), changeLabel = field === 'occupancy_rate' ? '较对标期' : '较对标期';
    return '<article class="hd-stat"><div class="hd-stat-label">' + label + '</div><div class="hd-stat-value">' + fmt(now, field) + '</div><div class="hd-stat-change"><span>对标 ' + fmt(base, field) + '</span><strong class="' + deltaClass(diff) + '">' + esc(fmtChange(diff, field)) + '</strong></div><div class="hd-stat-change hd-neutral">' + changeLabel + '</div></article>';
  }
  function renderKpis(records) {
    var now = summarize(records), baseRows = records.map(function (r) { return { occupancy_rate: r.baseline_occupancy_rate, adr: r.baseline_adr, revpar: r.baseline_revpar }; });
    var base = summarize(baseRows);
    $('holiday-kpis').innerHTML = kpi('假期日均入住率', now.occupancy_rate, base.occupancy_rate, 'occupancy_rate') +
      kpi('假期日均 ADR（元）', now.adr, base.adr, 'adr') + kpi('假期日均 RevPAR（元）', now.revpar, base.revpar, 'revpar');
  }
  function metricValue(row, field, baseline) {
    if (!baseline) return num(row[field]);
    return num(row['baseline_' + field]);
  }
  function renderChart(records) {
    var field = $('metric-select').value, title = field === 'occupancy_rate' ? '入住率' : field === 'adr' ? 'ADR' : 'RevPAR';
    var sorted = records.slice().sort(function (a, b) { return Number(a.period_day) - Number(b.period_day); });
    var values = sorted.flatMap(function (r) { return [metricValue(r, field, false), metricValue(r, field, true)]; }).filter(function (v) { return v != null; });
    $('trend-title').textContent = '假期每日' + title;
    $('trend-note').textContent = $('segment-select').value === '*' ? '当前查看全部分组' : $('segment-select').value;
    $('trend-caption').textContent = field === 'occupancy_rate' ? '入住率（%） · 按假期日序对齐 · 对照日期按源表保留' : title + '（元） · 按假期日序对齐 · 对照日期按源表保留';
    if (!sorted.length || !values.length) { $('holiday-chart').innerHTML = '<div class="hd-empty">所选范围暂无数据</div>'; return; }
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values), pad = (max - min) * .15 || Math.max(Math.abs(max) * .08, .1);
    min = Math.max(0, min - pad); max += pad;
    var width = 920, height = 330, left = 58, right = 18, top = 18, bottom = 46;
    var x = function (i) { return left + (sorted.length <= 1 ? 0 : i * (width - left - right) / (sorted.length - 1)); };
    var y = function (v) { return top + (max - v) * (height - top - bottom) / (max - min || 1); };
    var tickValues = [min, (min + max) / 2, max];
    var grid = tickValues.map(function (v) { var yy = y(v); return '<line x1="' + left + '" x2="' + (width - right) + '" y1="' + yy + '" y2="' + yy + '" stroke="#e9edf3"/><text x="' + (left - 10) + '" y="' + (yy + 4) + '" text-anchor="end" fill="#7b8496" font-size="11">' + (field === 'occupancy_rate' ? (v * 100).toFixed(0) + '%' : v.toFixed(0)) + '</text>'; }).join('');
    function path(baseline) {
      var chunks = [], points = [];
      sorted.forEach(function (r, i) {
        var value = metricValue(r, field, baseline);
        if (value == null) { if (points.length) chunks.push(points.join(' ')); points = []; return; }
        points.push((points.length ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(value).toFixed(1));
      });
      if (points.length) chunks.push(points.join(' '));
      return chunks.map(function (d) { return '<path d="' + d + '" fill="none" stroke="' + (baseline ? '#a0a9b8' : '#5964a6') + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"' + (baseline ? ' stroke-dasharray="5 4"' : '') + '/>'; }).join('');
    }
    var points = sorted.map(function (r, i) {
      var now = metricValue(r, field, false), base = metricValue(r, field, true), cx = x(i);
      var label = r.day_label ? r.day_label : '第' + r.period_day + '天';
      return '<g><text x="' + cx + '" y="' + (height - 16) + '" text-anchor="middle" fill="#7b8496" font-size="10">' + esc(label) + '</text>' +
        (now == null ? '' : '<circle cx="' + cx + '" cy="' + y(now) + '" r="3.5" fill="#5964a6"><title>' + r.current_date + ' · ' + fmt(now, field) + '</title></circle>') +
        (base == null ? '' : '<circle cx="' + cx + '" cy="' + y(base) + '" r="3.5" fill="#a0a9b8"><title>' + r.baseline_date + ' · ' + fmt(base, field) + '</title></circle>') + '</g>';
    }).join('');
    var unit = field === 'occupancy_rate' ? '%' : '元';
    $('holiday-chart').innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + title + '，本期与对标期按假期日序比较">' + grid + path(true) + path(false) + points + '</svg><div class="hd-legend"><span><i style="background:#5964a6"></i>本期</span><span><i style="background:#a0a9b8"></i>对标期</span><span>单位：' + unit + '</span></div>';
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
    $('period-note').textContent = periodText(holiday);
    var baselineYear = (matching[0] && matching[0].baseline_year) || '';
    $('asof').innerHTML = '<b>' + holidayNames[holiday] + ' · ' + ((matching[0] && matching[0].current_year) || '') + '年对标' + baselineYear + '年</b>酒店之家';
    renderHolidayOverview(dimension);
    renderKpis(selected);
    renderChart(selected);
    renderSummary(matching);
    renderDaily(selected);
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
    $('holiday-select').value = 'national-day';
    $('dimension-select').value = 'hotel_tier';
    ['holiday-select', 'dimension-select', 'segment-select', 'metric-select'].forEach(function (id) { $(id).addEventListener('change', render); });
    render();
    $('holiday-dashboard').hidden = false;
  }
  Promise.all([fetch('data/hotel_holiday_daily.csv', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }), fetch('data/hotel-holiday-import-record.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })])
    .then(function (result) { init(M.csv(result[0]), result[1]); })
    .catch(function (error) { $('load-error').hidden = false; $('load-error').textContent = '假期数据暂时无法读取：' + error.message; });
})();

