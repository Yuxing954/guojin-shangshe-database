const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../scripts/consumption-macro-model.js');
const row=(id,period,basis='month',value=0,quality='official')=>({indicatorId:id,period,endDate:period+'-28',frequency:'monthly',basis,value,yoy:null,quality});
test('same-period selection intersects exact frequency and basis, preserves zero and excludes estimates',()=>{
 const data={observations:[row('a','2026-01'),row('a','2026-02','jan_feb'),row('a','2026-03'),row('a','2026-04'),row('b','2026-01'),row('b','2026-02'),row('b','2026-04','month',4,'estimate'),row('b','2026-03','ytd',8)]};
 const scope={frequency:'monthly',basis:'month'};
 assert.deepEqual(C.comparisonPeriods(data,['a','b'],scope),[{key:'2026-01|month',period:'2026-01',basis:'month'}]);
 assert.equal(C.comparisonRow(data,'a',scope,'2026-01|month').value,0);
 assert.equal(C.comparisonRow(data,'b',scope,'2026-04|month'),null);
 assert.equal(C.comparisonRow(data,'b',scope,'2026-02|jan_feb'),null);
 assert.equal(C.comparisonRow(data,'b',scope,'2026-03|month'),null);
 assert.deepEqual(C.comparisonPeriods(data,['missing','a'],scope),[]);
});
test('quarterly cumulative periods never borrow monthly or single-quarter observations',()=>{
 const data={observations:[{...row('income','2026-Q2','ytd',120),endDate:'2026-06-30',frequency:'quarterly'},{...row('spend','2026-Q2','quarter',40),endDate:'2026-06-30',frequency:'quarterly'},row('spend','2026-06','ytd',50)]};
 assert.deepEqual(C.comparisonPeriods(data,['income','spend'],{frequency:'quarterly',basis:'ytd'}),[]);
 data.observations.push({...row('spend','2026-Q2','ytd',80),endDate:'2026-06-30',frequency:'quarterly'});
 assert.equal(C.comparisonPeriods(data,['income','spend'],{frequency:'quarterly',basis:'ytd'})[0].key,'2026-Q2|ytd');
});
