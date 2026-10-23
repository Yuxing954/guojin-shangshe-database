'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');let server;
async function main(){
  let base=process.env.TRAVEL_BASE_URL;
  if(!base){server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html'};res.setHeader('Content-Type',(types[path.extname(file)]||'application/octet-stream')+';charset=utf-8');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base+'/travel-dashboard.html');await page.locator('#dashboard:not([hidden])').waitFor();
    assert.equal(await page.locator('.travel-tabs button').count(),3);assert(await page.locator('#holiday-trips svg').count());assert((await page.locator('#domestic-kpis').innerText()).includes('7,383.75'));
    await page.selectOption('#holiday','春节');await page.selectOption('#holiday-basis','daily');assert((await page.locator('#domestic-kpis').innerText()).includes('9天'));assert.equal(await page.locator('#holiday-table tbody tr').count(),1);
    await page.selectOption('#domestic-year','all');assert(await page.locator('#holiday-table tbody tr').count()>5);
    await page.click('[data-view=inbound]');await page.locator('#view-inbound:not([hidden])').waitFor();assert((await page.locator('#inbound-kpis').innerText()).includes('1,160.1'));assert((await page.locator('#inbound-kpis').innerText()).includes('77.5'));
    assert.equal(await page.locator('#origins li').count(),10);await page.selectOption('#border-scope','h1');const headline=await page.locator('#inbound-kpis').innerText();assert(headline.includes('2,291.4'));assert(headline.includes('4,590.6'));assert(headline.includes('20.4%'));assert(headline.includes('20.6%'));
    await page.selectOption('#border-scope','annual');assert.equal(await page.locator('#border-table tbody tr').count(),4);assert((await page.locator('#tourist-table').innerText()).includes('15,450'));
    const downloadPromise=page.waitForEvent('download');await page.click('#export');const download=await downloadPromise;const file=await download.path();const csv=fs.readFileSync(file,'utf8');assert(csv.includes('外国人单向入境'));assert(csv.includes('文旅部全年'));assert(csv.includes('https://www.nia.gov.cn'));
    await page.click('[data-view=outbound]');await page.locator('#view-outbound:not([hidden])').waitFor();assert(await page.locator('#outbound-chart svg').count());assert.equal(await page.locator('#destination-table tbody tr').count(),9);
    await page.selectOption('#outbound-scope','ytd');assert.equal(await page.locator('#outbound-table tbody tr').count(),6);await page.selectOption('#destination','新加坡');await page.selectOption('#outbound-year','2019');assert((await page.locator('#outbound-table').innerText()).includes('—'));
    await page.selectOption('#destination','马来西亚');assert((await page.locator('#asof').innerText()).includes('期间待核验'));assert.equal(await page.locator('#outbound-chart svg').count(),0);
    for(const width of [1440,1024,768,390]){await page.setViewportSize({width,height:1000});for(const tab of ['domestic','inbound','outbound']){await page.click('[data-view='+tab+']');await page.waitForTimeout(70);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+width+' '+tab);}}
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/industry.html?panelSector=travel&panelView=view%3Dinbound#travel');await page.locator('#industry-stage[data-state=ready]').waitFor({timeout:45000});const frame=page.frameLocator('#panel-travel');await frame.locator('#view-inbound:not([hidden])').waitFor();assert.equal(await frame.locator('.site-nav').count(),0);assert(await page.locator('[data-key=travel][aria-pressed=true]').count());
    const height=await page.locator('#panel-travel').evaluate(e=>e.getBoundingClientRect().height);assert(height>800);await frame.locator('[data-view=outbound]').click();await page.waitForFunction(()=>new URLSearchParams(location.search).get('panelView')==='view=outbound');
    await page.goto(base+'/data-notes.html#travel');await page.locator('#notes-content').getByText('来源记录',{exact:true}).waitFor();assert((await page.locator('#notes-content').innerText()).includes('马来西亚'));
    await page.route('**/data/tourism/dashboard.json*',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto(base+'/travel-dashboard.html');await page.locator('#load-error:not([hidden])').waitFor();assert(await page.locator('#export').isDisabled());await page.unroute('**/data/tourism/dashboard.json*');await page.locator('#load-error button').click();await page.locator('#dashboard:not([hidden])').waitFor();
    if(process.env.TRAVEL_SCREENSHOT){await page.screenshot({path:process.env.TRAVEL_SCREENSHOT,fullPage:true});await page.click('[data-view=inbound]');await page.screenshot({path:process.env.TRAVEL_SCREENSHOT.replace('.png','-inbound.png'),fullPage:true});}
    assert.deepEqual(errors,[]);console.log('PASS travel browser: three boards, scope filters, source-linked CSV, missing dates, complete YTD, 1440/1024/768/390 widths, embedded board, saved view, data notes, failure/retry');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server?.close());

