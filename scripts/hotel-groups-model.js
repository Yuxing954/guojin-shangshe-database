(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./hotel-metrics.js'));else root.HotelGroupsModel=factory(root.HotelMetrics);})(typeof globalThis!=='undefined'?globalThis:this,function(H){
 'use strict';
 const groups={hworld:'华住',jinjiang:'锦江酒店（中国区）',btg:'首旅如家',atour:'亚朵'};
 const weeklyMetrics={adr:{name:'ADR',field:'stay_adr',unit:'元/间'},heat:{name:'热度指数',originalName:'市场热度指数(按入住日期统计)',field:'stay_heat_index',unit:'指数',precision:2},price:{name:'房价指数',originalName:'价格指数(按入住日期统计)',field:'stay_price_index',unit:'指数',precision:2},hotels:{name:'酒店数',field:'hotel_count',unit:'家'},rooms:{name:'房间数',field:'room_count',unit:'间'}};
 const time=p=>Number(p.slice(0,4))*53+Number(p.slice(5));
 function series(rows,id,metric){const d=weeklyMetrics[metric];if(!d)return null;const own=H.sorted(rows.filter(o=>o.group===groups[id]&&o.region==='全国')),index=H.index(own,['period_id']);
  return {metric,name:d.name,originalName:d.originalName||d.name,precision:d.precision||0,field:d.field,unit:d.unit,currency:metric==='adr'?'CNY':null,frequency:'周度',periodBasis:['adr','heat','price'].includes(metric)?'入住日期':'周度样本',region:'全国',scope:groups[id],basis:'酒店之家集团数据',observations:own.map(o=>{const value=H.num(o[d.field]),b=index.get(H.priorPeriod(o)),base=b?H.num(b[d.field]):null;return {id:'weekly-'+id+'-'+metric+'-'+o.period_id,period:o.period_id,value,startDate:o.start_date,endDate:o.end_date,source:'酒店之家',locator:'hotel_group_weekly.csv / '+o.group+' / '+o.period_id+' / '+d.field,rawValue:o[d.field],yoy:value!=null&&base!=null&&base>0?{value:(value/base-1)*100,unit:'%',kind:'同周同比',priorPeriod:H.priorPeriod(o),priorValue:base}:null};})};
 }
 function periods(rows){return [...new Set(rows.filter(o=>Object.values(groups).includes(o.group)&&o.region==='全国').map(o=>o.period_id))].sort((a,b)=>time(a)-time(b));}
 function observation(s,period){return s?.observations.find(o=>o.period===period)||null;}
 function windowRows(s,period,count,allPeriods){const available=allPeriods.filter(p=>time(p)<=time(period)),wanted=count==='all'?available:available.slice(-Number(count));return wanted.map(p=>observation(s,p)||{period:p,value:null,yoy:null});}
 function csv(rows,metric,period,count){const headers=['集团','数据周','开始日期','结束日期','指标','数值','单位','字段','同比（%）','同比基周','基期原值','来源','来源定位'],cell=v=>{let s=String(v??'');if(/^[=+@-]/.test(s)&&typeof v!=='number')s="'"+s;return '"'+s.replace(/"/g,'""')+'"';},all=periods(rows);
  return '\uFEFF'+[headers,...Object.entries(groups).flatMap(([id,name])=>{const s=series(rows,id,metric);return windowRows(s,period,count,all).filter(o=>o.value!=null).map(o=>[name,o.period,o.startDate,o.endDate,s.name,o.value,s.unit,s.field,o.yoy?.value,o.yoy?.priorPeriod,o.yoy?.priorValue,o.source,o.locator]);})].map(row=>row.map(cell).join(',')).join('\r\n');
 }
 return {groups,weeklyMetrics,time,series,periods,observation,windowRows,csv};
});
