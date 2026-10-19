(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./consumption-monthly-model.js'):root.MonthlyProduct);if(typeof module==='object'&&module.exports)module.exports=api;else root.RetailMonthly=api;})(typeof globalThis!=='undefined'?globalThis:this,function(B){
'use strict';
const {finite,monthIndex,monthAt,monthLabel,row,display,rate}=B;
const months=d=>[...new Set(d.observations.filter(r=>r.indicatorId==='retail'&&r.frequency==='monthly'&&['month','jan_feb'].includes(r.basis)&&finite(r.yoy)&&r.quality!=='estimate').map(r=>r.period))].sort().reverse();
const preferred=d=>months(d)[0]||'';
function periods(d,p,n){const a=months(d).filter(x=>x<=p);if(!a.length)return [];const start=n==='all'?monthIndex(a.at(-1)):Math.max(monthIndex(a.at(-1)),monthIndex(p)-Number(n)+1);return Array.from({length:monthIndex(p)-start+1},(_,i)=>monthAt(start+i));}
function mergeReleases(d,insights){
 const out={...d,sources:d.sources.map(s=>({...s})),observations:d.observations.map(r=>({...r}))};
 for(const [period,release] of Object.entries(insights.months||{})){
  const s=release.source;if(!s||s.quality!=='official'||!/^https:\/\/([a-z0-9-]+\.)*stats\.gov\.cn\//.test(s.url)||!/^\d{4}-\d{2}-\d{2}$/.test(s.publishedAt)||s.publishedAt>insights.checkedAt)throw Error('社零月度来源无效');
  if(!out.sources.some(x=>x.id===s.id))out.sources.push({...s});
  const keys=new Set();for(const r of release.observations||[]){const key=[r.indicatorId,r.basis].join('|');if(keys.has(key)||!d.indicators.some(i=>i.id===r.indicatorId)||r.period!==period||r.sourceId!==s.id||r.frequency!=='monthly'||!['month','jan_feb','ytd'].includes(r.basis)||(!finite(r.value)&&r.value!==null)||(!finite(r.yoy)&&r.yoy!==null)||(r.value===null&&r.yoy===null))throw Error('社零月度记录无效');keys.add(key);
   const at=out.observations.findIndex(x=>x.indicatorId===r.indicatorId&&x.period===period&&x.frequency===r.frequency&&x.basis===r.basis);
   if(at<0)out.observations.push({...r});else{const existing=out.observations[at];if(['value','yoy'].some(k=>finite(existing[k])&&finite(r[k])&&existing[k]!==r[k]))throw Error('社零披露与历史冲突：'+key);out.observations[at]={...existing,...r};}
  }
 }
 out.checkedAt=[d.checkedAt,insights.checkedAt].filter(Boolean).sort().at(-1);return out;
}
function report(d,p,count='12',insights={}){
 if(!months(d).includes(p))throw Error('未收录该月份');
 const retail=row(d,'retail',p),combined=retail.basis==='jan_feb',label=monthLabel(p,combined),prepared=insights.months?.[p],history=periods(d,p,count);
 const trend=history.map(period=>({period,retail:row(d,'retail',period),exAuto:row(d,'retail_ex_auto',period),goods:row(d,'goods',period),catering:row(d,'catering',period)}));
 const ids=['retail','retail_ex_auto','goods','catering'];const previous=monthAt(monthIndex(p)-1);
 const cards=ids.map((id,i)=>{const current=row(d,id,p),prior=row(d,id,previous);return {name:['社零同比','除汽车同比','商品零售同比','餐饮收入同比'][i],value:current?.yoy,delta:!combined&&prior?.basis==='month'&&finite(current?.yoy)&&finite(prior?.yoy)?current.yoy-prior.yoy:null};});
 const categories=d.indicators.filter(i=>/^category_\d+$/.test(i.id)).map(i=>({name:i.name,value:row(d,i.id,p)?.yoy})).filter(r=>finite(r.value));
 const currentRows=d.observations.filter(r=>r.period===p&&r.frequency==='monthly'&&([...ids,'online_goods','online_services','service_retail'].includes(r.indicatorId)||/^category_/.test(r.indicatorId)));
 const sourceIds=new Set([...trend.flatMap(t=>[t.retail,t.exAuto,t.goods,t.catering]),...currentRows].filter(Boolean).flatMap(r=>[r.sourceId,r.supplementSourceId,...Object.values(r.fieldSources||{})]).filter(Boolean));
 const sources=d.sources.filter(s=>sourceIds.has(s.id));for(const s of prepared?.references||[])if(!sources.some(x=>x.id===s.id))sources.push(s);
 const source=d.sources.find(s=>s.id===retail.sourceId);
 return {period:p,periodLabel:label,title:label+'社零跟踪',retail,cards,trend,history,categories,sources,
 freshness:{publishedAt:source?.publishedAt||'',updatedAt:prepared?.source.checkedAt||source?.checkedAt||d.checkedAt||'',latest:preferred(d)},
 comments:prepared?.commentSections?.map(x=>x.title+'：'+x.text).join('\n\n')||label+'社会消费品零售总额'+display(retail.value,0)+'亿元，同比'+rate(retail.yoy)+'。暂无当期专题解读。',
 commentSections:prepared?.commentSections||[],ytd:row(d,'retail',p,'ytd'),online:row(d,'online_goods',p,'ytd'),mom:prepared?.seasonallyAdjustedMom?.find(x=>x.period===p)?.value??null};
}
return {finite,monthIndex,monthAt,monthLabel,row,display,rate,months,preferred,periods,mergeReleases,report};
});
