'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv; charset=utf-8'})[path.extname(p)]||'text/plain');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
(async()=>{
 const M=require('../scripts/dutyfree-monthly-model.js');
 // Use the source CSV parser shipped in the page, including quoted Choice URLs.
 const html=fs.readFileSync(path.join(root,'dutyfree-dashboard.html'),'utf8'),parser=html.match(/function csv\(t\)\{[\s\S]*?\nconst N=/)[0].replace(/\nconst N=$/,'');
 const csv=new Function(parser+';return csv;')(),data=M.derive(csv(fs.readFileSync(path.join(root,'data/dutyfree_monthly.csv'),'utf8'))),last=data.at(-1);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const executable=process.env.BROWSER_PATH||process.env.EDGE_PATH;
 const browser=await chromium.launch({headless:true,...(executable&&fs.existsSync(executable)?{executablePath:executable}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/dutyfree-dashboard.html');await page.waitForFunction(p=>document.querySelector('#hn-period').textContent===p,last.period_id);
  const num=selector=>page.locator(selector).innerText().then(s=>Number(s.replace(/,/g,'')));
  assert.equal(await num('#hn-sales'),Number(Number(last.shopping_sales_cny_100m).toFixed(2)));assert.equal(await num('#hn-shoppers'),Number(Number(last.shoppers_10k).toFixed(2)));assert.equal(await num('#hn-spend'),Math.round(Number(last.spend_per_shopper_cny)));
  assert.equal(await page.locator('#hn-growth').getAttribute('data-chart-ready'),'true');
  await page.waitForFunction(()=>typeof document.querySelector('#hn-range').onchange==='function');await page.locator('#hn-range').selectOption('9999');await page.waitForFunction(n=>document.querySelectorAll('#hn-table tbody tr').length===n,data.length);await page.locator('#view-monthly .monthly-details summary').click();assert.equal(await page.locator('#hn-table tbody tr').count(),data.length);
  const download=page.waitForEvent('download');await page.locator('#monthly-download').click();const exported=csv(fs.readFileSync(await(await download).path(),'utf8'));assert.equal(exported.length,data.length);assert.equal(exported.at(-1).period_id,last.period_id);assert.equal(exported.at(-1).shopping_sales_cny_100m,last.shopping_sales_cny_100m);assert.ok(exported.at(-1).source.includes('Choice'));
  await page.locator('#view-monthly .controls button').first().click();assert.match(await page.locator('#srcbox').innerText(),/Choice/);await page.locator('#srcbox .closebtn button').click();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({period:last.period_id,rows:data.length,chart:true,csv:true,source:true,responsive:true,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
