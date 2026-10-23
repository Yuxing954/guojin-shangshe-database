(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.CruiseAnalysisModel=model;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v),difference=(a,b)=>finite(a)&&finite(b)?a-b:null,growth=(a,b)=>finite(a)&&finite(b)&&b>0?(a/b-1)*100:null;
 const previousYear=p=>String(Number(p.slice(0,4))-1)+p.slice(4);
 function create(industry,details){
  const core=new Map(industry.records.map(r=>[r.period,r])),detail=new Map(details.records.map(r=>[r.period,r])),periods=[...new Set([...core.keys(),...detail.keys()])].sort();
  const at=p=>({period:p,industry:core.get(p),detail:detail.get(p)});
  function audience(p){const r=at(p),b=at(previousYear(p)),a=r.detail?.ages||[],ba=b.detail?.ages||[],o=r.detail?.origins||{},bo=b.detail?.origins||{};
   const minor=finite(a[0])&&finite(a[1])?a[0]+a[1]:null,priorMinor=finite(ba[0])&&finite(ba[1])?ba[0]+ba[1]:null;
   return {period:p,senior:a[5]??null,seniorDelta:difference(a[5],ba[5]),minor,minorDelta:difference(minor,priorMinor),foreign:o.foreign??null,foreignYoY:growth(o.foreign,bo.foreign),foreignShare:o.foreignShare??null,foreignShareDelta:difference(o.foreignShare,bo.foreignShare),domestic:o.domestic??null,domesticYoY:growth(o.domestic,bo.domestic)};
  }
  function company(p,index){const r=at(p),b=at(previousYear(p)),value=r.detail?.companies?.[index]??null,prior=b.detail?.companies?.[index]??null;
   const shareFor=x=>index===6?(x.detail?.jiaoyunShare??null):(finite(x.detail?.companies?.[index])&&finite(x.industry?.monthly.passengers)&&x.industry.monthly.passengers>0?x.detail.companies[index]/x.industry.monthly.passengers*100:null);
   const share=shareFor(r),priorShare=shareFor(b),yoy=growth(value,prior),industryYoY=r.industry?.monthly.passengersYoY??null,values=(r.detail?.companies||[]).filter(finite);
   return {period:p,index,name:details.companyLabels[index],value,prior,yoy,share,priorShare,shareDelta:difference(share,priorShare),shareStatus:index===6?'官方披露':'测算',industryYoY,excess:difference(yoy,industryYoY),rank:finite(value)?1+values.filter(v=>v>value).length:null,sampleCount:values.length,sourceId:r.detail?.sourceId??null,priorSourceId:b.detail?.sourceId??null,industrySourceIds:r.industry?.sourceIds||[],priorIndustrySourceIds:b.industry?.sourceIds||[]};
  }
  function ranking(p){return details.companyLabels.map((_,i)=>company(p,i)).sort((a,b)=>finite(a.value)&&finite(b.value)?b.value-a.value:finite(a.value)?-1:finite(b.value)?1:a.index-b.index);}
  function windowPeriods(p,count=12){const filtered=periods.filter(x=>x<=p);return count==='all'?filtered:filtered.slice(-Number(count));}
  function metric(p,id){const r=at(p),a=audience(p);return id==='passengers'?(r.industry?.monthly.passengers??null):id==='load'?(r.industry?.monthly.load??null):id==='senior'?a.senior:id==='minor'?a.minor:a.foreignShare;}
  function seasons(p,id){const years=[...new Set(periods.filter(x=>x.slice(0,4)<=p.slice(0,4)).map(x=>x.slice(0,4)))].slice(-3);return {years,rows:Array.from({length:12},(_,i)=>{const mm=String(i+1).padStart(2,'0');return {period:mm+'月',x:i,values:years.map(year=>({name:year+'年',value:year+ '-'+mm<=p?metric(year+'-'+mm,id):null}))};})};}
  function ageComparison(p){return [...new Set(periods.filter(x=>x.slice(0,4)<=p.slice(0,4)).map(x=>x.slice(0,4)))].slice(-3).map(y=>{const period=y+p.slice(4);return {period,ages:detail.get(period)?.ages||Array(6).fill(null),sourceId:detail.get(period)?.sourceId??null,evidence:detail.get(period)?.evidence?.ages};});}
  const sourceById=new Map([...industry.sources,...details.sources].map(s=>[s.id,s]));
  function csv(p,view,index=6,count=12){const rows=[['分析期间','视图','月份','指标','数值','单位','口径','来源','基期来源','计算输入']];
   const url=id=>sourceById.get(id)?.url||'',q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
   if(view==='operators')for(const period of windowPeriods(p,count))for(const r of details.companyLabels.map((_,i)=>company(period,i)))for(const [k,label,unit,status] of [['value','客运量','万人','官方月度披露'],['yoy','客运量同比','%','两年同月舍入值测算'],['share','行业份额','%',r.shareStatus],['shareDelta','份额同比变动','百分点','两年同月份额相减'],['excess','较行业增速','百分点','公司测算同比减行业披露同比']])rows.push([p,view,period,r.name+' '+label,r[k],unit,r[k]===null?'缺失':status,url(r.sourceId),url(r.priorSourceId),JSON.stringify({company:r.value,priorCompany:r.prior,industryPassengers:core.get(period)?.monthly.passengers??null,priorIndustryPassengers:core.get(previousYear(period))?.monthly.passengers??null,industryYoY:r.industryYoY,industrySources:r.industrySourceIds.map(url),priorIndustrySources:r.priorIndustrySourceIds.map(url)})]);
   else for(const period of windowPeriods(p,count)){const a=audience(period),d=detail.get(period);for(const [k,label,unit] of [['senior','60岁以上国内游客占比','%'],['minor','18岁以下国内游客占比','%'],['domestic','国内客运量','万人'],['foreign','境外客运量','万人'],['foreignShare','境外游客占比','%'],['foreignYoY','境外客运量同比','%']])rows.push([p,view,period,label,a[k],unit,a[k]===null?'缺失':k==='minor'?'12岁以下+12—18岁':k==='foreignYoY'?'两年同月舍入值测算':d?.fieldStatus?.['origins.'+k]||'官方月度披露',url(d?.sourceId),url(detail.get(previousYear(period))?.sourceId),JSON.stringify({ages:d?.ages??null,origins:d?.origins??null,priorOrigins:detail.get(previousYear(period))?.origins??null})]);}
   return '\ufeff'+rows.map(r=>r.map(q).join(',')).join('\r\n');
  }
  return {periods,at,audience,company,ranking,windowPeriods,seasons,ageComparison,csv,sourceById,industry,details};
 }
 return {finite,difference,growth,previousYear,create};
});
