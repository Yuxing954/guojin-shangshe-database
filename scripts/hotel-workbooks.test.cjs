const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const M=require('./company-database-model.js'),A=require('./company-overview-model.js');
const index=read('data/companies/workbook-disclosures.json'),rows=index.parts.flatMap(p=>read(p).observations),cat=read('data/companies/catalog.json');
assert.equal(rows.length,24621);assert.equal(rows.length,index.observationCount);
assert.equal(new Set(rows.map(o=>o.id)).size,rows.length);
assert.equal(new Set(rows.map(A.key)).size,rows.length);
const metrics=new Set(cat.metrics.map(m=>m.id)),sources=new Set(index.sources.map(s=>s.id));
for(const o of rows){assert.ok(metrics.has(o.metric));assert.ok(sources.has(o.sourceId));assert.ok(Number.isFinite(o.value));assert.match(o.locator,/![A-Z]+\d+$/);if(o.metric==='occ'&&o.status!=='pending')assert.ok(o.value>=0&&o.value<=100);}
for(const [cid,parts] of Object.entries(index.companyParts)){const own=parts.flatMap(p=>read(p).observations);assert.equal(own.length,index.counts[cid]);assert.ok(own.every(o=>o.companyId===cid));}
const find=(cid,p,m,extra={})=>rows.find(o=>o.companyId===cid&&o.period===p&&o.metric===m&&Object.entries(extra).every(([k,v])=>o[k]===v));
const b=find('btg','2026Q2','hotels',{scope:'全部',mode:'全部',region:'集团整体',basis:'原报告门店网络 / 品牌'});assert.equal(b.value,8013);assert.equal(b.originalPeriod,'2026H1');assert.equal(b.screenshotLocator,'原始报告截图_2026!A685');
assert.equal(find('btg','2026Q2','revpar',{scope:'全部',mode:'全部',basis:'原报告运营酒店 / 全部酒店'}).reportedYoY,-1);
assert.equal(find('btg','2026Q2','pipeline',{scope:'全部',mode:'全部',basis:'原报告拓店 / 期末储备店'}).value,1641);
const j=find('jinjiang','2026Q2','hotels',{scope:'全部',mode:'全部',basis:'酒店业务口径（含全服务型+有限服务型）'});assert.equal(j.value,14404);
assert.equal(find('jinjiang','2026Q2','signed_hotels',{scope:'全部',mode:'全部',basis:j.basis}).value,18417);
const euro=find('jinjiang','2026H1','revenue',{region:'海外',basis:'原报告境内外分部'});assert.equal(euro.currency,'EUR');assert.equal(euro.value,229.3);assert.equal(euro.rawValue,22930);
const matrix=rows.find(o=>o.companyId==='jinjiang'&&o.scope.includes('境外')&&o.basis==='原报告分部收入矩阵');assert.equal(matrix.currency,'CNY');
assert.equal(M.period('2025Q3'),M.period('20259M'));assert.notEqual(M.seriesKey({...euro,periodBasis:'上半年'}),M.seriesKey({...euro,periodBasis:'下半年'}));
const pending=rows.filter(o=>o.metric==='occ'&&o.value>100);assert.ok(pending.length);assert.ok(pending.every(o=>o.status==='pending'));assert.equal(M.filter(pending).length,0);
const prior={...b,value:100},actual={...b,value:111,reportedYoY:10.8};assert.equal(A.yoy([prior,actual],actual).value,10.8);
const csv=M.csv([b,euro],cat.metrics);assert.match(csv,/真实截图位置/);assert.match(csv,/原始报告截图_2026!A685/);assert.match(csv,/22930/);
console.log('24,621 source observations: identity, source coverage, scope, currency, quarter/YTD, reported YoY, anomaly exclusion and CSV provenance passed.');
