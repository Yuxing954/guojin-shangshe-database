'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),M=require('../scripts/travel-model.js'),d=JSON.parse(fs.readFileSync(path.join(root,'data/tourism/dashboard.json'),'utf8'));
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
assert(d.domestic.holidays.length>=58);assert(d.domestic.changbai.length>100);assert(d.domestic.jiuzhai.length>700);
const seen=new Set();for(const r of d.domestic.holidays){const k=r.year+'-'+r.order;assert(!seen.has(k),'duplicate holiday '+k);seen.add(k);assert(r.locator);close(r.dailyTrips*r.days,r.trips);close(r.perTrip*r.trips,r.spend);}
const nd=d.domestic.holidays.find(r=>r.period==='2026年国庆');close(nd.spend,7383.75);close(nd.dailyTrips,1.18);assert.equal(nd.perTripYoY,null);assert(d.domestic.holidays.find(r=>r.period==='2026年端午'));
const f=d.inbound.border.find(r=>r.period==='2026H1');assert.equal(f.foreign,4590.6);assert.equal(f.foreignIn,2291.4);assert.equal(f.foreignYoY,20.6);assert.equal(f.foreignInYoY,20.4);close(f.foreignShare,4590.6/36900*100);
assert.equal(d.inbound.border.at(-1).period,'2026Q3');assert.equal(d.inbound.border.at(-1).foreignIn,1160.1);assert.equal(d.inbound.border.at(-1).visaShare,77.5);
const tourist=d.inbound.tourists.find(r=>r.period==='2025');assert.equal(tourist.total,15450);assert.equal(tourist.foreign,3517);assert.notEqual(tourist.foreign,d.inbound.border.find(r=>r.period==='2025').foreign);
assert(M.borderRows(d,'annual').every(r=>r.scope==='annual'));assert(M.borderRows(d,'h1').every(r=>r.period.endsWith('H1')));
assert.deepEqual(M.continuous([{period:'2026-01',value:1},{period:'2026-03',value:3}]).map(x=>x.value),[1,null,3]);
assert.equal(M.cumulative([{period:'2026-01',value:2},{period:'2026-03',value:4}],'2026-03').value,null);
assert.equal(M.cumulative([{period:'2026-01',value:0}],'2026-01').value,0);
const jp=d.outbound.destinations.find(x=>x.name==='日本');close(M.cumulative(jp.records,'2026-06').value,jp.records.filter(x=>x.period.startsWith('2026')).reduce((t,r)=>t+r.value,0));
const my=d.outbound.destinations.find(x=>x.name==='马来西亚');assert.equal(my.records.length,0);assert(my.quarantined.length>0);assert.equal(my.status,'期间待核验');
for(const s of d.sources.filter(x=>x.quality==='官方原始披露')){assert(/^https:\/\//.test(s.url));assert(s.publishedAt);}
assert(M.csv([[0,null,'x"y']],['a','b','c']).includes('"0","","x""y"'));
console.log('PASS travel: holiday units, source locators, annual/half/quarter scopes, inbound versus border, monthly gaps, complete YTD, quarantined dates, CSV');

