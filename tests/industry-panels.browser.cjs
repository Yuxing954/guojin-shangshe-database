'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SECTOR_BASE_URL||'http://127.0.0.1:18765';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/industry.html#hotel');await page.locator('#panel-hotel').waitFor({state:'visible'});assert.equal(await page.locator('[data-key]').count(),4);assert.equal(await page.locator('[data-key=overseas]').count(),0);assert.equal(await page.locator('#sector-detail,#specialist').count(),0);
  for(const sid of ['hotel','dutyfree','dining']){
   await page.click('[data-key="'+sid+'"]');const frame=page.frameLocator('#panel-'+sid);await frame.locator(sid==='hotel'?'#main-chart svg':sid==='dutyfree'?'#hn-growth':'#chart svg').waitFor({timeout:45000});assert.equal(await frame.locator('.site-nav').count(),0);assert.equal(await frame.locator('h1:visible').count(),0);assert.equal(await page.locator('h1:visible').innerText(),{hotel:'酒店',dutyfree:'免税',dining:'餐饮'}[sid]);
   await page.waitForFunction(sid=>{const f=document.getElementById('panel-'+sid),main=f.contentDocument.querySelector('main');return f.offsetHeight>650&&Math.abs(f.offsetHeight-main.getBoundingClientRect().height-8)<3;},sid);
   if(sid==='dining'){await frame.locator('[data-view=companies]').click();await frame.locator('#company').selectOption('dpc');assert.ok(await frame.locator('#company-history tr').count());await frame.locator('[data-view=market]').click();const download=page.waitForEvent('download');await frame.locator('#download').click();assert.ok((await download).suggestedFilename().endsWith('.csv'));}
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width:1440,height:1000});
  }
  await page.click('[data-key=gold]');await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(await page.locator('#industry-panels').isVisible(),false);
  await page.goto(base+'/index.html');await page.waitForFunction(()=>document.querySelectorAll('.industry-card').length===4);assert.ok(!(await page.locator('#industry-list').innerText()).includes('出海'));
  await page.goto(base+'/overseas.html');await page.waitForURL(/industry.html#hotel/);await page.locator('#panel-hotel').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);console.log('PASS: four direct boards, retired overseas/topic entries, charts, company data, CSV, mobile and iframe sizing');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
