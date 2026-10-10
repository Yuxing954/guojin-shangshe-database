const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SECTOR_BASE_URL||'http://127.0.0.1:8765',output=process.env.SECTOR_SCREENSHOTS;
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 for(const sid of ['dining']){
  await page.goto(base+'/'+sid+'.html');await page.locator('#content').waitFor({state:'visible'});assert.equal(await page.locator('#core button').count(),3);assert.ok(await page.locator('#chart svg').count());
  await page.selectOption('#metric',sid==='dining'?'dining_revenue':'us_ecommerce_sa');
  assert.ok((await page.locator('#metric-meta').innerText()).includes(sid==='dining'?'亿元':'亿美元'));
  if(sid==='dining'){assert.equal(await page.inputValue('#basis'),'monthly');await page.selectOption('#basis','combined');await page.locator('#view-market details').evaluate(el=>el.open=true);assert.ok((await page.locator('#history').innerText()).includes('1—2月'));await page.selectOption('#basis','monthly');await page.locator('#view-market details').evaluate(el=>el.open=false);}
  const pending=page.waitForEvent('download');await page.click('#download');const downloaded=await pending;assert.ok(downloaded.suggestedFilename().endsWith('.csv'));const stream=await downloaded.createReadStream();let csv='';for await(const part of stream)csv+=part.toString();assert.ok(csv.includes('发布日期'));assert.ok(csv.includes('统计口径'));
  await page.fill('#from','2099-01-01');await page.locator('#from').dispatchEvent('change');assert.ok((await page.locator('#chart').innerText()).includes('暂无数据'));await page.click('#clear-range');
  if(output)await page.screenshot({path:path.join(output,sid+'-desktop.png'),fullPage:true});
  await page.click('[data-view="companies"]');await page.selectOption('#company',sid==='dining'?'dpc':'anker');await page.selectOption('#company-period','2026-H1');assert.ok(await page.locator('#company-history tr').count());
  const text=await page.locator('#company-history').innerText();assert.ok(text.includes(sid==='dining'?'元/单':'亿元'));
  await page.fill('#company-search','不存在的指标');assert.ok((await page.locator('#company-history').innerText()).includes('暂无公司数据'));await page.fill('#company-search','');
  await page.click('[data-view="sources"]');assert.ok((await page.locator('#source-list').innerText()).includes('发布日期'));assert.ok((await page.locator('#gaps').innerText()).includes('未'));
  await page.click('[data-view="market"]');await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));if(output)await page.screenshot({path:path.join(output,sid+'-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 }
 await page.goto(base+'/industry.html#dining');await page.locator('#panel-dining').waitFor({state:'visible'});assert.equal(await page.locator('#page-title').innerText(),'餐饮');assert.equal(await page.locator('#specialist').count(),0);assert.equal(await page.locator('[data-key=overseas]').count(),0);
 await page.goto(base+'/company-database.html');assert.equal(await page.locator('[aria-label="公司板块"] a[href="industry.html?panelView=companies#dining"]').count(),1);assert.equal(await page.locator('[aria-label="公司板块"] a[href="overseas.html#companies"]').count(),0);
 await page.route('**/data/sectors/dining.json',route=>route.fulfill({status:503,body:'failed'}));await page.goto(base+'/dining.html');await page.locator('#retry').waitFor({state:'visible'});assert.ok((await page.locator('#status').innerText()).includes('暂时无法读取'));assert.ok(!await page.locator('#content').isVisible());
 assert.deepEqual(errors,[]);console.log('Sector browser: desktop/mobile, basis filters, company periods, CSV, empty/error states and legacy keys passed');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
