'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {navigation}=require('../scripts/site-ui.js'),D=require('../scripts/site-data.js');
const root=path.resolve(__dirname,'..'),out=process.env.SITE_SCREENSHOT_DIR,results=[];
const hotelManifest=JSON.parse(fs.readFileSync(path.join(root,'data/companies/domestic-hotels.json'),'utf8')),atour=hotelManifest.companies.find(c=>c.id==='atour');
const server=http.createServer((req,res)=>{let file;try{file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));}catch{res.writeHead(400).end();return;}if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'}[path.extname(file)]||'text/plain; charset=utf-8'}).end(body);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
   const start=Date.now(),before=errors.length;await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/'+file,{waitUntil:'domcontentloaded'});await page.waitForSelector('.site-nav');await page.waitForTimeout(['hotel-dashboard.html','company-database.html'].includes(file)?1800:600);
   assert.deepEqual(await page.locator('.site-nav nav a').evaluateAll(links=>links.map(a=>a.getAttribute('href'))),navigation.map(item=>item[1]),file+' navigation');assert.equal(await page.locator('.site-nav').count(),1,file+' duplicate nav');assert.ok(await page.locator('h1:visible').count()>=1,file+' heading');assert.ok(await page.locator('.skip-link').count()>=1,file+' skip');
   for(const width of [1440,1024,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(80);const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dimensions.scroll<=width+1,file+' overflow '+JSON.stringify(dimensions));if(out&&(width===1440||width===390)){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,file.replace('.html','')+'-'+width+'.png'),fullPage:false});}}
   assert.deepEqual(errors.slice(before),[],file+' runtime errors');results.push({page:file,widths:[1440,1024,768,390],loadMs:Date.now()-start});console.log('PASS',file);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/companies.html?company=601888.SH&sector=免税');await page.waitForURL(/quotes.html/);assert.equal(new URL(page.url()).searchParams.get('symbol'),'601888.SH');
 // Legacy company bookmarks now resolve to the current hotel workspace.
 await page.goto(base+'/company-database.html?db=atour&db-view=history');await page.locator('#dh-chart-0 svg').waitFor({state:'attached'});
 assert.deepEqual(await page.locator('#oh-companies [data-company]').evaluateAll(buttons=>buttons.map(b=>b.dataset.company)),hotelManifest.companies.map(c=>c.id));
 assert.equal(await page.locator('#oh-companies [data-company][aria-pressed=true]').getAttribute('data-company'),'atour');
 await page.locator('.oh-kpi [data-source]').first().click();await page.waitForSelector('#oh-evidence[open]');
 assert.match(await page.locator('#oh-evidence-body').innerText(),/PDF物理页码/);assert.match(await page.locator('#oh-evidence-body a').getAttribute('href'),/^https?:\/\//);
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
 await page.selectOption('#oh-range','8');await page.locator('#dh-chart-0 svg').waitFor({state:'attached'});
 if(!await page.locator('.cw-export').evaluate(el=>el.open))await page.locator('.cw-export > summary').click();
 const companyDownload=page.waitForEvent('download');await page.locator('#oh-export-view').click();const exportedFile=await companyDownload;
 assert.match(exportedFile.suggestedFilename(),/亚朵.*\.csv$/);const stream=await exportedFile.createReadStream();let companyCsv='';for await(const chunk of stream)companyCsv+=chunk.toString('utf8');
 const exportedRows=D.csv(companyCsv),companyParams=new URL(page.url()).searchParams;
 assert.ok(exportedRows.length>0);assert.ok(exportedRows.every(row=>row['公司'].includes('亚朵')&&row['样本']==='全部酒店'&&row['原报告期']>=companyParams.get('from')&&row['原报告期']<=companyParams.get('to')&&/^https?:\/\//.test(row['原始网址'])));
 await page.reload();await page.locator('#dh-chart-0 svg').waitFor({state:'attached'});
 assert.equal(new URL(page.url()).searchParams.get('company'),'atour');assert.equal(new URL(page.url()).searchParams.has('db'),false);assert.equal(await page.locator('#oh-range').inputValue(),'8');assert.equal(await page.locator('#oh-companies [data-company=atour]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-company=juneyao]').count(),0);
 let companyBroken=true;const companyDataRoute=url=>url.pathname==='/'+atour.file;
 await page.route(companyDataRoute,route=>companyBroken?route.fulfill({status:503,body:'unavailable'}):route.continue());await page.goto(base+'/company-database.html?company=atour');await page.waitForSelector('#oh-retry:not([hidden])');assert.match(await page.locator('#oh-status').innerText(),/数据读取失败/);
 companyBroken=false;await page.locator('#oh-retry').click();await page.locator('#dh-chart-0 svg').waitFor({state:'attached'});assert.equal(await page.locator('#oh-retry').isVisible(),false);await page.unroute(companyDataRoute);
 await page.goto(base+'/index.html?metric=revpar#sec-hotel');await page.waitForURL(/industry.html.*#hotel/);assert.equal(new URL(page.url()).searchParams.get('metric'),'revpar');
 // Embedded industry pages retain their real range and view after a parent reload.
 await page.goto(base+'/industry.html#hotel');await page.waitForSelector('#panel-hotel[data-state=ready]');
 const hotelPanel=page.frameLocator('#panel-hotel');await hotelPanel.locator('#main-chart svg').waitFor({state:'attached'});assert.equal(await hotelPanel.locator('.site-nav').count(),0);
 await hotelPanel.locator('#history-start').selectOption('52');await hotelPanel.locator('[data-view=cities]').click();
 await page.waitForURL(url=>url.searchParams.get('panelSector')==='hotel'&&new URLSearchParams(url.searchParams.get('panelView')).get('window')==='52'&&new URLSearchParams(url.searchParams.get('panelView')).get('view')==='cities');
 await page.reload();await page.waitForSelector('#panel-hotel[data-state=ready]');assert.equal(await hotelPanel.locator('#history-start').inputValue(),'52');assert.equal(await hotelPanel.locator('[data-view=cities]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.site-nav').count(),1);
 await page.goto(base+'/dutyfree-dashboard.html');await page.waitForFunction(()=>document.querySelector('#hn-sales').textContent!=='—');
 await page.locator('.dutyfree-actions [onclick="showSrc(\'monthly_sources\')"]').click();assert.equal(await page.locator('#srcmodal').evaluate(el=>el.open),true);
 const monthlySource=JSON.parse(fs.readFileSync(path.join(root,'data/dutyfree/sources.json'),'utf8')).sources.monthly_sources;
 assert.ok((await page.locator('#srcbox').innerText()).includes(monthlySource.sourceName));assert.equal(await page.locator('#srcbox a').getAttribute('href'),monthlySource.url);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#srcmodal').evaluate(el=>el.open),false);
 await page.selectOption('#hn-range','24');const monthlyDownload=page.waitForEvent('download');await page.locator('#monthly-download').click();const monthlyFile=await monthlyDownload;assert.equal(monthlyFile.suggestedFilename(),'离岛免税月度-24.csv');
 const monthlyStream=await monthlyFile.createReadStream();let monthlyCsv='';for await(const chunk of monthlyStream)monthlyCsv+=chunk.toString('utf8');
 const monthlyRows=D.csv(monthlyCsv),expectedMonthly=D.csv(fs.readFileSync(path.join(root,'data/dutyfree_monthly.csv'),'utf8')).slice(-24);
 assert.deepEqual(monthlyRows.map(r=>[r.period_id,r.shopping_sales_cny_100m,r.shoppers_10k]),expectedMonthly.map(r=>[r.period_id,r.shopping_sales_cny_100m,r.shoppers_10k]),'monthly export retains the selected source observations');
 await page.locator('[data-view=holidays]').click();assert.ok(await page.locator('#view-holidays').isVisible());
 await page.goto(base+'/dashboard.html?dataset=valuation');await page.waitForSelector('#table tbody tr');assert.equal(await page.locator('#table tbody tr').count(),32);await page.locator('#query').fill('不存在的名称');await page.waitForTimeout(200);assert.match(await page.locator('#table').innerText(),/暂无匹配/);await page.locator('#reset').click();assert.equal(await page.locator('#table tbody tr').count(),32);
 const jsonId=JSON.parse(fs.readFileSync(path.join(root,'data-manifest.json'),'utf8')).datasets.find(d=>d.file==='data/macro/snapshot.json').id;await page.locator('[data-dataset="'+jsonId+'"]').click();await page.waitForSelector('#json:not([hidden])');assert.equal(await page.locator('#export').isDisabled(),true);assert.ok(JSON.parse(await page.locator('#json').innerText()));
 let broken=true;await page.route('**/data/research/resource-index.json',route=>broken?route.fulfill({status:503,body:'unavailable'}):route.continue());await page.goto(base+'/search.html');await page.waitForSelector('#search-retry');broken=false;await page.locator('#search-retry').click();await page.waitForSelector('.resource-result');await page.unroute('**/data/research/resource-index.json');
 let csvBroken=true;await page.route(url=>decodeURI(url.pathname).endsWith('/商社-标的池与估值跟踪.csv'),route=>csvBroken?route.fulfill({status:503,body:'unavailable'}):route.continue());await page.goto(base+'/dashboard.html?dataset=valuation');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('暂时无法'));csvBroken=false;await page.locator('#reload').click();await page.waitForSelector('#table tbody tr');
 assert.deepEqual(errors,[]);if(out)fs.writeFileSync(path.join(out,'全站浏览器验证.json'),JSON.stringify({pages:results,interactions:['retired company link redirects to quotes','legacy company bookmarks migrate','company sources, filtered CSV, persistent range and retry','legacy industry query routing','embedded industry range and view restore','dutyfree sources and tabs','CSV and JSON datasets','empty and retry states'],externalNetwork:'blocked; quote network covered by recorded-response suite'},null,2));console.log('PASS: all page layouts and shared interaction regressions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());

