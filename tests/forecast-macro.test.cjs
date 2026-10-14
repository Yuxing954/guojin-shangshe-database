const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../scripts/fedwatch-model.js');
const P=require('../scripts/prediction-model.js');
const snapshot={observedDate:'2026-10-08',probabilityUnit:'%',ranges:[{lower:3.5,upper:3.75,probability:0},{lower:3.75,upper:4,probability:82.8},{lower:4,upper:4.25,probability:17.2}]};
test('CME aggregates against policy without normalizing source values',()=>{assert.deepEqual(F.aggregate(snapshot,{range:[3.75,4]}),{cut:0,hold:82.8,hike:17.2});assert.equal(F.valid({...snapshot,ranges:snapshot.ranges.map(r=>({...r,probability:0}))}),false);assert.equal(F.valid({...snapshot,ranges:[{lower:3.5,upper:4,probability:50},{lower:3.75,upper:4.25,probability:50}]}),false);});
test('CME future observations and missing prior ranges are never shown as current or zero',()=>{assert.equal(F.snapshots({snapshots:[snapshot]},Date.parse('2026-10-07')).length,0);assert.equal(F.comparison(snapshot,{ranges:[snapshot.ranges[0]]})[1].change,null);assert.equal(F.aggregate(snapshot,{range:[3.8,4.05]}),null);});
test('Polymarket search retains all event choices and Chinese option names',()=>{const markets=[{id:'1',eventId:'event',eventComplete:true,category:'经济与利率',question:'hold',optionLabelZh:'维持不变',eventTitleZh:'美联储利率决策',endDate:'2026-12-01',outcomes:[{name:'Yes',probability:.8}]},{id:'2',eventId:'event',eventComplete:true,category:'经济与利率',question:'cut',optionLabelZh:'降息25基点',eventTitleZh:'美联储利率决策',endDate:'2026-12-01',outcomes:[{name:'Yes',probability:.2}]}];const groups=P.groups(markets,{query:'降息25',wholeEvents:true,now:Date.parse('2026-10-10')});assert.equal(groups.length,1);assert.equal(groups[0].markets.length,2);assert.equal(groups[0].title,'美联储利率决策');assert.equal(P.optionLabel(groups[0],markets[1]),'降息25基点');});


const data=require('../data/gold-jewelry/macro.json'),receipt=require('../data/macro/fedwatch-receipt-2026-10-11.json');
test('failed refresh preserves historical futures and only warns after an actual attempt',()=>{
 const update={status:'error',attemptedAt:'2026-10-11T07:00:00Z'};
 assert.match(F.refreshWarning(update,{retrievedAt:'2026-10-11T00:36:25Z'},Date.parse('2026-10-11T08:00:00Z')),/保留概率及期货历史快照/);
 assert.equal(F.refreshWarning(update,{retrievedAt:'2026-10-11T00:36:25Z'},Date.parse('2026-10-11T06:00:00Z')),'');
 assert.equal(F.refreshWarning(update,{retrievedAt:'2026-10-11T07:30:00Z'},Date.parse('2026-10-11T08:00:00Z')),'');
});
test('whole official table retains every meeting, contract, zero, blank and unnormalized rounded row',()=>{
 const t=F.latestTable(data,Date.parse(receipt.retrievedAt)+1);assert.ok(t);
 assert.equal(t.rows.length,receipt.tables[1].rows.length-2);assert.equal(t.futures.length,receipt.tables[0].rows[1].length);
 assert.deepEqual(t.columns.map(c=>c.labelBps),receipt.tables[1].rows[1].slice(1));
 for(let i=0;i<t.rows.length;i++)assert.deepEqual(t.rows[i].probabilities,receipt.tables[1].rows[i+2].slice(1).map(v=>v?Number(v.slice(0,-1)):null));
 assert.equal(t.rows[0].probabilities[6],null);assert.equal(t.rows[0].probabilities[5],0);assert.ok(Math.abs(t.rows[8].probabilities.reduce((s,v)=>s+v,0)-99.8)<1e-8);
 assert.equal(t.observedAt,null);assert.notEqual(t.retrievedAt,t.referenceObservedAt);
 assert.equal(t.futures[0].rawPrice,'96.1150');assert.equal(t.futures[0].contractMonth,'2026-10');
 const bad=structuredClone(t);bad.rows[8].probabilities[0]+=1;assert.equal(F.validTable(bad),false);
 bad.rows[8]=structuredClone(t.rows[8]);bad.columns[1].lower=3.9;assert.equal(F.validTable(bad),false);
 assert.equal(F.latestTable(data,Date.parse(receipt.retrievedAt)-1),undefined);
 const s=data.meetings[0].snapshots.find(s=>s.retrievedAt===receipt.retrievedAt);assert.ok(s);assert.equal(s.observedDate,null);assert.ok(F.valid(s));
 assert.equal(F.snapshots(data.meetings[0],Date.parse(receipt.retrievedAt)+1).at(-1),s);
 assert.match(F.label(s),/^获取 /);
 const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),source=data.sources.find(s=>s.id===t.sourceId);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',source.evidence.path)).toString('utf8').replace(/\r\n/g,'\n')).digest('hex'),source.evidence.sha256);
});

