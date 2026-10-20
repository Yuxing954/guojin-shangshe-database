const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),M=require('../scripts/overseas-hotels-model.js'),U=require('../scripts/site-ui.js');
const manifest=read('data/companies/overseas-hotels.json'),companies=manifest.companies.map(c=>read(c.file));
assert.equal(companies.length,4);assert.deepEqual(U.pages['overseas-hotels.html'],['companies','海外酒店']);
assert.deepEqual(U.pages['overseas-hotel-comparison.html'],['companies','海外酒店公司对比']);
const ops=companies.flatMap(c=>c.operating),fin=companies.flatMap(c=>c.finance);
assert.equal(ops.length,612);assert.equal(fin.length,360);assert.equal(new Set(ops.map(r=>r.id)).size,612);assert.equal(new Set(fin.map(r=>r.id)).size,360);
assert.equal(ops.filter(r=>r.mode==='单季度').length,306);assert.equal(ops.filter(r=>r.values.some(v=>v===null)).length,24);
assert.equal(companies.flatMap(c=>c.brandScale).length,122);assert.equal(companies.flatMap(c=>c.brandMetrics).length,31);
for(const c of manifest.companies)assert.ok(fs.statSync(path.join(root,c.logo)).size>100);
for(const r of [...ops,...fin]){if(r.value!==null){assert.match(r.source,/^https:\/\//);assert.ok(r.where);}else assert.ok(r.method.includes('未单列'));assert.ok(r.workbookCell);}
for(const r of ops){if(r.values[2]!==null)assert.ok(r.values[2]>=0&&r.values[2]<=100);if(r.mode==='单季度')assert.equal(r.period,r.quarter);else assert.match(r.period,/^20\d{2}(Q1|H1|9M|FY)$/);}
const m=companies[0],last=M.operating(m.operating,{mode:'单季度',quarter:'2026Q2',region:'全球'})[0];
assert.deepEqual(last.values,[138.74,193.66,71.6]);assert.deepEqual(last.changes,[3.4,3.5,-0.1]);assert.equal(M.growth(last.changes[2],true),'-0.1 pp');
assert.equal(M.fmt(null),'—');assert.equal(M.fmt(0),'0.00');assert.equal(M.growth(0),'0.0%');
const hyatt=companies.find(c=>c.company.id==='hyatt'),line=M.chartPoints(M.operating(hyatt.operating,{region:'美国'}),manifest.quarters,0);
assert.equal(line.length,12);assert.equal(line[0].value,null);assert.equal(line[1].value,null);assert.equal(M.segments(line)[0][0].period,'2024Q1');
assert.equal(M.segments([{value:1},{value:null},{value:2}]).length,2);
const ihg=companies.find(c=>c.company.id==='ihg');assert.ok(ihg.finance.every(r=>/H1|FY/.test(r.period)));assert.ok(hyatt.finance.filter(r=>r.metric==='营业利润').every(r=>r.value===null));
assert.deepEqual(M.financeMatrix(ihg.finance,'集团').periods,['2023FY','2024H1','2024FY','2025H1','2025FY','2026H1']);
assert.ok(ihg.capital.some(r=>Object.values(r.formats).some(f=>f.includes('%'))));
assert.deepEqual(M.range(manifest.quarters,'2025Q1','2025Q3'),['2025Q1','2025Q2','2025Q3']);
assert.deepEqual(M.range(manifest.quarters,'2099Q1','bad'),manifest.quarters);
assert.equal(M.financialChange(hyatt.finance,hyatt.finance.find(r=>r.period==='2026Q2'&&r.region==='集团'&&r.metric==='归母净利润')).label,'扭亏');
assert.equal(M.financialChange(hyatt.finance,hyatt.finance.find(r=>r.period==='2026Q2'&&r.region==='集团'&&r.metric==='归母净利润')).percent,null);
assert.equal(M.financialChange(hyatt.finance,hyatt.finance.find(r=>r.period==='2026Q2'&&r.region==='集团'&&r.metric==='营业利润')),null);
const revenue=hyatt.finance.find(r=>r.period==='2026Q2'&&r.region==='集团'&&r.metric==='营业收入');assert.ok(Math.abs(M.financialChange(hyatt.finance,revenue).percent-(1829/1808-1)*100)<1e-10);
assert.ok(M.search(ops,'2026Q2 全球').every(r=>r.quarter==='2026Q2'&&r.region==='全球'));
assert.equal(M.financialGrowth([{period:'2025Q2',region:'集团',metric:'归母净利润',unit:'百万美元',basis:'GAAP',value:-5}],{period:'2026Q2',region:'集团',metric:'归母净利润',unit:'百万美元',basis:'GAAP',value:3}),null);
for(const s of manifest.sheets){const grid=read(s.file);assert.equal(grid.name,s.name);assert.equal(grid.rows.length,s.rows);for(const r of grid.rows)assert.ok(r.cells.every(c=>c.v!==null&&c.c>0));}
const html=fs.readFileSync(path.join(root,'company-database.html'),'utf8');assert.ok(html.includes('overseas-hotels.html'));assert.ok(fs.readFileSync(path.join(root,'scripts/data-notes.js'),'utf8').includes("'overseas-hotels'"));
console.log('Overseas hotels: 612 operating, 360 finance, 122 brand scale, 31 brand metrics, 13 sheets; scopes, units, gaps and sources passed.');

for(const mode of ['单季度','年初累计'])for(let metric=0;metric<3;metric++){
 const points=M.comparisonRows(companies,manifest.quarters,{mode,metric,region:'全球'});
 assert.equal(points.length,manifest.quarters.length);
 for(const p of points)for(const v of p.values){const d=companies.find(d=>d.company.id===v.id),r=d.operating.find(r=>r.mode===mode&&r.region==='全球'&&r.quarter===p.period);assert.equal(v.value,r?.values[metric]??null);assert.equal(v.change,r?.changes[metric]??null);}
}
const missingRegion=M.comparisonRows(companies,['2026Q2'],{ids:['marriott','hilton'],region:'大中华区',metric:1})[0];
assert.equal(missingRegion.values.length,2);assert.equal(missingRegion.values[1].value,null);assert.equal(missingRegion.values[1].change,null);
const noPoint=[{company:{id:'test',name:'test'},operating:[{quarter:'2026Q2',mode:'单季度',region:'全球',values:[0,0,0],changes:[0,0,0]}]}];
assert.equal(M.comparisonRows(noPoint,['2026Q1','2026Q2'])[0].values[0].value,null);assert.equal(M.comparisonRows(noPoint,['2026Q1','2026Q2'])[1].values[0].value,0);
for(const c of companies){const periods=[...new Set(c.finance.map(r=>r.period))];for(const period of periods){const segment=M.regionalFinance(c.finance,period);assert.deepEqual(segment.rows,c.finance.filter(r=>r.region!=='集团'&&r.period===period));assert(!segment.rows.some(r=>r.region==='集团'));}assert.equal(M.regionalFinance(c.finance,'2099Q2').rows.length,0);}
assert.equal(M.regionalFinance(ihg.finance,'2026Q2').rows.length,0);assert(M.regionalFinance(ihg.finance,'2026H1').rows.length>0);
console.log('Peer comparison: exact company, original region, mode, unit, missing/zero and reported financial segments passed.');
