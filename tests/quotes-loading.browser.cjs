// Real browser regression: slow transport must not block cached quotes or compact rectangles.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),fixture=require('./fixtures/tencent-charts-20261009.json').find(f=>f.label==='hk_native_day');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(p,(e,body)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(p)]||'text/plain'});res.end(e?'missing':body);});});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),base='http://127.0.0.1:'+server.address().port;
 const errors=[],charts=[];let slow=false,price=100;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/data/coverage-companies.json',async route=>{if(slow)await new Promise(r=>setTimeout(r,2000));await route.fulfill({contentType:'application/json',body:fs.readFileSync(path.join(root,'data/coverage-companies.json'),'utf8')});});
 await page.route('https://**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='qt.gtimg.cn'){
   const snapshotPrice=price;if(slow)await new Promise(r=>setTimeout(r,1800));
   const codes=url.pathname.slice(3).split('&')[0].split(','),body=codes.map(code=>{const f=Array(50).fill('');f[1]='TEST ONLY';f[2]=code.startsWith('us')?code.slice(2)+'.OQ':code.slice(2);f[3]=String(snapshotPrice);f[4]='99';f[5]='100';f[30]=snapshotPrice===100?'20261012100000':'20261012100001';f[31]='1';f[32]='1';f[33]='101';f[34]='98';return 'var v_'+code+'='+JSON.stringify(f.join('~'))+';';}).join('\n');
   await route.fulfill({contentType:'application/javascript',body});return;
  }
  if(url.hostname==='web.ifzq.gtimg.cn'){
   charts.push(url.href);const code=url.searchParams.get('param').split(',')[0],callback=url.searchParams.get('_var');
   await route.fulfill({contentType:'application/javascript',body:'var '+callback+'='+JSON.stringify({data:{[code]:fixture.response.data[fixture.symbol]}})+';'});return;
  }
  await route.abort();
 });
 try{
  await page.goto(base+'/quotes.html?symbol=600754.SH');await page.waitForSelector('#chart svg');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('最近读取'));
  assert.equal(charts.length,1,'hidden benchmark charts must not request data');
  await page.waitForFunction(()=>localStorage.getItem('sinolink.quotes.snapshot.v1'));
  slow=true;price=102;const start=Date.now();await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.quotes-heat-tile');
  const cachedVisibleMs=Date.now()-start;assert.ok(cachedVisibleMs<1500,'cached board must display before delayed directory and quote responses');
  assert.match(await page.locator('#status').innerText(),/上次报价/);assert.equal(await page.locator('#overview-price').innerText(),'100.00');await page.waitForSelector('#chart svg');assert.equal(charts.length,1,'recent cached chart needs no new request');
  await page.waitForFunction(()=>document.getElementById('overview-price').textContent==='102.00');assert.doesNotMatch(await page.locator('#status').innerText(),/上次报价，正在更新/);
  for(const width of [1440,1920,1100,390]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);
   const company=await page.locator('.quotes-heat-tile').first().boundingBox();assert.ok(company.width/company.height>=1.15&&company.width/company.height<=1.55,JSON.stringify({width,company}));
   await page.locator('[data-view=sector]').click();const sector=await page.locator('.quotes-sector-tile').first().boundingBox();assert.ok(sector.width/sector.height>=1.15&&sector.width/sector.height<=1.6,JSON.stringify({width,sector}));
   await page.locator('.quotes-sector-tile').first().click();await page.locator('[data-view=sector]').click();assert.equal(await page.locator('#sector').inputValue(),'');assert.equal(await page.locator('.quotes-sector-tile').count(),7);
   if(width>1100){const board=await page.locator('.quotes-board').boundingBox(),detail=await page.locator('#quote-detail').boundingBox();assert.ok(Math.abs(board.height-detail.height)<3,JSON.stringify({board,detail}));assert.ok(board.width/detail.width<1.35);}assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('[data-view=heat]').click();
  }
  // Corrupt cached identity must fall back to the real directory, never break initialization.
  slow=false;await page.evaluate(()=>{localStorage.setItem('sinolink.quotes.directory.v1',JSON.stringify({at:Date.now(),directory:{companies:[{code:'bad'}]}}));});await page.reload();await page.waitForSelector('.quotes-heat-tile');assert.equal(await page.locator('#rows tr').count(),74);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',cachedVisibleMs,simulatedDirectoryDelayMs:2000,simulatedQuoteDelayMs:1800,balancedWidths:[1440,1920,1100,390],errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
