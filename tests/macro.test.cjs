'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../scripts/macro-model.js');
const level={frequency:'monthly',kind:'level',unit:'元',staleDays:100};
const list=[{period:'2024-01',value:100},{period:'2025-01',value:110},{period:'2025-02',value:121}];
test('exact period changes, missing base and zero base',()=>{
  assert.ok(Math.abs(M.compare(level,list,list[1],'yoy')-10)<1e-9);
  assert.ok(Math.abs(M.compare(level,list,list[2],'mom')-10)<1e-9);
  assert.equal(M.compare(level,list,list[2],'yoy'),null);
  assert.equal(M.compare(level,[{period:'2025-01',value:0},list[2]],list[2],'mom'),null);
  assert.equal(M.compare(level,[{period:'2025-01',value:-5},list[2]],list[2],'mom'),null);
});
test('rate differences are percentage points; cumulative/daily have no inferred changes',()=>{
  assert.equal(M.compare({...level,kind:'rate'},list,list[1],'yoy'),10);
  assert.equal(M.changeUnit({...level,kind:'rate'}),'百分点');
  assert.equal(M.compare({...level,kind:'cumulative'},list,list[1],'yoy'),null);
  assert.equal(M.compare({...level,frequency:'daily'},list,list[1],'mom'),null);
});
test('quarterly change crosses year and annual has no month-on-month',()=>{
  const quarterly=[{period:'2024-Q4',value:10},{period:'2025-Q1',value:12}];
  assert.ok(Math.abs(M.compare({...level,frequency:'quarterly'},quarterly,quarterly[1],'mom')-20)<1e-9);
  assert.equal(M.compare({...level,frequency:'annual'},[{period:'2024',value:10}],{period:'2024',value:10},'mom'),null);
  assert.equal(M.dateOf('2024-Q1').toISOString().slice(0,10),'2024-03-31');
});
test('status uses observation period, not recent fetch timestamp',()=>{
  assert.equal(M.status(level,{status:'ready',fetchedAt:'2026-10-09',observations:list},new Date('2026-10-09')),'数据滞后');
  assert.equal(M.status(level,{status:'error',observations:list}),'更新失败');
  assert.equal(M.status(level,{status:'pending',observations:[]}),'待接入');
});
test('CSV retains attribution, unknown dates blank, escapes formulas and quotes',()=>{
  const value=M.csv({...level,name:'=DANGEROUS',country:'CN',adjustment:'未季调'},{observations:list,sourceUrl:'https://example.com'},{});
  assert.ok(value.startsWith('\uFEFF'));assert.ok(value.includes("'=&")===false);assert.ok(value.includes("'=DANGEROUS"));
  assert.equal(M.csvCell('a"b'),'"a""b"');assert.equal(M.csvCell('-3.2'),'"-3.2"');assert.equal(M.safeUrl('javascript:alert(1)'),'#');
});
test('real catalog has both countries and all requested categories with unique IDs',()=>{
  const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/macro/catalog.json')));
  assert.equal(new Set(catalog.series.map(s=>s.id)).size,catalog.series.length);
  for(const country of ['CN','US'])for(const category of catalog.categories)assert.ok(catalog.series.some(s=>s.country===country&&s.category===category),country+' '+category);
  const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/macro/snapshot.json')));
  for(const s of catalog.series){assert.ok(catalog.sources[s.source]);assert.ok(data.series[s.id]);}
  const filtered=M.filter(catalog.series,{country:'US',category:'就业',q:'失业',available:true},data);
  assert.ok(filtered.length);assert.ok(filtered.every(s=>s.country==='US'&&s.category==='就业'&&M.rows(data.series[s.id]).length));
});
