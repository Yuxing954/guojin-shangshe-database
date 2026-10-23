const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),d=JSON.parse(fs.readFileSync(path.join(root,'data/tourism/three-gorges-cruises.json'),'utf8'));
assert.equal(d.records.length,33);assert.equal(new Set(d.records.map(r=>r.period)).size,33);
const ids=new Set(d.sources.map(s=>s.id));
for(const [i,r] of d.records.entries()){
 assert.equal(r.period,`${2024+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`);
 for(const id of r.sourceIds)assert(ids.has(id));
 for(const id of Object.values(r.fieldSources))assert(r.sourceIds.includes(id));
 for(const scope of ['monthly','ytd'])for(const [k,v] of Object.entries(r[scope])){assert(v===null||Number.isFinite(v));if(v!==null&&['sailings','nonOvernightSailings'].includes(k))assert(Number.isInteger(v)&&v>=0);if(v!==null&&k==='load')assert(v>=0&&v<=100);}
}
assert.equal(d.records.filter(r=>r.monthly.passengers!==null).length,33);
assert.equal(d.records[0].monthly.passengers,1.0025);assert.equal(d.records[0].monthly.sailings,79);assert.equal(d.records[0].reconciliationClue.sailings,80);assert.equal(d.records[25].monthly.nonOvernightPassengers,0);
assert.equal(d.records[24].monthly.passengers,.8971);assert.equal(d.records[32].monthly.passengers,11.95);assert.equal(d.records[32].ytd.passengers,96.21);
assert.equal(d.records[28].ytd.nonOvernightSailings,74);assert(d.records[28].notes.length); // Never silently repair source conflicts.
assert.equal(d.records[26].fieldSources['monthly.load'],'cq-2026-03-load');
assert.equal(d.records[1].monthly.load,58.15); // Preserve initial disclosure, not a later implied base.
const csv=fs.readFileSync(path.join(root,'data/tourism/three-gorges-cruises.csv'),'utf8');assert.equal(csv.trim().split(/\r?\n/).length,67);assert(csv.includes('2026-09,monthly,478.0,11.95,70.41'));
const csvRows=require('../scripts/site-data.js').csv(csv);
for(const r of d.records)for(const scope of ['monthly','ytd']){const c=csvRows.find(x=>x.period===r.period&&x.scope===scope);assert(c);for(const [k,v] of Object.entries(r[scope]))assert.equal(c[k]===''?null:Number(c[k]),v);}
console.log('PASS: 33 continuous and reported months, typed missing values, official January source, provenance and conflict preservation');

