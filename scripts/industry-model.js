(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IndustryModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function latest(metric){return metric.points.filter(p=>Number.isFinite(p.value)).at(-1)||null;}
  function inRange(points,years){if(!Number(years)||!points.length)return points;const last=new Date(points.at(-1).endDate+'T00:00:00Z');last.setUTCFullYear(last.getUTCFullYear()-Number(years));const cutoff=last.toISOString().slice(0,10);return points.filter(p=>p.endDate>=cutoff);}
  function chartPoints(metric,years,mode){let points=inRange(metric.points,years);if(!metric.isRate&&mode!=='change')points=points.filter(p=>p.basis!=='combined');return points.map(p=>({...p,value:mode==='change'?(Number.isFinite(p.change)?p.change:null):p.value}));}
  function csv(metric,points,sources){const headers=['指标','单位','数据期间','期间开始','期间结束','统计口径','数值','变化','变化单位','变化定义','来源','来源URL','发布日期','核对或采集时间','数据状态','变化来源'];const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';return '\uFEFF'+[headers,...points.map(p=>{const s=sources[p.sourceId]||{};return [metric.label,metric.unit,p.periodLabel,p.startDate,p.endDate,p.basis,p.value,p.change,metric.changeUnit||'%',p.changeLabel||'',s.name,s.url||s.file,s.publishedAt,s.retrievedAt,p.quality,(sources[p.changeSourceId]||{}).name||''];})].map(row=>row.map(quote).join(',')).join('\r\n');}
  return {latest,inRange,chartPoints,csv};
});
