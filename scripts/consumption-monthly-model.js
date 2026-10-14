(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MonthlyProduct=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const monthIndex=p=>Number(p.slice(0,4))*12+Number(p.slice(5))-1;
const monthAt=n=>Math.floor(n/12)+'-'+String(n%12+1).padStart(2,'0');
const monthLabel=(p,combined=false)=>p.slice(0,4)+'年'+(combined?'1—2':Number(p.slice(5)))+'月';
const rows=(data,id)=>data.observations.filter(r=>r.indicatorId===id&&r.frequency==='monthly'&&['month','jan_feb'].includes(r.basis)&&r.quality!=='estimate');
function row(data,id,period,basis='month'){return data.observations.find(r=>r.indicatorId===id&&r.period===period&&r.frequency==='monthly'&&(basis==='month'?['month','jan_feb'].includes(r.basis):r.basis===basis)&&r.quality!=='estimate')||null;}
function months(data){return [...new Set(['retail','cpi'].flatMap(id=>rows(data,id).filter(r=>finite(r.value)||finite(r.yoy)).map(r=>r.period)))].sort().reverse();}
function preferred(data){const retail=new Set(rows(data,'retail').filter(r=>finite(r.value)||finite(r.yoy)).map(r=>r.period));return rows(data,'cpi').filter(r=>finite(r.value)&&retail.has(r.period)).map(r=>r.period).sort().at(-1)||months(data)[0]||'';}
function periods(data,period,count){const candidates=months(data).filter(p=>p<=period);if(!candidates.length)return [];const start=count==='all'?monthIndex(candidates.at(-1)):Math.max(monthIndex(candidates.at(-1)),monthIndex(period)-Number(count)+1);return Array.from({length:monthIndex(period)-start+1},(_,i)=>monthAt(start+i));}
function display(v,precision=1){return finite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:precision,maximumFractionDigits:precision}):'—';}
const rate=v=>finite(v)?(v>0?'+':'')+display(v)+'%':'—';
function report(data,period,count='12'){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||!months(data).includes(period))throw Error('未收录该月份');
 const retail=row(data,'retail',period),cpi=row(data,'cpi',period),core=row(data,'core_cpi',period),ytd=row(data,'retail',period,'ytd'),online=row(data,'online_goods',period,'ytd');
 const history=periods(data,period,count),recent=periods(data,period,'3'),priceRecent=periods(data,period,'6'),combined=retail?.basis==='jan_feb';
 const structure=['goods','catering','retail_urban','retail_rural','online_goods'].map(id=>({id,name:data.indicators.find(i=>i.id===id)?.name||id,current:row(data,id,period),ytd:row(data,id,period,'ytd')}));
 const categories=data.indicators.filter(i=>i.group==='社零分品类').map(i=>({id:i.id,name:i.name,current:row(data,i.id,period),history:recent.map(p=>row(data,i.id,p))}));
 const prices=priceRecent.map(p=>({period:p,cpi:row(data,'cpi',p),core:row(data,'core_cpi',p)}));
 const currentRows=[retail,cpi,core,ytd,online,...structure.flatMap(i=>[i.current,i.ytd]),...categories.map(i=>i.current)].filter(Boolean);
 const chartRows=history.flatMap(p=>['retail','goods','catering','cpi','core_cpi'].map(id=>row(data,id,p))).filter(Boolean);
 const sourceIds=new Set([...currentRows,...chartRows,...prices.flatMap(p=>[p.cpi,p.core]).filter(Boolean)].flatMap(r=>[r.sourceId,r.supplementSourceId,...Object.values(r.fieldSources||{})]).filter(Boolean));
 const sources=data.sources.filter(s=>sourceIds.has(s.id));
 const comments=[retail?'本期社零'+display(retail.value,0)+'亿元，同比'+rate(retail.yoy)+'；餐饮收入同比'+rate(row(data,'catering',period)?.yoy)+'。':'本期社零暂无数据。',cpi?'CPI同比'+rate(cpi.value)+'，环比'+rate(cpi.mom)+'；核心CPI同比'+rate(core?.value)+'。':'本期CPI暂无数据。'].join('\n');
 return {period,title:monthLabel(period)+' 社零与CPI月度跟踪',periodLabel:monthLabel(period,combined),combined,retail,cpi,core,ytd,online,structure,categories,prices,history,recent,sources,comments,
 retailTrend:history.map(p=>({period:p,retail:row(data,'retail',p),goods:row(data,'goods',p),catering:row(data,'catering',p)})),
 priceTrend:history.map(p=>({period:p,cpi:row(data,'cpi',p),core:row(data,'core_cpi',p)}))};
}
return {finite,monthLabel,monthIndex,monthAt,row,months,preferred,periods,display,rate,report};
});