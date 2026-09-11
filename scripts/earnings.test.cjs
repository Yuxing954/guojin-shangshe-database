const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('./earnings.js');
assert.equal(E.validDate('2026-02-30'),false);assert.equal(E.validDate('2026-08-29'),true);
assert.equal(E.validTime('2026-08-29T25:00'),false);
assert.throws(()=>E.validateRecord({meetingUrl:'javascript:alert(1)'}));
assert.throws(()=>E.validateRecord({meeting:'2026-09-21T16:00',meetingEnd:'2026-09-21T15:00'}));
assert.equal(E.matches({actual:'2026-08-29',model:'todo'},'pending','2026-09-11'),true);
assert.equal(E.matches({actual:'2026-08-29',model:'done'},'pending','2026-09-11'),false);
assert.equal(E.matches({deadline:'2026-09-10',complete:true},'overdue','2026-09-11'),false);
assert.equal(E.matches({deadline:'2026-09-10',complete:false},'overdue','2026-09-11'),true);
assert.match(E.csvCell('=HYPERLINK("bad")'),/^"'/);
const ics=E.calendar([{code:'600258.SH',name:'首旅酒店',actual:'2026-08-29',meeting:'2026-09-21T16:00',meetingEnd:'2026-09-21T17:00'}],'2026H1');
assert.match(ics,/DTSTART:20260921T080000Z/);assert.match(ics,/DTEND:20260921T090000Z/);assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);
const pool=E.parseCSV(fs.readFileSync(__dirname+'/../data/商社-标的池与估值跟踪.csv','utf8')),snapshot=JSON.parse(fs.readFileSync(__dirname+'/../data/earnings-snapshot.json','utf8'));
assert.equal(pool.length,32);assert.equal(snapshot.records.length,30);for(const r of snapshot.records){assert(pool.some(p=>p['证券代码']===r.code));assert(E.validDate(r.actual));assert.equal(r.period,'2026H1');}
// Exercise the actual page handlers with storage, fetch and form adapters.
const nodes={},storage={},fields={};
for(const k of ['expected','actual','meeting','meetingEnd','meetingUrl','sourceUrl','owner','deadline','model','minutes','questions','notes','complete'])fields[k]={value:'',checked:false};
function node(id){return nodes[id]||(nodes[id]={value:id==='period'?'2026H1':id==='view'?'all':id==='sort'?'next':'',textContent:'',innerHTML:'',style:{},selectedOptions:[{textContent:'2026 中报'}],elements:fields,addEventListener(type,fn){this[type]=fn;},showModal(){this.open=true;},close(){this.open=false;},click(){},appendChild(){},remove(){}});}
const fetch=async url=>({ok:true,text:async()=>url==='data-manifest.json'?JSON.stringify({datasets:[{id:'valuation',file:'pool.csv'}]}):url==='pool.csv'?fs.readFileSync(__dirname+'/../data/商社-标的池与估值跟踪.csv','utf8'):JSON.stringify(snapshot)});
const context={document:{getElementById:node,querySelectorAll:()=>[],createElement:()=>node('download'),body:{appendChild(){}}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},fetch,AbortController,Date,Intl,URL,Blob,console,setTimeout:()=>1,clearTimeout(){},confirm:()=>true,FormData:class{constructor(){return Object.entries(fields).filter(([k])=>k!=='complete').map(([k,v])=>[k,v.value]);}}};context.window=context;
vm.runInNewContext(fs.readFileSync(__dirname+'/earnings.js','utf8'),context);
setImmediate(async()=>{try{
 assert.equal(nodes.total.textContent,32);assert.equal(nodes.pending.textContent,30);
 nodes.rows.click({target:{closest:()=>({dataset:{code:'600754.SH'}})}});assert(nodes.editor.open);assert.equal(fields.actual.value,'2026-08-29');
 fields.owner.value='研究员测试';fields.deadline.value='2026-09-10';fields.questions.value='同店口径？';fields.model.value='done';
 nodes.editForm.onsubmit({preventDefault(){},currentTarget:nodes.editForm});assert.equal(nodes.editor.open,false);assert.equal(nodes.pending.textContent,29);
 assert.match(storage['sinolink-earnings-v1'],/研究员测试/);
 nodes.period.value='2026Q3';nodes.period.change();assert.equal(nodes.pending.textContent,0);
 nodes.rows.click({target:{closest:()=>({dataset:{code:'600754.SH'}})}});assert.equal(fields.owner.value,'');assert.equal(fields.actual.value,'');
 nodes.editor.close();nodes.period.value='2026H1';nodes.period.change();nodes.rows.click({target:{closest:()=>({dataset:{code:'600754.SH'}})}});assert.equal(fields.owner.value,'研究员测试');
 nodes.search.value='锦江';nodes.search.input();assert.match(nodes.count.textContent,/当前 1 \/ 32/);
 nodes.backupFile.files=[{size:100,text:async()=>JSON.stringify({version:1,records:{'2026H1|600754.SH':{owner:'恢复测试',model:'doing'}}})}];await nodes.backupFile.onchange({target:nodes.backupFile});assert.match(storage['sinolink-earnings-v1'],/恢复测试/);
 console.log('PASS: 32-company data, 30 source dates, editing/persistence, period isolation, filtering, restore, date validation, calendar timezone, CSV safety');
}catch(e){console.error(e);process.exitCode=1;}});
