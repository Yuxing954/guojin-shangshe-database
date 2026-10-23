'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../scripts/macro-model.js'),D=require('../scripts/macro-dashboard-model.js');
test('static page assets exist and the dashboard loads without the former redirect',()=>{
  const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'../macro.html'),'utf8');
  for(const match of html.matchAll(/(?:src|href)="(scripts\/[^"?]+)(?:\?[^" ]*)?"/g))assert.ok(fs.existsSync(path.join(__dirname,'..',match[1])),match[1]);
  assert.doesNotMatch(html,/location\.replace/);assert.ok(html.indexOf('macro-model.js')<html.indexOf('macro-dashboard-model.js'));assert.ok(html.indexOf('macro-dashboard-model.js')<html.indexOf('macro.js'));
});
const catalog=structuredClone(require('../data/macro/catalog.json')),snapshot=structuredClone(require('../data/macro/snapshot.json'));
M.mergeAutomatic(catalog,snapshot,require('../data/macro/automatic-series.json'));
test('featured KPIs and directory use the reviewed catalog; attention filter preserves real gaps',()=>{
  for(const country of ['CN','US'])for(const id of D.featured[country])assert.ok(D.core(catalog,country,snapshot).some(s=>s.id===id));
  assert.equal(D.directory(catalog,snapshot,{country:'CN',frequency:'quarterly'}).length,2);
  assert.ok(!D.directory(catalog,snapshot,{country:'US',health:'attention'}).some(s=>s.id==='us-cpi'));
  const incomplete=structuredClone(snapshot);
  incomplete.series['us-cpi'].observations=incomplete.series['us-cpi'].observations.filter(r=>r.period!=='2026-07');
  incomplete.series['us-cpi'].coverage={...incomplete.series['us-cpi'].coverage,missingPeriods:['2026-07'],complete:false};
  assert.ok(D.directory(catalog,incomplete,{country:'US',health:'attention'}).some(s=>s.id==='us-cpi'));
  assert.equal(D.directory(catalog,snapshot,{country:'CN',q:'不存在'}).length,0);
});
test('KPI difference uses exact prior period; PMI difference is points, rates use percentage points',()=>{
  const spec={id:'cn-pmi',frequency:'monthly',kind:'rate',unit:'点'},data={observations:[{period:'2026-06',value:49},{period:'2026-08',value:50.2}]};
  assert.equal(D.movement(spec,data),null);data.observations.push({period:'2026-09',value:50.1});
  assert.equal(D.movement(spec,data).value,-.1);assert.equal(D.movement(spec,data).unit,'点');assert.equal(M.changeUnit(spec),'点');
  assert.equal(M.changeUnit({...spec,unit:'%'}),'百分点');
});
test('CPI KPI trend and delta use calculated YoY, payroll uses exact monthly changes',()=>{
  const cpi={id:'us-cpi',frequency:'monthly',kind:'index',unit:'指数'},data={observations:[{period:'2025-07',value:100},{period:'2025-08',value:100},{period:'2026-07',value:102},{period:'2026-08',value:103}]};
  assert.equal(D.headlineRows(cpi,data).at(-1).chartValue,3);assert.equal(D.movement(cpi,data).value,1);assert.equal(D.movement(cpi,data).unit,'百分点');
  const payroll={id:'us-payroll',frequency:'monthly',kind:'level',unit:'千人'};
  assert.equal(D.headlineRows(payroll,{observations:[{period:'2026-07',value:100},{period:'2026-09',value:130}]}).at(-1).chartValue,null);
});
test('sparkline segments break at real and structural gaps without fabricating observations',()=>{
  const list=[{period:'2026-01',chartValue:1},{period:'2026-02',chartValue:2},{period:'2026-04',chartValue:3},{period:'2026-05',chartValue:null},{period:'2026-06',chartValue:4}],copy=JSON.stringify(list);
  assert.deepEqual(D.segments({frequency:'monthly'},list).map(p=>p.length),[2,1,1]);assert.equal(JSON.stringify(list),copy);
});
test('latest CSV includes raw and headline units, true period, release and source; formula injection escaped',()=>{
  const spec={id:'x',name:'=bad',country:'CN',source:'a',kind:'rate',unit:'%',frequency:'monthly',adjustment:'未季调',staleDays:365};
  const csv=D.latestCsv([spec],{series:{x:{observations:[{period:'2026-09',value:2,releaseDate:null}],fetchedAt:'2026-10-09T01:00:00Z'}}},{a:{url:'https://example.com'}});
  assert.match(csv,/"'=bad"/);assert.match(csv,/"2026-09"/);assert.match(csv,/"2","%"/);assert.match(csv,/"","2026-10-09T01:00:00Z"/);
});
test('morning release list uses true release dates, excludes daily quotes and never substitutes fetch times',()=>{
  const specs=['cn-cpi','cn-ppi','cn-pmi','cn-retail','cn-lpr','cn-usdcny'].map((id,i)=>({id,name:id,country:'CN',frequency:i===5?'daily':'monthly',kind:'rate',unit:'%',staleDays:99}));
  const feed={cutoff:'2026-10-10',series:Object.fromEntries(specs.map((s,i)=>[s.id,{fetchedAt:'2026-10-10T00:00:00Z',observations:[{period:'2026-09',value:i,releaseDate:['2026-10-09',null,'2026-10-08','2026-10-11','2026-02-30','2026-10-10'][i]}]}]))};
  const before=JSON.stringify(feed),result=D.releases({series:specs},feed,'CN');
  assert.deepEqual(result.items.map(r=>r.spec.id),['cn-cpi','cn-pmi']);assert.equal(result.unknown,3);assert.equal(JSON.stringify(feed),before);
});
test('morning prior readings keep exact periods, actual zeros and derived headline units',()=>{
  const spec={id:'cn-cpi',frequency:'monthly',kind:'rate',unit:'%'},data={observations:[{period:'2026-07',value:0},{period:'2026-08',value:.2}]};
  assert.equal(D.readout(spec,data).previous.chartValue,0);assert.equal(D.readout(spec,data).delta.value,.2);
  assert.equal(D.readout(spec,{observations:[data.observations[0],{period:'2026-09',value:.3}]}).previous,null);
  assert.equal(D.priorPeriod({frequency:'quarterly'},'2026-Q1'),'2025-Q4');assert.equal(D.priorPeriod({frequency:'daily'},'2026-10-09'),null);
  const retail={id:'cn-retail',frequency:'monthly',kind:'level',unit:'亿元'},r=D.readout(retail,{observations:[{period:'2026-07',value:400,officialYoy:2},{period:'2026-08',value:410,officialYoy:3}]});
  assert.equal(r.value,3);assert.equal(r.previous.chartValue,2);assert.equal(r.unit,'%');assert.equal(r.delta.unit,'百分点');
  const missing={observations:[{period:'2026-07',value:400},{period:'2026-08',value:410,officialYoy:3}]};
  assert.equal(D.readout(retail,missing).previous.chartValue,null);assert.equal(D.readout(retail,missing).delta,null);assert.equal(D.headlineRows(retail,missing)[0].chartValue,null);
});
test('morning charts retain original frequency, gaps and headline transformations within three years',()=>{
  const spec={id:'us-payroll',frequency:'monthly',kind:'level',unit:'千人'},data={observations:[{period:'2023-08',value:100},{period:'2026-07',value:110},{period:'2026-09',value:130}]};
  const result=D.trendRows(spec,data,'2026-10-10');assert.deepEqual(result.map(r=>r.period),['2026-07','2026-09']);assert.ok(result.every(r=>r.chartValue===null));
  for(const country of ['CN','US'])for(const id of D.trends[country])assert.ok(D.core(catalog,country,snapshot).some(s=>s.id===id));
});



