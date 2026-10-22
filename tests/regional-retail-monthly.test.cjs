const test=require('node:test'),assert=require('node:assert/strict'),M=require('../scripts/regional-retail-model'),T=require('../scripts/regional-retail-tier-model');
const row=(period,amount,yoy=0,other={})=>({regionId:'city',period,basis:'ytd',category:'社零总额',scope:'全口径',amount,yoy,provenance:{amount:{sourceId:period+'-a',frequency:'monthly'},yoy:{sourceId:period+'-g',frequency:'monthly'}},...other});
const fixture=rows=>({targetPeriod:'2026-09',regions:[{id:'city',name:'测试市',level:'city'},{id:'province',name:'测试省',level:'province'}],sources:rows.flatMap(r=>Object.values(r.provenance).map(p=>({id:p.sourceId,url:'https://example.com/'+p.sourceId}))),observations:rows});
test('adjacent cumulative amounts and comparable bases yield monthly estimates with complete inputs; originals stay intact',()=>{
 const raw=fixture([row('2026-04',220,10),row('2026-05',390,30)]),before=JSON.stringify(raw),d=M.deriveMonthly(raw),r=M.observation(d,'city','2026-05','month');
 assert.equal(r.amount,170);assert.ok(Math.abs(r.yoy-70)<1e-9);assert.equal(JSON.stringify(raw),before);assert.equal(M.deriveMonthly(d),d);assert.equal(r.provenance.amount.derived,true);assert.equal(r.provenance.amount.priority,-10);assert.deepEqual(M.sourceIds(r).sort(),['2026-04-a','2026-04-g','2026-05-a','2026-05-g']);
 const csv=M.csvRows(d,'city','2026-05','month')[0];assert.equal(csv.金额属性,'累计差分测算');assert.equal(csv.同比属性,'累计基数推算');assert.ok(csv.测算输入.includes('2026-04')&&csv.来源链接.includes('2026-04-g'));assert.equal(csv.官方同比百分比,undefined);
});
test('official month fields win, existing missing fields can be filled, and mismatched month amounts prevent derived growth',()=>{
 const raw=fixture([row('2026-04',220,10),row('2026-05',390,30),row('2026-05',168,5,{basis:'month'})]),d=M.deriveMonthly(raw),r=M.observation(d,'city','2026-05','month');assert.equal(r.amount,168);assert.equal(r.yoy,5);assert.ok(!r.provenance.amount.derived);
 const partial=M.deriveMonthly(fixture([row('2026-04',220,10),row('2026-05',390,30),row('2026-05',null,5,{basis:'month'})]));assert.equal(M.observation(partial,'city','2026-05','month').amount,170);assert.equal(M.observation(partial,'city','2026-05','month').yoy,5);
 const mismatch=M.deriveMonthly(fixture([row('2026-04',220,10),row('2026-05',390,30),row('2026-05',168,null,{basis:'month'})]));assert.equal(M.observation(mismatch,'city','2026-05','month').yoy,null);
});
test('January-February remains combined without a real January, gaps and quarter ends are never spread into months',()=>{
 const d=M.deriveMonthly(fixture([row('2026-02',200,10),row('2026-03',330,10),row('2026-05',550,10),row('2026-06',660,10,{provenance:{amount:{sourceId:'q2',frequency:'quarterly'},yoy:{sourceId:'q2',frequency:'quarterly'}}})]));
 assert.equal(M.observation(d,'city','2026-02','combined').amount,200);assert.equal(M.observation(d,'city','2026-01','month'),null);assert.equal(M.observation(d,'city','2026-02','month'),null);assert.equal(M.observation(d,'city','2026-03','month').amount,130);assert.equal(M.observation(d,'city','2026-05','month'),null);assert.equal(M.observation(d,'city','2026-06','month'),null);
 const separate=M.deriveMonthly(fixture([row('2025-12',1000),row('2026-01',10),row('2026-02',25)]));assert.equal(M.observation(separate,'city','2026-01','month').amount,10);assert.equal(M.observation(separate,'city','2026-02','month').amount,15);
});
test('negative or incompatible totals and disputed fields fail closed, while genuine zero remains a value',()=>{
 for(const current of [row('2026-05',90),row('2026-05',120,0,{scopeChanged:true}),row('2026-05',120,0,{definitionVersion:'v2'}),row('2026-05',120,0,{frequency:'annual'})]){const d=M.deriveMonthly(fixture([row('2026-04',100,0,{definitionVersion:'v1'}),current]));assert.equal(M.observation(d,'city','2026-05','month'),null);}
 const zero=M.deriveMonthly(fixture([row('2026-04',100),row('2026-05',100)]));assert.equal(M.observation(zero,'city','2026-05','month').amount,0);assert.equal(M.observation(zero,'city','2026-05','month').yoy,null);
 const disputed=M.deriveMonthly(fixture([row('2026-04',100),row('2026-05',120),row('2026-05',null,null,{basis:'month',disputed:{amount:true,yoy:true}})]));assert.equal(M.observation(disputed,'city','2026-05','month').amount,null);assert.equal(M.observation(disputed,'city','2026-05','month').yoy,null);
});
test('missing growth still permits amount differences; nonpositive comparable-base differences leave monthly growth empty',()=>{
 let d=M.deriveMonthly(fixture([row('2026-04',100,null),row('2026-05',120,null)]));assert.equal(M.observation(d,'city','2026-05','month').amount,20);assert.equal(M.observation(d,'city','2026-05','month').yoy,null);
 d=M.deriveMonthly(fixture([row('2026-04',100,0),row('2026-05',120,50)]));assert.equal(M.observation(d,'city','2026-05','month').amount,20);assert.equal(M.observation(d,'city','2026-05','month').yoy,null);
});
test('real city coverage expands and every new monthly amount reconciles to its two source cumulative periods',()=>{
 const raw=T.merge(T.merge(require('../data/regional-retail/observations.json'),require('../data/regional-retail/tier-supplement.json')),M.expandHistory(require('../data/regional-retail/history.json'))),d=M.deriveMonthly(raw),derived=d.observations.filter(r=>r.basis==='month'&&r.provenance.amount?.derived&&r.provenance.amount.method==='ytd-difference');
 assert.ok(derived.length>1000);for(const r of derived){const [a,b]=r.provenance.amount.inputs;assert.equal(M.previous(b.period),a.period);assert.equal(a.period.slice(0,4),b.period.slice(0,4));assert.ok(Math.abs(r.amount-(b.amount-a.amount))<1e-7);}
 assert.equal(M.compare(raw,'city','2026-08','month').filter(r=>M.finite(r.amount)).length,5);assert.equal(M.compare(d,'city','2026-08','month').filter(r=>M.finite(r.amount)).length,35);assert.equal(M.observation(d,'c0','2026-08','month').amount,855.18);assert.equal(M.observation(d,'p0','2026-09','month').amount,1259.546);
 const ytdBefore=T.snapshot(raw,require('../data/regional-retail/city-tiers.json'),'2026-08','ytd'),ytdAfter=T.snapshot(d,require('../data/regional-retail/city-tiers.json'),'2026-08','ytd');assert.deepEqual(ytdAfter,ytdBefore);
});
