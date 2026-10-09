'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../scripts/macro-model.js');
const level={frequency:'monthly',kind:'level',unit:'元',staleDays:100};
const list=[{period:'2024-01',value:100},{period:'2025-01',value:110},{period:'2025-02',value:121}];
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/macro/catalog.json')));
const snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/macro/snapshot.json')));
test('reuses verified consumption observations without mixing monthly and cumulative bases',()=>{
  const feed=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/consumption-macro/observations.json'))),copy=structuredClone(snapshot);
  M.mergeConsumption(catalog,copy,feed);
  const result=M.curated(catalog.series,{country:'CN'},copy);
  assert.deepEqual(result.available.map(s=>s.id).sort(),['cn-cpi','cn-disposable-income','cn-retail']);
  for(const [id,input,basis] of [['cn-cpi','cpi','month'],['cn-retail','retail','month'],['cn-disposable-income','income_national','ytd']]){
    const spec=catalog.series.find(s=>s.id===id),sourceRows=feed.observations.filter(r=>r.indicatorId===input&&r.frequency===spec.frequency&&r.basis===basis);
    assert.equal(copy.series[id].observations.length,sourceRows.length);
    for(const row of copy.series[id].observations){const original=sourceRows.find(r=>r.period===row.period);assert.equal(row.value,original.value);assert.ok(row.releaseDate);assert.match(row.sourceUrl,/stats\.gov\.cn/);}
  }
  assert.ok(!copy.series['cn-retail'].observations.some(r=>r.period.endsWith('-02')));
  const income=catalog.series.find(s=>s.id==='cn-disposable-income'),latest=M.rows(copy.series[income.id]).at(-1);
  assert.equal(M.compare(income,M.rows(copy.series[income.id]),latest,'mom'),null);
  assert.equal(M.headline(income,copy.series[income.id]).value,latest.officialYoy);
  const retail=catalog.series.find(s=>s.id==='cn-retail'),retailRows=M.rows(copy.series[retail.id]);
  assert.equal(M.compare(retail,retailRows,retailRows.at(-1),'yoy'),retailRows.at(-1).officialYoy);
  assert.equal(M.compare(retail,retailRows,{...retailRows.at(-1),officialYoy:null},'yoy'),null);
  assert.ok(M.csv(income,copy.series[income.id],catalog.sources.nbs).includes('官方同比%'));
  const invalid=structuredClone(feed);invalid.sources.find(s=>s.id===sourceRowsId(feed)).url='https://example.com/unverified';
  assert.throws(()=>M.mergeConsumption(catalog,structuredClone(snapshot),invalid),/核验/);
  function sourceRowsId(f){return f.observations.find(r=>r.indicatorId==='cpi'&&r.basis==='month'&&r.frequency==='monthly').sourceId;}
});
test('curation separates core, pending and annual references with complete unique groups',()=>{
  assert.equal(M.groups.length,5);
  for(const country of ['CN','US']){
    const result=M.curated(catalog.series,{country},snapshot),ids=result.core.map(s=>s.id);
    assert.equal(ids.length,20);assert.equal(new Set(ids).size,20);
    for(const id of ids)assert.ok(M.groupOf(id),id);
    assert.equal(result.available.length+result.pending.length,result.core.length);
    assert.ok(result.available.every(s=>s.frequency!=='annual'&&M.rows(snapshot.series[s.id]).length));
    assert.ok(result.pending.every(s=>!M.rows(snapshot.series[s.id]).length));
    assert.equal(result.references.length,2);assert.ok(result.references.every(s=>s.frequency==='annual'));
    for(const suffix of ['gdp','unemployment-annual','money','credit','market-cap','fx'])assert.ok(!ids.includes(country.toLowerCase()+'-'+suffix));
  }
});
test('group filters retain matching data and search across curated references and pending items',()=>{
  const prices=M.curated(catalog.series,{country:'US',group:'prices'},snapshot);
  assert.equal(prices.core.length,6);assert.equal(prices.available.length,5);assert.equal(prices.references.length,1);
  const pending=M.curated(catalog.series,{country:'CN',q:'PMI'},snapshot);assert.equal(pending.pending[0].id,'cn-pmi');assert.equal(pending.available.length,0);
  const annual=M.curated(catalog.series,{country:'CN',q:'实际GDP'},snapshot);assert.equal(annual.references[0].id,'cn-gdp-growth');
  const empty=M.curated(catalog.series,{country:'US',q:'does-not-exist'},snapshot);assert.equal(empty.core.length+empty.references.length,0);
});
test('exact period changes, missing base and zero base',()=>{
  assert.ok(Math.abs(M.compare(level,list,list[1],'yoy')-10)<1e-9);
  assert.ok(Math.abs(M.compare(level,list,list[2],'mom')-10)<1e-9);
  assert.equal(M.compare(level,list,list[2],'yoy'),null);
  assert.equal(M.compare(level,[{period:'2025-01',value:0},list[2]],list[2],'mom'),null);
  assert.equal(M.compare(level,[{period:'2025-01',value:-5},list[2]],list[2],'mom'),null);
});
test('headline emphasizes CPI inflation and exact monthly payroll additions without skipping missing periods',()=>{
  assert.deepEqual(M.headline({...level,id:'us-cpi'},{observations:list}),{value:null,unit:'%',label:'同比'});
  assert.equal(M.headline({...level,id:'us-cpi'},{observations:list.slice(0,2)}).value,10);
  assert.deepEqual(M.headline({...level,id:'us-payroll',unit:'千人'},{observations:list}),{value:11,unit:'千人',label:'较上月增减'});
  assert.equal(M.headline({...level,id:'us-payroll'},{observations:[list[0],list[2]]}).value,null);
  assert.equal(M.headline({...level,id:'us-payroll'},{observations:[list[1],{period:'2025-02',value:90}]}).value,-20);
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
