// Real local data. No synthetic values are written to production.
'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const D=require('../scripts/site-data.js'),H=require('../scripts/hotel-metrics.js');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.csv':'text/csv; charset=utf-8'})[path.extname(file)]||'text/plain'}).end(body);});
});
const monthlyRows=D.csv(fs.readFileSync(path.join(root,'data/dutyfree_monthly.csv'),'utf8')),monthlyByPeriod=new Map(monthlyRows.map(row=>[row.period_id,row]));
const monthlyMetrics={sales:['shopping_sales_cny_100m','亿元'],shoppers:['shoppers_10k','万人次'],items:['items_10k','万件'],spend:['spend_per_shopper_cny','元']};
function assertMonthlyReading(text,metric){
 const row=monthlyByPeriod.get(text.split('\n')[0].trim());assert.ok(row,'tooltip period exists in the monthly source');
 const [field,unit]=monthlyMetrics[metric],value=D.number(row[field]);assert.ok(Number.isFinite(value),'source observation is available');
 assert.ok(text.includes(new Intl.NumberFormat('zh-CN',{minimumFractionDigits:metric==='sales'?2:0,maximumFractionDigits:2}).format(value)+' '+unit),'tooltip matches the source value and unit');
}
async function pairedMode(page,host,mode){
 assert.equal(await page.locator(host+' .site-value-bar').count()>0,mode!=='change',host+' value series');
 assert.equal(await page.locator(host+' .site-change-line').count()>0,mode!=='value',host+' change series');
 assert.equal(await page.locator(host+' .site-axis-label').count(),mode==='combo'?2:1,host+' axes');
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(),base='http://127.0.0.1:'+server.address().port;
 try{
 const context=await browser.newContext({viewport:{width:1400,height:1100}});await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Dining now presents a data matrix, covered by dining.browser.cjs. Retired gold
 // and consumption links must reach a current, interactive chart workspace.
 const chartPages=['industry.html#dutyfree','industry.html#hotel','industry.html#gold','hotel-dashboard.html','dutyfree-dashboard.html','gold-jewelry.html#industry-panel','macro.html','macro.html?country=US&indicator=us-housing-starts','consumption-macro.html?indicator=retail'];
 for(const url of chartPages){
   console.log('Checking chart '+url);await page.goto(base+'/'+url,{waitUntil:'domcontentloaded'});
   if(url.startsWith('gold-jewelry.html'))await page.waitForURL(u=>u.pathname.endsWith('/industry.html')&&u.hash==='#gold'&&u.searchParams.get('goldView')==='demand');
   if(url.startsWith('consumption-macro.html'))await page.waitForURL(u=>u.pathname.endsWith('/macro.html')&&u.searchParams.get('view')==='indicators');
   const current=new URL(page.url()),requested=current.hash.slice(1),id=requested==='gold'?'hotel':requested,embedded=current.pathname.endsWith('/industry.html'),scope=embedded?page.frameLocator('#panel-'+id):page;
   if(embedded){await page.locator('#panel-'+id+'[data-state=ready]').waitFor();assert.equal(await page.locator('#sector-tabs [aria-pressed=true]').getAttribute('data-key'),id,url+' active sector');if(requested==='gold')assert.equal(await page.locator('#gold-content').isVisible(),false,url+' retired gold content');await page.waitForFunction(id=>{const f=document.getElementById('panel-'+id),m=f?.contentDocument?.querySelector('body > main,body > .wrap');return m&&Math.abs(f.offsetHeight-m.getBoundingClientRect().height-8)<3;},id);await page.waitForTimeout(500);}
   const svg=scope.locator('svg.site-interactive-chart:visible:not(.macro-spark)').first();await svg.waitFor({timeout:20000});await svg.scrollIntoViewIfNeeded();
   const box=await svg.boundingBox();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);
   const tooltip=scope.locator('.site-chart-tooltip:not([hidden])');await tooltip.waitFor();assert.ok((await tooltip.innerText()).trim().length>4,url+' exact value tooltip');assert.doesNotMatch(await tooltip.innerText(),/来源：|发布：|计算值|已固定|÷/,url+' concise tooltip');
   await svg.click();assert.equal(await tooltip.getAttribute('data-pinned'),'true',url+' pin');
   const pinned=await tooltip.innerText();await page.mouse.move(2,2);assert.equal(await tooltip.innerText(),pinned,url+' retained outside plot');
   await svg.press('End');await svg.press('Escape');assert.equal(await scope.locator('.site-chart-tooltip:not([hidden])').count(),0,url+' dismiss');
   await page.setViewportSize({width:390,height:900});await page.waitForTimeout(700);await svg.scrollIntoViewIfNeeded();await svg.click();await tooltip.waitFor();
   const bounds=await tooltip.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,url+' mobile tooltip bounds');
   await svg.press('Escape');await page.setViewportSize({width:1400,height:1100});await page.waitForTimeout(250);
 }
 
 // Three display modes remain available on the hotel chart. The macro workspace
 // uses an indicator-specific series, and monthly dutyfree keeps paired values/YoY.
 await page.goto(base+'/hotel-dashboard.html');await page.waitForSelector('#main-chart .site-paired-chart');assert.equal(await page.locator('#mode-switch [aria-pressed=true]').getAttribute('data-mode'),'combo');
 await pairedMode(page,'#main-chart','combo');
 for(const mode of ['value','change','combo']){await page.locator('#mode-switch [data-mode="'+mode+'"]').click();assert.equal(await page.locator('#mode-switch [aria-pressed=true]').getAttribute('data-mode'),mode);await pairedMode(page,'#main-chart',mode);}
 await page.locator('#metric-switch [data-metric=occupancy_rate]').click();assert.match(await page.locator('#main-chart .site-change-axis').first().textContent(),/百分点/);
 const hotelLatest=H.sorted(H.csv(fs.readFileSync(path.join(root,'data/hotel_industry_weekly.csv'),'utf8')).filter(r=>r.region==='全国'&&r.segment==='全部')).at(-1);
 await page.locator('#main-chart svg').press('End');const hotelReading=await page.locator('.site-chart-tooltip:not([hidden])').innerText();assert.ok(hotelReading.startsWith(H.weekLabel(hotelLatest.period_id)));assert.ok(hotelReading.includes(new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(H.metric(hotelLatest,'occupancy_rate')*100)+' %'));await page.keyboard.press('Escape');
 await page.goto(base+'/dutyfree-dashboard.html');await page.waitForSelector('#hn-growth .site-value-bar');
 for(const metric of Object.keys(monthlyMetrics)){await page.selectOption('#hn-metric',metric);await pairedMode(page,'#hn-growth','combo');await page.locator('#hn-growth').press('End');const reading=await page.locator('.site-chart-tooltip:not([hidden])').innerText();assert.ok(reading.startsWith(monthlyRows.at(-1).period_id),'keyboard End reaches the latest month');assertMonthlyReading(reading,metric);await page.keyboard.press('Escape');}
 console.log('PASS: '+chartPages.length+' current/legacy chart routes, hover, pin, keyboard, narrow-screen bounds, modes and source values');
 const touch=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true});await touch.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const phone=await touch.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base+'/dutyfree-dashboard.html');const chart=phone.locator('#hn-growth');await chart.waitFor();await phone.waitForSelector('#hn-growth.site-interactive-chart');await chart.tap();
 const touchTooltip=phone.locator('.site-chart-tooltip:not([hidden])');assert.equal(await touchTooltip.getAttribute('data-pinned'),'true');assertMonthlyReading(await touchTooltip.innerText(),'sales');assert.deepEqual(errors,[]);console.log('PASS: touch tap shows and pins actual monthly value');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});

