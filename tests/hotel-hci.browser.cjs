const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.csv':'text/csv; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{const file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}try{const bytes=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain'}).end(bytes);}catch{res.writeHead(404).end();}});
async function main(){await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});try{
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.argv[2]||'http://127.0.0.1:'+server.address().port)+'/hotel-dashboard.html');await page.waitForSelector('#hci-chart svg');await page.waitForSelector('#dashboard:not([hidden])');
assert.equal(await page.locator('#hotel-hci').evaluate(e=>e.closest('.hd-view').id),'view-overview');assert.match(await page.locator('#hci-summary').innerText(),/2026-08.*104.1.*-2.7%/);
await page.getByText('月度明细与来源',{exact:true}).click();assert.equal(await page.locator('#hci-table tbody tr').count(),16);
for(const metric of ['hci','adr_index','occupancy_index','booking_index','food_revenue_index','confidence_index']){await page.selectOption('#hci-metric',metric);assert.equal(await page.locator('#hci-table tbody tr').count(),16);}
await page.selectOption('#hci-metric','occupancy_index');assert.match(await page.locator('#hci-table tbody tr').first().innerText(),/待核验/);
await page.selectOption('#hci-year','2025');assert.equal(await page.locator('#hci-table tbody tr').count(),8);await page.selectOption('#hci-mode','change');assert.match(await page.locator('#hci-chart').innerText(),/暂无数据/);
await page.selectOption('#hci-year','');await page.selectOption('#hci-mode','value');await page.selectOption('#hci-metric','adr_index');
await page.locator('[data-view="cities"]').click();assert.equal(await page.locator('#hotel-hci').isVisible(),false);await page.locator('[data-view="overview"]').click();assert.equal(await page.locator('#hotel-hci').isVisible(),true);
for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(180);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#hotel-hci').scrollIntoViewIfNeeded();if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.locator('#hotel-hci').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'hci-'+width+'.png')});}}
if(!process.argv[2]){await page.route('**/data/hotel-hci/observations.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.reload();await page.waitForSelector('#hci-retry:not([hidden])');assert.match(await page.locator('#hci-status').innerText(),/读取失败/);await page.unroute('**/data/hotel-hci/observations.json');await page.locator('#hci-retry').click();await page.waitForSelector('#hci-chart svg');}
assert.deepEqual(errors,[]);console.log('PASS: six metrics, history filter, missing YoY, conflict flag, view isolation, responsive layout, failure and retry');
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());

