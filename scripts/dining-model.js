(function(root){
  'use strict';
  function cell(data,brandId,row){return data.records.find(r=>r.brandId===brandId&&r.startRow<=row&&r.endRow>=row)||null;}
  function monthly(data,brandId){return data.periods.filter(p=>p.kind==='month').map(p=>{const r=data.records.find(r=>r.brandId===brandId&&r.period===p.id&&r.scope==='month');return {period:p.id,value:r?.value??null};});}
  function filtered(data,{category='all',year='all',holidays=true}={}){const brands=data.brands.filter(b=>category==='all'||b.category===category),ids=new Set(brands.map(b=>b.id)),rows=data.periods.map((p,i)=>({...p,index:i})).filter(p=>(year==='all'||p.id.startsWith(year))&&(holidays||p.kind!=='holiday')).sort((a,b)=>b.index-a.index);return {brands,rows,records:data.records.filter(r=>ids.has(r.brandId)&&rows.some(p=>p.index>=r.startRow&&p.index<=r.endRow)).sort((a,b)=>b.endRow-a.endRow||b.startRow-a.startRow)};}
  function source(data,record){return data.sources.find(s=>s.id===record?.sourceId)||{};}
  function metric(data,record,brand){return record?.metric||brand.metric.replace('原表同店口径','同店');}
  function csvRows(data,state){return filtered(data,state).records.map(r=>{const b=data.brands.find(b=>b.id===r.brandId),s=source(data,r);return {'品牌':b.name,'业态':b.category,'指标口径':metric(data,r,b),'口径补充':r.metricNote||'','开始期间':r.period,'结束期间':r.periodEnd,'来源原始期间':(r.sourcePeriodLabel||r.periodLabel).replace('（原图合并）',''),'期间类型':r.scope,'展示值':r.raw,'精确恢复率':r.value,'单位':r.unit,'数据性质':r.dataNature||(/预计/.test(r.raw)?'预计':'原图转录'),'来源':s.name||r.sourceId,'发布日':s.publishedAt||'','来源链接':s.url||'','原文摘录':r.sourceQuote||'','定位':r.locator};});}
  const api={cell,monthly,filtered,csvRows,source,metric};if(typeof module==='object'&&module.exports)module.exports=api;else root.DiningModel=api;
})(typeof window==='object'?window:globalThis);

