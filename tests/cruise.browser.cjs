const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),origin=process.argv[2]||'http://127.0.0.1:'+server.address().port,errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/cruise-dashboard.html');await page.locator('#dashboard:not([hidden])').waitFor();assert.equal(await page.locator('#monthly-table tbody tr').count(),33);assert.equal(await page.locator('#charts svg').count(),3);assert((await page.locator('#kpis').innerText()).includes('11.95'));
 assert.equal(await page.locator('tr[data-period="2024-01"] td').nth(1).innerText(),'1.0025');
 await page.selectOption('#year','2026');assert.equal(await page.locator('#monthly-table tbody tr').count(),9);await page.selectOption('#scope','ytd');assert((await page.locator('#kpis').innerText()).includes('96.21'));
 assert.equal(await page.locator('#view').count(),0);assert.equal(await page.locator('#charts input[type=checkbox]').count(),6);
 const passengers=page.locator('#chart-passengers'),values=passengers.locator('[data-value-kind=value]'),yoy=passengers.locator('[data-value-kind=change]');
 assert.equal(await values.isChecked(),false);assert(await yoy.isChecked());assert(await passengers.locator('.site-value-label[data-kind=change]').count()>0);await yoy.uncheck();await values.check();assert(await passengers.locator('.site-value-label[data-kind=value]').count()>0);assert.equal(await passengers.locator('.site-value-label[data-kind=change]').count(),0);
 await yoy.check();assert(await passengers.locator('.site-value-label[data-kind=change]').count()>0);assert((await passengers.locator('.site-value-labels').textContent()).includes('96.2'));assert((await passengers.locator('.site-value-labels').textContent()).includes('+6.7%'));
 await values.uncheck();assert.equal(await passengers.locator('.site-value-label[data-kind=value]').count(),0);assert(await passengers.locator('.site-value-label[data-kind=change]').count()>0);
 await page.selectOption('#scope','monthly');assert(await yoy.isChecked());assert.equal(await values.isChecked(),false);await page.selectOption('#scope','ytd');
 const download=page.waitForEvent('download');await page.click('#export');const file=await download;const content=fs.readFileSync(await file.path(),'utf8');assert.equal(content.trim().split(/\r?\n/).length,10);assert(content.includes('96.21'));
 await page.click('[data-cruise-view="audience"]');await page.locator('#ca-age-table').waitFor();assert((await page.locator('#ca-kpis').innerText()).includes('55.16'));assert(await page.locator('#ca-season input[data-value-kind="value"]').isChecked());
 await page.locator('#ca-season input[data-value-kind="value"]').uncheck();await page.selectOption('#ca-window','24');assert.equal(await page.locator('#ca-season input[data-value-kind="value"]').isChecked(),false);
 await page.click('[data-cruise-view="operators"]');await page.locator('#ca-company-table').waitFor();assert((await page.locator('#ca-kpis').innerText()).includes('32.66'));assert.equal(await page.locator('#ca-ranking .ca-rank-row').count(),7);
 for(const width of [1440,1024,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),String(width));}
 await page.click('[data-cruise-view="overview"]');assert(await page.locator('#cruise-overview').isVisible());
 if(process.env.CRUISE_SCREENSHOT)await page.screenshot({path:process.env.CRUISE_SCREENSHOT,fullPage:true});
 await page.goto(origin+'/data-notes.html#tourism');await page.locator('#notes-content .notes-source-item').first().waitFor({state:'attached'});assert((await page.locator('#notes-content').innerText()).includes('2024-01'));
 await page.goto(origin+'/industry.html#tourism');await page.locator('#panel-tourism[data-state=ready]').waitFor();assert(await page.locator('#panel-tourism').isVisible());assert.equal(await page.locator('[data-key=tourism]').getAttribute('aria-pressed'),'true');assert.equal(await page.frameLocator('#panel-tourism').locator('#monthly-table tbody tr').count(),33);
 await page.route('**/data/tourism/three-gorges-cruises.json*',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto(origin+'/industry.html?test=cruise-failure#tourism');await page.locator('#industry-stage[data-state=error]').waitFor();await page.unroute('**/data/tourism/three-gorges-cruises.json*');await page.click('#industry-load-retry');await page.locator('#panel-tourism[data-state=ready]').waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: cruise charts, one-decimal independent value/YoY labels, preserved controls, period/scope filters, CSV, missing data, responsive layout, notes, industry embed, failure/retry');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());

