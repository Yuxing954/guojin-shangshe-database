'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv; charset=utf-8'}[path.extname(file)]||'text/plain'}).end(b);});});
const cases=[
 ['industry.html#hotel','#sector-tabs','#panel-hotel','.hd-tabs'],
 ['industry.html#gold','#sector-tabs',null,'.gj-tabs'],
 ['industry.html#dutyfree','#sector-tabs','#panel-dutyfree','#tabs'],
 ['industry.html#dining','#sector-tabs','#panel-dining','[aria-label="数据视图"]'],
 ['regional-retail.html','[data-macro-navigation]',null,'.regional-tabs'],
 ['macro.html?view=indicators&study=workspace','[data-macro-navigation]',null,'#countries'],
 ['company-database.html','[aria-label="公司板块"]',null,'.db-tabs'],
 ['research.html','#research-tabs'],['quotes.html','#groups',null,'#views'],
 ['search.html','#resource-types'],['earnings.html','.ec-views']
];
async function check(nav){
 await nav.waitFor({state:'visible',timeout:45000});assert.ok(await nav.evaluate(e=>e.classList.contains('site-subnav')));await nav.evaluate(e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
 const items=nav.locator(':scope > button,:scope > a');assert.ok(await items.count()>=1);
 const values=await items.evaluateAll(items=>items.map(e=>{const s=getComputedStyle(e),selected=e.matches('.active,.on,.current,[aria-pressed=true],[aria-selected=true],[aria-current=page]');return {selected,font:s.fontSize,weight:s.fontWeight,line:s.lineHeight,radius:s.borderRadius,padding:s.padding,border:s.borderTopWidth,height:e.getBoundingClientRect().height,background:s.backgroundColor,color:s.color,shadow:s.boxShadow};}));
 for(const v of values){assert.equal(v.font,'14px');assert.equal(v.line,'22px');assert.equal(v.radius,'8px');assert.equal(v.padding,'10px 16px');assert.equal(v.border,'1px');assert.ok(v.height>=44);assert.equal(v.shadow,'none');assert.equal(v.weight,v.selected?'600':'500');assert.equal(v.background,v.selected?'rgb(77, 88, 164)':'rgb(255, 255, 255)');assert.equal(v.color,v.selected?'rgb(255, 255, 255)':'rgb(102, 116, 138)');}
 assert.ok(values.some(v=>v.selected),'navigation has a visible selected category');
 const first=items.first();await first.focus();assert.equal(await first.evaluate(e=>getComputedStyle(e).outlineWidth),'3px');
}
(async()=>{
 const remote=process.env.SUBNAV_BASE_URL;await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=remote||'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.SUBNAV_PREVIEW==='1')await page.route(base+'/**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace('/guojin-shangshe-database/',''),file=path.join(root,rel);if(!fs.existsSync(file))return route.continue();return route.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'}[path.extname(file)]||'text/plain'});});
 try{
  for(const [url,primary,frame,secondary] of cases){
   await page.setViewportSize({width:1440,height:1100});await page.goto(base+'/'+url);await check(page.locator(primary));
   const scope=frame?page.frameLocator(frame):page;if(secondary)await check(scope.locator(secondary));
   if(url.startsWith('company-database'))await check(page.locator('.db-chapters'));
   if(url.startsWith('macro.html')){await check(page.locator('.macro-groups'));await check(page.locator('.macro-study-tabs'));}
   await page.setViewportSize({width:390,height:900});await page.waitForTimeout(500);await page.mouse.move(0,0);await check(page.locator(primary));if(secondary)await check(scope.locator(secondary));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),url+' mobile overflow');
   if(process.env.SUBNAV_SCREENSHOTS){fs.mkdirSync(process.env.SUBNAV_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.SUBNAV_SCREENSHOTS,url.split(/[?#]/)[0].replace('.html','')+'-mobile.png')});await page.setViewportSize({width:1440,height:1100});await page.waitForTimeout(250);await page.screenshot({path:path.join(process.env.SUBNAV_SCREENSHOTS,url.replace(/[^a-zA-Z0-9]/g,'-')+'-desktop.png')});}
   console.log('PASS consistent secondary navigation:',url);
  }
  await page.goto(base+'/industry.html#gold');const gold=page.locator('.gj-tabs');await gold.locator('[data-view=demand]').click();await page.mouse.move(0,0);await check(gold);assert.ok(await page.locator('#view-demand').isVisible());
  await page.goto(base+'/macro.html?view=indicators');await page.locator('#primary-chart svg').waitFor({timeout:45000});await page.locator('#countries [data-country=US]').click();await page.waitForFunction(()=>new URL(location.href).searchParams.get('country')==='US');await page.mouse.move(0,0);await check(page.locator('#countries'));
  assert.deepEqual(errors,[]);console.log('PASS desktop/mobile styles, selected states, keyboard focus and category switching');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});

