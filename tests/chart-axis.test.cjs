const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const context={ChartPeriod:require('../scripts/chart-period.js'),window:{},document:{addEventListener(){},readyState:'loading'},addEventListener(){},Intl,AbortController};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts/site-charts.js'),'utf8'),context);
const {niceScale,paired}=context.window.SiteCharts;
test('axes cover positive, negative, constant, tiny and missing observations with distinct evenly spaced ticks',()=>{
 for(const values of [[0,201.9],[-41,92],[-.0031,.0028],[0],[71],[100000,200000],[null,undefined]]){
  const s=niceScale(values,{zero:true});assert.ok(s.max>s.min);assert.ok(s.ticks.length>=2&&s.ticks.length<=8);
  for(const v of values.filter(Number.isFinite))assert.ok(v>=s.min&&v<=s.max);
  assert.equal(new Set(s.ticks.map(s.format)).size,s.ticks.length);
  for(let i=1;i<s.ticks.length;i++)assert.ok(Math.abs(s.ticks[i]-s.ticks[i-1]-s.step)<s.step*1e-8);
 }
});
test('standard hotel axes avoid extrema-derived decimals and preserve raw tooltip precision',()=>{
 const s=niceScale([100,201.91],{zero:true});assert.deepEqual(Array.from(s.ticks),[0,50,100,150,200,250]);
 const chart=paired([{period:'2026W01',value:201.91,change:-41.23}],{unit:'元'});
 assert.match(chart.points[0].text,/201.91 元.*-41.23/);assert.doesNotMatch(chart.html,/NaN|Infinity/);
 assert.match(chart.html,/site-line-halo/);
});
test('bounded occupancy scale and single-axis change label retain metric meaning',()=>{
 const s=niceScale([.77,.98],{min:0,max:1});assert.ok(s.min>=0&&s.max<=1);
 assert.match(paired([{period:'一期',change:1.2}],{mode:'change',changeLabel:'环比',changeUnit:'百分点'}).html,/环比（百分点）/);
});

