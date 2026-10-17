'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),G=require('./hotel-groups-model.js'),H=require('./hotel-metrics.js'),{build}=require('./build-hotel-groups.cjs');
const root=path.resolve(__dirname,'..'),d=JSON.parse(fs.readFileSync(path.join(root,'data/hotel-groups.json'),'utf8')),w=H.csv(fs.readFileSync(path.join(root,'data/hotel_group_weekly.csv'),'utf8'));
assert.deepEqual(build(root),d,'The read model must match current source observations');
assert.equal(d.companies.length,4);const sources=new Set(d.sources.map(s=>s.id));
for(const c of d.companies)for(const [m,s] of Object.entries(c.series)){
 assert(s.observations.length>0);assert.equal(s.frequency,'季度');if(['profit','revenue'].includes(m)){assert.equal(s.currency,'CNY');assert.equal(s.periodBasis,'单季');}
 const periods=new Set();for(const o of s.observations){assert(/^\d{4}Q[1-4]$/.test(o.period));assert(!periods.has(o.period));periods.add(o.period);assert(Number.isFinite(o.value));assert(!['pending','forecast'].includes(o.status));assert(sources.has(o.sourceId));assert(o.locator);if(o.yoy?.unit==='百分点')assert.equal(m,'occ');}
}
for(const f of d.inputFiles)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f.file))).digest('hex'),f.sha256);
const atour=d.companies.find(c=>c.id==='atour');assert.equal(atour.series.profit.name,'净利润');assert.equal(d.companies.find(c=>c.id==='jinjiang').series.profit.name,'归母净利润');
const test=[{group:'华住',region:'全国',period_id:'2025W01',year:'2025',week:'1',stay_adr:'0',adr:'999'}, {group:'华住',region:'全国',period_id:'2026W01',year:'2026',week:'1',stay_adr:'200',adr:'999'}];
let s=G.weeklySeries(test,'hworld','adr');assert.equal(s.observations.at(-1).value,200);assert.equal(s.observations.at(-1).yoy,null,'No zero-base growth');test[0].stay_adr='100';s=G.weeklySeries(test,'hworld','adr');assert.equal(s.observations.at(-1).yoy.value,100);test[1].stay_adr='';assert.equal(G.weeklySeries(test,'hworld','adr').observations.at(-1).value,null,'Blank is not zero');assert.equal(G.weeklySeries(test,'hworld','occ'),null,'No weekly OCC should be fabricated');
s={unit:'百万元',observations:[{period:'2025Q1',value:1234.567},{period:'2025Q3',value:8}]};assert.equal(G.display(s,s.observations[0]).value,12.34567);const window=G.windowRows(s,'2025Q2','2',['2025Q1','2025Q2','2025Q3']);assert.equal(window.length,2);assert.equal(window[1].value,null);assert(!window.some(o=>o.period==='2025Q3'));
for(const id of Object.keys(G.groups)){const s=G.weeklySeries(w,id,'adr');assert(s.observations.length>0);const o=s.observations.at(-1),raw=w.find(r=>r.group===G.groups[id]&&r.period_id===o.period);assert.equal(o.value,Number(raw.stay_adr));}
console.log('Hotel groups: source freshness, scopes, single quarters, units, weekly ADR and missing data passed');
