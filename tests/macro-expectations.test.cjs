'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../scripts/macro-expectations.js'),feed=require('../data/macro/expectations.json');
const spec={id:'cn-retail',frequency:'monthly',kind:'level',unit:'亿元'};
test('retail compares official YoY, never nominal amounts; absent and incompatible bases stay missing',()=>{
  assert.equal(E.actual(spec,{value:40000,officialYoy:0.4}),0.4);
  assert.equal(E.difference(feed,spec,{period:'2026-08',value:40000,officialYoy:0.4}),-0.33);
  assert.equal(E.difference(feed,spec,{period:'2026-08',value:40000}),null);
  assert.equal(E.difference(feed,{id:'cn-gdp-quarter',kind:'rate',unit:'%'},{period:'2026-Q2',value:4.3}),null);
  assert.equal(E.difference(feed,spec,{period:'2026-02',value:40000,officialYoy:2.8}),null);
});
test('forecast receipts retain exact source values, unknown survey dates and real zeros',()=>{
  E.validate(feed);
  for(const series of Object.values(feed.series)){
    assert.equal(series.vintageVerified,false);assert.equal(series.aggregation,null);
    const file=path.join(__dirname,'..',series.receipt),bytes=fs.readFileSync(file);
    assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),series.receiptSha256);
    for(const r of series.observations){assert.equal(r.value,Number(r.rawValue));assert.equal(r.forecastDate,null);}
  }
  const cpi={id:'cn-cpi',kind:'rate',unit:'%'};
  assert.equal(E.difference(feed,cpi,{period:'2025-07',value:0}),0.094);
  assert.throws(()=>E.validate({...feed,series:{'cn-cpi':{...feed.series['cn-cpi'],unit:'亿元'}}}));
});
test('CSV includes future forecast periods without inventing actual readings or publication dates',()=>{
  const csv=E.csv(feed,{id:'cn-cpi',name:'CPI同比',kind:'rate',unit:'%'},{observations:[{period:'2026-09',value:0.9}]});
  assert.match(csv,/"2026-10","","1.05","",""/);
  assert.match(csv,/"2026-09","0.9","1.028","-0.128",""/);
  assert.match(csv,/公布前版本已核验/);assert.match(csv,/"否"/);
});
test('overview selects nearest pending period and never substitutes a far future projection',()=>{
  const catalog={series:E.ids.map(id=>({id,name:id}))},snapshot={series:{'cn-cpi':{observations:[{period:'2026-09',value:0.9}]},'cn-gdp-quarter':{observations:[{period:'2026-Q2',value:4.3}]},'cn-retail':{observations:[{period:'2026-08',value:0.4}]}}};
  const html=E.overview(feed,catalog,snapshot,'CN');assert.match(html,/2026-Q3/);assert.match(html,/2026-09/);assert.match(html,/2026-10/);assert.doesNotMatch(html,/2026-12/);assert.equal(E.overview(feed,catalog,snapshot,'US'),'');
});
