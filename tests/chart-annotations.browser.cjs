'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs'),http=require('http'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/chart-annotations');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain'}).end(b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.ANNOTATIONS_BASE_URL||'http://127.0.0.1:'+server.address().port,b=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[],results=[];p.on('pageerror',e=>errors.push(e.message));fs.mkdirSync(out,{recursive:true});
try{
const cases=[
 ['hotel-dashboard.html','#main-chart svg'],['hotel-groups.html','#rooms-trend svg'],['hotel-holiday-dashboard.html','#holiday-chart svg'],
 ['dutyfree-dashboard.html','#hn-growth'],['dutyfree-dashboard.html#korea','#view-korea[data-status=ready] svg.site-paired-chart'],
 ['travel-dashboard.html','#domestic-quarter-trips svg'],['cruise-dashboard.html','#chart-passengers svg'],['macro.html','#primary-chart svg'],
 ['national-retail.html','#national-trend svg'],['regional-retail.html','#tier-trend svg.regional-chart'],
 ['company-database.html?company=atour','#dh-chart-0 svg'],['overseas-hotels.html?company=marriott','#oh-op-plot-0 svg'],['quotes.html','#chart svg.quotes-chart']];
for(const [file,ready]of cases){
 await p.setViewportSize({width:1440,height:1000});await p.goto(base+'/'+file);await p.locator(ready).first().waitFor({timeout:45000});await p.waitForFunction(()=>document.querySelector('.site-value-menu'));await p.waitForTimeout(300);
 const scope=p.locator('.site-chart-label-scope').filter({visible:true}).first();
 const menu=p.locator('.site-value-menu:visible').first();await menu.locator('summary').waitFor();
 assert.equal(await menu.getAttribute('open'),null,file+' folded by default');
 const input=menu.locator('input[type=checkbox]'),select=menu.locator('select[data-value-mode]');
 const plot=()=>p.locator('svg.site-interactive-chart,svg.regional-chart').evaluateAll(es=>es.map(e=>({v:e.getAttribute('viewBox'),marks:[...e.querySelectorAll('path:not(.site-chart-guide),polyline,rect,circle')].map(n=>['d','points','x','y','cx','cy','width','height'].map(a=>n.getAttribute(a)))})));
 const before=await plot();await menu.locator('summary').click();
 if(await input.count()){const active=input.filter({visible:true}).first(),checked=await active.isChecked();if(!await active.isDisabled()){await active.setChecked(!checked);assert.deepEqual(await plot(),before,file+' annotations must not change plot geometry or observations');await active.setChecked(checked);}}
 else if(await select.count()){const host=p.locator('#tier-trend'),count=await host.locator('circle').count(),height=(await host.locator('svg.regional-chart').boundingBox()).height;await select.selectOption('off');assert.equal(await host.locator('.regional-value-label').count(),0);assert.equal(await host.locator('circle').count(),count);assert.equal((await host.locator('svg.regional-chart').boundingBox()).height,height);await p.locator('#tier-trend .site-value-menu select').selectOption('all');}
 await p.keyboard.press('Escape');
 for(const width of [1440,768,390,320]){
  await p.setViewportSize({width,height:1000});await p.waitForTimeout(300);
  const current=p.locator('.site-value-menu:visible').first(),summary=current.locator('summary');await summary.click();
  const options=current.locator('.site-value-options');await options.waitFor();
  const box=await options.boundingBox();assert.ok(box.x>=7&&box.x+box.width<=width-7&&box.y>=7&&box.y+box.height<=1000-7,file+' menu fits '+width+' '+JSON.stringify(box));
  assert.ok(await options.evaluate(n=>{const e=n.querySelector('label')||n,b=e.getBoundingClientRect();return n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),file+' menu hit target is visible');
  await options.locator('input,select').first().focus();await p.keyboard.press('Escape');assert.equal(await current.getAttribute('open'),null);assert.ok(await summary.evaluate(e=>e===document.activeElement));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),file+' no page overflow '+width);
 }
 assert.equal(await p.locator('input[data-chart-labels],input[data-value-kind],select[data-value-mode],input[data-labels-for]').evaluateAll(es=>es.filter(e=>e.offsetParent&&!e.closest('.site-value-menu')).length),0,file+' visible controls use the shared menu');
 assert.equal(await p.locator('.site-brand').innerText(),'零售&社服数据库');results.push({file,menus:await p.locator('.site-value-menu').count()});console.log('PASS annotations menu, plotted data and four widths:',file);
}
await p.setViewportSize({width:1440,height:1000});await p.goto(base+'/hotel-dashboard.html');await p.locator('#main-chart svg').waitFor();
await p.evaluate(()=>{const card=document.createElement('article');card.className='board-panel';card.id='annotations-fixture';card.innerHTML='<h2>测试</h2><div id="annotations-fixture-plot"></div>';document.querySelector('main').append(card);window.annotationRows=[{period:'A',value:0,change:0},{period:'B',value:null,change:null},{period:'C',value:-3.4,change:-1.2}];window.annotationOriginal=JSON.stringify(annotationRows);SiteCharts.drawPaired(card.lastElementChild,annotationRows,{unit:'元'});});
const fixture=p.locator('#annotations-fixture');await fixture.locator('summary').click();for(const input of await fixture.locator('input').all())await input.check();const values=await fixture.locator('.site-value-label').allTextContents();assert.ok(values.includes('0')&&values.includes('-3.4'));assert.ok(!values.includes('—'));assert.ok(await p.evaluate(()=>JSON.stringify(annotationRows)===annotationOriginal));
await p.mouse.click(1,1);assert.equal(await fixture.locator('details').getAttribute('open'),null);
await p.goto(base+'/industry.html');await p.frameLocator('#panel-hotel').locator('#main-chart svg').waitFor();const fm=p.frameLocator('#panel-hotel').locator('.site-value-menu:visible').first();await fm.locator('summary').click();await fm.locator('input').first().focus();await p.keyboard.press('Escape');assert.equal(await fm.getAttribute('open'),null);
for(const width of [390,320]){await p.setViewportSize({width,height:1000});assert.equal(await p.locator('.site-brand').innerText(),'零售&社服数据库');const fits=await p.locator('.site-brand').evaluate(e=>{const b=e.getBoundingClientRect(),a=document.querySelector('.site-resource-actions').getBoundingClientRect();return b.right<=a.left&&b.height<=36});assert.ok(fits,'long brand fits compact header');}
await p.screenshot({path:path.join(out,'industry-320.png')});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({results,originalLogo:true,brand:'零售&社服数据库'},null,2));console.log('PASS shared annotation menus, data integrity, responsive boundaries and embeds');
}finally{await b.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
