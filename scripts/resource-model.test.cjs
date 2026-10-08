const assert=require('node:assert/strict'),M=require('./resource-model.js');
const items=[
  {kind:'company',title:'华住集团-S',code:'1179.HK',date:'2026-09-08',href:'companies.html?company=1179.HK'},
  {kind:'company',title:'首旅酒店',code:'600258.SH'},
  {kind:'minutes',title:'20260930 华住集团交流纪要.docx',date:'2026-09-30',sector:'travel'},
  {kind:'minutes',title:'20260918 华住专家.docx',date:'',sortDate:'2026-09-18'},
  {kind:'minutes',title:'20260918 首旅如家交流.docx',date:'2026-09-18'},
  {kind:'views',title:'酒店周度数据',date:'2026-10-08',sector:'travel'}
];
assert.equal(M.search(items,'1179.HK')[0].kind,'company');
assert.equal(M.search(items,'1179.HK','minutes').length,2);
assert.equal(M.search(items,'华住 交流','minutes').length,1);
assert.equal(M.search(items,'不存在').length,0);
assert.equal(M.companyResources(items,'600258.SH','minutes')[0].title,'20260918 首旅如家交流.docx');
assert.equal(M.companyResources(items,'1179.HK','minutes')[0].title,'20260930 华住集团交流纪要.docx');
assert.equal(M.search(items,'旅游酒店','views').length,1);
assert.equal(M.safeHref('javascript:alert(1)'),'');
assert.equal(M.safeHref('//evil.example'),'');
assert.equal(M.safeHref('research.html?kind=minutes&asset=abc'),'research.html?kind=minutes&asset=abc');
console.log('Resource search checks passed');
