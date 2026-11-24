const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../scripts/consumption-macro-model.js'),P=require('../scripts/prediction-model.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/consumption-macro/observations.json')));
test('all 16 retail categories match the selected month and retain official amounts and growth',()=>{
 const result=C.retailBreakdown(data,{period:'2026-08'});assert.equal(result.items.length,16);
 for(const {row} of result.items){assert.equal(row.period,'2026-08');assert.equal(row.basis,'month');}
 const cosmetics=result.items.find(x=>x.indicator.id==='category_4');assert.equal(cosmetics.row.value,368);assert.equal(cosmetics.row.yoy,4.9);
 assert.equal(C.retailBreakdown(data,{period:'2099-01'}).reference,undefined);
});
test('missing monthly online data is not filled from cumulative data; January-February stays combined',()=>{
 const monthly=C.retailBreakdown(data,{period:'2026-08',group:'channels'}),ytd=C.retailBreakdown(data,{period:'2026-08',basis:'ytd',group:'channels'});
 assert.equal(monthly.items.find(x=>x.indicator.id==='online_goods').row,null);assert.equal(ytd.items.find(x=>x.indicator.id==='online_goods').row.value,84195);
 const combined=C.retailBreakdown(data,{period:'2026-02'});assert.equal(combined.reference.basis,'jan_feb');assert.ok(combined.items.every(x=>x.row?.basis==='jan_feb'));
});
test('same event groups without normalizing probabilities; expired events excluded, search and categories preserved',()=>{
 const markets=[{id:'a',eventId:'one',category:'经济与利率',questionZh:'美联储2026年10月会议维持利率？',endDate:'2026-11-01',outcomes:[{name:'Yes',probability:.845}],volume24h:1},{id:'b',eventId:'one',category:'经济与利率',questionZh:'美联储2026年10月会议加息？',endDate:'2026-11-01',outcomes:[{name:'Yes',probability:.155}],volume24h:2},{id:'c',eventId:'two',category:'金融市场',questionZh:'价格预测',endDate:'2026-01-01',outcomes:[{name:'Yes',probability:.8}]}];
 const copy=JSON.stringify(markets),now=Date.parse('2026-10-09');const groups=P.groups(markets,{now});assert.equal(groups.length,1);assert.equal(groups[0].markets.length,2);assert.equal(P.affirmative(groups[0].markets[0]).probability,.845);assert.equal(JSON.stringify(markets),copy);
 assert.equal(P.groups(markets,{query:'加息',now})[0].markets.length,1);assert.equal(P.groups(markets,{category:'金融市场',now}).length,0);
});
test('native macro sections retain country, consumption and forecast destinations',()=>{
 for(const name of ['macro.html','national-retail.html','regional-retail.html','consumption-macro.html']){
  const html=fs.readFileSync(path.join(__dirname,'..',name),'utf8');
  assert.match(html,/<script type="module" src="scripts\/tabler-app\/app\.js(?:\?[^"]*)?"><\/script>/,name);
  assert.doesNotMatch(html,/location\.replace/,name+' is a real entrypoint');
 }
 const moduleSource=fs.readFileSync(path.join(__dirname,'../scripts/tabler-app/macro.js'),'utf8');
 for(const route of ['macro.html?country=CN&view=indicators','macro.html?country=US&view=indicators','consumption-macro.html','national-retail.html','regional-retail.html','macro.html?view=expectations','macro.html?view=fedwatch','macro.html?view=predictions'])assert.ok(moduleSource.includes("'"+route+"'"),route);
 assert.match(moduleSource,/page==='consumption-macro\.html'\)view='consumption'/);
 assert.match(moduleSource,/page==='national-retail\.html'\)view='national'/);
 assert.match(moduleSource,/page==='regional-retail\.html'\)view='regional'/);
});

