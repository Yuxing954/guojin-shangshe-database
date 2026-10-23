const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),base=process.env.SECTOR_BASE_URL||'http://127.0.0.1:18765';
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
if(process.env.INDUSTRY_DESIGN_PREVIEW==='1')await page.route(base+'/**',route=>{const rel=new URL(route.request().url()).pathname.replace('/guojin-shangshe-database/','');const f=path.join(root,rel);if(!fs.existsSync(f)||!fs.statSync(f).isFile())return route.continue();return route.fulfill({body:fs.readFileSync(f),contentType:{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'text/plain'});});
for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.goto(base+'/industry.html');
for(const sector of ['hotel','dutyfree','travel','tourism','dining']){await page.locator('#sector-tabs [data-key='+sector+']').click();await page.locator('#industry-stage[data-state=ready]').waitFor({timeout:60000});const frame=page.frameLocator('#panel-'+sector);await page.waitForTimeout(700);
const result=await frame.locator('body').evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,cards:[...document.querySelectorAll('.board-stat,.travel-kpi,.cruise-kpi,.dining-kpi')].filter(e=>e.getBoundingClientRect().width).slice(0,5).map(e=>{const s=getComputedStyle(e);return{radius:s.borderRadius,padding:s.padding,bg:s.backgroundImage};}),nav:[...document.querySelectorAll('.hd-tabs,#tabs,.travel-tabs,.cruise-tabs')].map(e=>({y:e.getBoundingClientRect().y,bg:getComputedStyle(e).backgroundColor}))}));
console.log(width,sector,JSON.stringify(result));assert.equal(result.overflow,false,sector+' overflow');for(const c of result.cards){assert.equal(c.radius,'12px');assert.equal(c.padding,'16px');assert.equal(c.bg,'none');}
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
if(process.env.SITE_SCREENSHOT_DIR){fs.mkdirSync(process.env.SITE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SITE_SCREENSHOT_DIR,sector+'-'+width+'.png')});} for(const nav of result.nav)assert.equal(nav.y,56,'consistent navigation offset');
}
}
console.log('PAGE ERRORS',JSON.stringify(errors));assert.equal(errors.length,0);await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
