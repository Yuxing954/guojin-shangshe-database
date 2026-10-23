'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../scripts/prediction-model.js'),data=require('../data/macro/predictions.json');
const now=Date.parse('2026-10-23T04:00:00Z');
test('every current event belongs to one specific data type without losing outcomes or changing prices',()=>{
 const before=JSON.stringify(data),groups=P.groups(data.markets,{now,wholeEvents:true});
 assert(groups.every(g=>P.dataTypes.some(t=>t.label===g.dataType.label)));
 const byType=P.dataTypes.flatMap(t=>P.groups(data.markets,{now,category:t.label,wholeEvents:true}));
 assert.equal(byType.length,groups.length);assert.equal(new Set(byType.map(g=>g.id)).size,groups.length);
 assert.equal(byType.reduce((n,g)=>n+g.markets.length,0),data.markets.filter(m=>Date.parse(m.endDate)>=now).length);
 assert.equal(JSON.stringify(data),before);
});
test('period price touches, point-in-time prices, election margins and rate counts stay distinct',()=>{
 const group=(question,category='金融市场')=>P.groups([{id:'x',question,category,outcomes:[{name:'Yes',probability:0}]}],{now})[0];
 assert.equal(P.measurement(group('Will Bitcoin reach $95,000 by December 31, 2026?')),'期间触及价格概率');
 assert.equal(P.measurement(group('Will Bitcoin be above $72,000 on October 23?')),'指定时点价格概率');
 assert.equal(P.measurement(group('Will 1 Fed rate hike happen in 2026?','经济与利率')),'调整次数概率');
 assert.equal(P.measurement(group('Will a candidate win the presidential election by at least 12%?','政治与地缘')),'选举胜差概率');
 assert.equal(P.measurement(group('US x Iran ceasefire continues through October 31?','政治与地缘')),'持续至日期概率');
 assert.equal(P.measurement(group('Will US CPI exceed 3%?','经济与利率')),'经济指标条件概率');
 assert.equal(group('Unrecognized question','新增主题').dataType.label,'其他事件');
 assert.equal(group('Will a stock index rise?').dataType.label,'金融资产');
});
test('legacy broad-category links keep working and a type search retains whole events',()=>{
 const legacy=P.groups(data.markets,{category:'金融市场',now,wholeEvents:true});
 assert(legacy.length>0);assert(legacy.every(g=>g.category==='金融市场'));
 const result=P.groups(data.markets,{category:'央行利率',query:'降息25',wholeEvents:true,now});
 assert(result.length>0);assert(result.every(g=>g.markets.length>1));
});

