// Offline interaction/layout regression. Quotes are deterministic test doubles;
// chart rows come from the recorded Tencent fixture, remapped ONLY inside this test.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/tencent-charts-20261009.json'),'utf8'));
const out=path.join(root,'.cache','quotes-preview');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(p,(error,body)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.csv':'text/csv; charset=utf-8'})[path.extname(p)]||'text/plain'});res.end(body);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']}:{} )}),page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true}),base='http://127.0.0.1:'+server.address().port;
 const errors=[],requests=[];let quoteRead=0,failQuotes=false,chartDelay=0,failChart=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='qt.gtimg.cn'){
   requests.push({kind:'quote',at:Date.now()});if(failQuotes){await route.abort();return;}
   quoteRead++;const codes=(url.searchParams.get('q')||decodeURIComponent(url.pathname.slice(3)).split('&')[0]).split(','),body=codes.map((code,i)=>{const f=Array(50).fill('');f[1]='TEST ONLY';f[2]=code.startsWith('us')?code.slice(2)+'.OQ':code.slice(2);f[3]=String(100+i);f[4]='100';f[5]='100';f[30]='202610091000'+String(quoteRead%60).padStart(2,'0');f[31]=String(i);f[32]=String((i%11)-5);f[33]=String(105+i);f[34]='95';return 'var v_'+code+'='+JSON.stringify(f.join('~'))+';';}).join('\n');
   await route.fulfill({contentType:'application/javascript',body});return;
  }
  if(url.hostname==='web.ifzq.gtimg.cn'){
   const [code,mode]=url.searchParams.get('param').split(','),callback=url.searchParams.get('_var');requests.push({kind:'chart',code,mode,at:Date.now()});
   if(chartDelay)await new Promise(r=>setTimeout(r,chartDelay));if(failChart){await route.abort();return;}
   const fixture=fixtures.find(f=>f.label==='hk_native_'+(mode==='week'?'week':'day')),series=fixture.response.data[fixture.symbol],data={code:0,data:{[code]:series}};
   await route.fulfill({contentType:'application/javascript',body:'var '+callback+'='+JSON.stringify(data)+';'});return;
  }
  await route.abort();
 });
 try{
  await page.goto(base+'/quotes.html');await page.waitForSelector('#chart svg');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('最近读取'));
  const size=await page.locator('#heatmap').boundingBox(),tiles=await page.locator('.quotes-heat-tile').count();assert.equal(tiles,32);assert.ok(Math.abs(size.width-size.height)<30,JSON.stringify(size));assert.equal(await page.locator('#live-sort').isChecked(),false);
  await page.screenshot({path:path.join(out,'行情-桌面.png'),fullPage:true});
  await page.evaluate(()=>{window.heatNodes=[...document.querySelectorAll('.quotes-heat-tile')];window.listNodes=[...document.querySelectorAll('#rows tr')];window.tileChanges=[];new MutationObserver(records=>{for(const r of records)if(r.type==='childList'&&r.target.id==='heatmap')window.tileChanges.push(r.addedNodes.length+r.removedNodes.length);}).observe(document.getElementById('heatmap'),{childList:true});});
  const currentCode=await page.locator('.quotes-heat-tile[aria-pressed=true]').getAttribute('data-code'),allCodes=await page.locator('.quotes-heat-tile').evaluateAll(nodes=>nodes.map(n=>n.dataset.code)),codes=[currentCode,...allCodes.filter(c=>c!==currentCode)];
  const title=await page.locator('#quote-title').innerText(),chartSize=await page.locator('#chart').boundingBox();
  chartDelay=600;await page.locator('.quotes-heat-tile[data-code="'+codes[1]+'"]').click();assert.equal(await page.locator('#chart svg').count(),0);assert.match(await page.locator('#chart').innerText(),/正在读取/);assert.equal((await page.locator('#chart').boundingBox()).height,chartSize.height);await page.waitForSelector('#chart svg');assert.notEqual(await page.locator('#quote-title').innerText(),title);
  // Cached return must neither empty the plot nor re-request its historical series.
  const count=requests.filter(r=>r.kind==='chart').length;await page.locator('.quotes-heat-tile[data-code="'+codes[0]+'"]').click();await page.waitForSelector('#chart svg');assert.match(await page.locator('#chart svg').getAttribute('aria-label'),new RegExp(await page.locator('#quote-title').innerText()));assert.equal(requests.filter(r=>r.kind==='chart').length,count);
  assert.ok(await page.evaluate(()=>window.heatNodes.every(n=>n.isConnected)&&window.listNodes.every(n=>n.isConnected)&&window.tileChanges.length===0));
  // Rapid A/B/C selection issues only the final uncached request, no transient old chart.
  const before=requests.filter(r=>r.kind==='chart').length;
  await page.evaluate(codes=>{for(const code of codes)document.querySelector('.quotes-heat-tile[data-code="'+code+'"]').click();},codes.slice(2,5));await page.waitForSelector('#chart svg');assert.equal(requests.filter(r=>r.kind==='chart').length,before+1);assert.equal(await page.locator('.quotes-heat-tile[aria-pressed=true]').getAttribute('data-code'),codes[4]);
  // An old in-flight response cannot replace the later selection.
  await page.locator('.quotes-heat-tile[data-code="'+codes[5]+'"]').click();await page.waitForTimeout(160);await page.locator('.quotes-heat-tile[data-code="'+codes[6]+'"]').click();await page.waitForSelector('#chart svg');assert.match(await page.locator('#chart svg').getAttribute('aria-label'),new RegExp(await page.locator('#quote-title').innerText()));
  // Wait through a quote tick; selected company, nodes, overview and plot must survive it.
  await page.evaluate(()=>{window.savedSvg=document.querySelector('#chart svg');window.savedOverview=document.getElementById('overview-price');});
  const quoteBefore=quoteRead;await page.waitForFunction(before=>document.querySelector('#rows .quotes-time').textContent.includes('10:00:'+String((before+1)%60).padStart(2,'0')),quoteBefore);assert.ok(await page.evaluate(()=>window.heatNodes.every(n=>n.isConnected)&&window.listNodes.every(n=>n.isConnected)&&window.savedSvg===document.querySelector('#chart svg')&&window.savedOverview===document.getElementById('overview-price')));assert.equal(await page.locator('#chart svg').count(),1);
  await page.locator('#pause-quotes').click();const paused=quoteRead;await page.waitForTimeout(1150);assert.equal(quoteRead,paused);await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('refresh').getAttribute('aria-busy')==='false');assert.equal(quoteRead,paused+1);assert.equal(await page.locator('#pause-quotes').getAttribute('aria-pressed'),'true');
  const downloaded=page.waitForEvent('download');await page.locator('#export-quotes').click();const dl=await downloaded,csv=fs.readFileSync(await dl.path(),'utf8');assert.equal(csv.split('\r\n').length,33);assert.match(csv,/来源报价时间/);assert.match(csv,/HKD/);assert.match(csv,/USD/);
  // List view, selection, self-watch filtering, search and an empty result.
  await page.locator('[data-view=list]').click();await page.locator('#columns').selectOption('full');await page.locator('#rows tr').nth(6).locator('td').nth(3).click();assert.equal(await page.locator('#rows tr[data-selected=true]').count(),1);await page.locator('#detail-watch').click();await page.locator('[data-group=watch]').click();assert.equal(await page.locator('#rows tr[data-company]').count(),1);await page.locator('#reset').click();await page.locator('#search').fill('no-such-company');await page.waitForFunction(()=>document.getElementById('range-summary').textContent.startsWith('0 家'));assert.equal(await page.locator('#quote-detail').isHidden(),true);await page.locator('#reset').click();
  // A failed quote read keeps prices and source timestamps and cannot bypass backoff.
  failQuotes=true;await page.waitForTimeout(1050);await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('status').dataset.error==='true');assert.match(await page.locator('#rows tr[data-company]').first().innerText(),/读取失败/);assert.match(await page.locator('#range-summary').innerText(),/32 家有报价/);const reqBefore=requests.filter(r=>r.kind==='quote').length;await page.locator('#refresh').click();assert.equal(requests.filter(r=>r.kind==='quote').length,reqBefore);
  // On a fresh mobile page, bounded square pagination makes every company accessible.
  failQuotes=false;chartDelay=0;await page.setViewportSize({width:390,height:844});await page.goto(base+'/quotes.html?view=heat');await page.waitForSelector('#chart svg');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('最近读取'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const mobileSize=await page.locator('#heatmap').boundingBox();assert.ok(Math.abs(mobileSize.width-mobileSize.height)<2);assert.equal(await page.locator('.quotes-heat-tile').count(),16);assert.equal(await page.locator('#heat-pagination').isVisible(),true);const page1=await page.locator('.quotes-heat-tile').evaluateAll(ns=>ns.map(n=>n.dataset.code));await page.locator('#heat-next').click();const page2=await page.locator('.quotes-heat-tile').evaluateAll(ns=>ns.map(n=>n.dataset.code));assert.equal(new Set(page1.concat(page2)).size,32);await page.locator('#heat-previous').click();await page.screenshot({path:path.join(out,'行情-手机.png'),fullPage:true});
  // Keyboard selection crosses page boundaries and remains visible.
  await page.locator('.quotes-heat-tile').first().focus();await page.keyboard.press('End');assert.equal(await page.locator('#heat-next').isDisabled(),true);assert.equal(await page.locator('.quotes-heat-tile[aria-pressed=true]').count(),1);assert.equal(await page.locator('.quotes-heat-tile:focus').count(),1);
  assert.deepEqual(errors,[]);console.log('PASS: square layout, 32-company desktop/16-company mobile pages, stable DOM, cached return, rapid switch, quote ticks, pause/manual, export, filters, failure/backoff, keyboard and mobile overflow.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
