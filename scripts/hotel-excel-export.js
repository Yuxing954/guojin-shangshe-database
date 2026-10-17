(function () {
  'use strict';
  var loading;
  function library() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (!loading) loading = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timer = setTimeout(function () { script.remove(); loading = null; reject(new Error('Excel组件加载超时，请重试')); }, 20000);
      script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      script.onload = function () { clearTimeout(timer); if (window.ExcelJS) resolve(window.ExcelJS); else { loading = null; reject(new Error('Excel组件不可用')); } };
      script.onerror = function () { clearTimeout(timer); script.remove(); loading = null; reject(new Error('Excel组件加载失败，请重试')); };
      document.head.appendChild(script);
    });
    return loading;
  }
  var formats = { number: '#,##0.0;[Red](#,##0.0);0.0', percent: '0.0%;[Red](0.0%);0.0%', change: '+0.0%;[Green]-0.0%;0.0%', points: '+0.0;[Green]-0.0;0.0', date: 'yyyy-mm-dd' };
  function date(value) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00Z') : value || null; }
  function sheet(book, spec) {
    var ws = book.addWorksheet(spec.name, { views: [{ state: 'frozen', ySplit: 5, xSplit: 1, showGridLines: false }], properties: { defaultRowHeight: 23 } });
    ws.columns = spec.columns.map(function (c) { return { width: c.width || 16 }; });
    var last = spec.columns.length;
    [1,2,3].forEach(function (n) { ws.mergeCells(n,1,n,last); });
    ws.getCell('A1').value = spec.title;
    ws.getCell('A1').font = { name: 'Microsoft YaHei', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF354778' } }; ws.getRow(1).height = 38;
    ws.getCell('A2').value = spec.subtitle; ws.getRow(2).height = 27;
    ws.getCell('A3').value = spec.note; ws.getRow(3).height = 30;
    [2,3].forEach(function (n) { ws.getCell(n,1).font = { name: 'Microsoft YaHei', size: 10, color: { argb: 'FF667085' } }; ws.getCell(n,1).alignment = { vertical: 'middle', wrapText: true }; });
    var head = ws.getRow(5); head.values = spec.columns.map(function (c) { return c.label; }); head.height = 38;
    head.eachCell(function (c) { c.font = { name: 'Microsoft YaHei', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5158AA' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
    spec.rows.forEach(function (values,i) {
      var r = ws.addRow(values);
      r.eachCell({ includeEmpty: true },function (cell,col) {
        cell.font = { name: 'Microsoft YaHei', size: 10, color: { argb: 'FF263047' } };
        cell.alignment = { vertical: 'middle', horizontal: typeof cell.value === 'number' ? 'right' : 'left' };
        if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F3FA' } };
        var format = spec.columns[col-1].format;
        if (format) cell.numFmt = formats[format] || format;
        if ((format === 'change' || format === 'points') && typeof cell.value === 'number') cell.font.color = { argb: cell.value > 0 ? 'FFB54748' : cell.value < 0 ? 'FF20836B' : 'FF667085' };
      });
    });
    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5,ws.rowCount), column: last } };
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:5' };
    return ws;
  }
  function raw(rows) {
    var keys = Array.from(new Set(rows.flatMap(function (r) { return Object.keys(r); })));
    return { name: '原始数据', title: '原始数据与来源', subtitle: '来源：酒店之家 · 保留原始字段和精度', note: '字段名和原始值按数据源保留；缺失值留空。', columns: keys.map(function (k) { return { label:k,width:/source|file/.test(k)?32:22 }; }), rows: rows.map(function (r) { return keys.map(function (k) { return r[k] == null || r[k] === '' ? null : r[k]; }); }) };
  }
  async function download(specs, filename) {
    var Excel = await library(), book = new Excel.Workbook();
    book.creator = '国金商社研究数据库'; book.created = new Date();
    specs.forEach(function (s) { sheet(book,s); });
    var buffer = await book.xlsx.writeBuffer();
    var url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var a = document.createElement('a'); a.href = url; a.download = filename + '.xlsx'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); },1000);
  }
  window.HotelExcel = { download: download, raw: raw, date: date, sheet: sheet };
})();
