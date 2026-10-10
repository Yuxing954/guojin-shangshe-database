'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const context={window:{},document:{addEventListener(){},readyState:'loading'},addEventListener(){},Intl,AbortController};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts/site-charts.js'),'utf8'),context);
const paired=context.window.SiteCharts.paired;
test('paired modes preserve real zero, negative values, missing values and units',()=>{
 const rows=[{period:'2025-01',x:1,value:0,change:0},{period:'2025-02',x:2,value:null,change:-4},{period:'2025-03',x:3,value:12,change:null}];
 const before=JSON.stringify(rows),combo=paired(rows,{unit:'亿元'});
 assert.match(combo.points[0].text,/0 亿元.*同比 0 %/);
 assert.match(combo.points[1].text,/—.*同比 -4 %/);
 assert.match(combo.points[2].text,/12 亿元.*同比 —/);
 assert.equal((combo.html.match(/class="site-value-bar"/g)||[]).length,2);
 assert.match(combo.html,/同比（%）/);assert.match(combo.html,/数值（亿元）/);
 assert.doesNotMatch(paired(rows,{mode:'value'}).html,/class="site-change-line"/);
 assert.doesNotMatch(paired(rows,{mode:'change'}).html,/class="site-value-bar"/);
 assert.equal(JSON.stringify(rows),before);
});
test('line breaks at missing observations and genuine calendar gaps; short text omits provenance',()=>{
 const result=paired([{period:'一',x:1,value:5,change:2,source:'来源',note:'计算过程'},{period:'二',x:2,value:6,change:null},{period:'三',x:3,value:7,change:0},{period:'六',x:6,value:8,change:4}],{gap:1,changeUnit:'百分点'});
 assert.equal(result.html.match(/class="site-change-line" d="([^"]*)"/)[1].split('M').length-1,3);
 assert.doesNotMatch(result.points.map(p=>p.text).join('\n'),/来源|计算|固定/);
 assert.match(result.html,/同比（百分点）/);
});
test('paired multi-series keep period alignment and escape labels',()=>{
 const result=paired([{period:'<月>',values:[{name:'甲',value:5,change:null},{name:'乙',value:null,change:10}]}],{unit:'吨'});
 assert.match(result.html,/&lt;月&gt;/);assert.match(result.points[0].text,/甲：5 吨.*同比 —\n乙：—.*同比 10 %/);
 assert.match(paired([]).html,/暂无数据/);
});
