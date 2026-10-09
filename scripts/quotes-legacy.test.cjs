const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../database.html','utf8');
test('all legacy inline scripts compile after refresh changes',()=>{for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){if(match[1].trim())new vm.Script(match[1]);}});
test('legacy stored heatmap discards untimestamped entries and persists source time instead of redraw time',()=>{
  let saved=JSON.stringify({'600519.SH':{price:'100',pct:1,asOf:'2026-10-09 10:00:00'},'000001.SZ':{price:'20',pct:2,time:999}});
  const host={dataset:{},innerHTML:''},count={};const el={getAttribute:()=> '600519.SH',querySelector:k=>({textContent:k==='.chg'?'1':'100'})};
  const ctx={localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v},document:{getElementById:k=>k==='coverage-list'?host:count,querySelectorAll:()=>[el]},rows:[{'证券代码':'600519.SH','公司名称':'一'},{'证券代码':'000001.SZ','公司名称':'二'}],esc:String,pctText:String,codeKey:String};ctx.window=ctx;ctx.__MARKET_QUOTE_CACHE__={'600519.SH':{asOf:'2026-10-09 10:00:00'}};vm.createContext(ctx);
  vm.runInContext(html.slice(html.indexOf('function savedQuotes(){'),html.indexOf('function renderSectors(){')),ctx);ctx.renderHeat();assert.match(host.innerHTML,/来源报价时间：2026-10-09 10:00:00/);assert.doesNotMatch(host.innerHTML,/>20</);
  const start=html.indexOf('function persist(){var q={}');vm.runInContext(html.slice(start,html.indexOf('function sync(){',start)),ctx);ctx.persist();const record=JSON.parse(saved)['600519.SH'];assert.equal(record.asOf,'2026-10-09 10:00:00');assert.equal(record.time,undefined);
});
test('legacy quote transport only runs for visible active tools; source timestamp survives repeats',async()=>{
  let time=0,id=0;const scripts=[],events={},intervals=new Map(),nodes=new Map();const element={getAttribute:()=> '600519.SH',querySelector:()=>null,classList:{contains:()=>false}};
  const node=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',style:{},dataset:{}});return nodes.get(k);};
  const doc={hidden:false,getElementById:node,querySelector:()=>null,querySelectorAll:()=>[element],addEventListener:(k,fn)=>events[k]=fn,createElement:()=>({remove(){this.removed=true;}}),head:{appendChild:s=>scripts.push(s)}};
  class Clock extends Date {static now(){return time;}}
  const ctx={document:doc,Date:Clock,Intl,AbortController,console,location:{hash:'#sec-f'},MutationObserver:class{observe(){}},fetch:async()=>({json:async()=>({})}),setTimeout:()=>++id,clearTimeout(){},setInterval:(fn,ms)=>{assert.equal(ms,1000);intervals.set(++id,fn);return id;},clearInterval:id=>intervals.delete(id),addEventListener:(k,fn)=>events[k]=fn,QuotesModel:require('./quotes-model.js')};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/quotes-poller.js','utf8'),ctx);
  const main=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('var marketQuoteCache='))[1];vm.runInContext(main,ctx);const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};await settle();assert.equal(scripts.length,0);
  ctx.location.hash='#consumer-focus';events.hashchange();await settle();assert.equal(scripts.length,1);const f=Array(50).fill('');f[3]='100';f[30]='20261009100000';f[32]='1';ctx.v_sh600519=f.join('~');scripts[0].onload();await settle();assert.equal(ctx.__MARKET_QUOTE_CACHE__['600519.SH'].asOf,'2026-10-09 10:00:00');assert.match(element.title,/10:00:00/);
  time=1000;await ctx.refreshTencentMarket();assert.equal(scripts.length,1);time=15000;ctx.refreshTencentMarket();await settle();assert.equal(scripts.length,2);doc.hidden=true;events.visibilitychange();await settle();assert.equal(intervals.size,0);assert.equal(scripts[1].removed,true);
  doc.hidden=false;ctx.location.hash='#sec-gold';events.hashchange();time=60000;await ctx.refreshTencentMarket();assert.equal(scripts.length,2);ctx.location.hash='#consumer-focus';events.hashchange();await settle();assert.equal(scripts.length,3);events.pagehide();await settle();assert.equal(intervals.size,0);assert.equal(scripts[2].removed,true);
});
