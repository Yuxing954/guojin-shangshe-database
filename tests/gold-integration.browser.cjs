'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SECTOR_BASE_URL||'http://127.0.0.1:18765';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/data/gold-jewelry/'))requests.push(r.url());});
 try{
  await page.goto(base+'/industry.html#hotel');await page.locator('#content').waitFor({state:'visible'});assert.equal(requests.length,0,'gold data loads when selected');
  await page.click('[data-key="gold"]');await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(new URL(page.url()).hash,'#gold');assert.equal(await page.locator('#page-title').innerText(),'黄金');assert.equal(await page.locator('#sector-detail').isVisible(),false);assert.equal(await page.locator('.site-nav').count(),1);assert.equal(await page.locator('h1:visible').count(),1);assert.equal(requests.length,5);assert.ok(await page.locator('#macro-chart svg').count());
  for(const view of ['demand','companies','prices','sources','overview']){
   await page.click('.gj-tabs [data-view="'+view+'"]');assert.ok(await page.locator('#view-'+view).isVisible());assert.equal(new URL(page.url()).hash,'#gold');
  }
  const download=page.waitForEvent('download');await page.click('#macro-export');assert.ok((await download).suggestedFilename().includes('金价驱动'));
  await page.click('#gold-industry-history > summary');assert.ok(await page.locator('#content').isVisible());assert.ok(await page.locator('#chart svg').count());
  await page.click('[data-key="hotel"]');assert.ok(await page.locator('#content').isVisible());assert.ok(!await page.locator('#gold-content').isVisible());assert.equal(await page.locator('#content').evaluate(el=>el.parentElement.tagName),'MAIN');
  await page.click('[data-key="gold"]');await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(requests.length,5,'switching does not duplicate data requests');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width:1440,height:1000});
  for(const [old,view] of [['overview','overview'],['companies','companies'],['brand-panel','prices'],['source-panel','sources']]){
   await page.goto(base+'/gold-jewelry.html?keep=1#'+old);await page.waitForURL(/industry\.html.*#gold/);await page.locator('#dashboard').waitFor({state:'visible'});assert.ok(await page.locator('#view-'+view).isVisible());assert.equal(new URL(page.url()).searchParams.get('keep'),'1');
  }
  await page.route('**/data/gold-jewelry/macro.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto(base+'/industry.html#gold');await page.locator('#gold-retry').waitFor({state:'visible'});assert.ok((await page.locator('#load-error').innerText()).includes('暂时无法读取'));
  assert.deepEqual(errors,[]);console.log('PASS: unified gold views, industry switching, lazy data, legacy views, CSV, mobile layout and load failure');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
