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
  assert.ok(D.directory(catalog,snapshot,{country:'US',health:'attention'}).some(s=>s.id==='us-cpi'));
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
