const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=process.env.MACRO_SCREENSHOT_DIR||path.join(root,'.cache','macro-preview');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(p,(error,body)=>{if(error){res.writeHead(404);res.end();return;}const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8'};res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(body);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/consumption-macro.html');await page.waitForSelector('#content:not([hidden])');assert.match(await page.locator('.site-nav a.current').innerText(),/宏观数据/);assert.equal(await page.locator('.cm-kpi').count(),6);assert.match(await page.locator('#kpis').innerText(),/39,824/);assert.ok(await page.locator('#consumption-directory').isHidden());await page.locator('[data-cm-view=workspace]').click();assert.equal(await page.locator('#directory tr').count(),12);assert.ok(await page.locator('#history tr').count()>15);
  await page.screenshot({path:path.join(out,'消费宏观-桌面预览.png'),fullPage:true});
  await page.locator('#trend-panel details > summary').click();
  await page.locator('#group').selectOption('社零分品类');assert.match(await page.locator('#page-label').innerText(),/16 项指标/);await page.locator('#query').fill('化妆品');assert.match(await page.locator('#trend-title').innerText(),/化妆品/);assert.equal(await page.locator('#directory tr').count(),1);
  let downloaded=page.waitForEvent('download');await page.locator('#export-latest').click();let dl=await downloaded;let csv=fs.readFileSync(await dl.path(),'utf8');assert.match(csv,/化妆品类/);assert.match(csv,/"368"/);assert.equal(csv.split('\r\n').length,2);
  await page.locator('#reset').click();await page.locator('#connection').selectOption('pending');assert.equal(await page.locator('#directory tr').count(),1);assert.equal(await page.locator('#export-latest').isDisabled(),true);assert.equal(await page.locator('#export-series').isDisabled(),true);assert.match(await page.locator('#chart').innerText(),/待接入/);
  await page.locator('#reset').click();await page.locator('#frequency').selectOption('quarterly');assert.match(await page.locator('#directory').innerText(),/2026-Q2/);await page.locator('#indicator').selectOption('income_national');assert.equal(await page.locator('#basis').inputValue(),'ytd');assert.match(await page.locator('#series-definition').innerText(),/季度发布为年初累计/);
  await page.locator('#reset').click();await page.locator('#indicator').selectOption('retail');await page.locator('#from').fill('2026-08-01');await page.locator('#to').fill('2026-08-31');await page.locator('#to').dispatchEvent('change');assert.equal(await page.locator('#history tr').count(),1);assert.match(await page.locator('#history').innerText(),/39,824/);
  downloaded=page.waitForEvent('download');await page.locator('#export-series').click();dl=await downloaded;csv=fs.readFileSync(await dl.path(),'utf8');assert.equal(csv.split('\r\n').length,2);assert.match(csv,/2026-09-15/);
  await page.locator('#clear-range').click();await page.locator('#indicator').selectOption('cpi');assert.equal(await page.locator('#measure option[value=yoy]').evaluate(el=>el.disabled),true);assert.equal(await page.locator('#measure').inputValue(),'value');assert.match(await page.locator('#value-heading').innerText(),/同比涨跌幅/);
  await page.locator('#indicator').selectOption('confidence');assert.match(await page.locator('#value-heading').innerText(),/点/);assert.match(await page.locator('#history').innerText(),/89.5/);assert.equal(await page.locator('#measure option[value=yoy]').evaluate(el=>el.disabled),true);
  await page.locator('[data-cm-view=structure]').click();await page.locator('[data-retail=categories]').click();assert.equal(await page.locator('#retail-bars .retail-row').count(),6);assert.match(await page.locator('#retail-note').innerText(),/展开其余 10 类/);await page.locator('.retail-detail-toggle').click();assert.equal(await page.locator('#retail-bars .retail-row').count(),16);assert.equal(await page.locator('.retail-detail-toggle').getAttribute('aria-expanded'),'true');await page.locator('.retail-detail-toggle').click();assert.equal(await page.locator('#retail-bars .retail-row').count(),6);await page.locator('#retail-basis').selectOption('year');assert.match(await page.locator('#retail-context').innerText(),/2025/);await page.locator('#retail-period').selectOption('2017');assert.match(await page.locator('#retail-context').innerText(),/2017/);
  await page.locator('#indicator').selectOption('holiday_travel');assert.match(await page.locator('#history').innerText(),/预计/);assert.match(await page.locator('#history').innerText(),/日均同比/);
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/consumption-macro.html');await page.waitForSelector('#content:not([hidden])');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('.site-nav nav a').count(),6);assert.equal(await page.locator('.site-nav nav a[href="company-database.html"]').count(),1);await page.screenshot({path:path.join(out,'消费宏观-手机预览.png'),fullPage:true});
  await page.goto(base+'/industry.html');await page.waitForSelector('.site-nav nav');assert.equal(await page.locator('.site-nav nav a').count(),6);assert.match(await page.locator('.site-nav a.current').innerText(),/行业数据/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.route('**/data/macro/automatic-series.json',route=>route.fulfill({status:503,body:'unavailable'}));await page.goto(base+'/consumption-macro.html');await page.waitForSelector('#automatic-warning:not([hidden])');assert.equal(await page.locator('#content').isVisible(),true);assert.match(await page.locator('#kpis').innerText(),/39,824/);await page.unroute('**/data/macro/automatic-series.json');
  // Headline growth never substitutes the amount when YoY is absent; real zeros stay visible.
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'data/consumption-macro/observations.json'),'utf8'));
  for(const row of fixture.observations){
    if(row.indicatorId==='retail'&&row.frequency==='monthly'&&row.basis==='month'){row.yoy=0;row.value=0;}
    if(row.indicatorId==='online_goods')row.yoy=null;
    if(row.indicatorId==='cpi')row.value=0;
  }
  await page.route('**/data/macro/automatic-series.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.route('**/data/consumption-macro/observations.json',route=>route.fulfill({json:fixture}));
  await page.goto(base+'/consumption-macro.html');await page.waitForSelector('#content:not([hidden])');
  assert.match(await page.locator('.cm-kpi[data-id=retail] strong').innerText(),/^0/);
  assert.match(await page.locator('.cm-kpi[data-id=retail] .cm-kpi-amount').innerText(),/金额 0 亿元/);
  assert.match(await page.locator('.cm-kpi[data-id=online_goods] strong').innerText(),/—[\s\S]*同比未提供/);
  assert.match(await page.locator('.cm-kpi[data-id=cpi] strong').innerText(),/^0/);
  await page.unroute('**/data/consumption-macro/observations.json');
  await page.route('**/data/consumption-macro/observations.json',route=>route.fulfill({status:503,body:'unavailable'}));await page.goto(base+'/consumption-macro.html');await page.waitForSelector('#status[role=alert]');assert.match(await page.locator('#status').innerText(),/503/);assert.equal(await page.locator('#content').isHidden(),true);
  assert.deepEqual(errors,[]);console.log('PASS: dashboard loading, navigation, pagination, filters, pending, quarterly scope, date range, CSV downloads, CPI rates, estimates, mobile layout, existing home navigation, and fetch failure.');
 }catch(error){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw error;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});





