'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),M=require('../scripts/hotel-metrics.js');
const root=path.resolve(__dirname,'..'),industry=M.csv(fs.readFileSync(path.join(root,'data/hotel_industry_weekly.csv'),'utf8')),supply=M.csv(fs.readFileSync(path.join(root,'data/hotel_supply_weekly.csv'),'utf8'));
const tiers=['经济型','中档型','高档型','豪华型'],bands=['15-29间','30-69间','70-149间','150间及以上'];
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(f)]||'text/plain; charset=utf-8'}).end(b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{let charts;Object.defineProperty(window,'SiteCharts',{configurable:true,get:()=>charts,set(v){const original=v.drawPaired;v.drawPaired=function(host,rows,opt){if(host.id.startsWith('supply-')){window.supplyPlots=window.supplyPlots||{};window.supplyPlots[host.id]={rows:structuredClone(rows),opt:structuredClone(opt)};}return original.call(this,host,rows,opt);};charts=v;}});});
try{
await page.goto(base+'/hotel-dashboard.html#view=structure');
await page.waitForFunction(()=>window.supplyPlots?.['supply-band-chart']?.rows.at(-1).values.some(s=>s.value!==null));
assert.equal(await page.locator('#supply-window').inputValue(),'156');
async function verify(id,labels,rows,category,field){
 const p=await page.evaluate(id=>supplyPlots[id],id),last=p.rows.at(-1);assert.deepEqual(last.values.map(v=>v.name),labels);
 for(const [i,name]of labels.entries()){
  const r=rows.find(r=>r.region==='全国'&&r[category]===name&&r.period_id===last.period),prior=rows.find(b=>b.region==='全国'&&b[category]===name&&b.period_id===M.priorPeriod(r));
  assert.equal(last.values[i].value,M.metric(r,field));assert.equal(last.values[i].change,M.change(r,prior,field));
 }
 assert.equal(p.opt.precision,0);assert.equal(p.opt.periodFormat,'week-short');
}
await verify('supply-tier-chart',tiers,industry,'segment','room_count_15plus');
await verify('supply-band-chart',bands,supply,'room_band','room_count');
await page.selectOption('#supply-tier-metric','hotel_count_15plus');await verify('supply-tier-chart',tiers,industry,'segment','hotel_count_15plus');
await page.selectOption('#supply-metric','chain_room_count');await verify('supply-band-chart',bands,supply,'room_band','chain_room_count');
for(const mode of ['value','change','combo']){await page.locator('#mode-switch [data-mode='+mode+']').click();assert.equal(await page.evaluate(()=>supplyPlots['supply-tier-chart'].opt.mode),mode);assert.equal(await page.evaluate(()=>supplyPlots['supply-band-chart'].opt.mode),mode);}
await page.selectOption('#supply-window','13');assert.equal(await page.evaluate(()=>supplyPlots['supply-band-chart'].rows.length),13);
await page.reload();await page.waitForFunction(()=>window.supplyPlots?.['supply-band-chart']);assert.equal(await page.locator('#supply-window').inputValue(),'13');assert.equal(await page.locator('#supply-tier-metric').inputValue(),'hotel_count_15plus');
for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await page.locator('#supply-tier-chart svg').count());assert.ok(await page.locator('#supply-band-chart svg').count());}
for(const file of ['hotel-dashboard.html','hotel-groups.html','hotel-holiday-dashboard.html']){await page.goto(base+'/'+file);await page.locator('.hd-tabs').waitFor();assert.deepEqual((await page.locator('.hd-tabs').innerText()).trim().split(/\s+/),['经营概览','酒店供给','酒店集团','假期数据','饭店协会','城市对比']);}
assert.deepEqual(errors,[]);console.log('PASS: supply source values and yoy, metrics, modes, range persistence, responsive charts and navigation order');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
