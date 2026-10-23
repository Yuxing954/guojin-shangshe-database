(function(root){
  'use strict';
  function cell(data,brandId,row){return data.records.find(r=>r.brandId===brandId&&r.startRow<=row&&r.endRow>=row)||null;}
  function monthly(data,brandId){return data.periods.filter(p=>p.kind==='month').map(p=>{const r=data.records.find(r=>r.brandId===brandId&&r.period===p.id&&r.scope==='month');return {period:p.id,value:r?.value??null};});}
  function filtered(data,{category='all',year='all',holidays=true}={}){const brands=data.brands.filter(b=>category==='all'||b.category===category),ids=new Set(brands.map(b=>b.id)),rows=data.periods.map((p,i)=>({...p,index:i})).filter(p=>(year==='all'||p.id.startsWith(year))&&(holidays||p.kind!=='holiday'));return {brands,rows,records:data.records.filter(r=>ids.has(r.brandId)&&rows.some(p=>p.index>=r.startRow&&p.index<=r.endRow))};}
  function csvRows(data,state){return filtered(data,state).records.map(r=>{const b=data.brands.find(b=>b.id===r.brandId);return {'品牌':b.name,'业态':b.category,'指标口径':b.metric,'开始期间':r.period,'结束期间':r.periodEnd,'期间':r.periodLabel,'期间类型':r.scope,'原文':r.raw,'精确恢复率':r.value,'单位':r.unit,'状态':r.status,'预计或测算':/预计|测算/.test(r.raw)?'是':'否','来源':'用户提供截图 · 东方证券研究（未独立复核）','定位':r.locator};});}
  const api={cell,monthly,filtered,csvRows};if(typeof module==='object'&&module.exports)module.exports=api;else root.DiningModel=api;
})(typeof window==='object'?window:globalThis);
