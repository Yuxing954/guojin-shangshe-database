const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../scripts/dutyfree-holidays.js');
const d=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/dutyfree/holidays.json'),'utf8'));
const full=M.filter(d.records,'全部','全部');
assert.equal(full.length,31);
assert.equal(full.filter(r=>r.status==='available').length,29);
assert.equal(d.records.filter(r=>r.kind==='detail').length,25);
const newYear= M.filter(d.records,'元旦','2025')[0];
assert.equal(M.filter(d.records,'元旦','2026')[0].sales,7.12);
assert.equal(M.filter(d.records,'元旦','2026')[0].daily_sales,7.12/3);
assert.equal(newYear.days,1);
assert.ok(Math.abs(newYear.sales-1.29514963880289)<1e-12);
assert.equal(newYear.daily_sales,newYear.sales);
const calendar=d.records.find(r=>r.year===2025&&r.holiday==='元旦同日历三天');
assert.equal(calendar.days,3);
assert.ok(Math.abs(calendar.sales-3.1105286151157716)<1e-12);
assert.notEqual(newYear.sales,calendar.sales);
for(const r of full.filter(r=>r.status==='pending')){
  assert.equal(r.year,2026);for(const k of ['sales','shoppers','spend','daily_sales','daily_yoy'])assert.equal(r[k],null);
}
const spring=M.filter(d.records,'春节','2026')[0];
assert.equal(spring.days,9);assert.equal(spring.sales,27.2);assert.equal(spring.shoppers,32.5);
assert.ok(Math.abs(spring.daily_sales-27.2/9)<1e-12);
assert.ok(Math.abs(spring.daily_yoy-15.462167038098262)<1e-10);
assert.equal(M.filter(d.records,'国庆及中秋国庆','全部').length,5);
assert.equal(M.filter(d.records,'国庆及中秋国庆','2022')[0].daily_sales,null);
assert.ok(d.records.every(r=>r.source_cells.sales.cell&&r.sheet));
assert.ok(!d.records.some(r=>r.notes.some(n=>n.includes('假设2.1'))));
assert.equal(M.change(null,2),null);assert.equal(M.change(0,2),-100);assert.equal(M.change(2,0),null);
assert.equal(M.filter(d.records,'清明','2025').length,0);
console.log('Holiday data, missing-value handling, period separation and filters passed.');
// Exercise the actual browser download handler with a minimal DOM and Blob capture.
(async()=>{
  const vm=require('node:vm'),elements=new Map();let downloaded,downloadName;
  const element=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};
  const context={window:{},document:{getElementById:element,createElement:()=>({click(){downloadName=this.download;}})},location:{pathname:'/industry.html',hash:'#dutyfree'},addEventListener(){},fetch:async()=>({ok:true,json:async()=>d}),Blob,URL:{createObjectURL(blob){downloaded=blob;return 'blob:test';},revokeObjectURL(){}},setTimeout(){},console};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts/dutyfree-holidays.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  element('dh-holiday').onchange({target:{value:'春节'}});element('dh-year').onchange({target:{value:'2026'}});element('dh-download').onclick();
  const text=await downloaded.text(),D=require('../scripts/site-data.js'),rows=D.csv(text);
  assert.equal(downloadName,'离岛免税-春节-2026.csv');assert.equal(rows.length,1);
  assert.equal(Number(rows[0]['销售额（亿元）']),27.2);assert.equal(Number(rows[0]['日均销售额（亿元）']),27.2/9);
  assert.ok(rows[0]['来源单元格'].includes('春节假期!C17'));assert.ok(rows[0]['原始文件'].endsWith('.xlsx'));
  element('dh-holiday').onchange({target:{value:'中秋'}});element('dh-download').onclick();
  const pending=D.csv(await downloaded.text())[0];assert.equal(pending['销售额（亿元）'],'');assert.equal(pending['状态'],'pending');
  console.log('Browser CSV download handler exports exact values, source cells and blank pending amounts.');
})().catch(error=>{console.error(error);process.exitCode=1;});
