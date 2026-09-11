const assert=require("assert");
const K=require("./market-kline.js");

assert.equal(K.marketOf("600754.SH"),"CN");
assert.equal(K.marketOf("1179.HK"),"HK");
assert.equal(K.marketOf("ATAT.O"),"US");
assert.equal(K.calendarDate("1179.HK",new Date("2026-09-10T16:30:00Z")),"2026-09-11");
assert.equal(K.calendarDate("ATAT.O",new Date("2026-09-11T01:00:00Z")),"2026-09-10");
assert.equal(K.tradingDate("1179.HK",new Date("2026-09-12T04:00:00Z")),"2026-09-11");

const mixed=[
  ["202609101500",10,10.1,10.2,9.9,100],
  ["202609110930",10.2,10.3,10.4,10.2,40],
  ["202609110935",10.3,10.5,10.5,10.3,50]
];
let clean=K.sanitizeIntraday("600754.SH",mixed,new Date("2026-09-11T02:00:00Z"));
assert.equal(clean.rows.length,2,"must keep only the current market trading day");
clean=K.sanitizeIntraday("600754.SH",mixed.slice(0,1),new Date("2026-09-11T01:00:00Z"));
assert.equal(clean.rows.length,0,"must not retain yesterday before today's first tick");

let changes=0;K.onTradingDayChange(()=>changes++);
K.checkRollover("1179.HK",new Date("2026-09-10T15:59:00Z"));
K.setIntradayCache("1179.HK",[["202609102359",1,1,1,1,1]],new Date("2026-09-10T15:59:00Z"));
K.checkRollover("1179.HK",new Date("2026-09-10T16:01:00Z"));
assert.equal(changes,1,"market-timezone midnight must trigger rollover");
assert.equal(K.getIntradayCache("1179.HK",new Date("2026-09-10T16:01:00Z")),null,"rollover must clear intraday cache");

const normalized=K.normalize({data:{sh600754:{data:{date:"20260911",data:["0930 10 100","0931 11 130","0932 9 150","0933 10.5 180","0934 10 210"]}}}},"m5");
assert.deepEqual(normalized[0],["202609110930",10,10,11,9,210]);
console.log("market-kline tests passed");
