const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(file)]||'text/plain'}).end(b);});});
let base;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=process.env.PREVIEW_URL||'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(base+'/macro.html');await page.locator('.macro-kpi').first().waitFor();
 assert.equal(await page.locator('#macro-navigation>a').count(),3);
 assert.equal(await page.locator('#quick-indicator').inputValue(),'cn-cpi');
 for(const country of ['CN','US']){
  await page.locator('[data-country="'+country+'"]').click();
  for(const width of [1920,1440,1024,768,390]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);
   const geometry=await page.locator('.macro-kpi').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),v=e.querySelector('.macro-reading-row').getBoundingClientRect();return {w:r.width,h:r.height,top:v.top-r.top,overflow:e.scrollHeight>e.clientHeight+1,wide:e.scrollWidth>e.clientWidth+1};}));
   for(const k of ['w','h','top'])assert(Math.max(...geometry.map(r=>r[k]))-Math.min(...geometry.map(r=>r[k]))<=1,country+width+JSON.stringify(geometry));
   assert(geometry.every(r=>!r.overflow&&!r.wide),country+width+JSON.stringify(geometry));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+country+width);
   const svg=page.locator('#primary-chart svg');assert(await svg.count());assert(await svg.locator('.site-period-tick').count()>=2);
   if(process.env.MACRO_SCREENSHOT_DIR&&(width===1440||width===390)){fs.mkdirSync(process.env.MACRO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MACRO_SCREENSHOT_DIR,'core-'+country+'-'+width+'.png')});}
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-country=CN]').click();
 await page.selectOption('#quick-indicator','cn-ppi');assert.match(await page.locator('#metric-title').innerText(),/PPI/);
 await page.selectOption('#years','1');await page.reload();await page.locator('#quick-indicator').waitFor();assert.equal(await page.locator('#quick-indicator').inputValue(),'cn-ppi');assert.equal(await page.locator('#years').inputValue(),'1');
 await page.locator('#primary-chart [data-chart-point]').first().focus();assert(await page.locator('#primary-chart .research-tooltip').isVisible());
 let download=page.waitForEvent('download');await page.locator('#download').click();assert((await download).suggestedFilename().includes('cn-ppi'));
 await page.locator('[data-study=workspace]').click();await page.locator('#search').fill('社零');await page.waitForTimeout(300);assert.equal(await page.locator('#metric-list .macro-item').count(),1);
 await page.locator('#search').fill('不存在的指标');await page.waitForTimeout(300);assert(await page.locator('#download-latest').isDisabled());
 await page.locator('[data-macro-section=consumption]').click();await page.locator('.national-kpi').first().waitFor();
 assert.equal(await page.locator('#national-window').inputValue(),'12');assert.equal(await page.locator('#national-measure').inputValue(),'yoy');
 assert((await page.locator('#national-trend svg text').allTextContents()).some(t=>/^\d{2}M\d+$/.test(t)));
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'national overflow '+width);}
 await page.selectOption('#national-basis','ytd');await page.selectOption('#national-window','24');await page.selectOption('#national-measure','pp');assert.match(await page.locator('#national-category-unit').innerText(),/拉动/);
 download=page.waitForEvent('download');await page.locator('#national-download').click();assert((await download).suggestedFilename().endsWith('.csv'));
 await page.goto(base+'/regional-retail.html');await page.locator('.tier-card').first().waitFor();
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'regional overflow '+width);}
 await page.locator('[data-macro-section=forecasts]').click();await page.locator('.fedwatch-kpi').first().waitFor();
 assert.equal(await page.locator('[data-macro-section=forecasts]').getAttribute('aria-current'),'page');
 const vals=await page.locator('.fedwatch-kpi').evaluateAll(es=>es.map(e=>({v:parseFloat(e.querySelector('strong').textContent),primary:e.classList.contains('primary')})));
 assert(vals.filter(x=>x.primary).every(x=>x.v===Math.max(...vals.map(y=>y.v))));
 await page.locator('[data-view=predictions]').click();await page.locator('.pm-result').first().waitFor();
 assert.equal(await page.locator('[data-view=predictions]').getAttribute('aria-current'),'page');
 await page.selectOption('#prediction-event-select',{index:1});
 const probabilities=await page.locator('.pm-result').evaluateAll(es=>es.map(e=>({v:parseFloat(e.querySelector('strong').textContent),selected:e.getAttribute('aria-pressed')==='true'})));
 assert.equal(probabilities.find(x=>x.selected).v,Math.max(...probabilities.map(x=>x.v)));
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'predictions overflow '+width);}
 await page.locator('[data-prediction-event]').click();assert(await page.locator('#prediction-dialog').isVisible());await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('PASS macro workspace: navigation, CN/US five widths, query, chart, URL restore, CSV, retail basis, forecasts and mobile.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