test('US CPI detail plots use calendar-matched YoY while raw data and other indicators retain their units',()=>{
  const raw={observations:[{period:'2025-01',value:100},{period:'2025-03',value:200},{period:'2026-01',value:103},{period:'2026-02',value:104},{period:'2026-03',value:206}]},before=JSON.stringify(raw);
  for(const id of ['us-cpi','us-core-cpi']){
    const spec={id,frequency:'monthly',kind:'index',unit:'指数'};
    assert.deepEqual(D.detailDefinition(spec),{mode:'yoy',unit:'%',label:'同比'});
    assert.deepEqual(D.detailRows(spec,raw,1,new Date('2026-12-31')).map(r=>r.chartValue),[3,null,3]);
  }
  const rate={id:'us-cpi',frequency:'monthly',kind:'rate',unit:'%'};
  assert.equal(D.detailRows(rate,raw,0).at(-1).chartValue,206);
  const pmi={id:'cn-pmi',frequency:'monthly',kind:'rate',unit:'点'};
  assert.deepEqual(D.detailDefinition(pmi),{mode:'value',unit:'点',label:''});
  assert.equal(D.detailRows(pmi,raw,0).at(-1).chartValue,206);
  assert.equal(JSON.stringify(raw),before);
});
test('macro annotations adapt to available width, retain the latest finite point and preserve all observations',()=>{
  const points=Array.from({length:300},(_,i)=>({x:60+i*3,y:i%45,label:'1.23万亿'})),before=JSON.stringify(points);
  const narrow=D.annotationIndices(points,{width:300,left:48,right:20}),wide=D.annotationIndices(points,{width:1000,left:58,right:20});
  assert(narrow.includes(299));assert(wide.includes(299));assert(wide.includes(0));assert(wide.length<=12);assert(wide.length>narrow.length);
  for(let i=1;i<wide.length;i++)assert(points[wide[i]].x-points[wide[i-1]].x>=84);
  assert.equal(JSON.stringify(points),before);assert.deepEqual(D.annotationIndices([],{}),[]);
  assert.deepEqual(D.annotationIndices([{x:1,y:0,label:'0'},{x:2,y:NaN,label:'—'}],{width:240}),[0]);
});
