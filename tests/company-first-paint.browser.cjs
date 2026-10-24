const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=require('node:http').createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(p)]||'text/plain'}).end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();
for(const width of [1920,1440,1024,768,390])for(const file of ['company-database.html','overseas-hotels.html']){
await page.setViewportSize({width,height:1000});let release;const gate=new Promise(r=>release=r);
await page.route('**/scripts/site-shell.js*',async r=>{await gate;await r.continue();});
try{await page.goto('http://127.0.0.1:'+server.address().port+'/'+file,{waitUntil:'commit'});
await page.locator('body > .site-nav').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('link[rel=stylesheet]')].every(l=>l.sheet));
const read=()=>page.evaluate(()=>{const box=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}};return {main:box('body>main'),categories:box('.oh-categories'),nav:box('body>.site-nav'),font:getComputedStyle(document.body).font,bg:getComputedStyle(document.body).backgroundColor};});
const before=await read();release();await page.waitForLoadState('load');assert.deepEqual(await read(),before,file+' first paint '+width);assert.equal(await page.locator('body>.site-nav').count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log('PASS',file,width);
}finally{release();await page.unroute('**/scripts/site-shell.js*');}
}
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
