'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http'),root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/chart-sizing');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[path.extname(f)]||'text/plain'}).end(b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.CHART_SIZE_BASE_URL||'http://127.0.0.1:'+server.address().port,b=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));fs.mkdirSync(out,{recursive:true});
try{
for(const width of [1920,1440,1024,768,390,320]){
 await p.setViewportSize({width,height:1000});
 for(const [file,ready]of [['hotel-dashboard.html','#main-chart svg'],['hotel-groups.html','#group-trend svg'],['travel-dashboard.html','#domestic-quarter-trips svg'],['cruise-dashboard.html','#chart-passengers svg'],['dutyfree-dashboard.html','#hn-growth.site-paired-chart']]){
  await p.goto(base+'/'+file);await p.locator(ready).first().waitFor();
  for(const svg of await p.locator('svg.site-paired-chart:visible').all()){
   const geometry=await svg.evaluate(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,vw:e.viewBox.baseVal.width,vh:e.viewBox.baseVal.height}));assert.ok(geometry.h>=240&&geometry.h<=380,file+' balanced height '+JSON.stringify(geometry));assert.ok(Math.abs(geometry.w-geometry.vw)<2&&Math.abs(geometry.h-geometry.vh)<2,file+' must redraw at native size');assert.ok(await svg.locator('path,rect').count()>0);
  }
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if([1440,390].includes(width)&&['dutyfree-dashboard.html','hotel-groups.html'].includes(file))await p.screenshot({path:path.join(out,file.replace('.html','')+'-'+width+'.png')});
 }
 await p.goto(base+'/regional-retail.html');await p.locator('#tier-trend svg.regional-chart').waitFor();
 await p.selectOption('#tier-frequency','monthly');await p.selectOption('#tier-years','5');
 const svg=p.locator('#tier-trend svg.regional-chart');let box=await svg.boundingBox();assert.ok(box.height<=360);assert.ok(await p.locator('#tier-trend circle').count()>5);const allHeight=box.height;await p.selectOption('#tier-trend [data-value-mode]','off');assert.equal((await svg.boundingBox()).height,allHeight);await p.selectOption('#tier-trend [data-value-mode]','all');assert.equal((await svg.boundingBox()).height,allHeight);
 // Five dense histories retain every observation; only visible numeric annotations are thinned.
 await p.evaluate(()=>{const host=document.createElement('div');host.id='density-fixture';host.style.cssText='width:100%;max-width:1150px;position:relative';document.querySelector('main').append(host);const series=Array.from({length:5},(_,j)=>({label:'曲线'+j,points:Array.from({length:60},(_,i)=>({period:(2021+Math.floor(i/12))+'-'+String(i%12+1).padStart(2,'0'),value:i%17===0?null:10+j*4+Math.sin(i/3)*8}))}));window.sizingFixture=series;RegionalRetailCharts.draw(host,series);});
 const fixture=p.locator('#density-fixture'),expected=await p.evaluate(()=>sizingFixture.flatMap(s=>s.points).filter(r=>Number.isFinite(r.value)).length);assert.equal(await fixture.locator('circle').count(),expected);assert.ok(await fixture.locator('.regional-value-label').count()<expected);assert.equal(await fixture.locator('.regional-end-value').count(),5);
 assert.ok(await fixture.locator('svg.regional-chart').evaluate(e=>{const v=e.viewBox.baseVal,labels=[...e.querySelectorAll('.regional-value-label:not(.regional-end-value)')].map(n=>n.getBBox());return v.height<=360&&labels.every(a=>a.x>=0&&a.y>=0&&a.x+a.width<=v.width&&a.y+a.height<=v.height)&&labels.every((a,i)=>labels.every((b,j)=>i===j||a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y));}),'dense labels must fit without overlapping');
 await fixture.locator('circle[data-time="30"][data-series="0"]').focus();assert.ok((await fixture.locator('[role=tooltip]').innerText()).includes('2023-07'));assert.equal(await fixture.locator('[role=tooltip] span').count(),5);
 await fixture.locator('[data-layout=split]').click();assert.equal(await fixture.locator('svg.regional-chart').count(),5);for(const s of await fixture.locator('svg.regional-chart').all())assert.ok((await s.boundingBox()).height<=260);
 await fixture.evaluate(e=>e.remove());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if([1440,390].includes(width))await p.screenshot({path:path.join(out,'regional-'+width+'.png')});
 console.log('PASS bounded, native-size charts and dense histories at',width);
}
assert.deepEqual(errors,[]);
}finally{await b.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});