(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.SinolinkKline=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  var intradayCache={},listeners=[],lastDates={};
  var MARKETS={
    CN:{timeZone:"Asia/Shanghai",open:"09:30",close:"15:00"},
    HK:{timeZone:"Asia/Hong_Kong",open:"09:30",close:"16:00"},
    US:{timeZone:"America/New_York",open:"09:30",close:"16:00"}
  };
  function marketOf(code){code=String(code||"").toUpperCase();if(code==="HSI.HI"||/\.HK$/.test(code))return"HK";if(/\.(O|N)$/.test(code))return"US";return"CN";}
  function quoteCode(code){code=String(code||"").toUpperCase();if(code==="HSI.HI")return"hkHSI";var p=code.split(".");return p[1]==="SH"?"sh"+p[0]:p[1]==="SZ"?"sz"+p[0]:p[1]==="HK"?"hk"+String(parseInt(p[0],10)||0).padStart(5,"0"):(p[1]==="O"||p[1]==="N")?"us"+p[0]:code.toLowerCase();}
  function zonedParts(date,timeZone){var parts=new Intl.DateTimeFormat("en-CA",{timeZone:timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(date||new Date()),o={};parts.forEach(function(p){o[p.type]=p.value;});return o;}
  function calendarDate(code,now){var p=zonedParts(now||new Date(),MARKETS[marketOf(code)].timeZone);return p.year+"-"+p.month+"-"+p.day;}
  function tradingDate(code,now){var market=marketOf(code),p=zonedParts(now||new Date(),MARKETS[market].timeZone),date=p.year+"-"+p.month+"-"+p.day;if(p.weekday!=="Sat"&&p.weekday!=="Sun")return date;var noon=new Date(date+"T12:00:00Z"),back=p.weekday==="Sat"?1:2;noon.setUTCDate(noon.getUTCDate()-back);return noon.toISOString().slice(0,10);}
  function compactDate(v){return String(v||"").replace(/-/g,"").slice(0,8);}
  function rowDate(row){var s=String(row&&row[0]||"");var d=compactDate(s);return d.length===8?d.slice(0,4)+"-"+d.slice(4,6)+"-"+d.slice(6,8):"";}
  function latestSession(rows){var dates=rows.map(rowDate).filter(Boolean).sort();return dates.length?dates[dates.length-1]:"";}
  function onlySession(rows,session){return rows.filter(function(r){return rowDate(r)===session;});}
  function sessionAxis(code,row){var market=marketOf(code),s=String(row&&row[0]||""),hh=Number(s.slice(8,10)),mm=Number(s.slice(10,12)),t=hh*60+mm;if(market==="HK"){if(t<=720)return{minute:Math.max(0,t-570),total:345};if(t<780)return{minute:150,total:345};return{minute:Math.min(345,165+t-780),total:345};}if(market==="CN"){if(t<=690)return{minute:Math.max(0,t-570),total:255};if(t<780)return{minute:120,total:255};return{minute:Math.min(255,135+t-780),total:255};}return{minute:Math.max(0,Math.min(390,t-570)),total:390};}
  function normalize(obj,period){var d=obj&&obj.data;if(!d)return[];var k=Object.keys(d)[0],x=d[k]||{};if(period==="m5"){if(Array.isArray(x.m5))return x.m5;var md=x.data||{},pts=md.data||[],date=compactDate(md.date),out=[],bucket=null,prevVol=0;pts.forEach(function(line,i){var p=String(line).split(" "),tm=p[0],price=Number(p[1]),cum=Number(p[2])||prevVol,vol=Math.max(0,cum-prevVol);prevVol=cum;if(!isFinite(price))return;if(!bucket||i%5===0){if(bucket)out.push(bucket);bucket=[date+tm,price,price,price,price,vol];}else{bucket[2]=price;bucket[3]=Math.max(bucket[3],price);bucket[4]=Math.min(bucket[4],price);bucket[5]+=vol;}});if(bucket)out.push(bucket);return out;}var a=x["qfq"+period]||x[period]||x["fq"+period]||[];return Array.isArray(a)?a:[];}
  function sanitizeIntraday(code,rows,now){var marketDate=tradingDate(code,now),dataSession=latestSession(rows);if(!dataSession)return{rows:[],marketDate:marketDate,session:""};/* Before a new session has published its first tick, never relabel or append the prior session. */return{rows:dataSession===marketDate?onlySession(rows,marketDate):[],marketDate:marketDate,session:dataSession};}
  function clearIntraday(code){Object.keys(intradayCache).forEach(function(k){if(!code||k.indexOf(String(code).toUpperCase()+"|")===0)delete intradayCache[k];});}
  function checkRollover(code,now){var market=marketOf(code),next=tradingDate(code,now),prev=lastDates[market];lastDates[market]=next;if(prev&&prev!==next){clearIntraday();listeners.slice().forEach(function(fn){fn({market:market,previous:prev,current:next});});return true;}return false;}
  function onTradingDayChange(fn){listeners.push(fn);return function(){listeners=listeners.filter(function(x){return x!==fn;});};}
  function minuteCacheKey(code,now){return String(code||"").toUpperCase()+"|m5|"+tradingDate(code,now);}
  function getIntradayCache(code,now,maxAge){checkRollover(code,now);var x=intradayCache[minuteCacheKey(code,now)];return x&&Date.now()-x.at<=(maxAge==null?25000:maxAge)?x.rows:null;}
  function setIntradayCache(code,rows,now){var clean=sanitizeIntraday(code,rows,now);intradayCache[minuteCacheKey(code,now)]={at:Date.now(),rows:clean.rows};return clean;}
  return{MARKETS:MARKETS,marketOf:marketOf,quoteCode:quoteCode,calendarDate:calendarDate,tradingDate:tradingDate,rowDate:rowDate,latestSession:latestSession,sessionAxis:sessionAxis,normalize:normalize,sanitizeIntraday:sanitizeIntraday,checkRollover:checkRollover,onTradingDayChange:onTradingDayChange,clearIntraday:clearIntraday,getIntradayCache:getIntradayCache,setIntradayCache:setIntradayCache};
});
