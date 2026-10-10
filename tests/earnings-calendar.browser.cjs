const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8'};
const server=http.createServer((req,res)=>{const file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://local/').pathname));if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}try{const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const NativeDate=Date;class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:['2026-10-10T00:00:00Z']));}static now(){return new NativeDate('2026-10-10T00:00:00Z').getTime();}}window.Date=FixedDate;});
 await page.goto(origin+'/earnings.html');await page.waitForSelector('#content:not([hidden])');
 assert.equal(await page.locator('[data-view=list]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#rows tr').count(),10);assert.equal(await page.locator('select:visible').count(),1);assert.equal(await page.locator('#period').count(),0);
 assert.match(await page.locator('#sourceStatus').innerText(),/Choice MCP/);assert.match(await page.locator('#count').innerText(),/32 家公司.*21 家安排/);
 assert.match(await page.locator('#rows tr').first().innerText(),/携程.*2026.*9-16/s);assert.equal(await page.locator('#reminders [data-record]').count(),21);
 assert.equal(await page.locator('#moreOptions').getAttribute('open'),null);
 if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'财报日历-精简桌面.png'),fullPage:true});}
 await page.click('#historyMore');assert.equal(await page.locator('#rows tr').count(),32);
 await page.fill('#search','601888');assert.equal(await page.locator('#rows tr').count(),1);
 await page.click('#rows .ec-next');await page.waitForSelector('dialog[open]');assert.match(await page.locator('#detailBody').innerText(),/2026-10-31/);assert.match(await page.locator('#detailBody').innerText(),/实际披露日\s*待公布/);
 await page.click('#watchCompany');await page.keyboard.press('Escape');await page.click('#moreOptions summary');await page.check('#watchOnly');await page.fill('#search','');assert.equal(await page.locator('#rows tr').count(),1);
 await page.reload();await page.waitForSelector('#content:not([hidden])');assert.equal(await page.locator('#watchOnly').isChecked(),true);assert.equal(await page.locator('#rows tr').count(),1);
 await page.click('#moreOptions summary');await page.uncheck('#watchOnly');await page.selectOption('#market','港股');await page.click('#count');assert.equal(await page.locator('#rows tr').count(),10);assert.match(await page.locator('#rows').innerText(),/携程/);assert.equal(await page.locator('#reminders [data-record]').count(),0);
 await page.click('#moreOptions summary');await page.selectOption('#market','');await page.click('#count');
 await page.click('[data-view=month]');assert.equal(await page.locator('#grid .ec-day').count(),42);assert.match(await page.locator('#rangeTitle').innerText(),/2026 年 10 月/);
 await page.click('[data-date="2026-10-31"]');assert.equal(await page.locator('#dayEvents [data-record]').count(),4);await page.locator('#dayEvents [data-record]').first().click();assert.match(await page.locator('#detailBody').innerText(),/Choice/);await page.keyboard.press('Escape');
 await page.click('[data-view=week]');assert.equal(await page.locator('#grid .ec-day').count(),7);await page.click('#today');await page.click('[data-view=list]');
 await page.fill('#search','海底捞');await page.click('#rows .ec-company');assert.match(await page.locator('#detailBody').innerText(),/实际披露日\s*2026-08-25/);assert.match(await page.locator('#detailBody a').first().getAttribute('href'),/hkexnews.hk/);
 await page.locator('#detailBody details').filter({hasText:'预约与变更'}).locator('summary').click();assert.match(await page.locator('#detailBody').innerText(),/通知发布 2026-08-12/);await page.keyboard.press('Escape');await page.fill('#search','');
 await page.click('#moreOptions summary');await page.check('#history');assert.equal(await page.locator('#rows tr').count(),50);await page.click('#historyMore');assert.equal(await page.locator('#rows tr').count(),84);
 await page.click('#moreOptions summary');const download=page.waitForEvent('download');await page.click('#csv');assert.match((await download).suggestedFilename(),/\.csv$/);await page.uncheck('#history');
 await page.click('#moreOptions summary');const ics=page.waitForEvent('download');await page.click('#ics');const icsFile=await(await ics).path();const text=fs.readFileSync(icsFile,'utf8');assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,22);assert.equal((text.match(/BEGIN:VALARM/g)||[]).length,22);await page.click('#count');
 await page.fill('#search','<script>alert(1)</script>');assert.match(await page.locator('#rows').innerText(),/没有匹配公司/);assert.equal(await page.locator('script:not([src])').count(),0);await page.fill('#search','');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(await page.locator('select:visible').count(),1);const dateCell=await page.locator('#rows tr').first().locator('[data-label="实际披露日"]').boundingBox();assert.ok(dateCell.x>=0&&dateCell.x+dateCell.width<=390);
 if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'财报日历-精简手机.png'),fullPage:true});
 await page.click('[data-view=month]');assert.equal(await page.locator('#grid .ec-day').count(),42);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.click('[data-view=week]');assert.equal(await page.locator('#grid .ec-day').count(),7);await page.click('[data-view=list]');
 const failure=await context.newPage();let broken=true;await failure.route('**/data/earnings-calendar.json',route=>broken?route.fulfill({status:503,body:'unavailable'}):route.continue());await failure.goto(origin+'/earnings.html');await failure.waitForSelector('#error:not([hidden])');assert.equal(await failure.locator('#content').isVisible(),false);broken=false;await failure.click('#retry');await failure.waitForSelector('#content:not([hidden])');
 const rollover=await context.newPage();await rollover.addInitScript(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2027-01-05T00:00:00Z']));}static now(){return new NativeDate('2027-01-05T00:00:00Z').getTime();}};});await rollover.goto(origin+'/earnings.html');await rollover.waitForSelector('#content:not([hidden])');assert.equal(await rollover.locator('[data-view=list]').getAttribute('aria-pressed'),'true');assert.match(await rollover.locator('#reminders').innerText(),/暂无已公布预约/);await rollover.click('[data-view=month]');assert.match(await rollover.locator('#rangeTitle').innerText(),/2027 年 1 月/);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS: recent default/rollover, Choice data, simplified controls, nearest reservations, latest reports, month/week, original documents, filters/watch, history, safe downloads, retry and mobile');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
