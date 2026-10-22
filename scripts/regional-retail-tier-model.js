(function(root){
'use strict';
const M=typeof module==='object'&&module.exports?require('./regional-retail-model.js'):root.RegionalRetail,F=M.finite;
const mean=xs=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:null;
function quantile(values,q){if(!values.length)return null;const v=[...values].sort((a,b)=>a-b),at=(v.length-1)*q,i=Math.floor(at);return v[i]+(v[Math.ceil(at)]-v[i])*(at-i);}
function merge(base,extra){
 const regions=new Map(base.regions.map(r=>[r.id,r])),names=new Map(M.regions(base,'city').map(r=>[r.name,r.id])),aliases=new Map(),sources=new Map(base.sources.map(s=>[s.id,s])),key=r=>[r.regionId,r.period,r.basis,r.category,r.scope].join('|'),rows=new Map(base.observations.map(r=>[key(r),r]));
 for(const r of extra.regions||[]){const id=names.get(r.name)||r.id;aliases.set(r.id,id);if(!regions.has(id)){regions.set(id,{...r,id});names.set(r.name,id);}}
 for(const s of extra.sources||[])sources.set(s.id,s);
 const priority=(r,f)=>r.provenance?.[f]?.priority??(sources.get(r.provenance?.[f]?.sourceId)?.quality==='official'?100:20);
 for(const input of extra.observations||[]){const r={...input,regionId:aliases.get(input.regionId)||input.regionId},old=rows.get(key(r));if(!old){rows.set(key(r),r);continue;}const combined={...old,dimension:r.dimension??old.dimension,provenance:{...old.provenance},disputed:{...old.disputed}};for(const f of ['amount','yoy'])if(F(r[f])&&(!old.disputed?.[f]||priority(r,f)>=100)&&((!F(old[f])&&!old.disputed?.[f])||priority(r,f)>priority(old,f))){combined[f]=r[f];combined.provenance[f]=r.provenance[f];delete combined.disputed[f];}rows.set(key(r),combined);}
 return {...base,historyStart:[base.historyStart,extra.historyStart].filter(Boolean).sort()[0],targetPeriod:[base.targetPeriod,extra.targetPeriod].filter(Boolean).sort().at(-1),updatedAt:extra.updatedAt||base.updatedAt,regions:[...regions.values()],sources:[...sources.values()],observations:[...rows.values()]};
}
function cityRows(data,registry,period,basis){const mapping=new Map(registry.cities.map(c=>[c.name,c]));return M.compare(data,'city',period,basis).map(r=>{const p=M.observation(data,r.id,M.previous(period),basis);return {...r,yoy:r.disputed?.yoy?null:r.yoy,change:r.disputed?.yoy||p?.disputed?.yoy?null:r.change,group:mapping.get(r.name)?.group??null,originalTier:mapping.get(r.name)?.originalTier??'未分级'};});}
function stats(rows){const valid=rows.filter(r=>F(r.yoy)),values=valid.map(r=>r.yoy),weighted=valid.map(r=>({...r,base:M.comparableBase(r.amount,r.yoy)})).filter(r=>F(r.base)&&r.base>0),den=weighted.reduce((s,r)=>s+r.base,0),paired=valid.filter(r=>F(r.change));return {tracked:rows.length,n:valid.length,estimatedN:valid.filter(r=>r.provenance?.yoy?.derived).length,average:mean(values),median:quantile(values,.5),q25:quantile(values,.25),q75:quantile(values,.75),min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,positive:valid.filter(r=>r.yoy>0).length,negative:valid.filter(r=>r.yoy<0).length,flat:valid.filter(r=>r.yoy===0).length,positiveShare:valid.length?valid.filter(r=>r.yoy>0).length/valid.length*100:null,weighted:den>0?(weighted.reduce((s,r)=>s+r.amount,0)/den-1)*100:null,weightedN:weighted.length,pairedChange:mean(paired.map(r=>r.change)),pairedN:paired.length,improving:paired.filter(r=>r.change>0).length};}
function snapshot(data,registry,period,basis){const rows=cityRows(data,registry,period,basis);return registry.groups.map(g=>{const list=rows.filter(r=>r.group===g.id);return {...g,...stats(list),rows:list};});}
function metricRows(rows,metric){return rows.filter(r=>F(r.yoy)&&(metric!=='weighted'||M.comparableBase(r.amount,r.yoy)>0));}
function trend(data,registry,period,basis,metric='average',cohort='fixed',years=0,frequency='monthly'){
 const start=years?M.windowStart(period,years):period.slice(0,4)+'-01',ps=M.calendar([start,data.historyStart||'0000-01'].sort().at(-1),period,frequency).filter(p=>basis!=='combined'||p.endsWith('-02'));
 const anchor=cityRows(data,registry,period,basis);
 return registry.groups.map(g=>{const ids=new Set(metricRows(anchor.filter(r=>r.group===g.id),metric).map(r=>r.id));return {...g,anchorN:ids.size,points:ps.map(p=>{const candidates=cityRows(data,registry,p,basis).filter(r=>r.group===g.id&&(cohort!=='fixed'||ids.has(r.id))),valid=metricRows(candidates,metric),s=stats(valid);return {period:p,n:valid.length,estimatedN:s.estimatedN,requiredN:cohort==='fixed'?ids.size:null,value:cohort==='fixed'&&(!ids.size||valid.length!==ids.size)?null:s[metric]};})};});
}
function broadPeriod(data,registry,basis='ytd'){
 const ps=M.periods(data,basis).filter(p=>p>=M.windowStart(data.targetPeriod,1)&&p<=data.targetPeriod),scores=ps.map(period=>({period,n:snapshot(data,registry,period,basis).reduce((sum,s)=>sum+s.n,0)})),max=Math.max(0,...scores.map(s=>s.n));
 return scores.filter(s=>s.n>=max*.8&&s.n>0).at(-1)?.period||M.defaultPeriod(data);
}
function csv(data,registry,period,basis){return cityRows(data,registry,period,basis).filter(r=>r.group>=1&&r.group<=4).map(r=>({城市:r.name,省份:r.parent||r.name,展示层级:r.group,原始分级:r.originalTier,分级版本:registry.version,统计期:period,统计口径:basis,社零金额亿元:r.amount,同比百分比:r.yoy,...M.calculationCsv(r),增速较上月变化百分点:r.change,可比基数亿元测算:M.comparableBase(r.amount,r.yoy),同比来源:M.fieldSourceIds(r,'yoy').join(' '),金额来源:M.fieldSourceIds(r,'amount').join(' '),来源链接:M.sourceIds(r).map(id=>data.sources.find(s=>s.id===id)?.url||'').join(' '),发布日期:M.sourceIds(r).map(id=>data.sources.find(s=>s.id===id)?.releaseDate||'').filter(Boolean).join(' ')}));}
const api={mean,quantile,merge,cityRows,stats,snapshot,trend,broadPeriod,csv};if(typeof module==='object'&&module.exports)module.exports=api;else root.RegionalRetailTiers=api;
})(typeof window==='object'?window:globalThis);
