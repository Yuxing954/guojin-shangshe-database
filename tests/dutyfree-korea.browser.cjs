'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),M=require('../scripts/dutyfree-korea-model.js'),D=require('../scripts/site-data.js');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/dutyfree/korea.json'),'utf8')),derived=M.derive(data);
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv; charset=utf-8'})[path.extname(p)]||'text/plain');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
async function csv(p,id){const done=p.waitForEvent('download');await p.click(id);return D.csv(fs.readFileSync(await(await done).path(),'utf8'));}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.argv[2]||'http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.addInitScript(()=>{let charts;Object.defineProperty(window,'SiteCharts',{configurable:true,get:()=>charts,set(v){const draw=v.drawPaired;v.drawPaired=(host,rows,opt)=>{(window.kPlots||=Object.create(null))[host.id]={rows:structuredClone(rows),opt:structuredClone(opt)};return draw(host,rows,opt);};charts=v;}});});
 const p=await context.newPage();await p.goto(base+'/dutyfree-dashboard.html#korea');await p.locator('#view-korea[data-status=ready]').waitFor();assert.equal(await p.locator('#view-korea .site-paired-chart').count(),3);assert.equal(await p.locator('#view-korea [data-chart-labels]:checked').count(),3);assert(await p.locator('#kr-sales-chart .site-value-label').count()>0);assert((await p.locator('#kr-sales-chart .site-value-label[data-kind=value]').allTextContents()).every(t=>/^[\d,]+\.\d{2}$/.test(t)));assert((await p.locator('#asof').textContent()).includes('2026-08'));assert((await p.locator('#kr-sales').textContent()).includes('7.55'));
 for(const scope of ['total','foreign','domestic']){
  await p.selectOption('#kr-scope',scope);const rows=M.series(derived,scope,'12');
  for(const [id,field,scale] of [['sales','salesUsd',1e8],['shoppers','shoppers',1e4],['spend','spendUsd',1]]){
   const plot=await p.evaluate(id=>kPlots[id],'kr-'+id+'-chart');assert.equal(plot.opt.mode,'combo');assert.equal(plot.rows.length,12);
   for(let i=0;i<rows.length;i++){assert.equal(plot.rows[i].value,rows[i][field]/scale);assert.equal(plot.rows[i].change,rows[i][field+'Yoy']);}
  }
 }
 await p.locator('#kr-sales-chart svg').focus();await p.keyboard.press('End');assert((await p.locator('.site-chart-tooltip:not([hidden])').innerText()).includes('26-08'));await p.keyboard.press('Escape');
 await p.locator('#view-korea [data-chart-labels]').first().check();assert(await p.locator('#kr-sales-chart .site-value-label').count()>0);await p.locator('#view-korea [data-chart-labels]').first().uncheck();assert.equal(await p.locator('#kr-sales-chart .site-value-label').count(),0);await p.selectOption('#kr-scope','foreign');assert.equal(await p.locator('#kr-sales-chart .site-value-label').count(),0);await p.selectOption('#kr-scope','domestic');
 for(const mode of ['value','change','combo']){await p.selectOption('#kr-mode',mode);assert.equal((await p.evaluate(()=>kPlots['kr-sales-chart'])).opt.mode,mode);}
 await p.selectOption('#kr-range','24');assert.equal((await p.evaluate(()=>kPlots['kr-sales-chart'])).rows.length,24);const out=await csv(p,'#kr-export');assert.equal(out.length,24);assert(out.every(r=>r['顾客分类']==='韩国本国人'));assert.equal(out.at(-1)['销售额原始回执'],'1.919亿');
 await p.selectOption('#kr-range','all');await p.locator('#view-korea details summary').click();assert.equal(await p.locator('#kr-table tbody tr').count(),31);assert.equal((await csv(p,'#kr-export-all')).length,93);
 await p.click('#kr-source');await p.locator('#srcmodal[open]').waitFor();const info=await p.locator('#srcbox').textContent();assert(info.includes('韩国免税店协会'));assert(info.includes('缩略'));await p.click('#kr-close-source');
 await p.locator('[data-view=monthly]').click();await p.waitForFunction(()=>document.querySelector('#hn-period').textContent.includes('2026-09'));assert(await p.locator('#hn-growth svg').count()===0);assert.equal(await p.locator('#hn-growth').getAttribute('data-chart-ready'),'true');
 await p.locator('[data-view=holidays]').click();await p.locator('#dh-cards').waitFor();const holiday=p.locator('#dh-chart').locator('..');assert(await holiday.locator('[data-value-kind=value]').isChecked());assert(await holiday.locator('[data-value-kind=change]').isChecked());assert(await p.locator('#dh-chart .site-value-label[data-kind=change]').count()>0);assert(await p.locator('#dh-chart .site-value-label[data-kind=value]').count()>0);assert((await p.locator('#dh-chart .site-value-label[data-kind=value]').allTextContents()).every(t=>/^[\d,]+\.\d{2}$/.test(t)));await holiday.locator('[data-value-kind=value]').uncheck();await p.selectOption('#dh-metric','sales');assert.equal(await p.locator('#dh-chart .site-value-label[data-kind=value]').count(),0);await p.locator('[data-view=korea]').click();await p.locator('#view-korea[data-status=ready]').waitFor();
 for(const width of [1440,1024,768,724,600,390,320]){await p.setViewportSize({width,height:900});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);assert(await p.locator('.kr-plot').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),'chart '+width);assert(await p.locator('.kr-plot svg').evaluateAll(svgs=>svgs.every(svg=>{
 const boxes=selector=>[...svg.querySelectorAll(selector)].map(e=>{const b=e.getBBox();return {x:b.x,y:b.y,w:b.width,h:b.height};});
 const dates=boxes('.site-period-tick').sort((a,b)=>a.x-b.x),titles=boxes('.site-axis-label'),ticks=boxes('.site-tick');
 if(svg.dataset.chartLayout!=='spacious'||svg.viewBox.baseVal.height<500||dates.length<2||dates.length>6)return false;
 if(dates.some((b,i)=>b.x<0||b.x+b.w>svg.viewBox.baseVal.width||i&&b.x-(dates[i-1].x+dates[i-1].w)<18))return false;
 if(Math.min(...dates.map(b=>b.y))-Math.max(...ticks.map(b=>b.y+b.h))<12)return false;
 if(Math.min(...ticks.map(b=>b.y))-Math.max(...titles.map(b=>b.y+b.h))<12)return false;
 if(titles.length===2&&titles[0].x+titles[0].w>titles[1].x&&titles[0].y+titles[0].h>titles[1].y)return false;
 for(const cls of ['.site-tick:not(.site-change-axis)','.site-tick.site-change-axis']){
  const axis=boxes(cls).sort((a,b)=>a.y-b.y);
  if(axis.some((b,i)=>i&&b.y-(axis[i-1].y+axis[i-1].h)<14))return false;
 }
 return true;
})),'axis spacing '+width);}
 const bad=await context.newPage();await bad.route('**/data/dutyfree/korea.json',r=>r.fulfill({status:503,body:'bad'}));await bad.goto(base+'/dutyfree-dashboard.html#korea');await bad.locator('#view-korea[data-status=error]').waitFor();await bad.locator('[data-view=monthly]').click();await bad.locator('#hn-growth[data-chart-ready]').waitFor();await bad.unroute('**/data/dutyfree/korea.json');await bad.locator('[data-view=korea]').click();await bad.locator('#view-korea[data-status=ready]').waitFor();
 const isolated=await context.newPage();await isolated.route('**/data/dutyfree_monthly.csv',r=>r.fulfill({status:503,body:'bad'}));await isolated.goto(base+'/dutyfree-dashboard.html#korea');await isolated.locator('#view-korea[data-status=ready]').waitFor();assert((await isolated.locator('#asof').textContent()).includes('韩国月度截至'));
 // A real iframe exercises the shared ready/error protocol used by industry.html.
 const parent=await context.newPage();await parent.route('**/__korea-embed-test.html',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'}));await parent.goto(base+'/__korea-embed-test.html');
 await parent.evaluate(url=>{document.body.innerHTML='<iframe id="embed" style="width:900px;height:1200px"></iframe>';window.embedMessages=[];addEventListener('message',e=>{if(e.origin===location.origin&&e.data.type==='industry-panel')embedMessages.push(e.data);});document.querySelector('#embed').src=url;},base+'/dutyfree-dashboard.html?embed=1#korea');
 await parent.waitForFunction(()=>embedMessages.some(m=>m.state==='ready'&&m.view==='korea'&&m.layoutReady));
 const frame=parent.frameLocator('#embed');await frame.locator('#kr-sales-chart svg').waitFor();assert((await frame.locator('#view-korea').getAttribute('data-status'))==='ready');
 const note=await context.newPage();await note.goto(base+'/data-notes.html#dutyfree');await note.waitForFunction(()=>document.querySelector('#notes-content').textContent.includes('缩略原值'));
 assert.deepEqual(errors,[]);console.log('PASS Korea: 93 sourced monthly records; cohort, mode and range, numerical labels, tooltips, raw CSV, source, Hainan/holiday preservation, responsive widths, retry/isolation, industry embed and notes.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
