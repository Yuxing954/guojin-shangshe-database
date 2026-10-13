// 国金商社数据库 · GitHub→微信小程序 数据代理
// 作用：小程序的 request 合法域名需备案，GitHub 不满足 → 用本服务实时拉 raw 数据转 JSON
// 数据链路：小程序 → 本服务(内存缓存) ← 后台任务每 10 分钟拉 GitHub raw
// GitHub push 后 ≤10 分钟自动同步；小程序下拉刷新即读最新缓存，响应毫秒级
// 拉取失败时保留旧缓存（降级可用），首次冷启动未就绪时返回 loading 状态码

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
// 主链路 jsDelivr CDN（快），兜底 GitHub raw；均为仓库 main 分支实时内容
const SOURCES = [
  'https://cdn.jsdelivr.net/gh/Yuxing954/guojin-shangshe-database@main/',
  'https://raw.githubusercontent.com/Yuxing954/guojin-shangshe-database/main/'
];
const TOKEN = process.env.GH_TOKEN || '';
const REFRESH_MS = 10 * 60 * 1000; // 后台每 10 分钟全量刷新
const FETCH_TIMEOUT_MS = 30 * 1000; // 普通文件拉取上限
const FETCH_TIMEOUT_BIG_MS = 120 * 1000; // 大文件（views/allviews）拉取上限

const cache = new Map(); // key -> {ts, data, ready}
const status = { startedAt: new Date().toISOString(), lastRefreshAt: null, lastRefreshOk: null, refreshing: false, errors: [] };

function fetchOnce(base, path, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = base + encodeURI(path);
    const opts = { timeout: timeoutMs, headers: { 'User-Agent': 'guojin-miniapp-proxy' } };
    if (TOKEN && base.indexOf('raw.githubusercontent.com') > -1) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
    const req = https.get(url, opts, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('upstream ' + res.statusCode + ' for ' + path));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout ' + path)); });
  });
}

// 先 CDN，失败回落 raw；big 文件用长超时
async function fetchRaw(path, big) {
  const t = big ? FETCH_TIMEOUT_BIG_MS : FETCH_TIMEOUT_MS;
  let lastErr;
  for (const base of SOURCES) {
    try { return await fetchOnce(base, path, t); }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all sources failed');
}

// ---- CSV 解析（处理 BOM / 引号 / 换行内嵌 / CRLF）----
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length && r.some(x => x.trim() !== ''));
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).map(r => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] !== undefined ? r[i] : '').trim(); });
    return o;
  });
}

// ---- 业务字段标准化 ----
function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v).replace(/[,%]/g, ''));
  return isNaN(n) ? null : n;
}

// 高频板块数据：按「数据分类+指标」拆组，每指标取最近 24 期
function transformSector(rows) {
  const objs = rowsToObjects(rows);
  const groups = new Map();
  for (const r of objs) {
    const key = (r['数据分类'] || '其他') + '|' + (r['指标名称'] || '未命名');
    if (!groups.has(key)) groups.set(key, { 分类: r['数据分类'] || '其他', 指标: r['指标名称'] || '未命名', 单位: r['单位'] || '', 频率: r['频率'] || '', points: [] });
    groups.get(key).points.push({ d: r['数据日期'], v: r['数值'], yoy: num(r['同比(%)']) });
  }
  const list = [];
  for (const g of groups.values()) {
    g.points.sort((a, b) => (a.d < b.d ? 1 : -1));
    g.latest = g.points[0] || null;
    g.recent = g.points.slice(0, 24);
    delete g.points;
    list.push(g);
  }
  const byCat = {};
  for (const g of list) {
    (byCat[g.分类] = byCat[g.分类] || []).push(g);
  }
  return byCat;
}

// 观点：瘦身 + 截断（超大集正文截 300 字、封顶 maxRows 条）
// big 集（全量观点）再按时间窗过滤：只保留近 92 天，控制转换体积与内存
function transformViews(objs, bodyField, maxRows, timeWindowDays) {
  const cap = maxRows || 20000;
  const bodyLen = maxRows ? 300 : 3000;
  let pool = objs;
  if (timeWindowDays) {
    const cutoff = Date.now() - timeWindowDays * 24 * 3600 * 1000;
    pool = objs.filter(r => {
      const ts = Date.parse((r['时间'] || r['日期'] || '').replace(/(\.\d+)?([+-]\d{2}:?\d{2}|Z)$/, 'Z'));
      return !isNaN(ts) && ts >= cutoff;
    });
  }
  let list = pool.map(r => {
    const body = (r[bodyField] || '').replace(/\s+/g, ' ').trim();
    return {
      t: r['时间'] || r['日期'] || '',
      title: (r['标题'] || '').slice(0, 80),
      body: body.slice(0, bodyLen),
      full: body.length > bodyLen,
      author: r['作者'] || '',
      likes: num(r['点赞']), comments: num(r['评论']), reads: num(r['阅读']),
      link: r['原文链接'] || '',
      topic: r['话题'] || r['命中关键词'] || ''
    };
  }).sort((a, b) => (a.t < b.t ? 1 : -1));
  const totalAll = objs.length;
  if (list.length > cap) {
    return { truncated: true, total: totalAll, rows: list.slice(0, cap) };
  }
  return list;
}

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

