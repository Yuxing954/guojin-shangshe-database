(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GoldResearch=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const categories=['jewelry','bars','industrial'];
  const labels={jewelry:'黄金首饰',bars:'金条及金币',industrial:'工业及其他'};
  const sameScope=(a,b)=>b&&a.scope===b.scope&&a.unit===b.unit&&a.quality===b.quality;
  function quarters(rows){
    const index=new Map(rows.map(r=>[r.period,r]));
    return rows.slice().sort((a,b)=>a.period.localeCompare(b.period)).map(r=>{
      const p=index.get(`${r.year}-Q${r.quarter-1}`),previous=sameScope(r,p)?p:null,values={};
      for(const k of categories){const current=r.values[k],prior=r.quarter===1?0:previous?.values[k];values[k]=finite(current)&&finite(prior)&&current>=prior?Math.round((current-prior)*1000)/1000:null;}
      const b0=index.get(`${r.year-1}-Q${r.quarter}`),bp=index.get(`${r.year-1}-Q${r.quarter-1}`),base=sameScope(r,b0)?b0:null,basePrior=sameScope(r,bp)?bp:null,yoy={};
      for(const k of categories){const b=base?.values[k],p=r.quarter===1?0:basePrior?.values[k],v=finite(b)&&finite(p)&&b>=p?b-p:null;yoy[k]=finite(values[k])&&finite(v)&&v>0?(values[k]/v-1)*100:null;}
      const inputSourceIds=[r.sourceId,...(previous?[previous.sourceId]:[])];
      const yoyInputSourceIds=[...inputSourceIds,...(base?[base.sourceId]:[]),...(basePrior?[basePrior.sourceId]:[])];
      return {...r,values,yoy,periodStart:`${r.year}-${String(r.quarter*3-2).padStart(2,'0')}-01`,basis:r.quarter===1?'disclosed_quarter':'derived_quarter',inputSourceIds,yoyInputSourceIds,yoyBasis:'derived_same_quarter'};
    });
  }
  function metric(row,key){const m=row.metrics[key];return m&&finite(m.value)?m.value:null;}
  function cashConversion(row){const cf=metric(row,'cashflow'),p=metric(row,'profit');return finite(cf)&&finite(p)&&p>0?cf/p*100:null;}
  function inventoryGrowth(row){const v=metric(row,'inventory'),p=metric(row,'inventoryPrevious');return finite(v)&&finite(p)&&p>0?(v/p-1)*100:null;}
  function validate(data){
    const errors=[],sources=new Map((data.sources||[]).map(s=>[s.id,s])),keys=new Set();
    if(data.schemaVersion!==1||sources.size!==(data.sources||[]).length)errors.push('版本或来源重复');
    const source=(r)=>{const s=sources.get(r.sourceId);if(!s||s.quality!=='primary'||s.period!==r.period||!/^https:\/\//.test(s.url)||!s.sha256?.match(/^[0-9a-f]{64}$/))errors.push('需求指标缺少对应期间原始披露');};
    for(const r of data.retail||[]){
      source(r);if(keys.has(r.period))errors.push('零售期间重复');keys.add(r.period);
      if(!/^\d{4}-(0[2-9]|1[0-2])$/.test(r.period)||!['monthly','jan_feb'].includes(r.basis)||(r.period.endsWith('-02')?r.basis!=='jan_feb':r.basis!=='monthly'))errors.push('零售1—2月口径错误');
      if(r.unit!=='亿元'||!finite(r.amount)||r.amount<=0||!finite(r.yoy)||!finite(r.ytdAmount)||!finite(r.ytdYoy))errors.push('零售量值无效');
    }
    keys.clear();
    for(const r of data.consumption||[]){
      source(r);if(keys.has(r.period))errors.push('消费期间重复');keys.add(r.period);
      if(r.period!==`${r.year}-Q${r.quarter}`||r.quarter<1||r.quarter>4||r.basis!=='cumulative'||r.unit!=='吨')errors.push('消费累计期间错误');
      for(const k of categories)if(!finite(r.values[k])||r.values[k]<0||!finite(r.yoy[k]))errors.push('消费类别缺失');
    }
    keys.clear();
    for(const r of data.financials||[]){
      if(keys.has(r.id))errors.push('公司重复');keys.add(r.id);
      if(r.currency!=='CNY'||r.unit!=='亿元'||r.periodStart!=='2026-01-01'||r.periodEnd!=='2026-06-30')errors.push('公司期间或币种混用');
      for(const m of Object.values(r.metrics)){if(m===null)continue;const s=sources.get(m.sourceId);if(!finite(m.value)||!s||m.quality!==s.quality||!['primary','provider'].includes(m.quality))errors.push('财务字段来源或数值错误');if(m.quality==='primary'&&(!/^https:\/\//.test(s?.url)||!Number.isInteger(m.pdfPage)||m.pdfPage<1))errors.push('财务原始页码缺失');}
    }
    return errors;
  }
  function comparable(a,b){return a.periodStart===b.periodStart&&a.periodEnd===b.periodEnd&&a.currency===b.currency&&a.unit===b.unit;}
  return {finite,categories,labels,quarters,metric,cashConversion,inventoryGrowth,validate,comparable};
});
