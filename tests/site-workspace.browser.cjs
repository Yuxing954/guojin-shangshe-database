'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(file)]||'text/plain'}).end(b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(base+'/industry.html?metric=dutyfree_sales&years=3#dutyfree');
 await page.locator('#panel-dutyfree').waitFor({state:'visible'});await page.locator('#site-save-page').click();
 assert.equal(await page.locator('#site-save-page').getAttribute('aria-pressed'),'true');
 const selected=page.url();await page.goto(base+'/index.html');
 await page.locator('#workspace-home a').waitFor();assert.match(await page.locator('#workspace-home').innerText(),/免税/);
 await page.locator('#home-workspace-open').click();await page.locator('.site-workspace-dialog[open]').waitFor();
 assert.equal(await page.locator('#site-saved-list a').count(),1);
 await page.locator('#site-workspace-search').fill('不存在的标题');assert.match(await page.locator('#site-saved-list').innerText(),/没有匹配/);
 await page.locator('#site-workspace-search').fill('');await page.keyboard.press('Escape');assert.equal(await page.locator('.site-workspace-dialog[open]').count(),0);
 await page.locator('#workspace-home a').click();assert.equal(page.url(),selected);
 await page.locator('#site-open-workspace').click();await page.locator('[data-workspace-remove]').click();
 assert.equal(await page.locator('#site-saved-list a').count(),0);await page.locator('#site-clear-recent').click();assert.equal(await page.locator('#site-recent-list a').count(),0);await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/index.html');await page.locator('.site-workspace-open').click();await page.locator('.site-workspace-dialog[open]').waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const rect=await page.locator('.site-workspace-dialog').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=390);
 await page.keyboard.press('Escape');await page.locator('.home-sector-shortcuts a[href="industry.html#gold"]').click();await page.waitForURL(/industry.html#gold/);
 assert.deepEqual(errors,[]);
 console.log('PASS workspace persistence, exact filter restoration, search, removal, history and mobile dialog');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