// 数据集定义（与仓库 data-manifest 对齐）
// views/allviews 用仓库 2026-10-13 起的官方 JSON 分片（GitHub Actions 自动重建）：
//   data/research/market-views-recent-300.json —— 合并近 300 条（views+all_views，带 kind 字段）
// 比解析 59MB 原始 CSV 快一个数量级，且随仓库自动更新
const DATASETS = {
  hotel:   { file: 'data/酒店板块跟踪数据_2026-09-08.csv',   type: 'sector', name: '酒店板块' },
  taxfree: { file: 'data/免税板块跟踪数据_2026-09-08.csv',   type: 'sector', name: '免税板块' },
  gold:    { file: 'data/黄金珠宝板块跟踪数据_2026-09-08.csv', type: 'sector', name: '黄金珠宝板块' },
  dining:  { file: 'data/餐饮茶饮板块跟踪数据_2026-09-08.csv', type: 'sector', name: '餐饮茶饮板块' },
  cbec:    { file: 'data/跨境电商板块跟踪数据_2026-09-08.csv', type: 'sector', name: '跨境电商板块' },
  valuation: { file: 'data/商社-标的池与估值跟踪.csv', type: 'valuation', name: '标的池与估值' },
  weekly:    { file: 'data/商社-覆盖标的本周行情.csv', type: 'weekly', name: '覆盖标的行情' },
  financials:{ file: 'data/商社-业绩与财务跟踪.csv', type: 'financials', name: '业绩与财务跟踪' },
  views:     { file: 'data/research/market-views-recent-300.json', type: 'viewsjson', name: '商社市场观点' },
  allviews:  { file: 'data/research/market-views-recent-300.json', type: 'viewsjson', name: '全部市场观点' },
  minutes:   { file: 'data/商社-纪要文库.csv', type: 'minutes', name: '纪要文库' }
};

// 官方 JSON 分片 → 小程序瘦身格式；按 kind 过滤（views=商社精选 / all_views=全部）
function transformViewsJson(payload, kindFilter) {
  const items = (payload && payload.items) || [];
  const list = items
    .filter(x => !kindFilter || x.kind === kindFilter)
    .map(x => {
      const r = x.record || {};
      const body = (r['内容'] || '').replace(/\s+/g, ' ').trim();
      return {
        t: x.publishedAt || r['时间'] || '',
        title: (r['标题'] || '').slice(0, 80),
        body: body.slice(0, 600),
        full: body.length > 600,
        author: r['作者'] || '',
        link: r['原文链接'] || '',
        topic: r['命中关键词'] || '',
        kind: x.kind
      };
    });
  return {
    coverageTo: (payload && payload.coverageTo) || '',
    totalRows: (payload && payload.totalRows) || 0,
    list
  };
}

function transform(def, rows) {
  switch (def.type) {
    case 'sector': return transformSector(rows);
    case 'views': return transformViews(rowsToObjects(rows), def.body, def.maxRows, def.windowDays);
    case 'valuation': return rowsToObjects(rows).map(r => ({
        name: r['公司名称'], code: r['证券代码'], market: r['市场'], industry: r['子行业'],
        level: r['覆盖级别'], price: num(r['现价(元)']), mcap: num(r['市值折CNY(亿元)']),
        pe: num(r['PE(TTM)']), pb: num(r['PB']), ytd: num(r['年初至今涨跌(%)']),
        chg: num(r['周涨跌(%)']), logic: r['核心逻辑'] || '', date: r['数据日期']
      })).sort((a, b) => (b.mcap || 0) - (a.mcap || 0));
    case 'weekly': return rowsToObjects(rows).map(r => ({
        name: r['公司名称'], code: r['证券代码'], market: r['市场'], industry: r['子行业'],
        price: num(r['最新收盘价']), cur: r['币种'], prev: num(r['上周收盘价']),
        chg: num(r['周涨跌幅%']), chgAmt: num(r['周涨跌额']), date: r['数据日期']
      })).sort((a, b) => (b.chg || 0) - (a.chg || 0));
    case 'financials': return rowsToObjects(rows).map(r => ({
        name: r['公司名称'], period: r['财报期'], industry: r['子行业'],
        rev: num(r['营业收入(亿元)']), revYoy: num(r['营收同比(%)']),
        np: num(r['归母净利润(亿元)']), npYoy: num(r['归母同比(%)']),
        gm: num(r['毛利率(%)']), comment: (r['业绩点评'] || '').slice(0, 200), report: r['报告类型']
      }));
    case 'minutes': return rowsToObjects(rows).map(r => ({
        title: r['标题'], date: (r['日期'] || '').slice(0, 10), type: r['类型'],
        sector: r['覆盖板块'], stocks: r['相关标的'], summary: (r['摘要'] || '').slice(0, 400),
        file: r['文件名'], link: r['下载链接']
      })).sort((a, b) => (a.date < b.date ? 1 : -1));
  }
}

