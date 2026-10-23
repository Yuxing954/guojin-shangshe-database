'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv; charset=utf-8'}[path.extname(file)]||'text/plain'}).end(b);});});
const cases=[['hotel','.hd-tabs','#core-kpis .board-stat'],['dutyfree','#tabs','.board-stat']];
async function styles(scope,mobile){
 const cards=scope.locator('.board-stat:visible');
 for(const card of await cards.all()){
  const s=await card.evaluate(e=>{const s=getComputedStyle(e),v=e.querySelector('.hd-stat-value,.gj-stat-value,strong'),label=e.querySelector('.hd-stat-label,.gj-stat-label,:scope > span'),vs=getComputedStyle(v);return{radius:s.borderRadius,bg:s.backgroundImage,color:s.backgroundColor,padding:s.padding,line:s.lineHeight,label:getComputedStyle(label).fontSize,font:vs.fontSize,valueLine:vs.lineHeight,weight:vs.fontWeight,align:vs.textAlign,span:getComputedStyle(e).gridColumnStart,nested:e.querySelectorAll('.board-stat').length};});
  assert.equal(s.radius,'12px');assert.equal(s.bg,'none');assert.equal(s.color,'rgb(255, 255, 255)');assert.equal(s.padding,'16px');assert.equal(s.label,'13px');assert.equal(s.font,mobile?'24px':'28px');assert.equal(s.valueLine,mobile?'34px':'38px');assert.equal(s.weight,'700');assert.equal(s.align,'left');assert.equal(s.span,'auto');assert.equal(s.nested,0);
 }
 for(const panel of await scope.locator('.industry-board .board-panel:not(.board-detail):visible').all()){
  const s=await panel.evaluate(e=>{const s=getComputedStyle(e);return{radius:s.borderRadius,padding:s.padding,bg:s.backgroundColor,border:s.borderTopWidth}});assert.equal(s.radius,'12px');assert.equal(s.padding,'0px');assert.equal(s.bg,'rgb(255, 255, 255)');assert.equal(s.border,'1px');
 }
 for(const head of await scope.locator('.board-panel-head h2:visible,.board-panel-head h3:visible,.board-section-head h2:visible').all()){
  const s=await head.evaluate(e=>{const s=getComputedStyle(e);return{font:s.fontSize,weight:s.fontWeight,line:s.lineHeight}});assert.deepEqual(s,{font:'16px',weight:'600',line:'24px'});
 }
 for(const field of await scope.locator('.industry-board select:visible,.industry-board input[type=date]:visible,.industry-board input[type=search]:visible').all()){
  const s=await field.evaluate(e=>{const s=getComputedStyle(e);return{font:s.fontSize,radius:s.borderRadius,height:e.offsetHeight}});assert.equal(s.font,'14px');assert.equal(s.radius,'8px');assert.ok(s.height>=40);
 }
 assert.ok(await scope.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'board overflow');
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.INDUSTRY_DESIGN_BASE_URL||'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(process.env.INDUSTRY_DESIGN_PREVIEW==='1')await page.route(base+'/**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace('/guojin-shangshe-database/',''),file=path.join(root,rel);if(!fs.existsSync(file))return route.continue();return route.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'}[path.extname(file)]||'text/plain'});});
 const stamps=[];
 try{
  for(const [sid,nav,ready] of cases){
   await page.setViewportSize({width:1440,height:1100});await page.goto(base+'/industry.html#'+sid);
   const scope=sid==='gold'?page:page.frameLocator('#panel-'+sid);await scope.locator(ready).first().waitFor({state:'visible',timeout:45000});
   if(sid==='dutyfree')await scope.locator('#hn-sales').filter({hasText:/\d/}).waitFor({timeout:45000});
   await styles(scope,false);await page.waitForTimeout(300);
   const offset=sid==='gold'?0:await page.locator('#panel-'+sid).evaluate(e=>e.getBoundingClientRect().top);
   if(nav)stamps.push(offset+await scope.locator(nav).evaluate(e=>e.getBoundingClientRect().top));
   if(process.env.SITE_SCREENSHOT_DIR){fs.mkdirSync(process.env.SITE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SITE_SCREENSHOT_DIR,sid+'-content-desktop.png')});}
   await page.setViewportSize({width:390,height:900});await page.waitForTimeout(500);await styles(scope,true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'parent overflow');
   if(process.env.SITE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SITE_SCREENSHOT_DIR,sid+'-content-mobile.png')});
   await page.setViewportSize({width:1440,height:1100});
   for(const tab of await scope.locator(nav?nav+' > button':'.no-view-tabs').all()){
    await tab.click();await page.waitForTimeout(200);await styles(scope,false);
    if(sid!=='gold')await page.waitForFunction(sid=>{const f=document.getElementById('panel-'+sid),main=f.contentDocument.querySelector('body > main,body > .wrap');return Math.abs(f.offsetHeight-main.getBoundingClientRect().height-8)<3},sid);
   }
   console.log('PASS shared industry content, all views and mobile:',sid);
  }
  assert.ok(Math.max(...stamps)-Math.min(...stamps)<=2,'metadata/navigation spacing differs: '+stamps);
  await page.goto(base+'/industry.html?panelView=view%3Dcities%26week%3D2025W01#hotel');
  await page.frameLocator('#panel-hotel').locator('#core-kpis .board-stat').first().waitFor({timeout:45000});
  assert.equal(await page.frameLocator('#panel-hotel').locator('.hd-header').count(),0);
  assert.equal(await page.frameLocator('#panel-hotel').locator('[data-view=overview]').getAttribute('aria-pressed'),'true');
  await page.goto(base+'/industry.html?panelSector=hotel&panelView=view%3Dcities#dutyfree');
  await page.frameLocator('#panel-dutyfree').locator('#hn-sales').filter({hasText:/\d/}).waitFor({timeout:45000});
  assert.equal(await page.frameLocator('#panel-dutyfree').locator('.hero,.crumbs').count(),0);
  assert.equal(await page.frameLocator('#panel-dutyfree').locator('#view-monthly').isVisible(),true);
  assert.match(await page.frameLocator('#panel-dutyfree').locator('#hn-metric').innerText(),/购物人次（万人次）/);
  let releaseEmbed;
  const embedGate=new Promise(resolve=>releaseEmbed=resolve);
  await page.route('**/scripts/industry-embed.js*',async route=>{await embedGate;await route.continue();});
  await page.goto(base+'/industry.html#hotel',{waitUntil:'domcontentloaded'});
  const loading=page.frameLocator('#panel-hotel');
  await loading.locator('body').waitFor({state:'attached',timeout:45000});
  assert.equal(await loading.locator('body').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  assert.equal(await loading.locator('html').evaluate(e=>e.classList.contains('industry-embedding')),true);
  releaseEmbed();
  await loading.locator('#core-kpis .board-stat').first().waitFor({state:'visible',timeout:45000});
  assert.equal(await loading.locator('.hd-header').count(),0);
  assert.equal(await loading.locator('body').evaluate(e=>getComputedStyle(e).visibility),'visible');
  await page.unroute('**/scripts/industry-embed.js*');
  await page.goto(base+'/hotel-dashboard.html');
  await page.locator('.hd-header').waitFor({state:'visible',timeout:45000});
  assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('industry-embedding')),false);
  assert.deepEqual(errors,[]);console.log('PASS industry cards, panels, typography, filters, metadata and iframe sizing');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});


