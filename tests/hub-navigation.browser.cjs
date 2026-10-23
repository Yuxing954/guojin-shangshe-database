'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=require('node:http').createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(file)]||'text/plain'}).end(b);});});
const files=['macro.html','regional-retail.html','industry.html','scripts/macro-design.css','scripts/hub-navigation.css','scripts/regional-retail.css','scripts/site-shell.js'];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.HUB_BASE_URL||'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const context=await browser.newContext();
 if(process.env.HUB_OVERLAY==='1')for(const file of files)await context.route(base+'/'+file+'*',r=>r.fulfill({path:path.join(root,file),contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript'}));
 const page=await context.newPage();
 const read=()=>page.locator('.hub-navigation').evaluate(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e),active=e.querySelector('[aria-current=page],[aria-pressed=true]');return {x:b.x,y:b.y,w:b.width,h:b.height,color:getComputedStyle(active).color,line:getComputedStyle(active).borderBottomColor,bg:getComputedStyle(document.body).backgroundColor,aside:document.querySelectorAll('body>.site-nav').length,items:[...e.children].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,font:getComputedStyle(n).fontSize};})};});
 try{
 for(const width of [1920,1440,1024,768,390]){
  await page.setViewportSize({width,height:1000});let baseline;
  for(const file of ['macro.html','regional-retail.html','industry.html']){
   // The static shell must have exactly the same geometry before deferred scripts execute.
   await page.route('**/scripts/site-shell.js*',async r=>{await new Promise(resolve=>setTimeout(resolve,600));await r.fallback();});
   await page.goto(base+'/'+file,{waitUntil:'commit'});await page.locator('.hub-navigation').waitFor();const early=await read();await page.waitForLoadState('load');const ready=await read();await page.unroute('**/scripts/site-shell.js*');
   assert.deepEqual(ready,early,file+' initial layout shift');assert.equal(ready.aside,1);assert.equal(ready.color,'rgb(77, 88, 164)');assert.equal(ready.line,ready.color);assert.equal(ready.bg,'rgb(245, 247, 251)');
   const geometry=({x,y,w,h,color,line,bg})=>({x,y,w,h,color,line,bg});if(!baseline)baseline=geometry(ready);else assert.deepEqual(geometry(ready),baseline,file+' position/color');
   assert.ok(ready.items.every(b=>Math.abs(b.h-ready.h)<1&&b.x>=ready.x-1&&b.x+b.w<=ready.x+ready.w+1));assert.ok(Math.max(...ready.items.map(b=>b.w))-Math.min(...ready.items.map(b=>b.w))<1);
   if(process.env.HUB_SCREENSHOT_DIR&&[1440,390].includes(width)){fs.mkdirSync(process.env.HUB_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.HUB_SCREENSHOT_DIR,file.replace('.html','')+'-'+width+'.png')});}
   if(file==='industry.html')for(const key of ['dutyfree','travel','tourism','dining','hotel']){await page.locator('#sector-tabs [data-key='+key+']').click();await page.waitForFunction(k=>document.querySelector('#sector-tabs [aria-pressed=true]')?.dataset.key===k,key);assert.deepEqual(await read(),ready);}
  }
  await page.goto(base+'/macro.html');await page.locator('#macro-navigation a[href="regional-retail.html"]').click();await page.waitForLoadState('load');assert.equal((await read()).color,'rgb(77, 88, 164)');assert.equal(await page.evaluate(()=>scrollY),0);
  console.log('PASS shared macro/regional/industry navigation, first paint and colors:',width);
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
