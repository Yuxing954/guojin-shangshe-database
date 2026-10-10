const assert=require('node:assert/strict'),A=require('./company-overview-model.js');
const r={id:'a',companyId:'x',metric:'revenue',value:110,period:'2026H1',frequency:'半年',scope:'全部',mode:'全部',region:'集团整体',basis:'财报',unit:'百万元',currency:'CNY',periodBasis:'半年',status:'transcribed'};
const prior={...r,id:'b',period:'2025H1',value:100};
assert.equal(A.yoy([r,prior],r).value,10);
assert.equal(A.yoy([r,{...prior,periodBasis:'单季'}],r),null,'YTD/single quarter must not mix');
assert.equal(A.yoy([r,{...prior,currency:'EUR'}],r),null,'currencies must not mix');
assert.equal(A.yoy([r,{...prior,sourceConflict:true}],r),null,'conflicted prior values do not generate automatic YoY');
assert.equal(A.yoy([r,{...prior,value:-100}],r).unit,'百万元','loss base gives change amount');
assert.equal(A.yoy([], {...r,reportedYoY:-2.2}).kind,'报告披露');
assert.equal(A.yoy([{...r,metric:'occ',value:63.4},{...prior,metric:'occ',value:63.9}],{...r,metric:'occ',value:63.4}).unit,'百分点');
assert.equal(A.ratio(r,{...r,value:0}),null);assert.equal(A.ratio(r,{...r,period:'2025H1'}),null);
assert.equal(A.latest([{...r,status:'forecast'}],{},'revenue'),null);
const merged=A.merge([r],[{...r,id:'verified',value:111}]);assert.equal(merged.length,1);assert.equal(merged[0].originalSource.value,110);assert.equal(merged[0].sourceConflict,true);
const data=[{...r,metric:'hotels',unit:'家',value:100},{...r,metric:'hotels',unit:'家',value:40,scope:'a'},{...r,metric:'hotels',unit:'家',value:50,scope:'b'}];
const s=A.structure(data,{scale:{scope:'全部'}},{metric:'hotels',rows:[{label:'a',scope:'a'},{label:'b',scope:'b'}]});assert.equal(s.residual,10);assert.equal(s.rows[0].share,40);
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const cat=read('data/companies/catalog.json'),profiles=read('data/companies/profiles.json').companies,sup=read('data/companies/supplements.json'),extra=sup.parts.flatMap(p=>read(p).observations);let count=0;
for(const c of cat.companies){const index=read(c.file),base=index.parts.flatMap(p=>read(p).observations),rows=A.merge(base,extra.filter(o=>o.companyId===c.id));count+=rows.length;const snap=A.snapshot(rows,profiles[c.id]);assert.equal(snap.revpar.period,'2026Q2');assert.equal(snap.hotels.period,'2026Q2');for(const group of profiles[c.id].structures)assert.equal(A.structure(rows,profiles[c.id],group).residual,0,'configured structure must reconcile');}
assert.equal(count,4833);assert.equal(extra.length,102);assert.equal(A.ratio(r,{...r,periodBasis:'单季'}),null);
console.log('Overview dataset, same-period, source precedence, forecasts, ratio and loss-base checks passed.');
const choice=read('data/companies/choice.json'),choiceRows=choice.parts.flatMap(p=>read(p).observations);
assert.equal(choiceRows.length,148);
assert.equal(cat.companies.length,4);
assert.deepEqual(new Set(choiceRows.map(o=>o.companyId)),new Set(cat.companies.map(c=>c.id)));
for(const o of choiceRows){assert.match(o.id,/^choice-/);assert.equal(o.status,'transcribed');assert.ok(o.rawValue);assert.ok(Number.isFinite(o.value));}
for(const c of cat.companies){const base=read(c.file).parts.flatMap(p=>read(p).observations),rows=A.merge(base,[...extra,...choiceRows].filter(o=>o.companyId===c.id)),p=profiles[c.id];
 const f=A.financial(rows,p,'2025FY','choice');assert.equal(f.revenue.period,'2025FY');assert.equal(f.operating_cf.period,'2025FY');assert.equal(f.revenue.currency,p.choiceFinancial.currency);assert.notEqual(f.revenue.basis,p.financial.basis);assert.equal(f.profitMetric,'parent_profit');
 assert.equal(A.financial(rows,p,'2027FY','choice').revenue,null,'missing requested period never falls back to prior actual');
 const h=A.financial(rows,p,'2026H1','choice');assert.equal(h.revenue.periodBasis,'上半年累计');assert.equal(h.operating_cf.periodBasis,h.revenue.periodBasis);assert.equal(h.cash_equivalents?.periodBasis||h.monetary_funds?.periodBasis,'期末');}
console.log('Choice period, currency, independent series, missing data and cohort checks passed.');
