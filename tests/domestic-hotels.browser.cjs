
async function selectOnly(page,id){const selected=await page.locator('[data-company][aria-pressed=true]').evaluateAll(es=>es.map(e=>e.dataset.company));if(!selected.includes(id))await page.click('[data-company='+id+']');for(const other of selected)if(other!==id)await page.click('[data-company='+other+']');await page.waitForFunction(id=>document.body.dataset.view==='company'&&document.querySelectorAll('[data-company][aria-pressed=true]').length===1&&document.querySelector('[data-company][aria-pressed=true]').dataset.company===id,id);}
async function openAll(page){const u=new URL(page.url()),domestic=u.pathname.includes('company-database');u.searchParams.set('peers',domestic?'jinjiang,btg,hworld,atour':'marriott,hyatt,ihg,hilton');await page.goto(u.href);}
'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),M=require('../scripts/domestic-hotels-model.js'),D=require('../scripts/site-data.js');
const ROOT=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'data/companies/domestic-hotels.json'),'utf8')),datasets=manifest.companies.map(c=>JSON.parse(fs.readFileSync(path.join(ROOT,c.file),'utf8')));
const server=http.createServer((req,res)=>{const file=path.resolve(ROOT,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
async function csv(page,selector){const event=page.waitForEvent('download');if(!await page.locator('.cw-export').evaluate(e=>e.open))await page.click('.cw-export>summary');await page.click(selector);const stream=await(await event).createReadStream();let raw='';for await(const c of stream)raw+=c.toString('utf8');return D.csv(raw);}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.argv[2]||(process.env.HOTEL_TEST_BASE||'http://127.0.0.1:'+server.address().port).replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  await context.addInitScript(()=>{let charts;Object.defineProperty(window,'SiteCharts',{configurable:true,get:()=>charts,set(value){const draw=value.drawPaired;value.drawPaired=function(host,rows,opt){(window.domPlotData||=Object.create(null))[host.id]={rows:structuredClone(rows),opt:structuredClone(opt)};return draw.call(this,host,rows,opt);};charts=value;}});});
  const p=await context.newPage(),ready=()=>p.locator('#dh-chart-2 svg').waitFor({state:'attached'}),more=async()=>{if(!await p.locator('#dh-advanced').getAttribute('open').then(v=>v!==null))await p.locator('#dh-advanced summary').click();};
  await p.goto(base+'/company-database.html');await ready();
  assert.equal(await p.locator('#oh-kind').inputValue(),'全部');assert.equal(await p.locator('#oh-frequency').inputValue(),'单季度');assert.equal(await p.locator('#oh-display').inputValue(),'change');
  assert.equal(await p.locator('#oh-toolbar select:visible').count(),4);assert.equal(await p.locator('#oh-kind option').count(),2);
  assert.equal(await p.locator('.oh-company svg').count(),4);
  assert.equal(await p.locator('.dh-monogram').count(),0);assert.equal(await p.locator('.site-paired-chart').count(),3);assert.equal(await p.locator('.oh-kpi').count(),3);
  assert.equal(await p.locator('.oh-company img').count(),0);assert.equal(await p.locator('.oh-company svg.cw-brand-mark').count(),4);
  async function verifyPlot(company,kind,frequency){
   const qs=manifest.quarters.filter(q=>q>=new URL(p.url()).searchParams.get('from')&&q<=new URL(p.url()).searchParams.get('to')),source=M.mainSeries(datasets.find(d=>d.company.id===company),kind,qs,frequency);
   for(let i=0;i<3;i++){const plot=await p.evaluate(id=>domPlotData[id],'dh-chart-'+i);assert.equal(plot.opt.mode,await p.locator('#oh-display').inputValue());assert.equal(plot.opt.valueStyle,'line');assert.equal(plot.rows.length,qs.length);for(let qi=0;qi<plot.rows.length;qi++){assert.equal(plot.rows[qi].values[0].value,source[qi].records[i]?.value??null);assert.equal(plot.rows[qi].values[0].change,source[qi].records[i]?.change??null);}}
  }
  await verifyPlot('jinjiang','全部','单季度');
  await p.locator('#dh-chart-0 svg').focus();await p.keyboard.press('End');assert((await p.locator('.site-chart-tooltip:not([hidden])').innerText()).includes('26Q2'));await p.keyboard.press('Escape');
  await p.locator('#dh-chart-0').locator('..').locator('[data-chart-labels]').check();assert(await p.locator('#dh-chart-0 .site-value-label').count()>0);
  await p.locator('.oh-kpi [data-source]').first().click();await p.locator('#oh-evidence[open]').waitFor();assert((await p.locator('#oh-evidence-body').innerText()).includes('PDF物理页码'));assert((await p.locator('#oh-evidence-body a').getAttribute('href')).startsWith('http'));await p.click('#oh-close');
  const exported=await csv(p,'#oh-export-view');assert.equal(exported.length,24);assert(exported.every(r=>r['样本']==='全部酒店'&&/Q[1-4]$/.test(r['原报告期'])&&r['原始网址'].startsWith('http')));
  await p.selectOption('#oh-range','8');assert.equal((await p.evaluate(()=>domPlotData['dh-chart-0'])).rows.length,8);await more();await p.selectOption('#oh-period','2025Q4');assert.equal((await p.evaluate(()=>domPlotData['dh-chart-0'])).rows.at(-1).period,'25Q4');await p.selectOption('#oh-from','2020Q1');assert.equal(await p.locator('#oh-range').inputValue(),'custom');assert.equal((await p.evaluate(()=>domPlotData['dh-chart-0'])).rows.length,24);
  await p.click('#dh-reset');assert.equal(await p.locator('#oh-range').inputValue(),'8');assert.equal(await p.locator('#oh-kind').inputValue(),'全部');assert.equal(await p.locator('#oh-toolbar select:visible').count(),4);
  // Old URLs and workspace bookmarks migrate once; new explicit selections persist.
  await p.goto(base+'/company-database.html?company=atour&kind='+encodeURIComponent('同店')+'&frequency='+encodeURIComponent('累计')+'&display=value&sampleView=2');await ready();
  assert.equal(await p.locator('#oh-kind').inputValue(),'全部');assert.equal(await p.locator('#oh-frequency').inputValue(),'单季度');assert.equal(await p.locator('#oh-display').inputValue(),'change');assert.equal(new URL(p.url()).searchParams.get('sampleView'),'3');
  await p.selectOption('#oh-kind','同店');await p.selectOption('#oh-frequency','累计');await p.selectOption('#oh-display','value');await p.reload();await ready();assert.equal(await p.locator('#oh-kind').inputValue(),'同店');assert.equal(await p.locator('#oh-frequency').inputValue(),'累计');assert.equal(await p.locator('#oh-display').inputValue(),'value');
  // Company switch preserves sample/period; defaults only company-specific dimensions.
  for(const c of manifest.companies){await selectOnly(p,c.id);await p.locator('#oh-profile h2').filter({hasText:c.name}).waitFor();assert.equal(await p.locator('#oh-frequency').inputValue(),'累计');assert.equal(await p.locator('#oh-kind').inputValue(),'同店');await verifyPlot(c.id,'同店','累计');}
  await selectOnly(p,'jinjiang');await p.selectOption('#oh-frequency','单季度');assert.equal(await p.locator('#oh-frequency').inputValue(),'单季度');assert.equal((await p.evaluate(()=>domPlotData['dh-chart-0'])).rows.at(-1).values[0].value,null);await p.click('#dh-cumulative');assert.equal(await p.locator('#oh-frequency').inputValue(),'累计');await verifyPlot('jinjiang','同店','累计');
  // Rapid additions preserve all selected companies; returning to one restores its view.
  await p.evaluate(()=>{document.querySelector('[data-company=hworld]').click();document.querySelector('[data-company=btg]').click();document.querySelector('[data-company=atour]').click();});
  await p.locator('#cw-peer-reading tbody tr').nth(3).waitFor();assert.equal(await p.locator('[aria-pressed=true][data-company]').count(),4);await selectOnly(p,'atour');
  await p.click('#dh-reset');
  for(const c of manifest.companies){await selectOnly(p,c.id);await p.locator('#oh-profile h2').filter({hasText:c.name}).waitFor();await verifyPlot(c.id,'全部','单季度');}
  await p.selectOption('#oh-kind','同店');await more();await p.selectOption('#oh-period','2023Q2');assert.equal((await p.evaluate(()=>domPlotData['dh-chart-0'])).rows.at(-1).values[0].value,null);
  await p.click('#dh-reset');await selectOnly(p,'hworld');await p.locator('#oh-profile h2').filter({hasText:'华住集团'}).waitFor();await more();await p.selectOption('#oh-region','国际业务');assert.equal(await p.locator('#oh-currency').inputValue(),'EUR');await p.selectOption('#oh-currency','USD');
  const fx=await p.evaluate(()=>domPlotData['dh-chart-0']);assert(fx.rows.filter(r=>r.period.startsWith('25Q')).every(r=>r.values[0].value===null));assert(fx.rows.filter(r=>r.period.startsWith('26Q')).some(r=>r.values[0].value!==null));
  await p.click('[data-tab=details]');await p.fill('#oh-search','2026Q2 RevPAR');await p.locator('#oh-search').press('Tab');await p.locator('.dh-details').waitFor();assert((await csv(p,'#oh-export-view')).every(r=>r['币种/单位']==='USD'&&r['原报告期']==='2026Q2'&&r['指标']==='RevPAR'));
  await selectOnly(p,'btg');await p.locator('#oh-profile h2').filter({hasText:'首旅酒店'}).waitFor();await p.click('[data-tab=details]');await p.click('#oh-clear');await more();await p.selectOption('#oh-category','经济型');await p.selectOption('#oh-operation','直营');await p.selectOption('#oh-period','2025Q4');assert.equal(await p.locator('#oh-category').inputValue(),'经济型');assert.equal(await p.locator('#oh-operation').inputValue(),'直营');const detailCsv=await csv(p,'#oh-export-view');assert(detailCsv.length>0);assert(detailCsv.every(r=>r['档次/范围']==='经济型'&&r['经营模式']==='直营'));
  assert.equal((await csv(p,'#oh-export-all')).length,7427);
  await p.click('[data-tab=operating]');await p.click('#dh-reset');await openAll(p);await ready();assert(p.url().includes('company-database.html'));assert.equal(await p.locator('#oh-kind').inputValue(),'全部');await p.selectOption('#oh-kind','同店');assert((await p.locator('#oh-content').innerText()).includes('仅累计披露'));assert.equal((await p.evaluate(()=>domPlotData['dh-chart-0'])).rows.at(-1).values[0].value,null);
  await p.locator('#dh-chart-0 svg').focus();await p.keyboard.press('End');const peers=await p.locator('.site-chart-tooltip:not([hidden])').innerText();for(const c of manifest.companies)assert(peers.includes(c.name));await p.keyboard.press('Escape');
  for(const width of [1440,1024,768,390,320]){
   await p.setViewportSize({width,height:900});await p.goto(base+'/company-database.html?company=atour');await ready();await p.locator('#dh-chart-0').locator('..').locator('[data-chart-labels]').check();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+width);
   assert(await p.locator('.oh-plot:visible').evaluateAll(hs=>hs.every(h=>h.scrollWidth<=h.clientWidth+1&&h.querySelector('svg').getBoundingClientRect().width<=h.clientWidth+1)),'chart overflow '+width);
   assert.equal(await p.locator('.oh-plot .site-chart-scroll').count(),0);
   await more();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'filter overflow '+width);
  }
  const failed=await context.newPage();await failed.route('**/data/companies/domestic-hotels/jinjiang.json',r=>r.fulfill({status:503,body:'unavailable'}));await failed.goto(base+'/company-database.html?company=jinjiang');await failed.locator('#oh-retry:not([hidden])').waitFor();await failed.unroute('**/data/companies/domestic-hotels/jinjiang.json');await failed.click('#oh-retry');await failed.locator('#dh-chart-2 svg').waitFor({state:'attached'});
  assert.deepEqual(errors,[]);console.log('PASS: all hotels / single-quarter / YoY default, four primary controls, versioned links, deterministic company and cohort transitions, true missing periods and FX gaps, source/CSV7427, persistent detail filters, charts and labels, mobile widths, retry.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});

