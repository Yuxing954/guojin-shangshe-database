// Real local data. No synthetic values are written to production.
'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function stableScroll(locator){for(let attempt=0;attempt<3;attempt++){try{await locator.scrollIntoViewIfNeeded();return;}catch(error){if(!/not attached|detached/.test(error.message))throw error;await new Promise(resolve=>setTimeout(resolve,150));}}throw Error('Chart continued replacing its SVG after layout');}
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.csv':'text/csv; charset=utf-8'})[path.extname(file)]||'text/plain'}).end(body);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),base='http://127.0.0.1:'+server.address().port;
 try{
 const context=await browser.newContext({viewport:{width:1400,height:1100}});await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const url of ['industry.html#dutyfree','industry.html#hotel','hotel-dashboard.html','dutyfree-dashboard.html','macro.html','travel-dashboard.html','cruise-dashboard.html','regional-retail.html']){
   console.log('Checking chart '+url);await page.goto(base+'/'+url,{waitUntil:'domcontentloaded'});
   const id=url.split('#')[1],scope=url.startsWith('industry.html#')&&['hotel','dutyfree','dining'].includes(id)?page.frameLocator('#panel-'+id):page;
   if(scope!==page){await page.waitForFunction(id=>{const f=document.getElementById('panel-'+id),m=f?.contentDocument?.querySelector('body > main,body > .wrap');return m&&Math.abs(f.offsetHeight-m.getBoundingClientRect().height-8)<3;},id);await page.waitForTimeout(500);}
   const svg=scope.locator('svg.site-interactive-chart:visible:not(.macro-spark)').first();await svg.waitFor({timeout:20000});await page.waitForTimeout(350);await stableScroll(svg);await page.waitForTimeout(200);
   const box=await svg.boundingBox();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);
   const tooltip=scope.locator('.site-chart-tooltip:not([hidden])');await tooltip.waitFor();assert.ok((await tooltip.innerText()).trim().length>4,url+' exact value tooltip');assert.doesNotMatch(await tooltip.innerText(),/来源：|发布：|计算值|已固定|÷/,url+' concise tooltip');
   await svg.click();assert.equal(await tooltip.getAttribute('data-pinned'),'true',url+' pin');
   const pinned=await tooltip.innerText();await page.mouse.move(2,2);assert.equal(await tooltip.innerText(),pinned,url+' retained outside plot');
   await svg.press('End');await svg.press('Escape');assert.equal(await scope.locator('.site-chart-tooltip:not([hidden])').count(),0,url+' dismiss');
   await page.setViewportSize({width:390,height:900});await page.waitForTimeout(700);await stableScroll(svg);await svg.click();await tooltip.waitFor();
   const bounds=await tooltip.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,url+' mobile tooltip bounds');
   await svg.press('Escape');await page.setViewportSize({width:1400,height:1100});await page.waitForTimeout(250);
 }
 

 // Existing hotel mode controls and dutyfree independent value/change controls.
 await page.goto(base+'/hotel-dashboard.html');await page.waitForSelector('#main-chart .site-paired-chart');assert.equal(await page.locator('#mode-switch [aria-pressed=true]').getAttribute('data-mode'),'combo');
 await page.locator('#metric-switch [data-metric=occupancy_rate]').click();assert.match(await page.locator('#main-chart .site-change-axis').first().textContent(),/百分点/);
 for(const mode of ['value','change','combo']){await page.locator('#mode-switch [data-mode="'+mode+'"]').click();assert.equal(await page.locator('#main-chart .site-value-bar').count()>0,mode!=='change');assert.equal(await page.locator('#main-chart .site-change-line').count()>0,mode!=='value');}
 await page.goto(base+'/dutyfree-dashboard.html');await page.waitForSelector('#hn-growth .site-value-bar');const value=page.locator('[data-chart-value-controls] input').first(),change=page.locator('[data-chart-value-controls] input').nth(1);assert.ok(await value.isChecked());assert.ok(await change.isChecked());await value.uncheck();assert.equal(await page.locator('#hn-growth .site-value-label[data-kind=value]').count(),0);await value.check();await change.uncheck();assert.equal(await page.locator('#hn-growth .site-value-label[data-kind=change]').count(),0);await change.check();
 assert.deepEqual(errors,[]);console.log('PASS: active chart pages, whole-area hover, pinned click, leave, keyboard and narrow-screen bounds');
 const touch=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true});await touch.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const phone=await touch.newPage();await phone.goto(base+'/dutyfree-dashboard.html');const chart=phone.locator('#hn-growth');await chart.waitFor();await phone.waitForSelector('#hn-growth.site-interactive-chart');await chart.tap();
 assert.equal(await phone.locator('.site-chart-tooltip:not([hidden])').getAttribute('data-pinned'),'true');console.log('PASS: touch tap shows and pins actual monthly value');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});


