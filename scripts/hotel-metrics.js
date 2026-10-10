(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HotelMetrics = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function num(value) {
    if (value == null || String(value).trim() === '') return null;
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function csv(text) {
    var rows = [], row = [], value = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
        else if (c === '"') quoted = false;
        else value += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(value); value = ''; }
      else if (c === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
      else value += c;
    }
    if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
    var header = rows.shift() || [];
    return rows.filter(function (r) { return r.some(Boolean); }).map(function (r) {
      var o = {}; header.forEach(function (h, j) { o[h] = r[j] == null ? '' : r[j]; }); return o;
    });
  }
  function key(row, fields) { return fields.map(function (f) { return row[f]; }).join('|'); }
  function index(rows, fields) {
    var result = new Map();
    rows.forEach(function (row) {
      var k = key(row, fields);
      if (result.has(k)) throw new Error('数据存在重复记录：' + k);
      result.set(k, row);
    });
    return result;
  }
  function priorPeriod(row) {
    return row ? (Number(row.year) - 1) + 'W' + String(Number(row.week)).padStart(2, '0') : null;
  }
  function metric(row, field) {
    if (field === 'chain_rate') {
      var total = metric(row, 'room_count'), chain = metric(row, 'chain_room_count');
      return total == null || total <= 0 || chain == null || chain < 0 || chain > total ? null : chain / total;
    }
    var v = row ? num(row[field]) : null;
    // Invalid occupancy cannot be treated as a valid zero or enter ratios.
    return field === 'occupancy_rate' && v != null && (v < 0 || v > 1) ? null : v;
  }
  function change(row, base, field) {
    var current = metric(row, field), prior = metric(base, field);
    if (current == null || prior == null) return null;
    if (field === 'occupancy_rate' || field === 'chain_rate') return (current - prior) * 100;
    return prior === 0 ? null : (current / prior - 1) * 100;
  }
  function sorted(rows) { return rows.slice().sort(function (a, b) { return a.period_id.localeCompare(b.period_id); }); }
  function windowRows(rows, period, limit) {
    var eligible = sorted(rows).filter(function (r) { return r.period_id <= period; });
    return limit === 'all' ? eligible : eligible.slice(-Number(limit));
  }
  function rank(rows, field) {
    return rows.slice().sort(function (a, b) {
      var x = num(a[field]), y = num(b[field]);
      if (x == null && y == null) return a.region.localeCompare(b.region, 'zh-CN');
      if (x == null) return 1;
      if (y == null) return -1;
      return y - x || a.region.localeCompare(b.region, 'zh-CN');
    });
  }
  function validShares(rows) {
    var values = rows.map(function (r) { return num(r.market_share_pct); });
    return values.length > 0 && values.every(function (v) { return v != null && v >= 0 && v <= 100; }) &&
      values.reduce(function (a, b) { return a + b; }, 0) <= 100.01;
  }
  function investmentWindow(rows, cutoff, limit) {
    var available = sorted(rows).filter(function (r) { return r.end_date <= cutoff; });
    if (!available.length) return [];
    var latest = available[available.length - 1].period_id;
    var end = new Date(latest + '-01T00:00:00Z');
    var start = limit === 'all' ? new Date(available[0].period_id + '-01T00:00:00Z') : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - Number(limit) + 1, 1));
    var byMonth = index(available, ['period_id']), result = [];
    for (var date = start; date <= end; date.setUTCMonth(date.getUTCMonth() + 1)) {
      if (date.getUTCMonth() === 0) continue; // NBS combines January and February.
      var period = date.toISOString().slice(0, 7);
      result.push(byMonth.get(period) || { period_id: period, yoy_pct: null, amount_cny_100m: null });
    }
    return result;
  }
  function supply15Plus(rows, industry) {
    var bands = ['15-29间', '30-69间', '70-149间', '150间及以上'];
    var selected = bands.map(function (band) { return rows.find(function (r) { return r.room_band === band; }); });
    var result = Object.assign({}, industry || {}, selected.find(Boolean) || {}, { room_band: '15间及以上' });
    ['hotel_count', 'room_count', 'chain_hotel_count', 'chain_room_count'].forEach(function (field) {
      var values = selected.map(function (r) { return metric(r, field); });
      result[field] = values.every(function (v) { return v != null && v >= 0; }) ? values.reduce(function (a, b) { return a + b; }, 0) : null;
    });
    ['hotel_count','room_count'].forEach(function (field) { var source = metric(industry,field+'_15plus'); if(result[field] == null && source != null && source >= 0) result[field] = source; });
    return result;
  }
  function chartSeries(lines) {
    var kept = lines.filter(function (s) { return s.pts.some(function (p) { return num(p.y) != null; }); });
    var valid = kept.flatMap(function (s) { return s.pts.filter(function (p) { return num(p.y) != null; }).map(function (p) { return p.x; }); }).sort();
    return valid.length ? kept.map(function (s) { return Object.assign({}, s, { pts: s.pts.filter(function (p) { return p.x >= valid[0] && p.x <= valid[valid.length - 1]; }) }); }) : [];
  }
  return { num: num, csv: csv, index: index, metric: metric, change: change, priorPeriod: priorPeriod,
    sorted: sorted, windowRows: windowRows, rank: rank, validShares: validShares, investmentWindow: investmentWindow,
    supply15Plus: supply15Plus, chartSeries: chartSeries };
});