// ---- 后台刷新：并行拉取（每个文件独立超时 30s），成功即更新缓存，失败保留旧值下轮重试 ----
async function refreshAll() {
  if (status.refreshing) return;
  status.refreshing = true;
  let okCount = 0, failCount = 0;
  const errs = [];
  const tasks = Object.keys(DATASETS).map(async (key) => {
    const def = DATASETS[key];
    try {
      if (def.type === 'viewsjson') {
        const text = await fetchRaw(def.file, false);
        const payload = JSON.parse(text);
        const data = transformViewsJson(payload, key === 'views' ? 'views' : 'all_views');
        cache.set(key, { ts: Date.now(), data, ready: true });
        okCount++;
      } else {
        const text = await fetchRaw(def.file, def.big);
        const data = transform(def, parseCSV(text));
        cache.set(key, { ts: Date.now(), data, ready: true });
        okCount++;
      }
    } catch (e) {
      failCount++;
      errs.push(key + ': ' + String(e.message || e));
    }
  });
  tasks.push((async () => {
    try {
      const m = JSON.parse(await fetchRaw('data-manifest.json'));
      cache.set('manifest', { ts: Date.now(), data: { ok: true, manifest: { updatedAt: m.updatedAt, count: (m.datasets || []).length } }, ready: true });
      okCount++;
    } catch (e) {
      failCount++;
      errs.push('manifest: ' + String(e.message || e));
    }
  })());
  await Promise.all(tasks);
  status.lastRefreshAt = new Date().toISOString();
  status.lastRefreshOk = failCount === 0;
  status.errors = errs.slice(-10);
  status.refreshing = false;
  console.log('[refresh] ok=' + okCount + ' fail=' + failCount + (errs.length ? ' | ' + errs.join(' ; ') : ''));
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname.replace(/^\/+|\/+$/g, '');

  if (p === '' || p === 'index.html' || p === 'health') {
    return json(res, 200, {
      ok: true, service: 'guojin-shangshe-data-proxy',
      ts: new Date().toISOString(),
      lastRefreshAt: status.lastRefreshAt,
      lastRefreshOk: status.lastRefreshOk,
      refreshing: status.refreshing,
      readyKeys: [...cache.keys()]
    });
  }

  if (p === 'datasets') {
    const out = {};
    for (const k of Object.keys(DATASETS)) {
      out[k] = { name: DATASETS[k].name, file: DATASETS[k].file, ready: !!(cache.get(k) || {}).ready };
    }
    return json(res, 200, { ok: true, datasets: out });
  }

  if (p === 'manifest') {
    const hit = cache.get('manifest');
    if (hit) return json(res, 200, hit.data);
    return json(res, 202, { ok: false, loading: true, error: 'manifest 尚未就绪，稍后重试' });
  }

  const m = p.match(/^data\/([a-z]+)$/i) || p.match(/^([a-z]+)$/);
  if (m && DATASETS[m[1]]) {
    const key = m[1];
    const hit = cache.get(key);
    if (!hit || !hit.ready) {
      return json(res, 202, { ok: false, loading: true, key, error: '数据尚未就绪（后台正在拉取 GitHub），稍后重试' });
    }
    const data = hit.data;
    // viewsjson：{coverageTo, totalRows, list} 包裹结构
    if (data && Array.isArray(data.list)) {
      return json(res, 200, {
        ok: true, key, fetchedAt: hit.ts,
        coverageTo: data.coverageTo, totalRows: data.totalRows,
        count: data.list.length, data: data.list
      });
    }
    const truncated = !!(data && data.truncated);
    const rows = truncated ? data.rows : data;
    const count = Array.isArray(rows) ? rows.length : Object.keys(rows || {}).length;
    const resp = { ok: true, key, fetchedAt: hit.ts, count, data: rows };
    if (truncated) { resp.truncated = true; resp.total = data.total; }
    return json(res, 200, resp);
  }

  json(res, 404, { ok: false, error: 'not found', usage: ['/health', '/datasets', '/manifest', '/data/{hotel|taxfree|gold|dining|cbec|valuation|weekly|financials|views|allviews|minutes}'] });
});

// 启动即预热，之后定时刷新；拉取失败保留旧缓存
refreshAll();
setInterval(refreshAll, REFRESH_MS);

server.listen(PORT, '0.0.0.0', () => {
  console.log('guojin proxy listening on ' + PORT + ' (background refresh every ' + (REFRESH_MS / 60000) + 'min)');
});
