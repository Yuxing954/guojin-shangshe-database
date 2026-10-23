(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TravelModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const finite=Number.isFinite;
  function yearRows(rows,year){return year==='all'?rows:year==='recent'?rows.filter(r=>String(r.year||r.period)>='2023'):rows.filter(r=>String(r.year||r.period).startsWith(String(year)));}
  function continuous(rows,frequency='month'){
    if(!rows.length)return [];
    const found=new Map(rows.map(r=>[r.period,r])),out=[];
    let current=new Date(rows[0].period+(frequency==='month'?'-01':'')+'T00:00:00Z');
    const end=rows.at(-1).period;
    while(true){const p=current.toISOString().slice(0,frequency==='month'?7:10);if(p>end)break;out.push(found.get(p)||{period:p,value:null,change:null});if(frequency==='month')current.setUTCMonth(current.getUTCMonth()+1);else current.setUTCDate(current.getUTCDate()+1);}
    return out;
  }
  function cumulative(rows,period){
    if(!period)return {value:null,change:null};
    const year=+period.slice(0,4),m=+period.slice(5,7),lookup=new Map(rows.map(r=>[r.period,r]));
    function sum(y){let total=0;for(let i=1;i<=m;i++){const r=lookup.get(y+'-'+String(i).padStart(2,'0'));if(!finite(r?.value))return null;total+=r.value;}return total;}
    const value=sum(year),prior=sum(year-1);return {value,change:value!=null&&prior>0?(value/prior-1)*100:null};
  }
  function outboundRows(destination,year,scope){const original=yearRows(destination.records,year);return continuous(original).map(r=>scope==='ytd'?{...r,...cumulative(destination.records,r.period)}:r);}
  function annualRows(destination){
    const years=[...new Set(destination.records.map(r=>r.period.slice(0,4)))].sort(),totals=new Map((destination.annualBaselines||[]).map(r=>[r.period,r]));
    for(const year of years){const rows=destination.records.filter(r=>r.period.startsWith(year)),sum=cumulative(destination.records,year+'-12');if(sum.value!=null){const ids=[...new Set(rows.map(r=>r.sourceId))];totals.set(year,{period:year,value:sum.value,sourceId:ids[0],sourceIds:ids,locator:rows.map(r=>r.locator).join('; ')});}}
    return years.filter(y=>y>='2023'&&totals.has(y)).map(y=>{const r=totals.get(y),prior=totals.get(String(+y-1));return {...r,change:prior?.value>0?(r.value/prior.value-1)*100:null,changeBasis:prior?.value>0?'完整年度客流计算':'上年完整年度基期未收录',comparisonSourceId:prior?.sourceId};});
  }
  function borderRows(data,scope){return data.inbound.border.filter(r=>r.scope===scope).sort((a,b)=>a.period.localeCompare(b.period));}
  function domesticQuarterRows(data,year='recent',scope='quarter',quarter='all'){return yearRows(scope==='ytd'?data.domestic.quarterYtd:data.domestic.quarters,year).filter(r=>quarter==='all'||r.quarter===Number(quarter));}
  const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  function csv(rows,headers){return '\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');}
  function source(data,id){return data.sources.find(s=>s.id===id)||{};}
  return {yearRows,continuous,cumulative,outboundRows,annualRows,borderRows,domesticQuarterRows,csv,source};
});
