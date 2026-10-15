(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./company-database-model.js'),require('./company-overview-model.js'));
  else root.HotelResearchModel=factory(root.CompanyDatabaseModel,root.CompanyOverviewModel);
})(typeof globalThis!=='undefined'?globalThis:this,function(M,A){
  'use strict';
  const dimensions=['region','scope','mode','basis','currency','frequency','periodBasis'];
  const actual=o=>!!o&&Number.isFinite(o.value)&&A.actual(o);
  const safe=o=>actual(o)&&!o.sourceConflict&&!o.researchIssue;
  const match=(o,sel)=>Object.entries(sel||{}).every(([k,v])=>o[k]===v);
  const selector=o=>Object.fromEntries(dimensions.map(k=>[k,o[k]??null]));
  function rows(data,sel,metric,period){return M.filter(data.filter(o=>actual(o)&&match(o,sel)&&(!metric||o.metric===metric)&&(!period||o.period===period)));}
  // A broad selector must never silently pick one of multiple scope/currency series.
  function one(data,sel,metric,period){const found=rows(data,sel,metric,period);if(!found.length)return null;const lastPeriod=found.at(-1).period,last=found.filter(o=>o.period===lastPeriod);return last.length===1?last[0]:null;}
  function history(data,o){return o?rows(data,selector(o),o.metric):[];}
  function previous(data,o){if(!o)return null;return one(data,selector(o),o.metric,(Number(o.period.slice(0,4))-1)+o.period.slice(4));}
  function growth(data,o){
    if(!safe(o))return null;
    if(Number.isFinite(o.reportedYoY))return {value:o.reportedYoY,unit:o.metric==='occ'?'百分点':'%',inputs:[o],method:'披露同比'};
    const b=previous(data,o);if(!safe(b))return null;
    if(o.metric==='occ')return {value:o.value-b.value,unit:'百分点',inputs:[o,b],method:'同比计算'};
    if(b.value<=0)return {value:o.value-b.value,unit:o.unit,inputs:[o,b],method:'同比增减额'};
    return {value:(o.value/b.value-1)*100,unit:'%',inputs:[o,b],method:'同比计算'};
  }
  function compatible(a,b,keys=dimensions){return safe(a)&&safe(b)&&a.companyId===b.companyId&&a.period===b.period&&keys.every(k=>(a[k]??null)===(b[k]??null));}
  function derived(value,unit,inputs,method){return Number.isFinite(value)?{value,unit,inputs,method}:null;}
  function ratio(a,b){return compatible(a,b)&&a.unit===b.unit&&b.value>0?derived(a.value/b.value*100,'%', [a,b],'分子 / 分母'):null;}
  function net(data,p,period){
    const sel=p.opened||p.scale,n=one(data,sel,'net_opened',period);if(n)return safe(n)?{row:n,inputs:[n],value:n.value,unit:n.unit}:null;
    const a=one(data,sel,'opened',period),b=one(data,sel,'closed',period);
    // Some companies disclose reclassification into pipeline separately.
    const transfer=one(data,sel,'to_pipeline',period);
    if(!compatible(a,b)||a.unit!==b.unit)return null;
    if(transfer&&!compatible(a,transfer))return null;
    return derived(a.value-b.value-(transfer?.value||0),a.unit,[a,b,...(transfer?[transfer]:[])],'新开 − 退出 − 转筹建');
  }
  function financial(data,p,period,source='research'){
    const sel=source==='choice'?p.choiceFinancial:p.financial,r=one(data,sel,'revenue',period);
    const profitMetric=source==='choice'?p.choiceProfitMetric:p.profitMetric;
    const out={revenue:r,profitMetric,source,period};if(!r)return out;
    for(const metric of ['parent_profit','net_profit','adjusted_profit','adjusted_ebitda','operating_profit','deducted_profit','managed_revenue','leased_revenue','retail_revenue','retail_other_revenue','other_revenue','hotel_revenue','gross_profit','hotel_cost','retail_cost','sales_expense','admin_expense','finance_expense','operating_cf'])out[metric]=one(data,selector(r),metric,period);
    return out;
  }
  function gap(data,a,b){
    const ga=growth(data,a),gb=growth(data,b);
    if(!ga||!gb||ga.unit!=='%'||gb.unit!=='%'||!compatible(a,b,['region','mode','currency','frequency','periodBasis'])||a.unit!==b.unit)return null;
    return derived(ga.value-gb.value,'百分点',[...ga.inputs,...gb.inputs],'序列A同比 − 序列B同比');
  }
  function roomsPerHotel(rooms,hotels){return compatible(rooms,hotels)&&hotels.value>0?derived(rooms.value/hotels.value,'间/家',[rooms,hotels],'客房 / 酒店'):null;}
  function scaleChange(data,o){if(!safe(o))return null;const h=history(data,o),i=h.findIndex(r=>r.id===o.id),prior=h[i-1];if(!safe(prior)||M.period(o.period)-M.period(prior.period)!==3)return null;return derived(o.value-prior.value,o.unit,[o,prior],'期末 − 上季末');}
  function bridge(data,f){
    const profit=f[f.profitMetric],prior=previous(data,profit);if(!safe(profit)||!safe(prior))return null;
    const components=[];
    for(const metric of ['revenue','hotel_cost','retail_cost','sales_expense','admin_expense','finance_expense']){
      const o=f[metric],b=previous(data,o);if(!compatible(o,profit)||!compatible(b,prior)||o.unit!==profit.unit||b.unit!==prior.unit)continue;
      components.push({metric,value:(o.value-b.value)*(metric==='revenue'?1:-1),inputs:[o,b]});
    }
    if(!components.some(x=>x.metric==='revenue')||components.length<3)return null;
    const residual=profit.value-prior.value-components.reduce((s,x)=>s+x.value,0);
    return {start:prior,end:profit,components:[...components,{metric:'未拆分差额（含税项等）',value:residual,inputs:[prior,profit,...components.flatMap(x=>x.inputs)]}]};
  }
  function scenario(base,assumptions){
    const {revenue,profit,hotelRevenue,hotels}=base;
    if(![revenue,profit,hotelRevenue,hotels].every(Number.isFinite)||revenue<=0||hotelRevenue<0||hotelRevenue>revenue||hotels<=0)return null;
    const {revpar,netHotels,contribution,incrementalMargin,expenseDelta}=assumptions;
    if(!Object.values(assumptions).every(Number.isFinite)||revpar<=-100||netHotels<=-hotels||contribution<0||contribution>1||incrementalMargin<0||incrementalMargin>100||Math.abs(expenseDelta)>100)return null;
    const hotelFactor=(1+revpar/100)*(1+netHotels/hotels*contribution);
    const projectedRevenue=revenue-hotelRevenue+hotelRevenue*hotelFactor;
    const projectedProfit=profit+(projectedRevenue-revenue)*incrementalMargin/100-projectedRevenue*expenseDelta/100;
    return {revenue:projectedRevenue,profit:projectedProfit,margin:projectedProfit/projectedRevenue*100,revenueGrowth:(projectedRevenue/revenue-1)*100,profitGrowth:profit>0?(projectedProfit/profit-1)*100:null};
  }
  function progress(data,p,record){
    const sel=record.metric==='hotels'?p.scale:record.metric==='opened'?(p.opened||p.scale):p.financial;
    let found=rows(data,Object.fromEntries(Object.entries(sel).filter(([k])=>k!=='frequency')),record.metric).filter(o=>safe(o)&&o.period.slice(0,4)===record.period.slice(0,4)&&o.unit===record.unit&&(o.currency||'')===(record.currency||''));
    if(record.period.endsWith('FY'))found=found.filter(o=>o.period===record.period||record.metric==='hotels'||o.frequency==='半年'||o.frequency==='累计');else found=found.filter(o=>o.period===record.period);
    const o=found.at(-1);if(!o||!(record.low>0))return null;
    return {row:o,ratio:o.value/record.low*100,complete:o.period===record.period};
  }
  return {dimensions,actual,safe,match,selector,rows,one,history,previous,growth,compatible,derived,ratio,net,financial,gap,roomsPerHotel,scaleChange,bridge,scenario,progress};
});
