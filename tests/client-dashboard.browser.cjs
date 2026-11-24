'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),D=require('../scripts/site-data.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const industry=read('data/industry/overview.json'),travel=read('data/tourism/dashboard.json');
const sources=Object.fromEntries(industry.sources.map(source=>[source.id,source]));
const expected=[['hotel','hotel_revpar'],['dutyfree','dutyfree_sales'],['dining','dining_revenue']].map(([id,key])=>{
 const metric=industry.sectors.flatMap(sector=>sector.metrics).find(metric=>metric.id===key);
 const points=metric.points.filter(point=>point.basis!=='combined').sort((a,b)=>(a.endDate||a.period).localeCompare(b.endDate||b.period));
 return {id,unit:metric.unit,precision:metric.precision,points,sources};
});
expected.push({id:'travel',unit:'亿人次',precision:2,sources:Object.fromEntries(travel.sources.map(source=>[source.id,source])),points:travel.domestic.quarters.filter(row=>row.scope==='quarter').sort((a,b)=>a.period.localeCompare(b.period)).map(row=>({period:row.period,periodLabel:row.period,value:row.trips,sourceIds:row.tripsSourceIds||[row.sourceId]}))});
const server=require('node:http').createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'text/plain'}).end(body);});
});
const number=(value,precision)=>value.toLocaleString('zh-CN',{minimumFractionDigits:precision,maximumFractionDigits:precision});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.CLIENT_BASE_URL||'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base+'/workspace.html');
  await page.waitForFunction(()=>document.querySelectorAll('.client-kpi [data-source]').length===4);
  assert.equal(await page.locator('.client-kpi').count(),4);
  for(const metric of expected){
   const last=metric.points.filter(point=>Number.isFinite(point.value)).at(-1),card=page.locator('.client-kpi[data-metric='+metric.id+']');
   assert.equal((await card.locator('.client-kpi-value').innerText()).replace(/\s+/g,''),number(last.value,metric.precision)+metric.unit,metric.id+' KPI matches the original source');
   assert.ok((await card.locator('.client-kpi-period').innerText()).includes(last.periodLabel),metric.id+' statistical period');
   await page.selectOption('#client-metric',metric.id);await page.selectOption('#client-window','12');
   assert.equal(await card.getAttribute('data-active'),'true');
   const points=metric.points.slice(-12),svg=page.locator('#client-trend svg');await svg.waitFor();
   assert.match(await page.locator('#client-trend-count').innerText(),new RegExp('^'+points.length+'期'));
   await svg.press('End');const tooltip=page.locator('.site-chart-tooltip:not([hidden])');await tooltip.waitFor();
   const reading=await tooltip.innerText();assert.ok(reading.startsWith(last.periodLabel),metric.id+' chart reads the actual last period');
   assert.ok(reading.includes(last.value.toLocaleString('zh-CN',{maximumFractionDigits:metric.precision})+' '+metric.unit),metric.id+' chart reads the actual last value and unit');
   await svg.press('Escape');
   await card.locator('[data-source]').click();assert.equal(await page.locator('#client-source-dialog').getAttribute('open'),'');
   const sourceText=await page.locator('#client-source-content').innerText();
   for(const id of last.sourceIds||[last.sourceId])assert.ok(sourceText.includes(metric.sources[id].name),metric.id+' original source '+id);
   if(metric.id==='travel')assert.ok(sourceText.includes(travel.domestic.quarters.at(-1).tripsBasis),'tourism calculation basis is retained');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#client-source-dialog').getAttribute('open'),null);
   const downloadEvent=page.waitForEvent('download');await page.locator('#client-trend-export').click();const download=await downloadEvent;
   const rows=D.csv(fs.readFileSync(await download.path(),'utf8'));assert.equal(rows.length,points.length,metric.id+' CSV uses the displayed range');
   for(let i=0;i<points.length;i++){
    assert.equal(rows[i]['数据期间'],points[i].periodLabel,metric.id+' exported period');
    assert.equal(rows[i]['单位'],metric.unit,metric.id+' exported unit');
    assert.equal(rows[i]['数值'],points[i].value==null?'':String(points[i].value),metric.id+' exported original value, with null kept empty');
    assert.ok(rows[i]['来源'],metric.id+' exported provenance');
   }
  }
  assert.equal(await page.evaluate(()=>new URLSearchParams(location.search).get('metric')),'travel','metric selection is bookmarkable');
  assert.equal(await page.evaluate(()=>new URLSearchParams(location.search).get('window')),'12','range selection is bookmarkable');
  await page.reload();await page.locator('.client-kpi[data-metric=travel] [data-source]').waitFor();assert.equal(await page.locator('#client-metric').inputValue(),'travel');assert.equal(await page.locator('#client-window').inputValue(),'12');
  await page.locator('[data-research-kind=minutes]').click();await page.waitForFunction(()=>document.querySelector('#client-research-list .client-research-title'));
  assert.ok((await page.locator('#client-research-list .client-research-title').first().getAttribute('href')).startsWith('research.html?kind=minutes'));
  await page.locator('[data-research-kind=views]').click();assert.ok((await page.locator('#client-research-list .client-research-title').first().getAttribute('href')).startsWith('research.html?kind=views'));

  // One failed dataset leaves the independently loaded tourism card usable.
  let industryRequests=0;
  await page.route('**/data/industry/overview.json',route=>++industryRequests===1?route.fulfill({status:503,body:'temporarily unavailable'}):route.continue());
  await page.goto(base+'/workspace.html');await page.locator('.client-kpi[data-metric=hotel] [data-retry=industry]').waitFor();
  await page.locator('.client-kpi[data-metric=travel] [data-source]').waitFor();
  assert.ok((await page.locator('.client-kpi[data-metric=hotel] .client-kpi-value').innerText()).startsWith('—'),'failure is not displayed as zero');
  await page.locator('.client-kpi[data-metric=hotel] [data-retry=industry]').click();await page.locator('.client-kpi[data-metric=hotel] [data-source]').waitFor();assert.equal(industryRequests,2,'retry reloads only the failed dataset');
  await page.unroute('**/data/industry/overview.json');

  // A missing actual observation is preserved in the chart range and CSV.
  const missing=structuredClone(industry),hotel=missing.sectors.flatMap(sector=>sector.metrics).find(metric=>metric.id==='hotel_revpar');
  hotel.points.at(-2).value=null;const missingPeriod=hotel.points.at(-2).periodLabel;
  await page.route('**/data/industry/overview.json',route=>route.fulfill({json:missing}));
  await page.goto(base+'/workspace.html');await page.locator('.client-kpi[data-metric=hotel] [data-source]').waitFor();
  const missingDownloadEvent=page.waitForEvent('download');await page.locator('#client-trend-export').click();const missingDownload=await missingDownloadEvent;
  const missingRows=D.csv(fs.readFileSync(await missingDownload.path(),'utf8'));assert.equal(missingRows.find(row=>row['数据期间']===missingPeriod)['数值'],'','missing observations stay empty in export');
  await page.locator('#client-trend svg').press('End');await page.locator('#client-trend svg').press('ArrowLeft');
  const missingReading=await page.locator('.site-chart-tooltip:not([hidden])').innerText();assert.ok(missingReading.startsWith(missingPeriod));assert.ok(missingReading.includes('—'),'missing chart observation is not zero');
  await page.keyboard.press('Escape');await page.unroute('**/data/industry/overview.json');
  assert.deepEqual(errors,[]);console.log('PASS client dashboard: four original-source KPIs, period/unit tooltips, source dialog, range CSV, bookmarks, research links, partial failure/retry and missing values');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
