'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),out=process.env.MACRO_SCREENSHOT_DIR;
const server=http.createServer((req,res)=>{let file;try{file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));}catch{res.writeHead(400);res.end();return;}if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,body)=>{if(err){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'}[path.extname(file)]||'text/plain'});res.end(body);});});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1512,height:1100},acceptDownloads:true}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const ready=()=>page.waitForSelector('#indicators:not([hidden]) .macro-kpi');
  try{
    const start=Date.now();await page.goto(base+'/macro.html');await ready();
    assert.ok(page.url().includes('/macro.html?'));assert.equal(await page.locator('.macro-kpi').count(),6);
    assert.equal(await page.locator('#metric-list .macro-item').count(),17);assert.match(await page.locator('#overview-meta').innerText(),/17\/17/);
    assert.ok(!requests.some(url=>url.includes('predictions.json')));assert.match(await page.locator('#kpi-grid').innerText(),/50.1/);
    console.log('Initial local load including history:',Date.now()-start,'ms');
    assert.equal(await page.locator('.macro-kpi:not(.is-support)').count(),4);assert.equal(await page.locator('.macro-kpi.is-support').count(),2);
    assert.equal(await page.locator('#morning-trends .morning-trend').count(),3);assert.ok(await page.locator('#release-rows tr').count()<=5);
    const releaseDates=await page.locator('#release-rows time').allTextContents();assert.deepEqual(releaseDates,releaseDates.slice().sort().reverse());
    if(await page.locator('#release-more').isVisible()){await page.locator('#release-more').click();assert.ok(await page.locator('#release-rows tr').count()>5);assert.equal(await page.locator('#release-more').getAttribute('aria-expanded'),'true');await page.locator('#release-more').click();}
    const releasedId=await page.locator('#release-rows [data-morning-metric]').first().getAttribute('data-morning-metric');await page.locator('#release-rows [data-morning-metric]').first().click();assert.equal(new URL(page.url()).searchParams.get('indicator'),releasedId);
    await page.locator('#morning-chart-cn-retail [data-chart-point]').first().focus();assert.ok(await page.locator('#morning-chart-cn-retail .research-tooltip').isVisible());
    await page.locator('#morning-trends [data-morning-metric="cn-pmi"]').click();assert.equal(new URL(page.url()).searchParams.get('indicator'),'cn-pmi');
    if(out){fs.mkdirSync(out,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'宏观晨报-首屏.png'),fullPage:false});}
    await page.locator('[data-kpi="cn-cpi"]').click();assert.match(await page.locator('#metric-title').innerText(),/CPI/);
    await page.locator('#comparison').selectOption('cn-ppi');assert.equal(await page.locator('.macro-chart svg').count(),2);
    await page.locator('#years').selectOption('1');await page.reload();await ready();assert.equal(await page.locator('#comparison').inputValue(),'cn-ppi');assert.equal(await page.locator('#years').inputValue(),'1');
    await page.locator('#primary-chart [data-chart-point]').first().focus();assert.ok(await page.locator('#primary-chart .research-tooltip').isVisible());assert.match(await page.locator('#primary-chart .research-tooltip').innerText(),/CPI/);
    if(out){fs.mkdirSync(out,{recursive:true});await page.locator('#primary-chart [data-chart-point]').first().evaluate(el=>el.blur());await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'宏观核心指标-桌面.png'),fullPage:true});}
    await page.locator('#more-filters > summary').click();await page.locator('#frequency').selectOption('quarterly');assert.equal(await page.locator('#metric-list .macro-item').count(),2);
    await page.locator('#search').fill('不存在');await page.waitForTimeout(250);assert.match(await page.locator('#detail').innerText(),/没有匹配/);assert.equal(await page.locator('#download-latest').isDisabled(),true);
    await page.locator('#reset-filters').click();await page.locator('#search').fill('社零');await page.waitForTimeout(250);assert.equal(await page.locator('#metric-list .macro-item').count(),1);
    const download=page.waitForEvent('download');await page.locator('#download-latest').click();const csv=fs.readFileSync(await (await download).path(),'utf8');assert.equal(csv.split('\r\n').length,2);assert.match(csv,/社零/);assert.match(csv,/2026-08/);
    await page.locator('[data-kpi="cn-pmi"]').click();assert.equal(await page.locator('#search').inputValue(),'');assert.match(await page.locator('.macro-latest').innerText(),/点/);
    await page.locator('#reset-filters').click();await page.locator('[data-country="US"]').click();assert.equal(await page.locator('#metric-list .macro-item').count(),14);assert.equal(await page.locator('#comparison').inputValue(),'');
    assert.equal(await page.locator('#morning-trends [data-morning-metric="us-payroll"]').count(),1);assert.equal(await page.locator('#morning-trends [data-morning-metric^="cn-"]').count(),0);
    await page.locator('#health').selectOption('attention');assert.match(await page.locator('#metric-list').innerText(),/CPI/);
    await page.locator('[data-kpi="us-cpi"]').click();assert.match(await page.locator('.macro-coverage').innerText(),/缺失/);
    await page.locator('#comparison').selectOption('us-gdp-quarter');assert.match(await page.locator('.macro-chart-note').innerText(),/频率不同/);
    await page.locator('[data-kpi="us-treasury10"]').click();await page.locator('#years').selectOption('0');assert.ok(await page.locator('#primary-chart [data-chart-point]').count()<=122);
    for(const width of [1920,1440,1024,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow at '+width);}
    await page.goto(base+'/macro.html?country=CN&indicator=cn-cpi&comparison=cn-ppi&years=1');await ready();
    if(out)await page.screenshot({path:path.join(out,'宏观核心指标-手机.png'),fullPage:true});
    await page.locator('[data-view="predictions"]').click();await page.waitForFunction(()=>document.querySelector('#prediction-list .forecast-event'));assert.ok(requests.some(url=>url.includes('predictions.json')));
    assert.match(await page.locator('#prediction-overview').innerText(),/活跃合约/);
    await page.locator('#prediction-search').fill('降息25');assert.equal(await page.locator('#prediction-list .forecast-event').count(),2);
    assert.match(await page.locator('#prediction-list').innerText(),/维持不变/);
    const predictionDownload=page.waitForEvent('download');await page.locator('#prediction-download').click();assert.match(fs.readFileSync(await (await predictionDownload).path(),'utf8'),/英文原文/);
    await page.locator('[data-view="fedwatch"]').click();await page.waitForSelector('.fedwatch-kpi');
    assert.equal(await page.locator('.fedwatch-kpi').count(),3);assert.match(await page.locator('#fedwatch-status').innerText(),/快照/);
    await page.locator('#fedwatch-meeting').selectOption('2026-12-09');assert.match(await page.locator('#fedwatch-content').innerText(),/2026-12-09/);
    await page.locator('[data-view="indicators"]').click();assert.ok(await page.locator('#kpi-grid').isVisible());
    await page.route('**/data/macro/automatic-series.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto(base+'/macro.html');await ready();assert.match(await page.locator('#data-warning').innerText(),/补充历史读取失败/);assert.ok(await page.locator('#retry').isVisible());await page.unroute('**/data/macro/automatic-series.json');await page.locator('#retry').click();await page.waitForFunction(()=>document.querySelectorAll('#metric-list .macro-item').length===17);assert.ok(await page.locator('#data-warning').isHidden());
    await page.route('**/data/macro/catalog.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto(base+'/macro.html');await page.waitForFunction(()=>document.querySelector('#load-state').textContent.includes('读取失败'));assert.ok(await page.locator('#indicators').isHidden());assert.ok(await page.locator('#skeleton').isHidden());
    await page.unroute('**/data/macro/catalog.json');await page.locator('#retry').click();await ready();
    assert.deepEqual(errors,[]);console.log('PASS: KPI drill-down, comparison, frequency/health/search filters, URL restore, CSV, chart keyboard access, daily performance, five viewport widths, lazy prediction loading, partial failure, full failure and retry.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});




