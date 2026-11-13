const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const f=path.join(root,new URL(req.url,'http://local').pathname);fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv','.svg':'image/svg+xml'})[path.extname(f)]||'text/plain'}).end(b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch({headless:true}),p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{await p.goto(base+'/hotel-dashboard.html#view=cities');await p.locator('.city-rank-row').first().waitFor();assert.equal(await p.locator('.city-rank-row').count(),10);
await p.selectOption('#city-limit','all');const all=await p.locator('.city-rank-row').count();assert.ok(all>10);
await p.locator('#city-search').fill('杭州');assert.equal(await p.locator('.city-rank-row').count(),1);await p.locator('#city-search').fill('不存在');assert.equal(await p.locator('.city-rank-row').count(),0);await p.locator('#city-search').fill('');
await p.selectOption('#city-limit','10');
for(const width of [1920,1440,1024,768,390,320]){await p.setViewportSize({width,height:1000});
for(const metric of ['revpar','occupancy_rate','adr']){await p.locator('[data-city-metric='+metric+']').click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);const nums=await p.locator('.city-primary').allTextContents();assert.ok(nums.every(n=>!n.includes('NaN')));if(width===1440||width===390){fs.mkdirSync(path.join(root,'artifacts/cities'),{recursive:true});await p.screenshot({path:path.join(root,'artifacts/cities/'+metric+'-'+width+'.png')});}}
console.log('PASS city layouts',width);}
await p.selectOption('#city-order','asc');const first=await p.locator('.city-rank-name button').first().innerText();await p.selectOption('#city-order','desc');assert.notEqual(await p.locator('.city-rank-name button').first().innerText(),first);
await p.locator('[data-mode=change]').click();assert.match(await p.locator('#city-heading').innerText(),/同比|对比/);assert.equal(await p.locator('.city-national-line').count(),10);
await p.locator('.city-all-metrics>summary').click();assert.equal(await p.locator('#city-table thead th').count(),7);assert.equal(await p.locator('#city-table tbody tr').count(),all+1);
const target=await p.locator('.city-rank-name button').first().innerText();await p.locator('.city-rank-name button').first().click();assert.equal(await p.locator('#region-select').inputValue(),target);
await p.setViewportSize({width:390,height:1000});await p.goto(base+'/industry.html?panelSector=hotel&panelView=view%3Dcities#hotel');const frame=p.frameLocator('#panel-hotel');await frame.locator('.city-rank-row').first().waitFor({timeout:60000});assert.ok(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
console.log('PASS ranking, search, ordering, metric switching, national benchmark, detail navigation and embedded mobile');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});


