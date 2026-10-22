(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KoreaDutyfree=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const scopes={total:'全部顾客',foreign:'外国人',domestic:'韩国本国人'},finite=v=>typeof v==='number'&&Number.isFinite(v),prior=p=>(+p.slice(0,4)-1)+p.slice(4);
 function months(start,end){const out=[];let y=+start.slice(0,4),m=+start.slice(5);while(y+'-'+String(m).padStart(2,'0')<=end){out.push(y+'-'+String(m).padStart(2,'0'));if(++m>12){m=1;y++;}}return out;}
 function derive(data){
  const map=new Map(),rows=data.rows.map(r=>{
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period)||!scopes[r.scope])throw Error('韩国免税期间或分组无效');
   const key=r.period+'|'+r.scope;if(map.has(key))throw Error('韩国免税月份分组重复');
   for(const k of ['salesUsd','shoppers'])if(r[k]!=null&&(!finite(r[k])||r[k]<0))throw Error('韩国免税数值无效');
   const n={...r,spendUsd:finite(r.salesUsd)&&finite(r.shoppers)&&r.shoppers>0?r.salesUsd/r.shoppers:null};
   n.spendUsdPrecision=n.salesUsdPrecision==='raw'&&n.shoppersPrecision==='raw'?'derived':'estimated';map.set(key,n);return n;
  });
  for(const row of rows){const base=map.get(prior(row.period)+'|'+row.scope);for(const field of ['salesUsd','shoppers','spendUsd']){
   const value=row[field],before=base?.[field];row[field+'Yoy']=finite(value)&&finite(before)&&before>0?(value/before-1)*100:null;
   row[field+'YoyMethod']=row[field+'Yoy']===null?'unavailable':field==='spendUsd'||row[field+'Precision']!=='raw'||base[field+'Precision']!=='raw'?'estimated':'calculated';
   row[field+'BasePeriod']=prior(row.period);
  }}return rows.sort((a,b)=>a.period.localeCompare(b.period)||a.scope.localeCompare(b.scope));
 }
 function series(rows,scope,range='12'){
  const selected=rows.filter(r=>r.scope===scope);if(!selected.length)return [];
  const map=new Map(selected.map(r=>[r.period,r])),calendar=months(selected[0].period,selected.at(-1).period);
  const periods=range==='all'?calendar:calendar.slice(-Number(range));
  return periods.map(period=>map.get(period)||{period,scope,salesUsd:null,shoppers:null,spendUsd:null});
 }
 function exports(rows){return rows.map(r=>({'月份':r.period,'顾客分类':scopes[r.scope],'销售额(美元)':r.salesUsd,'购物人次':r.shoppers,'客单价(美元/人次,测算)':r.spendUsd,'销售额同比(%)':r.salesUsdYoy,'人次同比(%)':r.shoppersYoy,'客单价同比(%)':r.spendUsdYoy,'销售额原始回执':r.salesUsdRaw,'人次原始回执':r.shoppersRaw,'销售额精度':r.salesUsdPrecision,'人次精度':r.shoppersPrecision,'销售额来源':r.salesUsdSource,'人次来源':r.shoppersSource,'同比基期':prior(r.period)}));}
 return {scopes,finite,derive,series,exports,months};
});
