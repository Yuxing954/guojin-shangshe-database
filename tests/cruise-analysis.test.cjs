const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),M=require('../scripts/cruise-analysis-model.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/tourism',p),'utf8')),core=read('three-gorges-cruises.json'),details=read('three-gorges-details.json'),m=M.create(core,details);
assert.equal(m.periods.length,33);const a=m.audience('2026-09');assert(Math.abs(a.minor-3.33)<1e-8);assert(Math.abs(a.seniorDelta+.73)<1e-8);assert(Math.abs(a.foreignShareDelta-6.16)<1e-8);assert(Math.abs(a.foreignYoY-70.5426356589)<1e-8);
const c=m.company('2026-09',6);assert.equal(c.value,.38);assert.equal(c.share,3.2);assert.equal(c.shareStatus,'官方披露');assert.equal(c.rank,5);assert.equal(c.sampleCount,6);assert(Math.abs(c.yoy-46.1538461538)<1e-8);assert(Math.abs(c.excess-32.6638461538)<1e-8);
const w=m.company('2026-09',0);assert.equal(w.shareStatus,'测算');assert(Math.abs(w.share-.83/11.95*100)<1e-8);
assert.equal(m.company('2026-03',3).value,null);assert.equal(m.company('2026-02',6).rank,null);assert.equal(m.company('2026-01',6).share,null);assert.equal(m.company('2025-12',6).value,0);assert.equal(m.company('2025-12',6).yoy,-100);
assert.equal(m.audience('2025-12').senior,null);assert.equal(m.audience('2025-12').foreign,null);assert.equal(m.audience('2026-01').foreignShare,4.48);assert.equal(m.audience('2026-01').foreign,null);assert.equal(m.audience('2026-01').minor,null);assert.equal(M.growth(1,0),null);assert.equal(M.growth(null,1),null);assert.equal(M.difference(null,0),null);
const s=m.seasons('2026-09','senior');assert.equal(s.years.length,3);assert.equal(s.rows[11].values[0].value,null);assert.equal(s.rows[9].values[2].value,null);assert.equal(m.ageComparison('2026-12').at(-1).ages[0],null);
const ps=m.windowPeriods('2025-03',12);assert.equal(ps.length,12);assert.equal(ps.at(-1),'2025-03');assert.equal(ps[0],'2024-04');assert(m.csv('2026-09','operators').includes('两年同月舍入值测算'));
// Input observations must remain unchanged when derived views are produced.
assert.equal(core.records[0].monthly.passengers,1.0025);assert.equal(details.records.find(r=>r.period==='2025-12').ages[0],null);
console.log('PASS: audience denominators, year-on-year points, official vs derived shares, ranking sample, null/zero, annual isolation and bounded windows');
