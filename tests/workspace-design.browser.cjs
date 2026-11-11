'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.SITE_SCREENSHOT_DIR||'.cache/workspace-design';
const pages=["company-database.html","cruise-dashboard.html","dashboard.html","data-notes.html","dining.html","dutyfree-dashboard.html","earnings.html","hotel-dashboard.html","hotel-groups.html","hotel-holiday-dashboard.html","industry.html","macro.html","national-retail.html","overseas-hotels.html","quotes.html","regional-retail.html","research.html","search.html","tools.html","travel-dashboard.html"];
const query={'company-database.html':'?company=jinjiang','overseas-hotels.html':'?company=marriott','industry.html':'?panelSector=dining#dining','macro.html':'?view=indicators'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain; charset=utf-8'}).end(b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});fs.mkdirSync(out,{recursive:true});const results=[];
try{
 const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage(),missing=[];page.on('response',r=>{if(r.status()===404&&/\.(css|js)(\?|$)/.test(r.url()))missing.push(r.url());});
 for(const file of pages){
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/'+file+(query[file]||''));await page.locator('.site-nav').waitFor();await page.waitForTimeout(1800);
  assert.equal(await page.locator('.site-nav').count(),1,file+' navigation');
  assert.equal(await page.locator('body').getAttribute('data-design'),'workspace',file+' design scope');
  for(const width of [1920,1440,1024,768,390]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);
   assert.equal(await page.locator('[hidden]:visible').count(),0,file+' hidden state');
   const facts=await page.evaluate(()=>{
    const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
    const controls=[...document.querySelectorAll('.site-main select,.site-main input[type=search],.site-main input[type=date]')].filter(visible);
    const bodyFont=getComputedStyle(document.body).fontFamily;
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,bodyFont,controls:controls.map(e=>({id:e.id,height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize,radius:getComputedStyle(e).borderRadius})),fonts:[...document.querySelectorAll('.site-main h2,.site-main h3,.site-main select')].filter(visible).filter(e=>getComputedStyle(e).fontFamily!==bodyFont).map(e=>e.tagName+'.'+e.className)};
   });
   assert.equal(facts.overflow,false,file+' '+width+' page overflow');
   assert.deepEqual(facts.fonts,[],file+' typography');
   for(const c of facts.controls){assert.ok(c.height>=40,file+' control '+JSON.stringify(c));assert.equal(c.font,width<=760?'16px':'14px',file+' field type '+JSON.stringify(c));assert.equal(c.radius,'8px',file+' field radius');}
   if(width===1440||width===390)await page.screenshot({path:path.join(out,file.replace('.html','')+'-'+width+'.png')});
   results.push({file,width,controls:facts.controls.length});
  }
 if(file==='hotel-dashboard.html'){
  await page.goto(base+'/hotel-dashboard.html#view=structure');
  await page.waitForSelector('#supply-band-chart svg');
  assert.ok(await page.locator('#supply-tier-chart .site-value-label').count()<=28,'supply labels stay sparse');
  for(const width of [1920,1440,768,390]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);
   const boxes=await page.locator('.hd-supply-breakdowns>.hd-card').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width};}));
   if(width===1920){assert.ok(Math.abs(boxes[0].y-boxes[1].y)<1,'wide supply cards align');assert.ok(boxes[1].x>boxes[0].x,'wide supply cards side by side');}
   if(width<=768){assert.ok(boxes[1].y>boxes[0].y,'narrow supply cards stack');assert.ok(Math.abs(boxes[0].x-boxes[1].x)<1);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'supply page overflow');
   await page.locator('#supply-tier-card').screenshot({path:path.join(out,'supply-tier-'+width+'.png')});
  }
 }
 console.log('PASS',file);
 }
 assert.deepEqual(missing,[],'missing styles/scripts');
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
