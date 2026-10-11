'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv; charset=utf-8'}[path.extname(file)]||'text/plain'}).end(b);});});
const cases=[['consumption','consumption-macro.html','#kpis .board-stat'],['indicators','macro.html?view=indicators','#kpi-grid .board-stat'],['fedwatch','macro.html?view=fedwatch','.fedwatch-kpi'],['predictions','macro.html?view=predictions','.forecast-event']];
async function check(page,mobile){
 for(const card of await page.locator('.data-board .board-stat:visible').all()){
  const s=await card.evaluate(e=>{const s=getComputedStyle(e),v=getComputedStyle(e.querySelector('strong'));return{padding:s.padding,radius:s.borderRadius,bg:s.backgroundColor,image:s.backgroundImage,span:s.gridColumnStart,value:v.fontSize,weight:v.fontWeight,line:v.lineHeight,align:v.textAlign};});
  assert.deepEqual(s,{padding:mobile?'16px':'20px',radius:'12px',bg:'rgb(255, 255, 255)',image:'none',span:'auto',value:mobile?'28px':'32px',weight:'700',line:mobile?'38px':'42px',align:'left'});
 }
 for(const panel of await page.locator('.data-board .board-panel:not(.board-detail):visible').all()){
  const s=await panel.evaluate(e=>{const s=getComputedStyle(e);return{radius:s.borderRadius,bg:s.backgroundColor,padding:s.padding};});assert.deepEqual(s,{radius:'12px',bg:'rgb(255, 255, 255)',padding:'0px'});
 }
 for(const field of await page.locator('.data-board select:visible,.data-board input[type=date]:visible,.data-board input[type=search]:visible').all()){
  const s=await field.evaluate(e=>{const s=getComputedStyle(e);return{font:s.fontSize,radius:s.borderRadius,height:e.offsetHeight};});assert.equal(s.font,'14px');assert.equal(s.radius,'8px');assert.ok(s.height>=40);
 }
 for(const title of await page.locator('.board-section-head h2:visible,.board-panel-head h2:visible,.board-panel-head h3:visible,.board-panel-body h3:visible').all()){
  assert.deepEqual(await title.evaluate(e=>{const s=getComputedStyle(e);return{font:s.fontSize,line:s.lineHeight,weight:s.fontWeight};}),{font:'18px',line:'28px',weight:'600'});
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile/page overflow');
 assert.equal(await page.locator('.data-board [hidden]:visible').count(),0,'hidden data remains hidden');
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.MACRO_DESIGN_BASE_URL||'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.MACRO_DESIGN_PREVIEW==='1')await page.route(base+'/**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace('/guojin-shangshe-database/',''),file=path.join(root,rel);if(!fs.existsSync(file))return route.continue();return route.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'}[path.extname(file)]||'text/plain'});});
 const offsets=[];
 try{
  for(const [name,url,ready] of cases){
   await page.setViewportSize({width:1440,height:1100});await page.goto(base+'/'+url);await page.locator(ready).first().waitFor({timeout:45000});await check(page,false);
   offsets.push(await page.locator('.data-board .site-subnav').first().evaluate(e=>e.getBoundingClientRect().top));
   if(name==='indicators'){await page.locator('#countries [data-country=US]').click();await check(page,false);await page.locator('#countries [data-country=CN]').click();assert.ok(await page.locator('.morning-chart svg').count());}
   if(name==='consumption'){await page.locator('#indicator').selectOption('cpi');await page.locator('#measure').selectOption('value');await page.locator('#chart svg').waitFor();await check(page,false);}
   if(name==='fedwatch'){await page.locator('.board-detail').last().evaluate(e=>e.open=true);assert.ok(await page.locator('#fedwatch .board-table tbody tr').count());}
   if(name==='predictions'){assert.ok(await page.locator('#prediction-topics').evaluate(e=>e.classList.contains('site-subnav')));await page.locator('#prediction-topics [data-topic=""]').click();await check(page,false);}
   if(process.env.SITE_SCREENSHOT_DIR){fs.mkdirSync(process.env.SITE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SITE_SCREENSHOT_DIR,name+'-macro-desktop.png')});}
   await page.setViewportSize({width:390,height:900});await page.waitForTimeout(500);await check(page,true);
   if(process.env.SITE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SITE_SCREENSHOT_DIR,name+'-macro-mobile.png')});
   console.log('PASS shared macro content, controls and mobile:',name);
  }
  assert.ok(Math.max(...offsets)-Math.min(...offsets)<=2,'macro header/navigation alignment: '+offsets);assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});

