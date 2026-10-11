'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),U=require('../scripts/site-ui.js');
function storage(seed){let text=seed;return {getItem(){return text||null;},setItem(_key,v){text=v;}};}
const base='https://example.com/database/industry.html?metric=adr#hotel';
test('saved links retain filters and sector, reject external and executable paths',()=>{
 const W=U.createWorkspace(storage(),base);
 for(const x of ['javascript:alert(1)','https://evil.test/database/industry.html','../industry.html','data/raw.json','other.html'])assert.equal(W.link(x),'');
 W.toggle('industry.html?metric=revpar&years=3&embed=1#hotel','酒店 RevPAR');assert.equal(W.read().saved[0].href,'industry.html?metric=revpar&years=3#hotel');
 W.toggle('industry.html?metric=revpar&years=3#hotel','酒店 RevPAR');assert.equal(W.read().saved.length,0);
});
test('history deduplicates, bounds entries, reloads and survives disabled writes',()=>{
 const S=storage(),W=U.createWorkspace(S,base);
 for(let i=0;i<40;i++){W.toggle('industry.html?metric='+i,'指标 '+i);W.visit('industry.html?metric='+i,'指标 '+i);}
 assert.equal(W.read().saved.length,30);assert.equal(W.read().recent.length,12);
 W.visit('industry.html?metric=39','更新标题');assert.equal(W.read().recent[0].title,'更新标题');assert.equal(W.read().recent.length,12);
 assert.equal(U.createWorkspace(S,base).read().saved.length,30);
 W.clearRecent();assert.equal(W.read().recent.length,0);
 const blocked=U.createWorkspace({getItem(){return JSON.stringify({saved:[{href:'industry.html#gold',title:'黄金'}]});},setItem(){throw Error('quota');}},base);
 blocked.toggle('industry.html#hotel','酒店');assert.equal(blocked.read().saved.length,2);assert.equal(blocked.read().persistent,false);
 blocked.remove('industry.html#gold');assert.equal(blocked.read().saved.length,1);
});
test('malformed stored entries do not break the workspace',()=>{
 const W=U.createWorkspace(storage(JSON.stringify({saved:[null,{}, {href:'javascript:alert(1)'},{href:'industry.html#hotel',title:'<img src=x>'},{href:'industry.html#hotel',title:'duplicate'}],recent:'bad'})),base);
 assert.equal(W.read().saved.length,1);assert.equal(W.read().recent.length,0);
 assert.equal(U.createWorkspace(storage('{bad'),base).read().persistent,false);
});
