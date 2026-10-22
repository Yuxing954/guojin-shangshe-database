'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.argv[2]||'http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true}),errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 if(process.env.AXIS_PREVIEW_ROOT){const overrides=JSON.parse(fs.readFileSync(path.join(root,'.axis-files.json'),'utf8'));await context.route(base+'/**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(new URL(base).pathname.replace(/\/$/,'')+'/','');if(!overrides.includes(rel))return route.continue();return route.fulfill({body:fs.readFileSync(path.join(root,rel)),contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json'})[path.extname(rel)]||'text/plain'});});}
 await context.addInitScript(()=>{let api;Object.defineProperty(window,'ChartPeriod',{configurable:true,get:()=>api,set(value){const format=value.format;value.format=input=>{const output=format(input);(window.axisDateCalls||=[]).push({input,output});return output;};api=value;}});});
 const p=await context.newPage(),types={monthly:/^\d{2}M(?:[1-9]|1[0-2])(?:–\d{1,2})?$/,quarter:/^\d{2}Q[1-4]$/,weekly:/^\d{2}W\d{2}$/,daily:/^\d{2}\/\d{1,2}\/\d{1,2}$/};
 const cases=[
 ['dutyfree-dashboard.html#monthly','monthly'],['dutyfree-dashboard.html#korea','monthly'],
 ['hotel-dashboard.html#view=overview','weekly'],['hotel-dashboard.html#view=structure','weekly'],
 ['hotel-groups.html#view=groups&type=weekly','weekly'],['company-database.html?company=atour&tab=operating','quarter'],
 ['domestic-hotel-comparison.html','quarter'],['overseas-hotels.html?company=marriott&tab=operating','quarter'],
 ['overseas-hotel-comparison.html','quarter'],['regional-retail.html','monthly'],
 ['macro.html?view=indicators','quarter'],['cruise-dashboard.html','monthly']

 ];
 for(const [url,type]of cases.slice(Number(process.env.AXIS_CASE_START||0))){await p.goto(base+'/'+url,{waitUntil:'domcontentloaded'});await p.locator('.site-period-tick:visible').first().waitFor({state:'attached',timeout:45000});await p.waitForFunction(()=>[...document.querySelectorAll('.site-period-tick')].filter(e=>e.getBoundingClientRect().width>0).length>1);const labels=await p.locator('.site-period-tick:visible').allTextContents();assert(labels.some(t=>types[type].test(t)),url+' '+JSON.stringify(labels));assert(labels.every(t=>!/^\d{4}(?:[-/年QW]|$)/.test(t)&&!/^\d{2}-\d{2}$/.test(t)&&!/^\d{2}M0\d/.test(t)),url+' long/mixed date');console.log('PASS axis '+url+' '+labels.slice(-4).join(','));if(url.startsWith('regional-retail'))assert.deepEqual(await p.evaluate(()=>[RegionalRetailCharts.axisLabel({period:'2026-09'},'quarterly'),RegionalRetailCharts.axisLabel({period:'2026-09'},'monthly')]),['26Q3','26M9']);
  if(url.startsWith('dutyfree-dashboard.html#monthly')){await p.locator('#hn-growth').focus();await p.keyboard.press('End');assert.match(await p.locator('.site-chart-tooltip:not([hidden])').innerText(),/20\d{2}-\d{2}/);await p.keyboard.press('Escape');}
 }
 for(const [url,type]of [['cpi-monthly-product.html','monthly'],['retail-monthly-product.html','monthly'],['hotel-weekly-product.html','weekly']]){
  await p.goto(base+'/'+url);await p.waitForFunction(()=>window.axisDateCalls?.length>0&&document.querySelector('canvas')?.height>1000,null,{timeout:45000});
  const calls=await p.evaluate(()=>axisDateCalls);assert(calls.some(c=>types[type].test(c.output)),url);assert(calls.every(c=>c.output===ChartPeriodExpected(c.output)),url+' canonical');
  const count=calls.length,download=p.waitForEvent('download');await p.locator('#export').click();await download;assert((await p.evaluate(()=>axisDateCalls.length))>count,url+' export uses formatter');console.log('PASS canvas and export '+url);
 }
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/tencent-charts-20261009.json'),'utf8'));
 await context.route('https://qt.gtimg.cn/**',route=>{const url=new URL(route.request().url()),codes=(url.searchParams.get('q')||decodeURIComponent(url.pathname.slice(3)).split('&')[0]).split(','),body=codes.map((code,i)=>{const f=Array(50).fill('');f[1]='TEST ONLY';f[2]=code.slice(2);f[3]='100';f[4]='100';f[5]='100';f[30]='20261009100000';f[31]='0';f[32]='0';f[33]='105';f[34]='95';return 'var v_'+code+'='+JSON.stringify(f.join('~'))+';';}).join('\n');return route.fulfill({contentType:'application/javascript',body});});
 await context.route('https://web.ifzq.gtimg.cn/**',route=>{const url=new URL(route.request().url()),[code,mode]=url.searchParams.get('param').split(','),callback=url.searchParams.get('_var'),fixture=fixtures.find(f=>f.label==='hk_native_'+(mode==='week'?'week':'day')),series=fixture.response.data[fixture.symbol];return route.fulfill({contentType:'application/javascript',body:'var '+callback+'='+JSON.stringify({code:0,data:{[code]:series}})+';'});});
 await p.goto(base+'/quotes.html?symbol=601888.SH&period=day');await p.locator('#chart .site-period-tick').first().waitFor();const quotes=await p.locator('#chart .site-period-tick').allTextContents();assert(quotes.every(t=>types.daily.test(t)),JSON.stringify(quotes));assert.match(await p.locator('#chart-detail').innerText(),/20\d{2}-\d{2}-\d{2}/);console.log('PASS daily K-line axis with recorded Tencent fixture; original readout dates retained');
 assert.deepEqual(errors,[]);console.log('PASS all chart date axes, original tooltips and product PNG exports');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
function ChartPeriodExpected(value){return require('../scripts/chart-period.js').format(value);}
