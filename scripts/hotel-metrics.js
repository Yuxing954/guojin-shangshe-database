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
    var v = row ? num(row[field]) : null;
    // Invalid occupancy cannot be treated as a valid zero or enter ratios.
    return field === 'occupancy_rate' && v != null && (v < 0 || v > 1) ? null : v;
  }
  function change(row, base, field) {
    var current = metric(row, field), prior = metric(base, field);
    if (current == null || prior == null) return null;
    if (field === 'occupancy_rate') return (current - prior) * 100;
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
  return { num: num, csv: csv, index: index, metric: metric, change: change, priorPeriod: priorPeriod,
    sorted: sorted, windowRows: windowRows, rank: rank, validShares: validShares };
});
