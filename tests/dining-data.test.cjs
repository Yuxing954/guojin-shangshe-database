const assert=require('node:assert/strict'),fs=require('node:fs');
const d=JSON.parse(fs.readFileSync('data/dining/observations.json','utf8').replace(/^\uFEFF/,'')),M=require('../scripts/dining-model.js');
assert.equal(d.brands.length,12);assert.equal(d.periods.length,20);assert.equal(d.records.length,154);
const occupied=new Set();for(const r of d.records){assert(d.brands.some(b=>b.id===r.brandId));assert(r.startRow<=r.endRow);assert.equal(r.period,d.periods[r.startRow].id);assert.equal(r.periodEnd,d.periods[r.endRow].id);assert(r.sourceId&&r.locator);for(let i=r.startRow;i<=r.endRow;i++){const k=r.brandId+'-'+i;assert(!occupied.has(k),'Overlapping source cells: '+k);occupied.add(k);}if(r.value!==null)assert.equal(r.raw,r.value+'%');}
assert.equal(M.cell(d,'taier',19).value,110);assert.equal(M.cell(d,'guming',16).raw,'预计中个位数下滑');assert.equal(M.cell(d,'shanghai',12),null);assert.equal(M.monthly(d,'taier').find(x=>x.period==='2025-04').value,null);assert.equal(M.monthly(d,'taier').find(x=>x.period==='2026-09').value,110);assert.equal(M.monthly(d,'haidilao').find(x=>x.period==='2026-02').value,null);assert.equal(M.cell(d,'greentea',12),null);
const tea=M.filtered(d,{category:'茶饮',year:'2026',holidays:false});assert.equal(tea.brands.length,3);assert(tea.rows.every(r=>r.kind==='month'&&r.id.startsWith('2026')));assert(M.csvRows(d,{category:'茶饮',year:'2026',holidays:false}).every(r=>r['业态']==='茶饮'));assert.equal(M.csvRows(d,{}).length,154);assert.equal(M.cell(d,'songhuoguo',19).value,73);
assert.equal(tea.rows[0].id,'2026-09');assert.equal(tea.rows.at(-1).id,'2026-01');assert(M.csvRows(d,{}).every((r,i,a)=>i===0||d.periods.findIndex(p=>p.id===a[i-1]['结束期间'])>=d.periods.findIndex(p=>p.id===r['结束期间'])));
console.log('Dining source coverage, merged spans, gaps, filters and exports passed.');

const sources=new Map(d.sources.map(s=>[s.id,s]));
for(const r of d.records){assert(sources.has(r.sourceId));assert(!r.raw.includes('测算'));if(r.sourceId.startsWith('zsxq-')){const source=sources.get(r.sourceId);assert(r.sourceQuote&&source.topicId&&source.publishedAt&&source.url.includes(source.topicId));if(r.sourceYoy!==undefined)assert.equal(r.value,Number((100+r.sourceYoy).toFixed(8)));}}
assert.equal(M.cell(d,'jiumaojiu',0).value,81);
assert.equal(M.cell(d,'jiumaojiu',0).scope,'quarter');
assert.equal(M.monthly(d,'jiumaojiu').find(x=>x.period==='2025-04').value,null);
assert.equal(M.cell(d,'xiaocaiyuan',5).value,97.9);
assert.equal(M.cell(d,'kfc',19).value,101);
assert.equal(M.cell(d,'kfc',19).dataNature,'专家口径');
assert.equal(M.cell(d,'guming',17).raw,'预计同比中单位数下滑');
assert.equal(M.cell(d,'guming',18).raw,'同比转正');
assert.equal(M.cell(d,'guming',19).value,null);
assert.equal(M.cell(d,'guming',10).raw,'同比增长10%—15%');
assert(M.cell(d,'guming',12).sourcePeriodLabel.includes('2026年01月'));
assert.equal(M.cell(d,'xiaomian',11).scope,'holiday');
assert(!M.filtered(d,{holidays:false}).records.some(r=>r.id===M.cell(d,'xiaomian',11).id));
assert.equal(M.cell(d,'xiaocaiyuan',19).status,'estimate');
assert(M.cell(d,'xiaocaiyuan',19).raw.startsWith('预计'));
assert.equal(M.cell(d,'nayuki',2).metric,'全量单店');
const csv=M.csvRows(d,{}),kfc=csv.find(r=>r['品牌']==='肯德基'&&r['开始期间']==='2026-09');
assert(kfc['来源链接'].includes('45548555441144228'));assert.equal(kfc['数据性质'],'专家口径');assert(kfc['原文摘录'].includes('9月同店+1%'));
assert(!JSON.stringify(csv).includes('测算'));
console.log('PASS source precedence, source-specific exports, quarter/month separation, split merged periods, ranges and estimate labels.');

