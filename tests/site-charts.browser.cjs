// Real local data. No synthetic values are written to production.
'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.csv':'text/csv; charset=utf-8'})[path.extname(file)]||'text/plain'}).end(body);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(),base='http://127.0.0.1:'+server.address().port;
 try{
 const context=await browser.newContext({viewport:{width:1400,height:1100}});await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const url of ['industry.html#dutyfree','industry.html#hotel','industry.html#gold','industry.html#overseas','industry.html#dining','hotel-dashboard.html','dutyfree-dashboard.html','gold-jewelry.html','macro.html','consumption-macro.html','dining.html','overseas.html']){
   console.log('Checking chart '+url);await page.goto(base+'/'+url,{waitUntil:'domcontentloaded'});
   const svg=page.locator('svg.site-interactive-chart:visible:not(.macro-spark)').first();await svg.waitFor({timeout:20000});await svg.scrollIntoViewIfNeeded();
   const box=await svg.boundingBox();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);
   const tooltip=page.locator('.site-chart-tooltip:not([hidden])');await tooltip.waitFor();assert.ok((await tooltip.innerText()).trim().length>4,url+' exact value tooltip');assert.doesNotMatch(await tooltip.innerText(),/来源：|发布：|计算值|已固定|÷/,url+' concise tooltip');
   await svg.click();assert.equal(await tooltip.getAttribute('data-pinned'),'true',url+' pin');
   const pinned=await tooltip.innerText();await page.mouse.move(2,2);assert.equal(await tooltip.innerText(),pinned,url+' retained outside plot');
   await svg.press('End');await svg.press('Escape');assert.equal(await page.locator('.site-chart-tooltip:not([hidden])').count(),0,url+' dismiss');
   await page.setViewportSize({width:390,height:900});await page.waitForTimeout(250);await svg.scrollIntoViewIfNeeded();await svg.click();
   const bounds=await tooltip.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,url+' mobile tooltip bounds');
   await svg.press('Escape');await page.setViewportSize({width:1400,height:1100});await page.waitForTimeout(250);
 }
 
 // Default paired charts and all three selections use real repository data.
 for(const [url,control,host] of [
 ['industry.html#dutyfree','#chart-mode','#chart'],
 ['consumption-macro.html?indicator=retail','#measure','#chart'],
 ['macro.html?country=US&indicator=us-housing-starts','#mode','#primary-chart'],
 ['dining.html','#sector-chart-mode','#chart'],
 ['overseas.html','#sector-chart-mode','#chart']]){
  await page.goto(base+'/'+url);await page.waitForSelector(host+' svg.site-paired-chart');
  assert.equal(await page.locator(control).inputValue(),'combo',url+' default combo');
  assert.ok(await page.locator(host+' .site-value-bar').count()>0,url+' values');
  assert.ok(await page.locator(host+' .site-change-line').count()>0,url+' YoY');
  assert.equal(await page.locator(host+' .site-axis-label').count(),2,url+' dual axes');
  await page.locator(control).selectOption('value');assert.equal(await page.locator(host+' .site-change-line').count(),0);
  await page.locator(control).selectOption(control==='#measure'||control==='#mode'?'yoy':'change');assert.equal(await page.locator(host+' .site-value-bar').count(),0);
 }
 await page.goto(base+'/hotel-dashboard.html');await page.waitForSelector('#main-chart .site-paired-chart');assert.equal(await page.locator('#mode-switch [aria-pressed=true]').getAttribute('data-mode'),'combo');
 await page.locator('#metric-switch [data-metric=occupancy_rate]').click();assert.match(await page.locator('#main-chart .site-change-axis').first().textContent(),/百分点/);
 await page.goto(base+'/gold-jewelry.html');await page.locator('[data-view=demand]').click();await page.waitForSelector('#retail-chart .site-paired-chart');assert.ok(await page.locator('#volume-chart .site-paired-chart').count()>0);
 assert.deepEqual(errors,[]);console.log('PASS: 12 chart pages, whole-area hover, pinned click, leave, keyboard and narrow-screen bounds');
 const touch=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true});await touch.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const phone=await touch.newPage();await phone.goto(base+'/dutyfree-dashboard.html');const chart=phone.locator('#hn-growth');await chart.waitFor();await phone.waitForSelector('#hn-growth.site-interactive-chart');await chart.tap();
 assert.equal(await phone.locator('.site-chart-tooltip:not([hidden])').getAttribute('data-pinned'),'true');console.log('PASS: touch tap shows and pins actual monthly value');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
