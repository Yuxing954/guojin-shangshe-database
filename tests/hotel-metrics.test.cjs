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
const supplyPrior=ix.supply.get(`全国|全部|${prior}`);
close(M.change(supply,supplyPrior,'hotel_count'),(M.num(supply.hotel_count)/M.num(supplyPrior.hotel_count)-1)*100);
close(M.change(supply,supplyPrior,'room_count'),(M.num(supply.room_count)/M.num(supplyPrior.room_count)-1)*100);
close(M.change(supply,supplyPrior,'chain_rate'),(M.num(supply.chain_room_count)/M.num(supply.room_count)-M.num(supplyPrior.chain_room_count)/M.num(supplyPrior.room_count))*100);
assert.equal(M.metric({room_count:0,chain_room_count:0},'chain_rate'),null);
assert.equal(M.metric({room_count:100,chain_room_count:101},'chain_rate'),null);
assert.equal(M.metric({room_count:100,chain_room_count:null},'chain_rate'),null);
close(M.change({room_count:100,chain_room_count:20},{room_count:100,chain_room_count:0},'chain_rate'),20);
const investment=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/hotel-investment-monthly.json'),'utf8'));
assert.equal(investment.indicator_id,'EMM01013000');
assert.equal(investment.aggregation,'year_to_date');
const investmentCsv=M.csv(fs.readFileSync(path.join(__dirname,'../data/hotel-investment-monthly.csv'),'utf8'));
assert.equal(investmentCsv.length,investment.observations.length);
for(const observation of investment.observations) {
  const c=investmentCsv.find(r=>r.period_id===observation.period_id);
  assert.ok(c);
  assert.equal(M.num(c.yoy_pct),observation.yoy_pct);
  assert.equal(M.num(c.amount_cny_100m),observation.amount_cny_100m);
}
assert.equal(investment.observations.find(r=>r.period_id==='2017-12').amount_cny_100m,6107);
assert.equal(investment.observations.at(-1).amount_cny_100m,null);
const investmentHistory=M.investmentWindow(investment.observations,'2025-03-15','all');
assert.equal(investmentHistory.at(-1).period_id,'2025-02');
assert.ok(investmentHistory.every(r=>!r.period_id.endsWith('-01')));
assert.deepEqual(M.investmentWindow(investment.observations,'2017-01-31','all'),[]);
const gap=M.investmentWindow([{period_id:'2024-02',end_date:'2024-02-29',yoy_pct:19},{period_id:'2024-04',end_date:'2024-04-30',yoy_pct:29.6}],'2024-04-30','all');
assert.equal(gap.find(r=>r.period_id==='2024-03').yoy_pct,null);
assert.equal(M.num(supply.room_count),M.num(latest.room_count));
assert.notEqual(M.num(latest.room_count),M.num(latest.room_count_15plus));
const large = M.supply15Plus(data.supply.filter(r=>r.region==='全国'&&r.period_id===latest.period_id));
const largePrior = M.supply15Plus(data.supply.filter(r=>r.region==='全国'&&r.period_id===prior));
assert.equal(large.hotel_count,M.num(latest.hotel_count_15plus));
assert.equal(large.room_count,M.num(latest.room_count_15plus));
assert.equal(large.hotel_count,428582);
assert.equal(large.room_count,20961366);
assert.equal(large.chain_room_count,6372680);
close(M.change(large,largePrior,'hotel_count'),(M.num(latest.hotel_count_15plus)/M.num(base.hotel_count_15plus)-1)*100);
close(M.metric(large,'chain_rate'),6372680/20961366);
const bands=data.supply.filter(r=>r.region==='全国'&&r.period_id===latest.period_id&&r.room_band!=='15间以下'&&r.room_band!=='全部');
assert.equal(M.supply15Plus(bands.slice(1)).room_count,null);
assert.equal(M.supply15Plus([],latest).room_count,M.num(latest.room_count_15plus));
assert.equal(M.supply15Plus([],latest).chain_room_count,null);
assert.equal(M.supply15Plus(bands.map((r,i)=>i? r : {...r,room_count:''})).room_count,null);
assert.equal(M.supply15Plus(bands.map(r=>({...r,chain_room_count:0}))).chain_room_count,0);
const clipped=M.chartSeries([{name:'有效',pts:[{x:'1',y:null},{x:'2',y:0},{x:'3',y:null},{x:'4',y:4},{x:'5',y:null}]},{name:'无数据',pts:[{x:'1',y:null}]}]);
assert.equal(clipped.length,1);
assert.deepEqual(clipped[0].pts.map(p=>p.x),['2','3','4']);
assert.equal(clipped[0].pts[1].y,null);
assert.deepEqual(M.chartSeries([{pts:[{x:'1',y:null}]}]),[]);
const annualYear=Math.max(...data.share.map(r=>Number(r.year))), shares=data.share.filter(r=>Number(r.year)===annualYear);
assert.ok(M.validShares(shares));
console.log(JSON.stringify({result:'PASS',latest:latest.period_id,comparison:prior,regions:regions.length,rows:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),annualYear,annualRawSum:shares.reduce((s,r)=>s+M.num(r.market_share_pct),0)}));

