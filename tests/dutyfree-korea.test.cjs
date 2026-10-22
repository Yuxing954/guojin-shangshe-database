const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../scripts/dutyfree-korea-model.js');
const data=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/dutyfree/korea.json'),'utf8'));
test('31 monthly periods and 93 classified source observations retain raw precision and provenance',()=>{
 const rows=M.derive(data);assert.equal(rows.length,93);assert.equal(new Set(rows.map(r=>r.period)).size,31);assert.equal(data.dataAsOf,'2026-08');assert.equal(data.currency,'USD');
 for(const r of rows){assert(data.sources.some(s=>s.id===r.salesUsdSource));assert(data.sources.some(s=>s.id===r.shoppersSource));assert.equal(r.shoppersPrecision,'provider-rounded');assert(r.salesUsdRaw!==undefined);}
 const last=rows.find(r=>r.period==='2026-08'&&r.scope==='foreign');assert.equal(last.salesUsd,563178172);assert.equal(last.salesUsdPrecision,'raw');assert.equal(last.shoppers,1387000);assert.equal(data.sources.find(s=>s.code==='D5529203').publishedAt,null);
});
test('calendar-year baseline, true zero and unknown denominators are distinct',()=>{
 const input={rows:[{period:'2025-01',scope:'total',salesUsd:100,shoppers:10},{period:'2026-01',scope:'total',salesUsd:0,shoppers:0},{period:'2026-02',scope:'total',salesUsd:90,shoppers:10}]};
 const rows=M.derive(input);assert.equal(rows[1].salesUsdYoy,-100);assert.equal(rows[1].spendUsd,null);assert.equal(rows[2].salesUsdYoy,null);assert.equal(rows[2].salesUsdYoyMethod,'unavailable');
});
test('spent amount is a same-month same-scope ratio, never cross-cohort or FX conversion',()=>{
 const rows=M.derive(data),r=rows.find(r=>r.period==='2026-08'&&r.scope==='total'),base=rows.find(r=>r.period==='2025-08'&&r.scope==='total');
 assert.equal(r.spendUsd,r.salesUsd/r.shoppers);assert.equal(r.spendUsdYoy,(r.spendUsd/base.spendUsd-1)*100);assert.equal(r.spendUsdYoyMethod,'estimated');
});
test('missing months break charts and matching cohort keeps correct source basis',()=>{
 const rows=M.derive({rows:[{period:'2025-01',scope:'total',salesUsd:1,shoppers:1},{period:'2025-03',scope:'total',salesUsd:2,shoppers:2}]});
 const result=M.series(rows,'total','all');assert.equal(result.length,3);assert.equal(result[1].period,'2025-02');assert.equal(result[1].salesUsd,null);assert.equal(M.series(M.derive(data),'foreign','12').length,12);
});
test('inputs remain immutable and invalid dates, numbers and duplicate observations reject',()=>{
 const before=JSON.stringify(data);M.derive(data);assert.equal(JSON.stringify(data),before);
 for(const row of [{period:'2025-13',scope:'total'},{period:'2025-01',scope:'other'},{period:'2025-01',scope:'total',salesUsd:-1}])assert.throws(()=>M.derive({rows:[row]}));
 assert.throws(()=>M.derive({rows:[data.rows[0],data.rows[0]]}),/重复/);
});
test('CSV is raw USD/persons, not chart-scaled money, and retains precision / measurement fields',()=>{
 const out=M.exports(M.series(M.derive(data),'total','12'));assert.equal(out.length,12);assert.equal(out.at(-1)['销售额(美元)'],755100000);assert.equal(out.at(-1)['购物人次'],2933000);assert.equal(out.at(-1)['销售额原始回执'],'7.551亿');assert.equal(out.at(-1)['销售额精度'],'provider-rounded');
});
