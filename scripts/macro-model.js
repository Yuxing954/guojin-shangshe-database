(function(root){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const frequency={annual:'年度',quarterly:'季度',monthly:'月度',daily:'日度'};
  function dateOf(period){
    if(/^\d{4}$/.test(period))return new Date(period+'-12-31T00:00:00Z');
    if(/^\d{4}-Q[1-4]$/.test(period))return new Date(Date.UTC(+period.slice(0,4),+period.slice(-1)*3,0));
    if(/^\d{4}-\d{2}$/.test(period))return new Date(Date.UTC(+period.slice(0,4),+period.slice(-2),0));
    return new Date(period+'T00:00:00Z');
  }
  function rows(data){return (data?.observations||[]).filter(r=>finite(r.value)).slice().sort((a,b)=>a.period.localeCompare(b.period));}
  function priorPeriod(period,freq,mode){
    const y=+period.slice(0,4);
    if(mode==='yoy')return String(y-1)+period.slice(4);
    if(freq==='annual')return null;
    if(freq==='quarterly'){const q=+period.slice(-1);return q===1?(y-1)+'-Q4':y+'-Q'+(q-1);}
    if(freq==='monthly'){const m=+period.slice(-2);return (m===1?y-1:y)+'-'+String(m===1?12:m-1).padStart(2,'0');}
    return null;
  }
  function compare(spec,list,row,mode){
    if(spec.kind==='cumulative')return null;
    // Daily series use only exact calendar matches: no implicit trading-day or monthly aggregation.
    if(spec.frequency==='daily')return null;
    const period=priorPeriod(row.period,spec.frequency,mode);
    const previous=list.find(r=>r.period===period);
    if(!previous)return null;
    if(spec.kind==='rate'||spec.kind==='balance')return Number((row.value-previous.value).toFixed(10));
    if(previous.value<=0)return null;
    return Number(((row.value/previous.value-1)*100).toFixed(10));
  }
  function changeUnit(spec){return spec.kind==='rate'?'百分点':spec.kind==='balance'?spec.unit:'%';}
  function changeLabel(spec,mode){
    if(mode==='mom'&&spec.frequency==='annual')return '环比（不适用）';
    const base=mode==='yoy'?'较上年同期':spec.frequency==='quarterly'?'较上季':'较上月';
    return base+(spec.kind==='rate'||spec.kind==='balance'?'差值':'变化');
  }
  function status(spec,data,now=new Date()){
    if(data?.status==='error')return '更新失败';
    if(data?.status==='empty')return rows(data).length?'本次无新数据':'上游无数据';
    const list=rows(data);if(!list.length)return '待接入';
    if((now-dateOf(list.at(-1).period))/86400000>spec.staleDays)return '数据滞后';
    return '已收录';
  }
  function filter(series,state,snapshot){
    const q=(state.q||'').toLocaleLowerCase().trim();
    return series.filter(s=>s.country===state.country&&(!state.category||s.category===state.category)&&
      (!state.available||rows(snapshot.series[s.id]).length)&&
      (!q||[s.name,s.category,s.code||'',s.definition].join(' ').toLocaleLowerCase().includes(q)));
  }
  function chartRows(spec,data,mode,years,now=new Date()){
    const list=rows(data), boundary=new Date(now);boundary.setUTCFullYear(boundary.getUTCFullYear()-years);
    return list.filter(r=>!years||dateOf(r.period)>=boundary).map(r=>({...r,chartValue:mode==='value'?r.value:compare(spec,list,r,mode)}));
  }
  function csvCell(value){
    let text=value===null||value===undefined?'':String(value);
    // Prevent spreadsheet formulas, while preserving ordinary numeric negatives.
    if(/^\s*[=+@]/.test(text)||/^[\t\r]/.test(text)||(/^\s*-/.test(text)&&!/^\s*-\d+(\.\d+)?$/.test(text)))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function csv(spec,data,source){
    const list=rows(data);
    const header=['指标','国家','数据期间','数值','单位','频率','季调与口径','同比变化','环比变化','变化单位','发布日期','源数据库更新日','获取时间','原始来源','原始提供者','修订脚注'];
    return '\uFEFF'+[header,...list.map(r=>[spec.name,spec.country,r.period,r.value,spec.unit,frequency[spec.frequency],spec.adjustment,
      compare(spec,list,r,'yoy'),compare(spec,list,r,'mom'),changeUnit(spec),r.releaseDate,data.datasetUpdatedAt,data.fetchedAt,r.sourceUrl||data.sourceUrl||source.url,data.sourceOrganization||source.name,(r.footnotes||[]).join('; ')])].map(row=>row.map(csvCell).join(',')).join('\r\n');
  }
  function safeUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'#';}catch{return '#';}}
  const api={finite,frequency,dateOf,rows,compare,status,filter,chartRows,changeUnit,changeLabel,csv,csvCell,safeUrl};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MacroModel=api;
})(typeof window==='object'?window:globalThis);
