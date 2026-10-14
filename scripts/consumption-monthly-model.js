(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MonthlyProduct=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const monthIndex=p=>Number(p.slice(0,4))*12+Number(p.slice(5))-1;
const monthAt=n=>Math.floor(n/12)+'-'+String(n%12+1).padStart(2,'0');
const monthLabel=(p,combined=false)=>p.slice(0,4)+'年'+(combined?'1—2':Number(p.slice(5)))+'月';
const rows=(data,id)=>data.observations.filter(r=>r.indicatorId===id&&r.frequency==='monthly'&&['month','jan_feb'].includes(r.basis)&&r.quality!=='estimate');
function row(data,id,period,basis='month'){return data.observations.find(r=>r.indicatorId===id&&r.period===period&&r.frequency==='monthly'&&(basis==='month'?['month','jan_feb'].includes(r.basis):r.basis===basis)&&r.quality!=='estimate')||null;}
function months(data){return [...new Set(['cpi'].flatMap(id=>rows(data,id).filter(r=>finite(r.value)||finite(r.yoy)).map(r=>r.period)))].sort().reverse();}
function preferred(data){return months(data)[0]||'';}
function periods(data,period,count){const candidates=months(data).filter(p=>p<=period);if(!candidates.length)return [];const start=count==='all'?monthIndex(candidates.at(-1)):Math.max(monthIndex(candidates.at(-1)),monthIndex(period)-Number(count)+1);return Array.from({length:monthIndex(period)-start+1},(_,i)=>monthAt(start+i));}
function display(v,precision=1){return finite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:precision,maximumFractionDigits:precision}):'—';}
const rate=v=>finite(v)?(v>0?'+':'')+display(v)+'%':'—';
function report(data,period,count='12',insights={}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||!months(data).includes(period))throw Error('未收录该月份');
 const cpi=row(data,'cpi',period),core=row(data,'core_cpi',period),history=periods(data,period,count),recent=periods(data,period,'6');
 const prices=recent.map(p=>({period:p,cpi:row(data,'cpi',p),core:row(data,'core_cpi',p)}));
 const priceTrend=history.map(p=>({period:p,cpi:row(data,'cpi',p),core:row(data,'core_cpi',p)}));
 const sourceIds=new Set([...priceTrend.flatMap(p=>[p.cpi,p.core]),row(data,'cpi',period,'ytd')].filter(Boolean).flatMap(r=>[r.sourceId,r.supplementSourceId,...Object.values(r.fieldSources||{})]).filter(Boolean));
 const sources=data.sources.filter(s=>sourceIds.has(s.id)),source=data.sources.find(s=>s.id===cpi?.sourceId);
 const latest=rows(data,'cpi').filter(r=>finite(r.value)).map(r=>r.period).sort().at(-1)||'';
 const prepared=insights.months?.[period];
 return {period,title:monthLabel(period)+'CPI跟踪',periodLabel:monthLabel(period),cpi,core,prices,priceTrend,sources,history,
 freshness:{period,publishedAt:source?.publishedAt||'',updatedAt:cpi?.updatedAt||source?.checkedAt||data.checkedAt||'',latest},
 priceCategories:prepared?.categories||[],headline:prepared?.headline||'',
 comments:prepared?.comment||'CPI同比'+rate(cpi?.value)+'，环比'+rate(cpi?.mom)+'；核心CPI同比'+rate(core?.value)+'，环比'+rate(core?.mom)+'。'};
}
return {finite,monthLabel,monthIndex,monthAt,row,months,preferred,periods,display,rate,report};
});