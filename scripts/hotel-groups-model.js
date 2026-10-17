(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./hotel-metrics.js'));else root.HotelGroupsModel=factory(root.HotelMetrics);})(typeof globalThis!=='undefined'?globalThis:this,function(H){
 'use strict';
 const groups={hworld:'华住',jinjiang:'锦江酒店（中国区）',btg:'首旅如家',atour:'亚朵'};
 const weeklyMetrics={adr:{name:'ADR',field:'stay_adr',unit:'元/间'},hotels:{name:'酒店数',field:'hotel_count',unit:'家'},rooms:{name:'房间数',field:'room_count',unit:'间'}};
 const time=p=>/^\d{4}Q[1-4]$/.test(p)?Number(p.slice(0,4))*12+Number(p.at(-1))*3:Number(p.slice(0,4))*53+Number(p.slice(5));
 function weeklySeries(rows,id,metric){const d=weeklyMetrics[metric];if(!d)return null;const own=H.sorted(rows.filter(o=>o.group===groups[id]&&o.region==='全国')),index=H.index(own,['period_id']);
  return {metric,name:d.name,unit:d.unit,currency:metric==='adr'?'CNY':null,frequency:'周度',periodBasis:metric==='adr'?'入住日期':'周度样本',region:'全国',scope:groups[id],basis:'酒店之家 · 集团周度样本',observations:own.map(o=>{const value=H.num(o[d.field]),b=index.get(H.priorPeriod(o)),base=b?H.num(b[d.field]):null;return {id:'weekly-'+id+'-'+metric+'-'+o.period_id,period:o.period_id,value,startDate:o.start_date,endDate:o.end_date,status:'transcribed',sourceId:'hotel-home-weekly',report:o.source||'酒店之家',locator:'hotel_group_weekly.csv / '+o.group+' / '+o.period_id,rawValue:o[d.field],yoy:value!=null&&base!=null&&base>0?{value:(value/base-1)*100,unit:'%',kind:'同周同比',priorId:H.priorPeriod(o)}:null};})};
 }
 function series(data,weekly,type,id,metric){return type==='weekly'?weeklySeries(weekly,id,metric):data.companies.find(c=>c.id===id)?.series[metric]||null;}
 function periods(data,weekly,type,metric){return [...new Set(data.companies.flatMap(c=>series(data,weekly,type,c.id,metric)?.observations.map(o=>o.period)||[]))].sort((a,b)=>time(a)-time(b));}
 function observation(s,period){return s?.observations.find(o=>o.period===period)||null;}
 function windowRows(s,period,count,allPeriods){const available=allPeriods.filter(p=>time(p)<=time(period)),wanted=count==='all'?available:available.slice(-Number(count));return wanted.map(p=>observation(s,p)||{period:p,value:null,yoy:null});}
 function display(s,o){const money=s?.unit==='百万元';return {value:o?.value==null?null:money?o.value/100:o.value,unit:money?'亿元':s?.unit||'',precision:money?2:0};}
 function growth(o){const y=o?.yoy;return y&&Number.isFinite(y.value)&&['%','百分点'].includes(y.unit)?y:null;}
 return {groups,weeklyMetrics,weeklySeries,time,series,periods,observation,windowRows,display,growth};
});
