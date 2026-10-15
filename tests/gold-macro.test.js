const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const M=require('../scripts/gold-macro-model.js'),D=require('../data/gold-jewelry/macro.json');
test('reviewed macro data validates with separate policy, market probabilities and SEP',()=>{assert.deepEqual(M.validate(D),[]);assert.ok(D.series.reduce((n,s)=>n+s.observations.length,0)>=184);assert.equal(D.releases.length,5);assert.ok(D.meetings.length>=2);assert.equal(D.projections.basis,'sep_year_end_midpoint');});
test('year-end probability aggregates all higher target ranges, not just one hike',()=>{const s=D.meetings[1].snapshots.find(s=>s.observedAt==='2026-10-08T09:09:01-05:00'),p=M.probabilities(s,D.policy.range);assert.ok(Math.abs(p.hike-82.8)<1e-10);assert.equal(p.hold,17.2);assert.equal(p.cut,0);assert.equal(s.observedAt,'2026-10-08T09:09:01-05:00');assert.equal(M.probabilities(D.meetings[1].snapshots[0],D.policy.range).hike,79.7);});
test('probability partition rejects missing mass, overlap, duplicate and invalid values',()=>{const s=structuredClone(D.meetings[1].snapshots.find(s=>s.observedAt==='2026-10-08T09:09:01-05:00'));s.ranges.pop();assert.equal(M.probabilities(s,D.policy.range),null);s.ranges.push({lower:4,upper:4.25,probability:13.6});assert.equal(M.probabilities(s,D.policy.range),null);s.ranges.at(-1).lower=4.1;s.ranges.at(-1).upper=4.5;assert.equal(M.probabilities(s,D.policy.range),null);s.ranges.at(-1).probability=NaN;assert.equal(M.probabilities(s,D.policy.range),null);});
test('interest rate movement is in bp while dollar movement is a percentage',()=>{const asOf=id=>{const s=D.series.find(s=>s.id===id);return {...s,observations:s.observations.filter(o=>o.date<='2026-10-08')};},r=M.changeSince(asOf('real10'),'2026-09-30'),d=M.changeSince(asOf('dxy'),'2026-09-30');assert.ok(Math.abs(r.bp+6)<1e-9);assert.equal(r.from,'2026-09-30');assert.ok(Math.abs(d.percent-.63858093)<1e-5);assert.equal(d.bp,null);assert.equal(M.changeSince({unit:'%',observations:[{date:'2026-10-08',value:2.87}]},'2026-09-30'),null);});
test('stale snapshot age uses observation day and future meeting date is not a data observation',()=>{assert.equal(M.ageDays('2026-10-08','2026-10-12'),4);assert.equal(M.ageDays('2026-02-30','2026-10-09'),null);const d=structuredClone(D);d.meetings[0].snapshots[0].observedDate='2026-09-08';assert.ok(M.validate(d).some(e=>e.includes('政策基准')));d.meetings[0].snapshots[0].observedDate='2026-10-28';assert.ok(M.validate(d).some(e=>e.includes('时点')));});
test('Chicago timestamp matches daylight saving and winter offsets',()=>{assert.equal(M.chicagoTimestamp({observedDate:'2026-10-08',observedAt:'2026-10-08T09:03:53-05:00'}),true);assert.equal(M.chicagoTimestamp({observedDate:'2026-11-06',observedAt:'2026-11-06T09:03:53-06:00'}),true);assert.equal(M.chicagoTimestamp({observedDate:'2026-11-06',observedAt:'2026-11-06T09:03:53-05:00'}),false);});
test('provider values cannot be upgraded and DXY cannot be renamed broad dollar',()=>{const d=structuredClone(D);d.series[0].quality='primary';assert.ok(M.validate(d).some(e=>e.includes('核验状态')));d.series[1].originalName='广义贸易加权美元指数';assert.ok(M.validate(d).some(e=>e.includes('指标身份')));d.policy.unit='bp';assert.ok(M.validate(d).some(e=>e.includes('政策利率')));});
test('unreleased statistics, duplicate dates and inconsistent timezone are rejected',()=>{const d=structuredClone(D);d.releases[0].periodEnd='2026-09-30';d.releases[0].publishedAt=new Date(Date.parse(d.checkedAt+'T00:00:00Z')+86400000).toISOString().slice(0,10);assert.ok(M.validate(d).some(e=>e.includes('发布日期')));d.series[0].observations[1].date=d.series[0].observations[0].date;assert.ok(M.validate(d).some(e=>e.includes('观测日期')));d.meetings[0].snapshots.at(-1).observedAt='2026-10-08T09:03:53Z';assert.ok(M.validate(d).some(e=>e.includes('时区')));d.policy=null;assert.doesNotThrow(()=>M.validate(d));});

test('new complete-table snapshots disclose unknown source time and preserve old precise timestamps',()=>{
 const latest=M.latestSnapshot(D.meetings[0]);assert.equal(latest.observedAt,null);assert.equal(latest.observedDate,null);
 const table=D.fedwatchTables.find(t=>t.sourceId===latest.sourceId),row=table.rows.find(r=>r.meetingDate===D.meetings[0].meetingDate);
 const hike=table.columns.reduce((sum,c,i)=>sum+(c.lower>=D.policy.range[1]&&Number.isFinite(row.probabilities[i])?row.probabilities[i]:0),0);
 assert.match(M.snapshotLabel(latest),/^获取 /);assert.equal(M.probabilities(latest,D.policy.range).hike,hike);
 assert.equal(D.meetings[0].snapshots.find(s=>s.observedAt==='2026-10-08T09:03:53-05:00').ranges[1].probability,82.8);
});

test('FedWatch receipt hash matches canonical committed bytes',()=>{
 const t=D.fedwatchTables.at(-1),raw=fs.readFileSync(path.join(__dirname,'..',t.receiptPath),'utf8').replace(/\r\n/g,'\n');
 assert.equal(crypto.createHash('sha256').update(raw,'utf8').digest('hex'),t.receiptSha256);
});

