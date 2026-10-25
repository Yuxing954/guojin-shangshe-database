'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.MACRO_SCREENSHOT_DIR;
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(file)]||'text/plain'}).end(b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.MACRO_STUDY_BASE_URL||'http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),p=await b.newPage({viewport:{width:1440,height:1100},acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.locator('#metric-title').waitFor();
 async function shot(name){if(out){fs.mkdirSync(out,{recursive:true});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(out,name+'.png')});}}
 try{
  await p.goto(base+'/macro.html');await ready();assert.ok(await p.locator('#kpi-grid').isVisible());assert.ok(await p.locator('.macro-list-panel').isHidden());assert.equal(await p.locator('#recent-releases,#trend-presets').count(),0);
  await p.locator('[data-kpi=cn-cpi]').click();assert.equal(await p.locator('#favorite,#favorites-only').count(),0);await shot('core-overview');
  await p.locator('[data-study=workspace]').click();
  await p.locator('#search').fill('CPI');await p.waitForTimeout(250);const q=await p.locator('#search').inputValue();await p.locator('#metric-list .macro-item').first().click();assert.equal(await p.locator('#search').inputValue(),q);await shot('core-workspace');
  await p.goto(base+'/consumption-macro.html');await p.waitForURL(/macro\.html\?/);await ready();assert.equal(new URL(p.url()).searchParams.get('view'),'indicators');
  assert.deepEqual(await p.locator('[data-macro-navigation] > *').allTextContents(),['核心指标','全国社零','地方社零','FedWatch','Polymarket']);
  await p.goto(base+'/regional-retail.html');await p.locator('#tier-cards strong').first().waitFor();assert.ok(await p.locator('#tiers').isVisible());await p.locator('[data-retail-view=breakdown]').click();assert.match(await p.locator('#breakdown-title').innerText(),/北京/);await p.locator('#breakdown-city').selectOption('p8');assert.match(await p.locator('#breakdown-title').innerText(),/上海/);await shot('regional-shanghai');
  for(const url of ['macro.html','macro.html?study=workspace','regional-retail.html','regional-retail.html?view=breakdown']){await p.setViewportSize({width:390,height:900});await p.goto(base+'/'+url);await p.locator(url.startsWith('macro')?'#metric-title':url.includes('view=breakdown')?'#breakdown-title':'#tier-cards strong').first().waitFor();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+url);await shot('mobile-'+url.split('?')[0]+(url.includes('?')?'-alternate':''));}
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'data/macro/predictions.json'),'utf8'));fixture.fetchedAt='2026-10-09T18:30:00Z';
  await p.route('**/data/macro/predictions.json',r=>r.fulfill({json:fixture}));await p.goto(base+'/macro.html?view=predictions');await p.locator('#prediction-focus .pm-result').first().waitFor();assert.match(await p.locator('#prediction-status').innerText(),/2026-10-10 02:30 北京时间/);await p.unroute('**/data/macro/predictions.json');
  assert.deepEqual(errors,[]);console.log('PASS: compact overview, shared detail, public indicators, preserved filters, retired consumption redirect, regional research views, Beijing date rollover and mobile overflow');
 }finally{await b.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});

