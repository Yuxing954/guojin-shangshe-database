'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const dir=path.join(__dirname,'../data/tourism'),data=JSON.parse(fs.readFileSync(path.join(dir,'three-gorges-details.json'),'utf8'));
const sources=new Set(data.sources.map(s=>s.id));assert.equal(data.records.length,33);
for(const [i,r] of data.records.entries()){
 assert.equal(r.period,`${2024+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`);assert(sources.has(r.sourceId));
 assert.equal(r.ages.length,6);assert.equal(r.companies.length,7);
 for(const v of [...r.ages,...r.companies,...Object.values(r.origins),r.jiaoyunShare,r.jiaoyunYoY])assert(v===null||Number.isFinite(v));
 if(r.ages.every(v=>v!==null))assert(Math.abs(r.ages.reduce((a,b)=>a+b,0)-100)<=.03,r.period);
 for(const v of r.companies)assert(v===null||v>=0);
 const base=data.records.find(x=>x.period===`${Number(r.period.slice(0,4))-1}${r.period.slice(4)}`),a=r.companies[6],b=base?.companies[6];
 if(r.jiaoyunYoY!==null){assert(a!==null&&b>0);assert(Math.abs(r.jiaoyunYoY-(a/b-1)*100)<.0001);assert(r.fieldStatus.jiaoyunYoY.startsWith('derived:'));}
 if(r.period.endsWith('-12')){assert(r.ages.every(v=>v===null));assert.equal(r.origins.foreign,null);}
 if(r.evidence.companies)assert(r.evidence.companies.startsWith('https://www.cse.net.cn/api/file/loadFile.do?id='));
}
const latest=data.records.at(-1);assert.deepEqual(latest.companies,[.83,.11,1.09,null,.84,.62,.38]);assert.equal(latest.jiaoyunShare,3.2);assert.equal(latest.jiaoyunYoY,46.1538);assert.equal(latest.origins.foreignShare,18.41);assert.equal(latest.ages[5],55.16);
assert.equal(data.records.find(r=>r.period==='2024-02').companies[0],.0463);assert.equal(data.records.find(r=>r.period==='2025-12').companies[6],0);assert.equal(data.records.find(r=>r.period==='2026-02').companies[6],null);
assert.equal(data.annualRecords.length,2);assert.equal(data.annualRecords[0].origins.foreign,5.92);assert.equal(data.annualRecords[1].origins.foreign,11.76);
const csv=require('../scripts/site-data.js').csv(fs.readFileSync(path.join(dir,'three-gorges-details.csv'),'utf8'));
const c=csv.find(r=>r.period==='2026-09'&&r.metric==='宜昌交运长江游轮');assert.equal(Number(c.value),.38);assert(c.evidenceUrl.includes('322318864639590400'));
assert.equal(data.records.filter(r=>r.evidence.companies).length,30);assert.equal(data.records.filter(r=>r.evidence.ages).length,28);
console.log('PASS: 33 month slots, original source links, annual/monthly separation, missing vs zero, people conversion, non-overnight exclusion and derived YoY');
