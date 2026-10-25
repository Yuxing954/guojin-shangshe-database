'use strict';
const {openAnnotation,setChartLabel}=require('./chart-menu-helpers.cjs');
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8','.json':'application/json; charset=utf-8'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const boards=[
   {file:'hotel-dashboard.html',chart:'#main-chart svg',scope:'.hd-card[data-chart-label-menu]',select:'#history-start',value:'13'},
   {file:'dutyfree-dashboard.html',chart:'#hn-growth',scope:'#view-monthly [data-chart-label-menu]',select:'#hn-metric',value:'shoppers'},
   {file:'macro.html',chart:'#primary-chart svg',scope:'#detail',select:'#years',value:'1'}
  ];
  for(const board of boards){
   await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/'+board.file);await page.locator(board.chart+' .site-value-label').first().waitFor();
   const menu=page.locator(board.scope+' .site-value-menu'),summary=menu.locator('summary'),toggle=menu.locator('[data-value-kind=value]');
   assert.equal(await menu.count(),1);assert.equal(await menu.getAttribute('open'),null);assert.equal(await toggle.isVisible(),false);assert(await toggle.isChecked());
   const plot=()=>page.locator(board.chart).evaluate(svg=>[...svg.querySelectorAll('polyline,rect,circle[data-chart-point],.site-value-bar,.site-change-line')].map(n=>({tag:n.tagName,points:n.getAttribute('points'),x:n.getAttribute('x'),y:n.getAttribute('y'),cx:n.getAttribute('cx'),cy:n.getAttribute('cy'),height:n.getAttribute('height'),width:n.getAttribute('width')})));
   const before=await plot();await summary.click();await setChartLabel(toggle,false);assert.equal(await page.locator(board.chart+' .site-value-label[data-kind=value]').count(),0);assert.deepEqual(await plot(),before,'annotation choice must preserve plotted observations');
   await page.locator(board.select).selectOption(board.value);assert.equal(await toggle.isChecked(),false,'annotation choice survives redraw');await setChartLabel(toggle,true);assert(await page.locator(board.chart+' .site-value-label[data-kind=value]').count()>0);
   await toggle.focus();await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('open'),null);assert(await summary.evaluate(n=>n===document.activeElement));
   for(const width of [1920,1440,1024,768,390,320]){
    await page.setViewportSize({width,height:1000});await summary.scrollIntoViewIfNeeded();await summary.click();
    const box=await menu.locator('.site-value-options').boundingBox();assert.ok(box.x>=-1&&box.x+box.width<=width+1,board.file+' menu outside viewport '+width+': '+JSON.stringify(box));
    const hit=await menu.locator('.site-value-option').first().evaluate(n=>{const b=n.getBoundingClientRect();return n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));});assert(hit,board.file+' menu is clipped or covered at '+width);
    await toggle.focus();await page.keyboard.press('Escape');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),board.file+' horizontal overflow '+width);
   }
   if(board.file==='hotel-dashboard.html'){
    await page.locator('[data-view=structure]').click();await page.locator('#supply-chart svg').waitFor();assert.equal(await page.locator('#supply-card .site-value-menu').count(),1);await openAnnotation(page.locator('#supply-card [data-value-kind=change]'));assert(await page.locator('#supply-card [data-value-kind=change]').isVisible());
   }
   if(board.file==='dutyfree-dashboard.html'){
    const order=await page.locator('#view-monthly').evaluate(n=>{const y=s=>n.querySelector(s).getBoundingClientRect().top;return[y('.controls'),y('#hn-period'),y('.board-section-head'),y('.kpis')];});assert.deepEqual([...order].sort((a,b)=>a-b),order);
    await page.locator('[data-view=korea]').click();await page.locator('#view-korea[data-status=ready]').waitFor();assert(await page.locator('#view-korea .site-value-menu').count()>0);
   }
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/industry.html');await page.locator('#industry-stage[data-state=ready]').waitFor();
  for(const sector of ['hotel','dutyfree']){
   await page.locator('#sector-tabs [data-key='+sector+']').click();await page.locator('#industry-stage[data-state=ready]').waitFor();const frame=page.frameLocator('#panel-'+sector),menu=frame.locator('.site-value-menu').first();await menu.locator('summary').click();assert(await menu.locator('[data-value-kind=value]').isVisible());await menu.locator('summary').press('Escape');assert.equal(await menu.getAttribute('open'),null);
  }
  assert.deepEqual(errors,[]);console.log('PASS: three pilot charts preserve data and label defaults; menu, redraw state, Escape/focus, six widths, folded secondary controls and industry embeds.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
