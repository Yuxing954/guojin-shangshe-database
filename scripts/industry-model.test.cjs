const assert=require('node:assert/strict');
const M=require('./industry-model.js');
const metric={label:'全国餐饮收入',unit:'亿元',isRate:false,points:[
  {periodLabel:'2024年3月',endDate:'2024-03-31',value:4000,basis:'monthly'},
  {periodLabel:'2025年1—2月',endDate:'2025-02-28',value:10000,basis:'combined'},
  {periodLabel:'2025年3月',endDate:'2025-03-31',value:4400,basis:'monthly',change:10},
  {periodLabel:'2025年4月',endDate:'2025-04-30',value:4500,basis:'monthly'},
]};
assert.equal(M.chartPoints(metric,0,'value').length,3,'combined amounts stay out of monthly trend');
assert.equal(M.chartPoints({...metric,isRate:true},0,'value').length,4,'comparable Jan-Feb rates are retained');
assert.equal(M.chartPoints(metric,0,'change').at(-1).value,null,'missing growth stays missing');
assert.equal(M.inRange(metric.points,1).length,3,'one year means calendar range, not last 12 records');
const exported=M.csv(metric,[{...metric.points[1],startDate:'2025-01-01',sourceId:'nbs',quality:'primary'}],{nbs:{name:'国家统计局',url:'https://www.stats.gov.cn/',publishedAt:'2025-03-17'}});
assert.ok(exported.includes('2025年1—2月'));
assert.ok(exported.includes('2025-01-01'));
assert.ok(exported.includes('https://www.stats.gov.cn/'));
console.log('Industry chart periods and provenance export passed');
