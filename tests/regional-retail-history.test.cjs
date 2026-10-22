const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const M=require('../scripts/regional-retail-model.js'),T=require('../scripts/regional-retail-tier-model.js'),B=require('../scripts/build-regional-retail-history.cjs'),H=require('../data/regional-retail/history.json'),R=require('../data/regional-retail/city-tiers.json');
const D=T.merge(T.merge(require('../data/regional-retail/observations.json'),require('../data/regional-retail/tier-supplement.json')),M.expandHistory(H));
test('official five-year release calendar and exact original amounts survive compact expansion',()=>{
 assert.equal(H.historyStart,'2021-10');assert.equal(H.targetPeriod,'2026-09');assert.equal(H.importAudit.officialSources,117);
 for(const [id,n,last]of [['p0',55,'2026-09'],['p8',54,'2026-08']]){const rows=D.observations.filter(r=>r.regionId===id&&r.category==='社零总额'&&r.scope==='全口径'&&r.basis==='ytd'&&r.provenance.amount?.priority===120);assert.equal(rows.length,n);assert.equal(rows.map(r=>r.period).sort().at(-1),last);}
 assert.equal(M.observation(D,'p0','2021-10','month').amount,1276.2055);assert.equal(M.observation(D,'p0','2026-09','month').amount,1259.546);assert.equal(M.observation(D,'p8','2022-02','month').amount,1378.21);assert.equal(M.observation(D,'p8','2025-02','month'),null);assert.equal(M.observation(D,'p0','2026-02','month'),null);assert.equal(M.observation(D,'p0','2026-02','combined').amount,2402.7446);
});
test('monthly contribution math reconciles separately for early full-scope usage and later limited goods',()=>{
 for(const [id,p,dimension,n]of [['p0','2021-10','usage',4],['p8','2022-04','usage',4],['p0','2026-09','goods',11],['p8','2026-08','goods',9]]){const c=M.breakdown(D,id,p,'month',dimension);assert.equal(c.rows.length,n);assert.ok(Math.abs(c.rows.reduce((sum,r)=>sum+r.increment,0)+c.residual-c.increment)<1e-8);assert.ok(c.rows.every(r=>M.rowDimension(r)===dimension));assert.equal(c.exclude('missing'),null);}
 const c=M.breakdown(D,'p0','2026-09','month','goods');assert.ok(Math.abs(c.rows.find(r=>r.category==='通讯器材类').incrementShare-83.7222392664)<1e-6);assert.ok(Math.abs(c.exclude('通讯器材类')-1.9748372207)<1e-6);assert.equal(M.breakdown(D,'p8','2022-04','month','goods'),null);assert.ok(!M.availableDimensions(D,'p0','2021-10','month').some(d=>d.id==='goods'));
});
test('coverage expands to at least 100 cities, quarter-end samples stay at their real dates, broad period uses recent coverage',()=>{
 assert.ok(M.regions(D,'city').length>=100);assert.equal(new Set(M.regions(D,'city').map(r=>r.name)).size,M.regions(D,'city').length);assert.equal(M.regions(D,'province').length,31);
 assert.equal(T.broadPeriod(D,R),'2026-06');const s=T.snapshot(D,R,'2026-06','ytd');assert.ok(s.reduce((sum,r)=>sum+r.n,0)>=60);assert.ok(s[3].n>=20&&s[4].n>=10);
 const huangshan=D.regions.find(r=>r.name==='黄山');assert.ok(M.observation(D,huangshan.id,'2026-06','ytd'));assert.equal(M.observation(D,huangshan.id,'2026-08','ytd'),null);
 const series=T.trend(D,R,'2026-06','ytd','average','fixed',5,'quarterly');assert.ok(series[0].points.every(p=>Number(p.period.slice(5))%3===0));assert.equal(M.seriesHistory(D,'p0','month','社零总额','全口径',5,'2026-09').filter(p=>!p.period.endsWith('c')).every(p=>p.period>='2021-10'&&p.period<='2026-09'),true);
});
test('new history sources resolve, exact keys remain unique and disputed provider fields stay unavailable',()=>{
 const keys=new Set(),ids=new Set(D.sources.map(s=>s.id));for(const r of D.observations){const key=[r.regionId,r.period,r.basis,r.category,r.scope].join('|');assert.ok(!keys.has(key));keys.add(key);assert.ok(r.period<='2026-09');for(const p of Object.values(r.provenance))assert.ok(ids.has(p.sourceId));if(r.disputed?.yoy)assert.equal(r.yoy,null);}
 for(const s of H.sources.filter(s=>s.quality==='secondary'))assert.equal(s.releaseDate,null);
 assert.ok(!H.series.some(s=>/网上|限额|市区/.test(s.originalName)));
});
test('import never substitutes an unknown city or online retail for a province and rejects annual/ambiguous rows',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'retail-history-'));try{const response={content:[{text:JSON.stringify({data:[{columns:['宏观数据（月）','数据来源','2026-08'],sheetName:'fixture',items:[['湖北省:仙桃市:社会消费品零售总额:累计值(元)','统计局','600.5亿'],['北京市:社会消费品零售额:网上零售额:累计值(元)','统计局','100亿'],['江苏省:盐城市:社会消费品零售总额:同比(%)','统计局','2'],['江苏省:无锡市:社会消费品零售总额:累计同比(%)','统计局','0']]},{columns:['宏观数据（年）','数据来源','2025'],sheetName:'annual',items:[['无锡市:社会消费品零售总额:累计同比(%)','统计局','10']]}]})}]};fs.writeFileSync(path.join(dir,'choice-test.json'),JSON.stringify({response,retrievedAt:'2026-10-22'}));const base=require('../data/regional-retail/observations.json'),result=B.build(dir,base,{regions:[],observations:[]},{observations:[],sources:[]});assert.equal(result.series.length,1);assert.equal(result.series[0].points[0][2],0);assert.ok(result.series[0].originalName.includes('无锡'));assert.ok(result.importAudit.ignored.length>=3);assert.equal(B.numeric('12300',true,'(万元)'),1.23);}finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});

