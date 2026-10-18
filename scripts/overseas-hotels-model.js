(function(root){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const fmt=(v,d=2)=>finite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
 const growth=(v,pp=false)=>finite(v)?(v>0?'+':'')+fmt(v,1)+(pp?' pp':'%'):'—';
 function operating(rows,{mode='单季度',quarter,region}={}){return rows.filter(r=>r.mode===mode&&(!quarter||r.quarter===quarter)&&(!region||r.region===region));}
 function previous(period){return String(period).replace(/^\d{4}/,s=>String(Number(s)-1));}
 function financialGrowth(rows,r){if(!r||!finite(r.value))return null;const before=rows.find(p=>p.period===previous(r.period)&&p.region===r.region&&p.metric===r.metric&&p.unit===r.unit&&p.basis===r.basis);return before&&finite(before.value)&&before.value>0?(r.value/before.value-1)*100:null;}
 function financeMatrix(rows,region){const rank=p=>Number(p.slice(0,4))*10+({Q1:1,H1:2,Q2:2,Q3:3,'9M':3,FY:4,Q4:4}[p.slice(4)]||0);const selected=rows.filter(r=>r.region===region),periods=[...new Set(selected.map(r=>r.period))].sort((a,b)=>rank(a)-rank(b)),metrics=[...new Set(selected.map(r=>r.metric))];return {periods,metrics,rows:selected};}
 function chartPoints(rows,quarters,idx){return quarters.map(q=>{const r=rows.find(r=>r.quarter===q);return {period:q,value:r?.changes[idx]??null,source:r};});}
 function segments(points){const out=[];let current=[];for(const p of points){if(finite(p.value))current.push(p);else if(current.length){out.push(current);current=[];}}if(current.length)out.push(current);return out;}
 const api={finite,fmt,growth,operating,previous,financialGrowth,financeMatrix,chartPoints,segments};if(typeof module==='object'&&module.exports)module.exports=api;else root.OverseasHotelModel=api;
})(typeof window==='object'?window:globalThis);
