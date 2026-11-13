'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.csv':'text/csv; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':types[path.extname(p)]||'text/plain'}).end(b));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.ASSOCIATION_BASE_URL||'http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.locator('#annual-trend-0 svg').waitFor(),tab=async name=>{await page.locator('[data-annual-tab="'+name+'"]').click();};
 const overflow=async label=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' overflow');
 try{
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/hotel-dashboard.html#view=annual');await ready();
 assert.deepEqual(await page.locator('.hd-tabs .hd-tab').allTextContents(),['经营概览','酒店供给','酒店集团','假期数据','饭店协会','城市对比']);
 assert.equal(await page.locator('#annual-tabs button').count(),5);assert.equal(await page.locator('#annual-kpis .hd-stat').count(),4);
 assert.equal(await page.locator('#annual-charts article:visible').count(),4);assert.ok((await page.locator('#annual-history').textContent()).includes('37.47'));
 await page.selectOption('#annual-year','2021');assert.ok((await page.locator('#annual-kpis').textContent()).includes('2021年'));
 assert.ok(!(await page.locator('#annual-history').textContent()).includes('2025年'));
 await page.selectOption('#annual-window','3');assert.equal(await page.locator('#annual-history thead th').count(),4);
 await tab('grades');assert.equal(await page.locator('#annual-charts article:visible').count(),3);assert.equal(await page.locator('.annual-profile-row').count(),4);assert.ok(await page.locator('#annual-exact').isHidden());
 await page.selectOption('#annual-year','2025');assert.ok(await page.locator('#annual-exact').evaluate(e=>!e.hidden));
 assert.ok((await page.locator('#annual-exact-table').textContent()).includes('292,215'));
 await page.selectOption('#annual-year','2019');assert.equal(await page.locator('#annual-history thead th').count(),2);await ready();
 await tab('rankings');assert.ok(await page.locator('#annual-year-label').isHidden());assert.match(await page.locator('#annual-rank-period').innerText(),/2025年/);
 assert.equal(await page.locator('#annual-snapshot tbody tr').count(),50);
 await page.locator('#annual-search').fill('华住');assert.equal(await page.locator('#annual-snapshot tbody tr').count(),1);
 await page.locator('#annual-search').fill('不存在的名称');assert.ok(await page.locator('.annual-empty').isVisible());await page.locator('#annual-search').fill('');
 await page.selectOption('#annual-detail','brand_rankings');assert.equal(await page.locator('#annual-snapshot tbody tr').count(),110);
 await page.selectOption('#annual-brand','经济型');assert.equal(await page.locator('#annual-snapshot tbody tr').count(),30);
 await page.selectOption('#annual-detail','provinces');assert.equal(await page.locator('#annual-snapshot tbody tr').count(),31);
 await page.selectOption('#annual-detail','topcities');assert.equal(await page.locator('#annual-snapshot tbody tr').count(),10);
 await tab('overview');await page.selectOption('#annual-year','2025');await page.selectOption('#annual-window','all');
 for(const width of [1920,1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const kind of ['overview','grades','sizes','cities','rankings']){
   await tab(kind);await overflow(width+' '+kind);
   if(kind!=='rankings'){
    await ready();
    assert.ok(await page.locator('#annual-trend-0 .site-value-label').count()>0);
    const bounds=await page.locator('#annual-charts article:visible').evaluateAll(es=>es.map(e=>{const s=e.querySelector('svg'),b=e.getBoundingClientRect(),r=s.getBoundingClientRect();return{ok:r.left>=b.left-1&&r.right<=b.right+1};}));assert.ok(bounds.every(b=>b.ok),'chart clipped '+width+' '+kind);
   }
   if([1440,390].includes(width)){const dir=path.join(root,'artifacts/association');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,kind+'-'+width+'.png')});}
  }
  await page.locator('#annual-sources>summary').click();const box=await page.locator('.annual-source-menu').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,JSON.stringify({width,box,style:await page.locator('.annual-source-menu').evaluate(e=>({position:getComputedStyle(e).position,left:getComputedStyle(e).left,right:getComputedStyle(e).right,parent:e.offsetParent?.className,parentBox:e.offsetParent?.getBoundingClientRect().toJSON()}))}));await page.keyboard.press('Escape');assert.equal(await page.locator('#annual-sources').evaluate(e=>e.open),false);
  console.log('PASS association views, chart bounds and sources at',width);
 }
 await tab('overview');
 await page.locator('#annual-card-0 .site-value-menu>summary').click();const toggle=page.locator('#annual-card-0 input[data-value-kind=value]');await toggle.uncheck();assert.equal(await page.locator('#annual-trend-0 .site-value-label').count(),0);await toggle.check();await page.keyboard.press('Escape');
 await page.locator('#annual-trend-0 [data-chart-point]').first().focus();assert.ok(await page.locator('#annual-trend-0 [role=tooltip]').count()||await page.locator('.site-chart-tooltip:visible').count());
 const download=page.waitForEvent('download');await page.locator('.annual-links a[download]').click();assert.ok((await download).suggestedFilename().endsWith('.csv'));
 await page.click('[data-view=overview]');await page.locator('#segment-chart svg').waitFor();await page.click('[data-view=annual]');await ready();assert.equal(await page.locator('#annual-tabs').count(),1);
 await page.route('**/data/hotel-association-annual.json*',r=>r.fulfill({status:503,body:'unavailable'}));await page.reload();await page.locator('#annual-retry').waitFor();await page.unroute('**/data/hotel-association-annual.json*');await page.locator('#annual-retry').click();await ready();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(base+'/industry.html?panelSector=hotel&panelView=view%3Dannual#hotel');const frame=page.frameLocator('#panel-hotel');await frame.locator('#annual-tabs').waitFor({timeout:60000});await frame.locator('[data-annual-tab=grades]').click();await frame.locator('#annual-trend-0 svg').waitFor();await overflow('embedded '+width);assert.ok(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'embedded horizontal overflow');const dir=path.join(root,'artifacts/association');await page.screenshot({path:path.join(dir,'embedded-'+width+'.png')});}assert.deepEqual(errors,[]);console.log('PASS historical year scopes, rankings/search, label controls, downloads, switching and retry');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});


