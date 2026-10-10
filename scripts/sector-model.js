(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SectorModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const basisLabels={monthly:'单月',combined:'1—2月合并',ytd:'年初累计',year:'全年',quarter:'单季',half:'半年',point:'时点'};
  function points(metric,{basis,from='',to=''}={}){return (metric.points||[]).filter(p=>Number.isFinite(p.value)&&(!basis||p.basis===basis)&&p.endDate>=from&&(!to||p.endDate<=to)).sort((a,b)=>a.endDate.localeCompare(b.endDate));}
  function latest(metric){return points(metric).at(-1)||null;}
  function groups(rows,frequency){
    const segments=[];let segment=[];
    rows.forEach(p=>{const last=segment.at(-1),days=last?(Date.parse(p.endDate)-Date.parse(last.endDate))/86400000:0;
      const gap=last&&(p.basis!==last.basis||(p.basis==='ytd'&&p.endDate.slice(0,4)!==last.endDate.slice(0,4))||days>(frequency==='周度'?15:frequency==='日度'?10:p.basis==='monthly'?40:p.basis==='quarter'?100:p.basis==='year'?370:200));
      if(gap){segments.push(segment);segment=[];}segment.push(p);
    });if(segment.length)segments.push(segment);return segments;
  }
  function companyRows(data,{company='',period='',q=''}={}){const needle=q.toLowerCase();return data.companyObservations.filter(r=>(!company||r.companyId===company)&&(!period||r.period===period)&&(!needle||[r.label,r.scope,r.period].join(' ').toLowerCase().includes(needle))).sort((a,b)=>b.period.localeCompare(a.period)||a.companyId.localeCompare(b.companyId)||a.metricId.localeCompare(b.metricId));}
  function csv(rows,sources){const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';const headers=['公司/指标','指标ID','统计期间','统计口径','数值','单位','同比','环比','范围','来源','来源URL','原始机构','来源状态','发布日期','采集/核对时间','定位','计算方式','计算输入','原始值'];return '\uFEFF'+[headers,...rows.map(r=>{const s=sources[r.sourceId]||{};return [r.label,r.metricId,r.period,r.basis,r.value,r.unit,r.yoy??r.change,r.mom,r.scope,s.name,s.url||s.file,s.publisher||s.provider,r.quality||s.quality,s.publishedAt,s.retrievedAt,s.locator,r.calculation||r.unitConversion,JSON.stringify(r.inputs||[]),r.originalValue];})].map(r=>r.map(quote).join(',')).join('\r\n');}
  return {basisLabels,points,latest,groups,companyRows,csv};
});
