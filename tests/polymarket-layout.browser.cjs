'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),P=require('../scripts/prediction-model.js');
const root=path.resolve(__dirname,'..'),now=Date.parse('2026-10-23T04:00:00Z'),fixture=require('../data/macro/predictions.json');
let server;
(async()=>{let base=process.env.PM_BASE_URL;
 if(!base){server=require('node:http').createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(file)]||'text/plain'}).end(body);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(now);
try{
 if(process.env.PM_OVERLAY)for(const file of ['macro.html','scripts/forecast-desk.js','scripts/prediction-workspace.css'])await page.route('**/'+file+'*',r=>r.fulfill({path:path.join(root,file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript'}));
 await page.route('**/data/macro/predictions.json',r=>r.fulfill({json:fixture}));
 await page.goto(base+'/macro.html?view=predictions');await page.locator('.pm-result').first().waitFor();
 const rateGroups=P.groups(fixture.markets,{category:'央行利率',wholeEvents:true,now});
 assert.equal(await page.locator('.pm-event').count(),rateGroups.length);
 assert.equal(await page.locator('.pm-focus-heading h2').innerText(),rateGroups[0].title);
 assert.equal(await page.locator('.pm-result').count(),rateGroups[0].markets.length);
 for(const width of [1920,1440,1024,768,390]){
  await page.setViewportSize({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);
  assert(await page.locator('.pm-big-number strong').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  const overlap=await page.locator('.pm-result').evaluateAll(ns=>ns.some(el=>{const a=el.querySelector('.pm-result-name').getBoundingClientRect(),b=el.querySelector('strong').getBoundingClientRect();return a.right>b.left+1}));
  assert(!overlap,'overlapping outcome and probability '+width);
  if(width<=850)assert(await page.locator('#prediction-event-select').isVisible());else assert(await page.locator('.pm-event').first().isVisible());
  if(process.env.MACRO_SCREENSHOT_DIR){fs.mkdirSync(process.env.MACRO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MACRO_SCREENSHOT_DIR,'workspace-'+width+'.png'),fullPage:false});}
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('.pm-result').nth(1).click();assert.equal(await page.locator('.pm-answer h3').innerText(),await page.locator('.pm-result-name').nth(1).innerText());assert.equal(await page.locator('.pm-big-number strong').innerText(),await page.locator('.pm-result strong').nth(1).innerText());assert.equal(await page.locator('[data-pm-outcome="1"]').evaluate(el=>el===document.activeElement),true);
 await page.locator('.pm-event').nth(1).focus();await page.keyboard.press('Enter');assert(await page.locator('.pm-event').nth(1).evaluate(el=>el===document.activeElement));assert.equal(await page.locator('.pm-focus-heading h2').innerText(),rateGroups[1].title);
 await page.locator('[data-prediction-event]').click();assert.equal(await page.locator('#prediction-dialog tbody tr').count(),rateGroups[1].markets.reduce((n,m)=>n+m.outcomes.length,0));await page.keyboard.press('Escape');
 await page.locator('[data-topic="数字货币"]').click();assert.match(await page.locator('.pm-results-heading').innerText(),/各合约独立，不相加/);
 await page.setViewportSize({width:390,height:1000});const options=await page.locator('#prediction-event-select option').evaluateAll(ns=>ns.map(n=>({value:n.value,label:n.textContent})));assert(options.length>1);await page.selectOption('#prediction-event-select',options[1].value);assert.equal(await page.locator('.pm-focus-heading h2').innerText(),options[1].label);
 await page.locator('#prediction-search').fill('不存在123');assert.equal(await page.locator('.pm-result').count(),0);assert(await page.locator('#prediction-download').isDisabled());await page.locator('#prediction-search').fill('');
 await page.locator('[data-topic=""]').click();await page.locator('.prediction-more-tools summary').click();const download=page.waitForEvent('download');await page.locator('#prediction-download').click();const csv=fs.readFileSync(await(await download).path(),'utf8');assert.equal(csv.split('\r\n').length,1+P.groups(fixture.markets,{wholeEvents:true,now}).reduce((n,g)=>n+g.markets.reduce((n,m)=>n+m.outcomes.length,0),0));
 const template=fixture.markets[0],large={...fixture,status:'error',markets:Array.from({length:55},(_,i)=>({...template,id:'large-'+i,eventId:'large-'+i,eventTitleZh:'测试事件'+i,endDate:'2026-12-31T00:00:00Z',outcomes:[{name:'Yes',nameZh:'是',probability:0},{name:'No',nameZh:'否',probability:1}]}))};
 await page.unroute('**/data/macro/predictions.json');await page.route('**/data/macro/predictions.json',r=>r.fulfill({json:large}));await page.goto(base+'/macro.html?view=predictions&predictionTopic=all');await page.locator('.pm-result').first().waitFor();assert.equal(await page.locator('.pm-event').count(),24);assert.match(await page.locator('#prediction-status').innerText(),/更新失败/);assert.match(await page.locator('.pm-results').innerText(),/0%/);await page.locator('#prediction-more').click();assert.equal(await page.locator('#prediction-event-select option').count(),48);await page.locator('#prediction-more').click();assert.equal(await page.locator('#prediction-event-select option').count(),55);
 assert.deepEqual(errors,[]);console.log('PASS workspace: 5 widths, exact outcomes, event/outcome selection, keyboard focus, mobile selector, independence labels, dialog, export, search, pagination, zero and error snapshot');
}finally{await browser.close();server?.close()}})().catch(e=>{console.error(e);server?.close();process.exitCode=1});



