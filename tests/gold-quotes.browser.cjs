/* Deterministic widget lifecycle tests. Provider fixtures are test-only; live prices are never synthesized in production. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),external=process.argv[2];
let server,browser;
(async()=>{
 let base=external;
 if(!base){server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(p)]||'application/octet-stream');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/';}
 const pageUrl=new URL('quotes.html',base).href;
 browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];let embedCalls=0,quoteCalls=0,failNext=false;
 page.on('pageerror',e=>errors.push(e.message));
 if(external)await page.route(new URL('./',pageUrl).href+'**',async r=>{const p=path.resolve(root,decodeURIComponent(new URL(r.request().url()).pathname.replace(new URL('./',pageUrl).pathname,'')));if(p.startsWith(root+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile())await r.fulfill({path:p});else await r.continue();});
 await page.route('**/qt.gtimg.cn/**',async r=>{quoteCalls++;const u=new URL(r.request().url());const names=(u.searchParams.get('q')||u.pathname.split('/q=')[1]?.split('&')[0]||'').split(',');const text=names.map(n=>{const f=Array(50).fill('');f[1]='测试';f[3]='100';f[4]='99';f[30]='20261026150000';f[31]='1';f[32]='1';f[33]='101';f[34]='98';return 'var v_'+n+'='+JSON.stringify(f.join('~'))+';';}).join('\n');await r.fulfill({contentType:'application/javascript',body:text});});
 await page.route('**/s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',async r=>{
  embedCalls++;if(failNext){failNext=false;await r.fulfill({status:503,contentType:'application/javascript',body:''});return;}
  await r.fulfill({contentType:'application/javascript',body:"(()=>{const s=document.currentScript,c=JSON.parse(s.textContent),f=document.createElement('iframe');f.style.cssText='width:100%;height:100%;border:0';f.src='https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=zh_CN#'+encodeURIComponent(JSON.stringify(c));s.parentElement.querySelector('.tradingview-widget-container__widget').append(f);})();"});
 });
 await page.route('**/www.tradingview-widget.com/embed-widget/advanced-chart/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"><div>Test-only provider frame</div></body></html>'}));
 await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.getElementById('content').hidden);
 assert.equal(embedCalls,0,'stock default must not contact gold provider');
 await page.locator('[data-quote-market="gold"]').click();
 await page.locator('#gold-widget iframe').waitFor();
 await page.waitForFunction(()=>document.getElementById('gold-market').dataset.state==='embedded');
 assert.equal(await page.locator('#stock-market').isVisible(),false);
 assert.match(await page.locator('.quotes-gold-head').innerText(),/美元\/金衡盎司/);
 const config=()=>page.locator('#gold-widget script').evaluate(s=>JSON.parse(s.textContent));
 assert.equal((await config()).symbol,'OANDA:XAUUSD');assert.equal((await config()).interval,'D');
 assert.match(await page.locator('#gold-widget .tradingview-widget-copyright a').getAttribute('href'),/XAUUSD/);
 for(const period of ['W','M']){await page.locator('[data-gold-period="'+period+'"]').click();await page.waitForFunction(p=>{const s=document.querySelector('#gold-widget script');return s&&JSON.parse(s.textContent).interval===p&&document.querySelector('#gold-widget iframe');},period);assert.equal(await page.locator('#gold-widget iframe').count(),1);assert.equal(await page.locator('[data-gold-period="'+period+'"]').getAttribute('aria-pressed'),'true');}
 const beforeDomestic=embedCalls;
 await page.locator('[data-gold-instrument="shanghai"]').click();
 assert.equal(await page.locator('#gold-widget iframe').count(),0);
 assert.equal(await page.locator('#gold-market').getAttribute('data-state'),'external');
 assert.match(await page.locator('#gold-title').innerText(),/沪金期货.*连续合约/);
 assert.match(await page.locator('#gold-meta').innerText(),/SHFE:AU1!.*人民币\/克/);
 assert.match(await page.locator('#gold-external-link').getAttribute('href'),/SHFE-AU1%21/);
 assert.match(await page.locator('#gold-external').innerText(),/登录/);
 assert.equal(await page.locator('#gold-periods').isVisible(),false);
 assert.equal(await page.locator('#gold-refresh').isVisible(),false);
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'domestic overflow '+width);}
 await page.waitForTimeout(300);assert.equal(embedCalls,beforeDomestic,'restricted SHFE must not request an unsupported embed');
 await page.locator('[data-gold-instrument="london"]').click();await page.locator('#gold-widget iframe').waitFor();
 assert.equal((await config()).symbol,'OANDA:XAUUSD');assert.equal((await config()).interval,'M');
 assert.match(await page.locator('#gold-meta').innerText(),/美元\/金衡盎司/);
 const paused=quoteCalls;await page.waitForTimeout(1250);assert.equal(quoteCalls,paused,'stock polling must pause in gold');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:950});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'overflow '+width);assert.ok((await page.locator('#gold-widget iframe').boundingBox()).width>200);}
 await page.locator('[data-quote-market="stock"]').click();await page.waitForFunction(()=>!document.getElementById('stock-market').hidden);
 assert.equal(await page.locator('#gold-widget iframe').count(),0);await page.waitForTimeout(1250);assert.ok(quoteCalls>paused,'stock polling must resume');
 await page.goto(pageUrl+'#gold',{waitUntil:'domcontentloaded'});await page.locator('#gold-widget iframe').waitFor();
 await page.waitForFunction(()=>!document.getElementById('content').hidden);assert.equal(new URL(page.url()).hash,'#gold');
 await page.waitForLoadState('load');await page.waitForFunction(()=>document.getElementById('gold-market').dataset.state==='embedded');failNext=true;await page.locator('#gold-refresh').click();await page.locator('#gold-retry').waitFor();assert.match(await page.locator('#gold-state').innerText(),/暂时无法连接/);
 await page.locator('#gold-retry').click();await page.locator('#gold-widget iframe').waitFor();await page.waitForFunction(()=>document.getElementById('gold-state').hidden);
 assert.equal(await page.locator('#gold-widget iframe').count(),1);assert.deepEqual(errors,[]);
 console.log('gold-quotes: stock default, London/SHFE instrument units and restricted entry, OANDA source, D/W/M, pause/resume, deep link, retry and 1440/768/390/320 layouts passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
