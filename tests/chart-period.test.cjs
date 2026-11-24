'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),P=require('../scripts/chart-period.js'),D=require('../scripts/site-data.js');
test('one axis format across monthly, quarterly, weekly, daily and combined periods',()=>{
 const samples={'2026-09':'26M9','26-09':'26M9','2026年9月':'26M9','2026/01':'26M1','26M09':'26M9','2026年1—2月':'26M1–2','2026-01—02（合并）':'26M1–2（合并）','2026Q3':'26Q3','2026 Q3':'26Q3','Q326':'26Q3','2026年第三季度':'26Q3','2026W01':'26W01','2026-W41':'26W41','2026-10-22':'26/10/22','20261022':'26/10/22','2026年9月1日':'26/9/1','2026H1':'26H1','2026年下半年':'26H2','2026':'26','2026 国庆':'26 国庆','2025/2026':'25/26','FY2026':'FY26','09:30':'09:30','第1天':'第1天','RevPAR':'RevPAR','':'','26M1–2':'26M1–2'};
 for(const [raw,short]of Object.entries(samples)){assert.equal(P.format(raw),short,raw);assert.equal(P.format(short),short,'idempotent '+short);}
});
test('trend axes shorten dates while title retains original observation date',()=>{
 const html=D.trend([{date:'2026-09',value:10},{date:'2026-10',value:12}],'指标');
 assert.match(html,/class="site-period-tick"[^>]*>26M9<\/text>/);assert.match(html,/>26M10<\/text>/);assert.match(html,/<title>指标\n2026-09：/);
});
test('native chart entrypoints share one module and retain exact observation periods',async()=>{
 const root=path.resolve(__dirname,'..');
 const pages=['industry','hotel-dashboard','hotel-groups','hotel-holiday-dashboard','dutyfree-dashboard','cruise-dashboard','company-database','domestic-hotel-comparison','overseas-hotels','overseas-hotel-comparison','macro','regional-retail','quotes','cpi-monthly-product','consumption-monthly-product','retail-monthly-product','hotel-weekly-product'];
 const redirects={'domestic-hotel-comparison':['company-database.html','jinjiang,btg,hworld,atour'],'overseas-hotel-comparison':['overseas-hotels.html','marriott,hyatt,ihg,hilton']};
 for(const p of pages){
  let s=fs.readFileSync(path.join(root,p+'.html'),'utf8');
  if(redirects[p]){
   let redirected;const location={href:'https://example.test/'+p+'.html?metric=revpar#comparison',search:'?metric=revpar',hash:'#comparison',replace:value=>{redirected=new URL(value);}};
   require('node:vm').runInNewContext(s.match(/<script>([\s\S]*?)<\/script>/)[1],{URL,URLSearchParams,location});
   assert.equal(redirected.pathname,'/'+redirects[p][0]);assert.equal(redirected.searchParams.get('peers'),redirects[p][1]);assert.equal(redirected.searchParams.get('metric'),'revpar');assert.equal(redirected.hash,'#comparison');
   s=fs.readFileSync(path.join(root,redirects[p][0]),'utf8');
  }
  assert.equal((s.match(/<script type="module" src="scripts\/tabler-app\/app\.js(?:\?[^"]*)?"/g)||[]).length,1,p);
  assert.doesNotMatch(s,/<script[^>]+src="scripts\/site-charts\.js/,p+' uses the shared native chart');
 }
 const {chart}=await import('../scripts/tabler-app/common.js');
 const host={innerHTML:'',querySelector:()=>({textContent:''}),querySelectorAll:()=>[]};
 chart(host,[{period:'2026-09',value:0},{period:'2026-Q3',value:2},{period:'2026-10-22',value:null}],{label:'原始期间',unit:'亿元'});
 assert.match(host.innerHTML,/<title>原始期间 · 2026-09：0 亿元<\/title>/);
 assert.match(host.innerHTML,/<title>原始期间 · 2026-Q3：2 亿元<\/title>/);
 assert.doesNotMatch(host.innerHTML,/<title>[^<]*2026-10-22/,'missing observations do not become chart values');
});
