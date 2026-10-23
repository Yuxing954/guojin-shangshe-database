const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),base=process.env.SECTOR_BASE_URL||'http://127.0.0.1:18765';

async function verifyDetails(frame,sector){
 const s=await frame.locator('body').evaluate(()=>{
  const visible=e=>!!e.getBoundingClientRect().width&&!!e.getBoundingClientRect().height;
  const font=getComputedStyle(document.body).fontFamily;
  const fonts=[...document.querySelectorAll('main *, .wrap *')].filter(visible).filter(e=>getComputedStyle(e).fontFamily!==font).map(e=>e.tagName+'.'+e.className).slice(0,8);
  const nav=document.querySelector('.hd-tabs,#tabs,.travel-tabs,.cruise-tabs');
  const active=nav?.querySelector('.on,.active,[aria-pressed=true],[aria-current=page]');
  const style=active&&getComputedStyle(active);
  const title=document.querySelector('#view-overview .hd-card-head h2'),tier=document.querySelector('.hd-tier-head h3');
  const charts=['#main-chart','#segment-chart'].map(q=>document.querySelector(q)?.getBoundingClientRect());
  return {scrollHeight:document.documentElement.scrollHeight,viewport:innerHeight,fonts,active:style&&{bg:style.backgroundColor,color:style.color,height:active.getBoundingClientRect().height,font:style.fontSize},
   alignment:title&&visible(title)&&tier?{left:title.getBoundingClientRect().left,tierLeft:tier.getBoundingClientRect().left,font:getComputedStyle(title).fontSize,tierFont:getComputedStyle(tier).fontSize,chartLeft:charts[0].left,segmentLeft:charts[1].left,chartWidth:charts[0].width,segmentWidth:charts[1].width}:null};
 });
 if(/^(travel|tourism|dining)(\/|$)/.test(sector))assert.ok(s.scrollHeight<=s.viewport+1,sector+' must scroll with outer page, not inside iframe: '+JSON.stringify(s));
 assert.deepEqual(s.fonts,[],sector+' font families');
 if(s.active){assert.equal(s.active.bg,'rgb(255, 255, 255)',sector+' selected tab background');assert.equal(s.active.color,'rgb(77, 88, 164)');assert.equal(s.active.height,40);assert.equal(s.active.font,'14px');}
 if(s.alignment){const a=s.alignment;assert.equal(a.left,a.tierLeft,'hotel heading alignment');assert.equal(a.font,'16px');assert.equal(a.tierFont,'16px');assert.equal(a.chartLeft,a.segmentLeft);assert.equal(a.chartWidth,a.segmentWidth);}
}

(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
if(process.env.INDUSTRY_DESIGN_PREVIEW==='1')await page.route(base+'/**',route=>{const rel=new URL(route.request().url()).pathname.replace('/guojin-shangshe-database/','');const f=path.join(root,rel);if(!fs.existsSync(f)||!fs.statSync(f).isFile())return route.continue();return route.fulfill({body:fs.readFileSync(f),contentType:{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'text/plain'});});
for(const width of [1920,1440,768,390]){await page.setViewportSize({width,height:1000});await page.goto(base+'/industry.html');
for(const sector of ['hotel','dutyfree','travel','tourism','dining']){await page.locator('#sector-tabs [data-key='+sector+']').click();await page.locator('#industry-stage[data-state=ready]').waitFor({timeout:60000});const frame=page.frameLocator('#panel-'+sector);await page.waitForTimeout(700);
const result=await frame.locator('body').evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,cards:[...document.querySelectorAll('.board-stat,.travel-kpi,.cruise-kpi,.dining-kpi')].filter(e=>e.getBoundingClientRect().width).slice(0,5).map(e=>{const s=getComputedStyle(e);return{radius:s.borderRadius,padding:s.padding,bg:s.backgroundImage};}),metadataBottom:document.getElementById('asof').getBoundingClientRect().bottom,nav:[...document.querySelectorAll('.hd-tabs,#tabs,.travel-tabs,.cruise-tabs')].map(e=>({y:e.getBoundingClientRect().y,bg:getComputedStyle(e).backgroundColor}))}));
await verifyDetails(frame,sector);
if(['travel','tourism','dining'].includes(sector)){
 await page.evaluate(()=>scrollTo(0,0));const box=await page.locator('#panel-'+sector).boundingBox();
 await page.mouse.move(box.x+20,box.y+20);await page.mouse.wheel(0,400);await page.waitForTimeout(250);
 assert.ok(await page.evaluate(()=>scrollY>0),'wheel must scroll outer page');
 assert.equal(await frame.locator('body').evaluate(()=>scrollY),0,'iframe must not capture vertical scrolling');await page.evaluate(()=>scrollTo(0,0));
}
console.log(width,sector,JSON.stringify(result));assert.equal(result.overflow,false,sector+' overflow');for(const c of result.cards){assert.equal(c.radius,'12px');assert.equal(c.padding,'16px');assert.equal(c.bg,'none');}
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
if(process.env.SITE_SCREENSHOT_DIR){fs.mkdirSync(process.env.SITE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SITE_SCREENSHOT_DIR,sector+'-'+width+'.png')});} for(const nav of result.nav)assert.equal(nav.y,result.metadataBottom+16,'consistent gap after metadata, including wrapped mobile text');
if(width===1440||width===390){
 const views={hotel:['cities','structure','groups','holiday','overview'],dutyfree:['korea','holidays','monthly'],travel:['inbound','outbound','domestic'],tourism:['audience','operators','overview']}[sector]||[];
 for(const view of views){
  let scope=page.frameLocator('#panel-'+sector);
  const selector=sector==='hotel'&&view==='groups'?'a[href*="hotel-groups"]':sector==='hotel'&&view==='holiday'?'a[href*="hotel-holiday"]':sector==='hotel'&&view==='overview'?'a[data-weekly-view=overview]':'['+(sector==='tourism'?'data-cruise-view':'data-view')+'='+view+']';
  await scope.locator(selector).first().click();await page.locator('#industry-stage[data-state=ready]').waitFor({timeout:60000});await page.waitForTimeout(200);
  scope=page.frameLocator('#panel-'+sector);await verifyDetails(scope,sector+'/'+view);
 }
}
}
}
console.log('PAGE ERRORS',JSON.stringify(errors));assert.equal(errors.length,0);await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
