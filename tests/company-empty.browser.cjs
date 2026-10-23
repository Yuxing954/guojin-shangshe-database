'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8000',root=path.resolve(__dirname,'..');
(async()=>{const b=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});try{
 for(const g of [{page:'company-database.html',first:'jinjiang',second:'hworld',folder:'domestic-hotels'},{page:'overseas-hotels.html',first:'marriott',second:'hilton',folder:'overseas'}]){
  const ctx=await b.newContext(),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const empty=async()=>{await p.waitForFunction(()=>document.body.dataset.view==='empty');assert.equal(await p.locator('[data-company][aria-pressed=true]').count(),0);assert.equal(await p.locator('#oh-content').innerText(),'');assert(!await p.locator('#oh-workspace').isVisible());assert.equal(await p.locator('#oh-status').innerText(),'请选择公司');assert.equal(await p.locator('#oh-export-view').count(),0);assert.equal(new URL(p.url()).searchParams.get('peers'),'');};
  let requests=0;p.on('request',r=>{if(new RegExp('/data/companies/'+g.folder+'/[^/]+\\.json').test(r.url()))requests++;});
  await p.goto(base+'/'+g.page+'?peers=');await empty();assert.equal(requests,0);await p.reload();await empty();assert.equal(requests,0);assert.equal(await p.locator('.cw-export #oh-export-all').count(),1);assert(await p.locator('.cw-export>summary').isVisible());
  for(const failure of [false,true]){
   let started,release;const waiting=new Promise(r=>started=r),gate=new Promise(r=>release=r),url='**/data/companies/'+g.folder+'/'+g.first+'.json';
   await p.route(url,async route=>{started();await gate;await route.fulfill({status:failure?503:200,contentType:'application/json',body:failure?'unavailable':fs.readFileSync(path.join(root,'data/companies',g.folder,g.first+'.json'),'utf8')});});
   await p.click('[data-company='+g.first+']');await waiting;await p.click('[data-company='+g.first+']');await empty();const response=p.waitForResponse(r=>r.url().endsWith('/'+g.first+'.json'));release();await(await response).finished();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await empty();await p.unroute(url);await p.reload();await empty();
  }
  await p.click('[data-company='+g.first+']');await p.locator('.cw-selected').waitFor();
  let started,release;const waiting=new Promise(r=>started=r),gate=new Promise(r=>release=r),url='**/data/companies/'+g.folder+'/'+g.second+'.json';
  await p.route(url,async route=>{started();await gate;await route.fulfill({contentType:'application/json',body:fs.readFileSync(path.join(root,'data/companies',g.folder,g.second+'.json'),'utf8')});});
  await p.click('[data-company='+g.second+']');await waiting;await p.evaluate(ids=>ids.forEach(id=>document.querySelector('[data-company='+id+']').click()),[g.first,g.second]);await empty();const response=p.waitForResponse(r=>r.url().endsWith('/'+g.second+'.json'));release();await(await response).finished();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await empty();await p.unroute(url);
  await p.click('[data-company='+g.second+']');await p.locator('.cw-selected').waitFor();assert.equal(await p.locator('[data-company][aria-pressed=true]').getAttribute('data-company'),g.second);
  for(const width of [1440,768,390,320]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await p.locator('[data-company='+g.second+']').focus();await p.keyboard.press('Space');await empty();assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log('PASS: empty selection and reload request no company data; late success/failure and comparison responses cannot restore cleared data; reselection, keyboard, exports and mobile.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
