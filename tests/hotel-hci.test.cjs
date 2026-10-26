const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const d=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/hotel-hci/observations.json'),'utf8'));
assert.equal(d.observations.length,96);assert.equal(new Set(d.observations.map(r=>r.period+'|'+r.metric)).size,96);
const periods=[...new Set(d.observations.map(r=>r.period))];assert.equal(periods[0],'2025-05');assert.equal(periods.at(-1),'2026-08');
for(let i=0;i<periods.length;i++){assert.equal(periods[i],new Date(Date.UTC(2025,4+i,1)).toISOString().slice(0,7));assert.equal(d.observations.filter(r=>r.period===periods[i]).length,6);}
const sources=new Map(d.sources.map(s=>[s.id,s]));for(const r of d.observations){assert(Number.isFinite(r.value));assert.equal(r.base,'2025-05=100');assert.equal(r.sourceUrl,sources.get(r.sourceId).url);assert.equal(r.sourcePublishedAt,sources.get(r.sourceId).publishedAt);assert(r.sourceImage.startsWith('https://www.chinahotel.org.cn/sfs/'));if(r.yoy!=null||r.mom!=null)assert(sources.has(r.growthSourceId));}
const at=(p,m)=>d.observations.find(r=>r.period===p&&r.metric===m);
assert.equal(at('2025-06','adr_index').value,97.9);assert.equal(at('2025-11','confidence_index').value,80);
assert.equal(at('2026-08','adr_index').yoy,-2.7);assert.equal(at('2026-08','occupancy_index').value,108.6);assert.equal(at('2026-08','occupancy_index').yoy,null);assert.equal(at('2026-08','occupancy_index').growthStatus,'conflict');
assert(d.observations.filter(r=>r.period<'2026-05').every(r=>r.yoy===null));
const csv=fs.readFileSync(path.join(__dirname,'../data/hotel-hci/observations.csv'),'utf8');assert.equal(csv.trim().split(/\r?\n/).length,97);assert(csv.includes('"2026-08","adr_index","104.1"'));
console.log('PASS: 16 contiguous months, 96 unique values, original provenance, CSV coverage, missing growth and disclosure conflicts');

