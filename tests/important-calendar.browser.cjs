const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{const file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://local/').pathname));if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}try{const content=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain'}).end(content);}catch{res.writeHead(404).end('Not found');}});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=process.argv[2]||'http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2026-10-14T02:00:00Z']));}static now(){return new NativeDate('2026-10-14T02:00:00Z').getTime();}};});
 let financialRequests=0;page.on('request',r=>{if(r.url().includes('data/earnings-calendar.json'))financialRequests++;});
 await page.goto(origin+'/earnings.html?tab=important');await page.waitForSelector('#importantBody:not([hidden])');
 assert.equal(financialRequests,0);assert.equal(await page.locator('#earningsPanel').isVisible(),false);
 assert.match(await page.locator('#importantList .ic-event').first().innerText(),/美国 CPI/);
 assert.match(await page.locator('#importantList').innerText(),/10 \/ 29\s+02:00/);
 await page.click('[data-important-region="中国"]');assert.equal(await page.locator('#importantList .ic-event').count(),4);assert(!await page.locator('#importantList').innerText().then(t=>t.includes('美国')));
 await page.click('[data-important-view="month"]');assert.equal(await page.locator('#importantGrid .ic-day').count(),42);
 await page.click('[data-important-day="2026-10-14"]');assert.equal(await page.locator('#importantList .ic-event').count(),1);assert.match(await page.locator('#importantList').innerText(),/时间已过/);
 await page.click('#importantClearDay');await page.click('[data-important-region=""]');await page.click('#importantNext');assert.equal(await page.locator('#importantList .ic-event').count(),4);
 await page.reload();await page.waitForSelector('#importantBody:not([hidden])');assert.match(await page.locator('#importantRange').innerText(),/2026年11月/);
 await page.click('#importantNext');assert.match(await page.locator('#importantList').innerText(),/12 \/ 10\s+03:00/);assert.equal(await page.locator('#importantNext').isDisabled(),true);
 const downloading=page.waitForEvent('download');await page.click('#importantExport');const file=await(await downloading).path(),ics=fs.readFileSync(file,'utf8');assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,5);assert.match(ics,/DTSTART:20261209T190000Z/);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.click('[data-important-view="upcoming"]');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'important-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'important-desktop.png'),fullPage:true});}
 await page.click('[data-calendar-tab="earnings"]');await page.waitForSelector('#content:not([hidden])');assert.equal(await page.locator('#rows tr').count(),10);assert.equal(financialRequests,1);
 await page.fill('#search','601888');assert.equal(await page.locator('#rows tr').count(),1);await page.click('[data-calendar-tab="important"]');assert.equal(await page.locator('#importantPanel').isVisible(),true);assert.match(page.url(),/tab=important/);await page.reload();await page.waitForSelector('#importantBody:not([hidden])');assert.equal(await page.locator('#earningsPanel').isVisible(),false);
 const failure=await context.newPage();await failure.route('**/data/earnings-calendar.json*',route=>route.fulfill({status:503,body:'unavailable'}));await failure.goto(origin+'/earnings.html');await failure.waitForSelector('#error:not([hidden])');await failure.click('[data-calendar-tab="important"]');await failure.waitForSelector('#importantBody:not([hidden])');assert.equal(await failure.locator('#importantList .ic-event').count()>0,true);assert.equal(await failure.locator('#error').isVisible(),false);
 const retry=await context.newPage();let broken=true;await retry.route('**/data/important-calendar.json*',route=>broken?route.fulfill({status:503,body:'unavailable'}):route.continue());await retry.goto(origin+'/earnings.html?tab=important');await retry.waitForSelector('#importantStatus button');broken=false;await retry.click('#importantStatus button');await retry.waitForSelector('#importantBody:not([hidden])');
 const expired=await context.newPage();await expired.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:['2027-01-05T00:00:00Z']));}static now(){return new D('2027-01-05T00:00:00Z').getTime();}};});await expired.goto(origin+'/earnings.html?tab=important');await expired.waitForSelector('#importantBody:not([hidden])');assert.match(await expired.locator('#importantNotice').innerText(),/待核验更新/);assert.equal(await expired.locator('#importantList .ic-event').count(),0);
 await page.click('.ic-foot a');await page.waitForSelector('#notes-tabs a[aria-current="page"]');assert.match(await page.locator('#notes-tabs a[aria-current="page"]').innerText(),/重要数据日历/);assert.match(await page.locator('#notes-content').innerText(),/冬夏令时/);assert.equal(await page.locator('.notes-source-item').count(),5);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS: curated agenda, Beijing clock, month/filter/deep link, ICS, independent failures, retry, expiry, financial regression, sources, desktop/mobile');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
