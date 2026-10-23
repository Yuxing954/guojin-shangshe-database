'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(file)]||'text/plain'}).end(b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.NAV_BASE_URL||'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const nav=page.locator('[data-macro-navigation]');
 const geometry=()=>nav.evaluate(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,items:[...e.children].map(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:b.x,y:b.y,w:b.width,h:b.height,font:s.fontSize,radius:s.borderRadius};})};});
 const check=async key=>{await page.locator('.site-nav').waitFor({state:'visible'});await page.waitForFunction(k=>document.querySelector('[data-macro-navigation] [aria-current=page]')?.textContent.includes(k),key);assert.equal(await nav.locator('[aria-current=page]').count(),1);assert.equal(await nav.locator('a').count(),4);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const g=await geometry();assert.ok(g.items.every(b=>b.x>=g.x-1&&b.x+b.w<=g.x+g.w+1&&b.h===g.h));assert.ok(Math.max(...g.items.map(b=>b.w))-Math.min(...g.items.map(b=>b.w))<1);return g;};
 try{
  for(const width of [1920,1440,1024,768,390]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/macro.html');await page.locator('.macro-kpi').first().waitFor();const before=await check('核心指标');
   for(const [view,label] of [['fedwatch','FedWatch'],['predictions','Polymarket'],['indicators','核心指标']]){await nav.locator('[data-view='+view+']').click();assert.deepEqual(await check(label),before);}
   await page.goBack();await check('Polymarket');await page.goBack();await check('FedWatch');await page.goForward();await check('Polymarket');
   await nav.locator('[data-view=indicators]').click();await nav.locator('a[href="regional-retail.html"]').click();assert.deepEqual(await check('地方社零'),before);
   await nav.getByText('FedWatch',{exact:true}).click();await check('FedWatch');
   for(const view of ['predictions','indicators','fedwatch','predictions'])await nav.locator('[data-view='+view+']').click();await page.waitForTimeout(300);await check('Polymarket');assert.equal(new URL(page.url()).searchParams.get('view'),'predictions');
   console.log('PASS stable macro navigation and history at',width);
  }
  const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:1440,height:1000}});await nojs.goto(base+'/macro.html');assert.equal(await nojs.locator('[data-macro-navigation] a').count(),4);assert.equal(await nojs.locator('[data-macro-navigation]').evaluate(e=>e.offsetHeight),60);await nojs.close();assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
