(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ConsumptionMacro=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const frequencies={monthly:'月度',quarterly:'季度',annual:'年度',holiday:'假期'};
  const bases={month:'当月',jan_feb:'1—2月合并',ytd:'年初累计',quarter:'单季',year:'全年',holiday:'假期合计'};
  const official=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['stats.gov.cn','mct.gov.cn','mot.gov.cn','mofcom.gov.cn'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}};
  function validate(data){
    const errors=[];if(data?.schemaVersion!==1||!Array.isArray(data.indicators)||!Array.isArray(data.observations)||!Array.isArray(data.sources))return ['数据结构无效'];
    const ids=new Map(),sources=new Map(),keys=new Set(),count=new Map();
    for(const i of data.indicators){if(ids.has(i.id)||!['connected','pending'].includes(i.status)||!i.name||!i.unit||!i.definition)errors.push('指标定义无效：'+i.id);ids.set(i.id,i);if(i.status==='pending'&&(!official(i.sourceUrl)||!i.pendingReason))errors.push('待接入来源无效：'+i.id);}
    for(const s of data.sources){if(sources.has(s.id)||!official(s.url)||!/^\d{4}-\d{2}-\d{2}$/.test(s.publishedAt)||s.publishedAt>data.checkedAt)errors.push('来源无效：'+s.id);sources.set(s.id,s);}
    for(const r of data.observations){
      const i=ids.get(r.indicatorId),s=sources.get(r.sourceId),key=[r.indicatorId,r.frequency,r.basis,r.period].join('|');
      if(!i||i.status!=='connected'||!s||!frequencies[r.frequency]||!bases[r.basis]||keys.has(key))errors.push('记录归属或重复：'+key);
      keys.add(key);count.set(r.indicatorId,(count.get(r.indicatorId)||0)+1);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(r.endDate)||r.endDate>s?.publishedAt)errors.push('期间与发布日期无效：'+key);
      if((r.value!==null&&!finite(r.value))||(r.yoy!==null&&!finite(r.yoy))||(r.value===null&&r.yoy===null))errors.push('数值无效：'+key);
      if(r.frequency==='monthly'&&(!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period)||(r.basis==='jan_feb'&&!r.period.endsWith('-02'))))errors.push('月度期间无效：'+key);
      if(r.frequency==='quarterly'&&!/^\d{4}-Q[1-4]$/.test(r.period))errors.push('季度期间无效：'+key);
      if(r.frequency==='annual'&&!/^\d{4}$/.test(r.period))errors.push('年度期间无效：'+key);
    }
    for(const i of ids.values())if(i.status==='connected'&&!count.has(i.id))errors.push('已接入指标没有记录：'+i.id);
    return errors;
  }
  const sorted=rows=>rows.slice().sort((a,b)=>a.endDate.localeCompare(b.endDate)||a.period.localeCompare(b.period,'zh-CN'));
  function records(data,id,{frequency='',basis='',from='',to=''}={}){return sorted(data.observations.filter(r=>r.indicatorId===id&&(!frequency||r.frequency===frequency)&&(!basis||(basis==='month'?['month','jan_feb'].includes(r.basis):r.basis===basis))&&(!from||r.endDate>=from)&&(!to||r.endDate<=to)));}
  function defaultScope(data,id,frequency=''){
    const rows=records(data,id,{frequency});const last=rows.at(-1);if(!last)return null;
    const f=frequency||last.frequency,available=rows.filter(r=>r.frequency===f),basis=available.some(r=>r.basis==='month'||r.basis==='jan_feb')?'month':last.basis;
    return {frequency:f,basis};
  }
  function latest(data,id,frequency=''){const scope=defaultScope(data,id,frequency);return scope?records(data,id,scope).at(-1):null;}
  function directory(data,{group='',frequency='',status='',query=''}={}){const q=query.trim().toLowerCase();return data.indicators.filter(i=>(!group||i.group===group)&&(!status||i.status===status)&&(!q||[i.name,i.group,i.definition].join(' ').toLowerCase().includes(q))&&(!frequency||(i.status==='pending'?(i.frequencies||[]).includes(frequency):data.observations.some(r=>r.indicatorId===i.id&&r.frequency===frequency))));}
  function segments(rows,field='value'){
    let segment=[],out=[];const push=()=>{if(segment.length)out.push(segment);segment=[];};
    for(const r of sorted(rows)){
      if(!finite(r[field])){push();continue;}
      const prev=segment.at(-1);
      if(prev){const a=Number(prev.period.slice(0,4))*12+Number(prev.period.slice(5)),b=Number(r.period.slice(0,4))*12+Number(r.period.slice(5));
        if(r.frequency!==prev.frequency||r.basis!==prev.basis||(r.frequency==='monthly'&&b-a!==1)||(r.basis==='ytd'&&r.period.slice(0,4)!==prev.period.slice(0,4)))push();
      }
      segment.push(r);
    }push();return out;
  }
  function csvCell(v){let s=v==null?'':String(v);if(/^[\s]*[=+@]/.test(s)||(/^[\s]*-/.test(s)&&!/^-[\d.]+$/.test(s.trim())))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function csv(data,rows){const indicators=new Map(data.indicators.map(i=>[i.id,i])),sources=new Map(data.sources.map(s=>[s.id,s]));
    const headers=['指标','分组','频率','数据期间','期间末日','统计口径','数值含义','数值','单位','同比%','环比%','实际同比%','备注','数据状态','发布日期','发布机构','原始报告','来源链接'];
    const body=rows.map(r=>{const i=indicators.get(r.indicatorId),s=sources.get(r.sourceId);return [i.name,i.group,frequencies[r.frequency],r.period,r.endDate,bases[r.basis]+'；'+i.definition,i.valueLabel,r.value,i.unit,r.yoy,r.mom,r.realYoy,r.note,r.quality==='estimate'?'预计':'官方披露',s.publishedAt,s.publisher,s.title,s.url];});
    return '\ufeff'+[headers,...body].map(row=>row.map(csvCell).join(',')).join('\r\n');
  }
  return {finite,frequencies,bases,official,validate,records,defaultScope,latest,directory,segments,csv};
});
