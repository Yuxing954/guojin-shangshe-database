(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./retail-monthly-model.js'):root.RetailMonthly);if(typeof module==='object'&&module.exports)module.exports=api;else root.NationalRetail=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R){
'use strict';
const finite=R.finite,formula='可比基数=本期金额/(1+同比/100)；增量=本期金额-可比基数；拉动=增量/社零可比基数×100。原披露金额及增速有舍入；限额以上品类仅覆盖部分商品，不能相加为全国社零增速。';
function base(row){return row&&finite(row.value)&&row.value>=0&&finite(row.yoy)&&row.yoy>-100?row.value/(1+row.yoy/100):null;}
function impact(row,total){const b=base(row),t=base(total);return b!==null&&t>0?{base:b,increment:row.value-b,pp:(row.value-b)/t*100}:null;}
function periods(data,basis='month'){return [...new Set(data.observations.filter(r=>r.indicatorId==='retail'&&r.frequency==='monthly'&&(basis==='month'?['month','jan_feb'].includes(r.basis):r.basis==='ytd')&&r.quality!=='estimate'&&(finite(r.value)||finite(r.yoy))).map(r=>r.period))].sort().reverse();}
function report(data,period,basis='month',window='24'){
 const total=R.row(data,'retail',period,basis);if(!total)throw Error('未收录该期间');
 const previousPeriod=R.monthAt(R.monthIndex(period)-1);
 const item=id=>{const indicator=data.indicators.find(i=>i.id===id),row=R.row(data,id,period,basis),prev=R.row(data,id,previousPeriod,basis);
 const comparable=basis==='month'&&total.basis==='month'&&row?.basis==='month'&&prev?.basis==='month';
 return{id,name:indicator?.name||id,row,impact:impact(row,total),delta:comparable&&finite(row.yoy)&&finite(prev.yoy)?row.yoy-prev.yoy:null,source:data.sources.find(s=>s.id===row?.sourceId)};};
 const groups={type:['goods','catering'],location:['retail_urban','retail_rural']};
 const decompositions=Object.fromEntries(Object.entries(groups).map(([key,ids])=>{const items=ids.map(item),complete=items.every(i=>i.impact);return[key,{items,residual:complete&&finite(total.yoy)?total.yoy-items.reduce((n,i)=>n+i.impact.pp,0):null}];}));
 const available=periods(data,basis),earliest=available.at(-1),start=window==='all'?R.monthIndex(earliest):Math.max(R.monthIndex(earliest),R.monthIndex(period)-Number(window)+1);
 const trend=Array.from({length:R.monthIndex(period)-start+1},(_,i)=>{const p=R.monthAt(start+i);return{period:p,total:R.row(data,'retail',p,basis),exAuto:R.row(data,'retail_ex_auto',p,basis)};});
 const categories=data.indicators.filter(i=>/^category_\d+$/.test(i.id)).map(i=>item(i.id));
 const extras=['retail_ex_auto','above_total','above_goods','above_catering','online_goods'].map(item);
 const source=data.sources.find(s=>s.id===total.sourceId);
 return{period,basis,total,source,combined:total.basis==='jan_feb',label:basis==='ytd'?period.slice(0,4)+'年1—'+Number(period.slice(5))+'月':R.monthLabel(period,total.basis==='jan_feb'),cards:['retail','retail_ex_auto','goods','catering'].map(item),categories,decompositions,extras,trend,formula};
}
function csv(data,model){const rows=[...model.cards,...model.decompositions.location.items,...model.extras,...model.categories],unique=[...new Map(rows.map(r=>[r.id,r])).values()],cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 return '\uFEFF'+[['期间','口径','指标','范围','金额（亿元）','同比（%）','较上月增速变化（百分点）','反推可比基数（亿元，测算）','增量（亿元，测算）','对社零拉动（百分点，测算）','发布日期','金额来源','同比来源','测算公式'],...unique.map(i=>{const sources=new Map(data.sources.map(s=>[s.id,s]));return[model.period,i.row?.basis||model.basis,i.name,/^category_/.test(i.id)||/^above_/.test(i.id)?'限额以上':i.id==='online_goods'?'网上商品（交叉口径）':'全国',i.row?.value,i.row?.yoy,i.delta,i.impact?.base,i.impact?.increment,i.impact?.pp,i.source?.publishedAt||i.row?.releaseDate,sources.get(i.row?.fieldSources?.value||i.row?.sourceId)?.url,sources.get(i.row?.fieldSources?.yoy||i.row?.sourceId)?.url,formula]} )].map(r=>r.map(cell).join(',')).join('\r\n');
}
return{base,impact,periods,report,csv,formula};
});
