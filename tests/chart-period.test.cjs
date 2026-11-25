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
test('chart entrypoints load formatter before renderers',()=>{
 const root=path.resolve(__dirname,'..');
 const pages=['industry','hotel-dashboard','hotel-groups','hotel-holiday-dashboard','dutyfree-dashboard','cruise-dashboard','company-database','domestic-hotel-comparison','overseas-hotels','overseas-hotel-comparison','macro','regional-retail','quotes','cpi-monthly-product','consumption-monthly-product','retail-monthly-product','hotel-weekly-product'];
 for(const p of pages){const s=fs.readFileSync(path.join(root,p+'.html'),'utf8'),helper=s.indexOf('scripts/chart-period.js');assert(helper>=0,p);const render=s.indexOf('scripts/site-charts.js');if(render>=0)assert(helper<render,p+' load order');}
});
