(function(root){
  'use strict';
  const M=typeof module==='object'&&module.exports?require('./macro-model.js'):root.MacroModel;
  const featured={CN:['cn-gdp-quarter','cn-retail','cn-pmi','cn-cpi','cn-unemployment','cn-m2'],US:['us-gdp-quarter','us-cpi','us-payroll','us-unemployment','us-fed-rate','us-treasury10']};
  function core(catalog,country,snapshot){return M.curated(catalog.series,{country},snapshot).core;}
  function directory(catalog,snapshot,state){
    const list=M.curated(catalog.series,state,snapshot).core;
    return list.filter(s=>(!state.frequency||s.frequency===state.frequency)&&(!state.health||(state.health==='attention'?M.status(s,snapshot.series[s.id])!=='已收录'||snapshot.series[s.id]?.coverage?.missingPeriods?.length||snapshot.series[s.id]?.coverage?.historyShort:M.rows(snapshot.series[s.id]).length===0)));
  }
  function headlineRows(spec,data){
    const list=M.rows(data);
    // Most series display their raw value; avoid sorting every prefix for daily history.
    const derived=(['us-cpi','us-core-cpi'].includes(spec.id)&&spec.kind!=='rate')||(spec.id==='us-payroll'&&data.metric!=='monthly-change');
    if(!derived){
      const officialHeadline=['cn-retail','cn-disposable-income'].includes(spec.id)&&M.finite(list.at(-1)?.officialYoy);
      return list.map(r=>({...r,chartValue:officialHeadline?(M.finite(r.officialYoy)?r.officialYoy:null):r.value}));
    }
    const byPeriod=new Map(list.map(r=>[r.period,r]));
    return list.map(r=>{const year=+r.period.slice(0,4),month=+r.period.slice(-2),previous=byPeriod.get(spec.id==='us-payroll'?(month===1?year-1:year)+'-'+String(month===1?12:month-1).padStart(2,'0'):(year-1)+r.period.slice(4));return {...r,chartValue:previous?(spec.id==='us-payroll'?r.value-previous.value:previous.value>0?Number(((r.value/previous.value-1)*100).toFixed(10)):null):null};});
  }
  function priorPeriod(spec,period){
    const year=+period.slice(0,4),month=+period.slice(-2);
    if(spec.frequency==='quarterly')return period.endsWith('Q1')?(year-1)+'-Q4':year+'-Q'+(+period.slice(-1)-1);
    if(spec.frequency==='annual')return String(year-1);
    if(spec.frequency==='monthly')return (month===1?year-1:year)+'-'+String(month===1?12:month-1).padStart(2,'0');
    return null;
  }
  function readout(spec,data){
    const points=headlineRows(spec,data),latest=points.at(-1),head=M.headline(spec,data);
    const previous=latest?points.find(r=>r.period===priorPeriod(spec,latest.period)):null;
    return {latest,previous:previous||null,value:head.value,unit:head.unit,label:head.label,delta:movement(spec,data)};
  }
  function releases(catalog,snapshot,country){
    const specs=core(catalog,country,snapshot).filter(s=>s.frequency!=='daily'),items=[];let unknown=0;
    for(const spec of specs){
      const data=snapshot.series[spec.id]||{},reading=readout(spec,data),date=reading.latest?.releaseDate;
      if(!reading.latest)continue;
      const valid=/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
      if(!valid||date>snapshot.cutoff){unknown++;continue;}
      items.push({spec,data,reading,releaseDate:date});
    }
    items.sort((a,b)=>b.releaseDate.localeCompare(a.releaseDate)||a.spec.id.localeCompare(b.spec.id));
    return {items,unknown};
  }
  const trends={CN:['cn-retail','cn-pmi','cn-cpi'],US:['us-gdp-quarter','us-cpi','us-payroll']};
  function trendRows(spec,data,cutoff){
    const boundary=new Date(cutoff+'T00:00:00Z');boundary.setUTCFullYear(boundary.getUTCFullYear()-3);
    return headlineRows(spec,data).filter(r=>M.dateOf(r.period)>=boundary&&M.dateOf(r.period)<=new Date(cutoff+'T23:59:59Z'));
  }
  function movement(spec,data){
    const list=headlineRows(spec,data),latest=list.at(-1);if(!latest||spec.frequency==='daily')return null;
    const previous=list.find(r=>r.period===priorPeriod(spec,latest.period));
    if(!previous||!M.finite(previous.chartValue)||!M.finite(latest.chartValue))return null;
    const unit=M.headline(spec,data).unit;
    return {value:Number((latest.chartValue-previous.chartValue).toFixed(10)),unit:unit==='%'?'百分点':unit,label:spec.frequency==='quarterly'?'较上季':spec.frequency==='annual'?'较上年':'较上月'};
  }
  function segments(spec,points){
    const maxGap={annual:400,quarterly:110,monthly:40,daily:7}[spec.frequency],result=[];let part=[],previous;
    for(const p of points){if(previous&&(M.dateOf(p.period)-M.dateOf(previous.period))/86400000>maxGap){if(part.length)result.push(part);part=[];}if(M.finite(p.chartValue))part.push(p);else{if(part.length)result.push(part);part=[];}previous=p;}
    if(part.length)result.push(part);return result;
  }
  function latestCsv(specs,snapshot,sources){
    const header=['指标','国家','数据期间','显示值','显示单位','显示口径','原始值','原始单位','季调与口径','发布日期','获取时间','状态','来源'];
    const list=specs.map(s=>{const data=snapshot.series[s.id]||{},latest=M.rows(data).at(-1),head=M.headline(s,data);return [s.name,s.country,latest?.period,head.value,head.unit,head.label,latest?.value,s.unit,s.adjustment,latest?.releaseDate,data.fetchedAt,M.status(s,data),latest?.sourceUrl||data.sourceUrl||sources[s.source]?.url];});
    return '\uFEFF'+[header,...list].map(r=>r.map(M.csvCell).join(',')).join('\r\n');
  }
  const api={featured,core,directory,headlineRows,movement,segments,latestCsv,priorPeriod,readout,releases,trends,trendRows};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MacroDashboardModel=api;
})(typeof window==='object'?window:globalThis);


