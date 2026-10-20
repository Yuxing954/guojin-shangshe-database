'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),out=process.env.MACRO_SCREENSHOT_DIR;
const server=http.createServer((req,res)=>{let file;try{file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));}catch{res.writeHead(400);res.end();return;}if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,body)=>{if(err){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'}[path.extname(file)]||'text/plain'});res.end(body);});});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1512,height:1100},acceptDownloads:true}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const ready=()=>page.waitForSelector('#indicators:not([hidden]) .macro-kpi',{state:'attached'});
  try{
    const start=Date.now();await page.goto(base+'/macro.html');await ready();
    assert.ok(page.url().includes('/macro.html?'));assert.equal(await page.locator('.macro-kpi').count(),6);
    assert.equal(await page.locator('#metric-list .macro-item').count(),17);assert.match(await page.locator('#overview-meta').innerText(),/17\/17/);
    assert.ok(!requests.some(url=>url.includes('predictions.json')));assert.match(await page.locator('#kpi-grid').innerText(),/50.1/);
    console.log('Initial local load including history:',Date.now()-start,'ms');
    async function checkCardGeometry(){
      const boxes=await page.locator('#kpi-grid .macro-kpi').evaluateAll(nodes=>nodes.map(node=>{
        const b=node.getBoundingClientRect();
        const reading=node.querySelector('.macro-reading-row').getBoundingClientRect(),unit=node.querySelector('.macro-kpi-reading small').getBoundingClientRect(),style=getComputedStyle(node),innerWidth=node.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
        return {width:b.width,height:b.height,readingTop:reading.top-b.top,unitFits:unit.bottom<=reading.bottom+1,slotFillsWidth:Math.abs(reading.width-innerWidth)<=1,overflow:node.scrollHeight>node.clientHeight+1};
      }));
      assert.equal(boxes.length,6);
      assert.ok(Math.max(...boxes.map(b=>b.width))-Math.min(...boxes.map(b=>b.width))<=1,JSON.stringify(boxes));
      assert.ok(Math.max(...boxes.map(b=>b.height))-Math.min(...boxes.map(b=>b.height))<=1,JSON.stringify(boxes));
      assert.ok(boxes.every(b=>!b.overflow&&b.unitFits&&b.slotFillsWidth),'card content clipped: '+JSON.stringify(boxes));
      assert.ok(Math.max(...boxes.map(b=>b.readingTop))-Math.min(...boxes.map(b=>b.readingTop))<=1,'readings are misaligned: '+JSON.stringify(boxes));
    }
    await checkCardGeometry();
    assert.equal(await page.locator('.macro-topic').count(),3);for(const group of await page.locator('.macro-topic').all())assert.equal(await group.locator('.macro-kpi').count(),2);
    assert.equal(await page.locator('#recent-releases,#trend-presets,#mode,.macro-history,.macro-method,.macro-forecast-detail,#forecast-overview').count(),0);
    async function checkPlotWidth(){
      const measured=await page.locator('#primary-chart svg').evaluate(svg=>{
        const b=svg.getBoundingClientRect(),matrix=svg.getScreenCTM();
        const xs=[...svg.querySelectorAll('polyline')].flatMap(line=>[...line.points].map(p=>new DOMPoint(p.x,p.y).matrixTransform(matrix).x));
        return {width:b.width,height:b.height,viewWidth:svg.viewBox.baseVal.width,plotWidth:Math.max(...xs)-Math.min(...xs),host:svg.closest('#primary-chart').clientWidth};
      });
      assert.ok(Math.abs(measured.viewWidth-measured.host)<3,JSON.stringify(measured));
      assert.ok(measured.plotWidth/measured.width>.65,'plot is squeezed: '+JSON.stringify(measured));
      assert.ok(measured.height>=250&&measured.height<=330,'plot height: '+JSON.stringify(measured));
    }
    assert.equal(await page.locator('#detail .site-value-option').count(),0);
    assert.equal(await page.locator('#detail .macro-trend-change b').evaluate(el=>getComputedStyle(el).fontSize),'16px');
    await checkPlotWidth();
    if(out){fs.mkdirSync(out,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'宏观晨报-首屏.png'),fullPage:false});}
    await page.evaluate(()=>scrollTo(0,0));const beforeKpiClick=await page.evaluate(()=>scrollY);await page.locator('[data-kpi="cn-cpi"]').click();assert.match(await page.locator('#metric-title').innerText(),/CPI/);assert.equal(await page.evaluate(()=>scrollY),beforeKpiClick,'selecting a KPI should not jump to the trend detail');assert.equal(await page.locator('#comparison').count(),0);assert.equal(await page.locator('#comparison-chart').count(),0);
    assert.equal(await page.locator('.macro-chart svg').count(),1);assert.equal(new URL(page.url()).searchParams.has('comparison'),false);
    await page.locator('#years').selectOption('1');await page.reload();await ready();assert.equal(await page.locator('#years').inputValue(),'1');
    await page.locator('#primary-chart [data-chart-point]').first().focus();assert.ok(await page.locator('#primary-chart .research-tooltip').isVisible());assert.match(await page.locator('#primary-chart .research-tooltip').innerText(),/20\d{2}-\d{2}/);assert.doesNotMatch(await page.locator('#primary-chart .research-tooltip').innerText(),/发布|来源|计算/);
    if(out){fs.mkdirSync(out,{recursive:true});await page.locator('#primary-chart [data-chart-point]').first().evaluate(el=>el.blur());await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'宏观核心指标-桌面.png'),fullPage:true});}
    await page.locator('[data-study=workspace]').click();await page.locator('#more-filters > summary').click();await page.locator('#frequency').selectOption('quarterly');assert.equal(await page.locator('#metric-list .macro-item').count(),2);
    await page.locator('#search').fill('不存在');await page.waitForTimeout(250);assert.match(await page.locator('#detail').innerText(),/没有匹配/);assert.equal(await page.locator('#download-latest').isDisabled(),true);
    await page.locator('#reset-filters').click();await page.locator('#search').fill('社零');await page.waitForTimeout(250);assert.equal(await page.locator('#metric-list .macro-item').count(),1);
    const download=page.waitForEvent('download');await page.locator('#download-latest').click();const csv=fs.readFileSync(await (await download).path(),'utf8');assert.equal(csv.split('\r\n').length,2);assert.match(csv,/社零/);assert.ok(csv.includes(JSON.parse(fs.readFileSync(path.join(root,'data/macro/automatic-series.json'),'utf8')).series['cn-retail'].observations.at(-1).period));
    await page.locator('[data-study=overview]').click();await page.locator('[data-kpi="cn-pmi"]').click();assert.equal(await page.locator('#search').inputValue(),'');assert.match(await page.locator('.macro-latest').innerText(),/点/);
    await page.locator('[data-study=workspace]').click();await page.locator('#reset-filters').click();await page.locator('[data-country="US"]').click();assert.equal(await page.locator('#metric-list .macro-item').count(),14);assert.equal(await page.locator('#comparison').count(),0);
    await page.locator('#health').selectOption('attention');assert.equal(await page.locator('#metric-list [data-id="us-cpi"]').count(),0);
    await page.locator('[data-study=overview]').click();await page.locator('[data-kpi="us-cpi"]').click();assert.equal(await page.locator('.macro-coverage').count(),0);
    assert.match(await page.locator('[data-kpi="us-cpi"] .macro-kpi-context').innerText(),/2025-10官方未发布/);assert.doesNotMatch(await page.locator('[data-kpi="us-fed-rate"]').innerText(),/数据滞后/);
    assert.equal(await page.locator('#comparison').count(),0);
    await page.locator('[data-kpi="us-treasury10"]').click();await page.locator('#years').selectOption('0');assert.ok(await page.locator('#primary-chart [data-chart-point]').count()<=122);
    for(const width of [1920,1440,1024,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);await checkPlotWidth();await checkCardGeometry();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow at '+width);}
    await page.locator('[data-country="CN"]').click();
    for(const width of [1920,1440,1024,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);await checkCardGeometry();}
    await page.goto(base+'/macro.html?country=CN&indicator=cn-cpi&comparison=cn-ppi&years=1');await ready();assert.equal(new URL(page.url()).searchParams.has('comparison'),false);
    if(out)await page.screenshot({path:path.join(out,'宏观核心指标-手机.png'),fullPage:true});
    await page.locator('[data-view="predictions"]').click();await page.waitForFunction(()=>document.querySelector('#prediction-list .forecast-event'));assert.ok(requests.some(url=>url.includes('predictions.json')));
    assert.match(await page.locator('#prediction-overview').innerText(),/活跃合约/);
    await page.locator('#prediction-search').fill('降息25');
    const pm=JSON.parse(fs.readFileSync(path.join(root,'data/macro/predictions.json'),'utf8')),P=require('../scripts/prediction-model.js');
    const expected=P.groups(pm.markets,{query:'降息25',category:await page.locator('#prediction-category').inputValue(),wholeEvents:true}).length;
    assert.ok(expected>0);assert.equal(await page.locator('#prediction-list .forecast-event').count(),expected);
    assert.match(await page.locator('#prediction-list').innerText(),/维持不变/);
    const predictionDownload=page.waitForEvent('download');await page.locator('#prediction-download').click();assert.match(fs.readFileSync(await (await predictionDownload).path(),'utf8'),/英文原文/);
    await page.locator('[data-view="fedwatch"]').click();await page.waitForSelector('.fedwatch-kpi');
    assert.equal(await page.locator('.fedwatch-kpi').count(),3);assert.match(await page.locator('#fedwatch-status').innerText(),/获取/);
    const full=JSON.parse(fs.readFileSync(path.join(root,'data/gold-jewelry/macro.json'),'utf8')).fedwatchTables.at(-1);
    assert.equal(await page.locator('.fedwatch-matrix tbody tr').count(),full.rows.length);
    assert.equal(await page.locator('.fedwatch-futures thead th').count(),full.futures.length);
    assert.doesNotMatch(await page.locator('#fedwatch-status').innerText(),/未提供/);assert.match(await page.locator('#fedwatch-status').innerText(),/获取/);
    assert.equal(await page.locator('.fedwatch-matrix tbody tr').first().locator('td').nth(full.columns.length-1).innerText(),'—');
    const zeroIndex=full.rows[0].probabilities.findIndex(value=>value===0);assert.ok(zeroIndex>=0);assert.equal(await page.locator('.fedwatch-matrix tbody tr').first().locator('td').nth(zeroIndex).innerText(),'0%');
    const wholeDownload=page.waitForEvent('download');await page.locator('#fedwatch-table-download').click();
    const wholeCsv=fs.readFileSync(await (await wholeDownload).path(),'utf8');
    assert.equal(wholeCsv.split('\r\n').length,1+full.rows.length*full.columns.length+full.futures.length);
    for(const future of full.futures){assert.ok(wholeCsv.includes('"'+future.contract+'","'+future.contractMonth+'"'));assert.ok(wholeCsv.includes('"'+future.rawPrice+'"'));}assert.ok(wholeCsv.includes(full.retrievedAt));
    await page.locator('[data-fedwatch-meeting="2027-10-27"]').click();assert.equal(await page.locator('#fedwatch-meeting').inputValue(),'2027-10-27');
    const history=JSON.parse(fs.readFileSync(path.join(root,'data/gold-jewelry/macro.json'),'utf8')).meetings.find(m=>m.meetingDate==='2027-10-27').snapshots;
    const previous=history.filter(s=>s.retrievedAt&&s.retrievedAt!==full.retrievedAt).at(-1);
    assert.equal(await page.locator('#fedwatch-compare').inputValue(),previous?.retrievedAt||'');assert.equal(await page.locator('.fedwatch-range').count(),full.columns.length);
    for(const width of [1512,768,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    await page.setViewportSize({width:1512,height:1100});
    await page.locator('#fedwatch-meeting').selectOption('2026-12-09');assert.match(await page.locator('#fedwatch-content').innerText(),/2026-12-09/);
    await page.locator('[data-view="indicators"]').click();assert.ok(await page.locator('#kpi-grid').isVisible());
    await page.route('**/data/macro/automatic-series.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto(base+'/macro.html');await ready();assert.match(await page.locator('#data-warning').innerText(),/补充历史读取失败/);assert.ok(await page.locator('#retry').isVisible());await page.unroute('**/data/macro/automatic-series.json');await page.locator('#retry').click();await page.waitForFunction(()=>document.querySelectorAll('#metric-list .macro-item').length===17);assert.ok(await page.locator('#data-warning').isHidden());
    await page.route('**/data/macro/catalog.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto(base+'/macro.html');await page.waitForFunction(()=>document.querySelector('#load-state').textContent.includes('读取失败'));assert.ok(await page.locator('#indicators').isHidden());assert.ok(await page.locator('#skeleton').isHidden());
    await page.unroute('**/data/macro/catalog.json');await page.locator('#retry').click();await ready();
    assert.deepEqual(errors,[]);console.log('PASS: no-jump KPI selection, single measured plot, compact detail without repeated sections, frequency/health/search filters, URL restore, CSV, chart keyboard access, daily performance, five viewport widths, lazy prediction loading, partial failure, full failure and retry.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});





