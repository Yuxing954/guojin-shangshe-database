'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'}[path.extname(file)]||'application/octet-stream'});res.end(error?'missing':body);});});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port+'/macro.html?country=CN&indicator=cn-cpi';
  const ready=()=>page.waitForSelector('#indicators:not([hidden]) .macro-kpi');
  try{
    await page.goto(url);await ready();
    assert.equal(await page.locator('.macro-expectation-reading').count(),3);
    assert.equal(await page.locator('#forecast-overview tbody tr').count(),3);
    for(const id of ['cn-cpi','cn-gdp-quarter','cn-retail']){
      await page.locator('[data-kpi="'+id+'"]').click();
      assert.match(await page.locator('.macro-forecast-latest').innerText(),/Choice 预测/);
      await page.locator('.macro-forecast-history summary').click();
      assert.ok(await page.locator('.macro-forecast-history tbody tr').count()>=8);
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载预测 CSV',exact:true}).click();
      const csv=fs.readFileSync(await(await download).path(),'utf8');assert.match(csv,/Choice预测%/);assert.match(csv,/公布前版本已核验/);
      if(id==='cn-gdp-quarter')assert.equal(await page.locator('.macro-forecast-history tbody tr').first().locator('td').nth(3).innerText(),'—');
    }
    for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow at '+width);}
    if(process.env.MACRO_SCREENSHOT_DIR){fs.mkdirSync(process.env.MACRO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MACRO_SCREENSHOT_DIR,'macro-expectations-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:path.join(process.env.MACRO_SCREENSHOT_DIR,'macro-expectations-desktop.png'),fullPage:true});}
    await page.locator('[data-country="US"]').click();assert.equal(await page.locator('.macro-expectation-reading').count(),0);assert.equal(await page.locator('#forecast-overview tbody tr').count(),0);
    await page.route('**/data/macro/expectations.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto(url);await ready();assert.match(await page.locator('#data-warning').innerText(),/预测数据读取失败/);assert.equal(await page.locator('.macro-kpi').count(),6);
    await page.unroute('**/data/macro/expectations.json');await page.locator('#retry').click();await page.waitForFunction(()=>document.querySelector('#forecast-overview tbody tr'));assert.ok(await page.locator('#data-warning').isHidden());
    assert.deepEqual(errors,[]);console.log('PASS: three forecast series, historical/future periods, CSV, missing definitions, country switch, narrow screens, failure and retry');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
