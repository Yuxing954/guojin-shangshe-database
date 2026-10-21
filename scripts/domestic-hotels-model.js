(function(root){
 'use strict';
 const metrics=['RevPAR','ADR','OCC'],finite=v=>typeof v==='number'&&Number.isFinite(v);
 const fmt=(v,d=2)=>finite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
 const growth=(v,pp=false)=>finite(v)?(v>0?'+':'')+fmt(v,1)+(pp?' pct':'%'):'—';
 const quarter=p=>String(p).replace(/H1$/,'Q2').replace(/9M$/,'Q3').replace(/FY$/,'Q4');
 const period=(q,frequency)=>frequency==='单季度'?q:q.replace(/Q2$/,'H1').replace(/Q3$/,'9M').replace(/Q4$/,'FY');
 const label=(p,frequency)=>frequency==='单季度'?String(p).replace(/^20(\d{2})Q/,'$1Q'):(/Q1$/.test(p)?'3M'+p.slice(2,4):/H1$/.test(p)?'6M'+p.slice(2,4):/9M$/.test(p)?'9M'+p.slice(2,4):/FY$/.test(p)?'FY'+p.slice(2,4):p);
 function range(quarters,from,to){const end=quarters.includes(to)?to:quarters.at(-1),start=quarters.includes(from)&&from<=end?from:quarters[0];return quarters.filter(q=>q>=start&&q<=end);}
 function windowRows(rows,frequency){return rows.filter(r=>frequency==='单季度'?/Q[1-4]$/.test(r.period):/(Q1|H1|9M|FY)$/.test(r.period));}
 function select(rows,filters={}){return rows.filter(r=>Object.entries(filters).every(([k,v])=>v==null||v===''||r[k]===v));}
 function series(rows,filters,quarters,frequency){const selected=select(windowRows(rows,frequency),filters);return quarters.map(q=>{const p=period(q,frequency),rs=selected.filter(r=>r.period===p);return {quarter:q,period:p,label:label(p,frequency),records:metrics.map(m=>rs.find(r=>r.metric===m)||null)};});}
 function mainFilters(company,kind,frequency){return {kind,region:company.region,category:company.id==='jinjiang'?(kind==='同店'?'合计':frequency==='单季度'?'有限服务型':'有限服务型合计'):company.category,mode:'合计',currency:'CNY'};}
 function mainSeries(data,kind,quarters,frequency){let filters=mainFilters(data.company,kind,frequency),rows=series(data.rows,filters,quarters,frequency);if(data.company.id==='jinjiang'&&kind==='全部'&&frequency==='累计')rows=rows.map((r,i)=>r.records.some(Boolean)?r:series(data.rows,{...filters,category:'有限服务型'},[quarters[i]],frequency)[0]);return rows;}
 function segments(points){const out=[];let current=[];for(const p of points){if(finite(p.value))current.push(p);else if(current.length){out.push(current);current=[];}}if(current.length)out.push(current);return out;}
 function search(rows,query){const words=String(query||'').trim().toLowerCase().split(/\s+/).filter(Boolean);return rows.filter(r=>words.every(w=>[r.period,r.kind,r.region,r.category,r.mode,r.metric,r.currency,r.evidence?.note].join(' ').toLowerCase().includes(w)));}
 const api={metrics,finite,fmt,growth,quarter,period,label,range,windowRows,select,series,mainFilters,mainSeries,segments,search};if(typeof module==='object'&&module.exports)module.exports=api;else root.DomesticHotelModel=api;
})(typeof window==='object'?window:globalThis);
