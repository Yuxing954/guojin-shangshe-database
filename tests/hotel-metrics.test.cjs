const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../scripts/hotel-metrics.js');
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
assert.equal(M.num(''), null);
assert.equal(M.num('  '), null);
assert.equal(M.num('Infinity'), null);
assert.equal(M.num('0'), 0);
assert.deepEqual(M.csv('\uFEFFa,b\r\n"x,y","z""q"\r\n'), [{a:'x,y',b:'z"q'}]);
assert.equal(M.metric({occupancy_rate:'1.02'}, 'occupancy_rate'), null);
assert.equal(M.metric({occupancy_rate:''}, 'occupancy_rate'), null);
close(M.change({occupancy_rate:'.7'}, {occupancy_rate:'.6'}, 'occupancy_rate'), 10);
close(M.change({occupancy_rate:'.7'}, {occupancy_rate:'0'}, 'occupancy_rate'), 70);
close(M.change({adr:300}, {adr:250}, 'adr'), 20);
assert.equal(M.change({adr:300}, {adr:0}, 'adr'), null);
assert.equal(M.change({revpar:''}, {revpar:100}, 'revpar'), null);
assert.equal(M.change({occupancy_rate:'.7'}, undefined, 'occupancy_rate'), null);
assert.equal(M.priorPeriod({year:'2026',week:'1'}), '2025W01');
assert.equal(M.priorPeriod({year:'2020',week:'53'}), '2019W53');
assert.throws(() => M.index([{a:1},{a:1}], ['a']), /重复/);
assert.equal(M.validShares([{market_share_pct:150}]), false);
assert.equal(M.validShares([{market_share_pct:60},{market_share_pct:50}]), false);
assert.equal(M.validShares([{market_share_pct:40},{market_share_pct:10.7}]), true);
assert.deepEqual(M.rank([{region:'甲',v:null},{region:'乙',v:0},{region:'丙',v:2}], 'v').map(r=>r.region), ['丙','乙','甲']);
const files = {
  industry: ['hotel_industry_weekly.csv',['region','segment','period_id']],
  group: ['hotel_group_weekly.csv',['group','region','period_id']],
  supply: ['hotel_supply_weekly.csv',['region','room_band','period_id']],
  share: ['hotel_market_share_annual.csv',['group','year']]
};
const data = {}, ix = {};
for (const [name,[file,keys]] of Object.entries(files)) {
  data[name] = M.csv(fs.readFileSync(path.join(__dirname,'../data',file),'utf8'));
  assert.ok(data[name].length > 0);
  ix[name] = M.index(data[name], keys);
}
const nationwide = M.sorted(data.industry.filter(r=>r.region==='全国'&&r.segment==='全部'));
const latest = nationwide.at(-1), prior = M.priorPeriod(latest), regions=[...new Set(data.industry.map(r=>r.region))];
const dates=new Map();
for(const r of data.industry) {
  const range=r.start_date+'|'+r.end_date;
  if(dates.has(r.period_id)) assert.equal(dates.get(r.period_id),range);
  dates.set(r.period_id,range);
}
assert.equal(regions.length,21);
for(const region of regions) {
  const r=ix.industry.get(`${region}|全部|${latest.period_id}`);
  const b=ix.industry.get(`${region}|全部|${prior}`);
  assert.ok(r, `${region} lacks latest week`);
  assert.ok(b, `${region} lacks baseline`);
  close(M.num(r.revpar),M.num(r.adr)*M.num(r.occupancy_rate),.03);
  if(region!=='全国') {
    const earliest=M.sorted(data.industry.filter(r=>r.region===region&&r.segment==='全部'))[0];
    assert.equal(earliest.period_id,'2017W02');
    assert.equal(M.metric(earliest,'occupancy_rate'),null);
    assert.equal(M.metric(earliest,'revpar'),null);
    assert.ok(M.metric(earliest,'adr')>0);
  }
}
const base=ix.industry.get(`全国|全部|${prior}`);
close(M.change(latest,base,'occupancy_rate'),(M.num(latest.occupancy_rate)-M.num(base.occupancy_rate))*100);
close(M.change(latest,base,'revpar'),(M.num(latest.revpar)/M.num(base.revpar)-1)*100);
// A manually selected holiday comparison must use that exact week, not the automatic one.
const priorYearRows=nationwide.filter(r=>Number(r.year)===Number(latest.year)-1&&r.period_id!==prior);
const manual=priorYearRows.at(-1);
close(M.change(latest,manual,'adr'),(M.num(latest.adr)/M.num(manual.adr)-1)*100);
const historic=M.windowRows(nationwide,'2019W10','all');
assert.ok(historic.every(r=>r.period_id<='2019W10'));
assert.equal(historic.at(-1).period_id,'2019W10');
assert.ok(M.windowRows(nationwide,latest.period_id,'52').length<=52);
for(const g of ['华住','首旅如家','锦江酒店（中国区）','亚朵']) {
  const r=ix.group.get(`${g}|全国|${latest.period_id}`), b=ix.group.get(`${g}|全国|${prior}`);
  assert.ok(r&&b);
  close(M.change(r,b,'stay_adr'),(M.num(r.stay_adr)/M.num(b.stay_adr)-1)*100);
}
const supply=ix.supply.get(`全国|全部|${latest.period_id}`);
assert.equal(M.num(supply.room_count),M.num(latest.room_count));
assert.notEqual(M.num(latest.room_count),M.num(latest.room_count_15plus));
const annualYear=Math.max(...data.share.map(r=>Number(r.year))), shares=data.share.filter(r=>Number(r.year)===annualYear);
assert.ok(M.validShares(shares));
console.log(JSON.stringify({result:'PASS',latest:latest.period_id,comparison:prior,regions:regions.length,rows:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),annualYear,annualRawSum:shares.reduce((s,r)=>s+M.num(r.market_share_pct),0)}));
