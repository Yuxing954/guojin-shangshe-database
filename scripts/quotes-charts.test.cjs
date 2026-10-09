const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('./market-kline.js'),M=require('./quotes-model.js'),receipts=require('../tests/fixtures/tencent-charts-20261009.json');
test('historical and intraday URLs select the correct market controller and source US suffix',()=>{
  assert.match(K.chartUrl('600754.SH','day',null,150),/\/fqkline\/get/);
  assert.match(K.chartUrl('6181.HK','day',null,150),/\/hkfqkline\/get/);
  assert.match(K.chartUrl('ATAT.O','week','usATAT.OQ',100),/\/usfqkline\/get/);
  assert.match(K.chartUrl('ATAT.O','minute','usATAT.OQ'),/\/UsMinute\/query\?code=usATAT.OQ/);
  assert.throws(()=>K.chartUrl('ATAT.O','day'),/来源代码/);
  assert.throws(()=>K.chartUrl('ATAT.O','day','usOTHER.OQ'),/来源代码/);
  assert.match(K.chartUrl('HSI.HI','day',null,150,true),/hkHSI%2Cday/);
  assert.doesNotMatch(K.chartUrl('HSI.HI','day',null,150,true),/qfq$/);
});
for(const fixture of receipts){test('recorded Tencent response: '+fixture.label,()=>{
  assert.match(fixture.responseSha256,/^[a-f0-9]{64}$/);
  const rows=K.normalize(fixture.response,fixture.period,fixture.symbol);
  if(fixture.label==='us_minute'){assert.deepEqual(rows,[],'empty source date must not become a fabricated session');return;}
  if(fixture.period==='m1'){
    const filtered=M.intraday(rows,fixture.symbol.startsWith('us')?'ATAT.O':'6181.HK');assert.ok(filtered.length>100);assert.match(filtered[0][0],/^2026100[89]0930$/);assert.ok(filtered.every(r=>r[2]>0&&r[0].length===12));
  }else{
    const filtered=M.candles(rows);assert.equal(filtered.length,rows.length);assert.equal(M.adjustment(fixture.response,fixture.symbol,fixture.period,false),'前复权');assert.ok(M.movingAverage(filtered,20).at(-1)>0);
  }
  assert.deepEqual(K.normalize(fixture.response,fixture.period,'wrong-symbol'),[],'another security cannot be accepted as the selected symbol');
});}
test('empty preferred series falls through to actual raw rows with truthful adjustment label',()=>{const response={code:0,data:{hk06181:{qfqday:[],day:[['2026-10-09',10,11,12,9,100]]}}};assert.equal(K.normalize(response,'day','hk06181').length,1);assert.equal(M.adjustment(response,'hk06181','day',false),'源数据');});
test('invalid dates, times, prices and incomplete candles cannot enter the chart',()=>{const data={code:0,data:{usATAT:{data:{date:'20260230',data:['0930 10 0']}}}};assert.deepEqual(K.normalize(data,'m1','usATAT'),[]);data.data.usATAT.data={date:'20261008',data:['  0','9999 10 0','0930 0 0','0931 31.6 1']};assert.deepEqual(K.normalize(data,'m1','usATAT'),[['202610080931',31.6,31.6,31.6,31.6,1]]);assert.deepEqual(M.candles([['2026-02-30',10,11,12,9],['2026-10-09',10]]),[]);assert.deepEqual(K.normalize({...data,code:1},'m1','usATAT'),[]);});
