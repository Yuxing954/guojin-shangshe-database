(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DutyfreeMonthly=api;})(typeof window!=='undefined'?window:this,function(){
'use strict';
const pairs={sales_yoy_pct:'shopping_sales_cny_100m',shoppers_yoy_pct:'shoppers_10k',items_yoy_pct:'items_10k',tourists_yoy_pct:'tourists_10k',spend_per_shopper_yoy_pct:'spend_per_shopper_cny'};
function number(v){if(v==null||String(v).trim()===''||['-','--','—'].includes(String(v).trim()))return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null;}
function previous(period){return /^\d{4}-(0[1-9]|1[0-2])$/.test(period)?String(Number(period.slice(0,4))-1)+period.slice(4):null;}
function derive(input){
  const rows=input.map(row=>({...row})),map=new Map();rows.forEach(row=>{if(map.has(row.period_id))throw Error('免税月度存在重复月份：'+row.period_id);map.set(row.period_id,row);});
  rows.forEach(row=>Object.entries(pairs).forEach(([rate,field])=>{
    const basePeriod=previous(row.period_id),base=map.get(basePeriod),current=number(row[field]),prior=number(base?.[field]);
    if(number(row[rate])!==null){row[rate+'_method']=row[rate+'_method']||'reported';row[rate+'_note']=row[rate+'_note']||'';return;}
    if(current!==null&&prior!==null&&prior>0){
      row[rate]=String((current/prior-1)*100);row[rate+'_method']='calculated';
      row[rate+'_note']='计算值：（当月 ÷ '+basePeriod+' - 1）× 100'+(basePeriod==='2011-04'?'；基期为政策启用首月，非完整经营月':'');
    }else{
      row[rate]='';row[rate+'_method']='unavailable';
      row[rate+'_note']=current===null?'当月原始值缺失':prior===null?'上年同月基期缺失':prior===0?'上年同月基期为0，无法计算同比':'基期异常，无法计算同比';
    }
  }));return rows;
}
return {derive,number,previous,pairs};
});
