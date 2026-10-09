(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GoldMacro=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const day=d=>Date.parse(d+'T00:00:00Z')/86400000;
  const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(day(d))&&new Date(day(d)*86400000).toISOString().slice(0,10)===d;
  const sorted=rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date));
  function chicagoTimestamp(s){
    if(s.observedAt===null)return true;
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[56]:00$/.test(s.observedAt)||!Number.isFinite(Date.parse(s.observedAt)))return false;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(s.observedAt)),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return v.year+'-'+v.month+'-'+v.day+'T'+v.hour+':'+v.minute+':'+v.second===s.observedAt.slice(0,19)&&s.observedAt.slice(0,10)===s.observedDate;
  }
  function probabilities(snapshot,baseline){
    if(!snapshot||!Array.isArray(snapshot.ranges)||!Array.isArray(baseline)||baseline.length!==2||!baseline.every(finite)||baseline[1]<=baseline[0])return null;
    let cut=0,hold=0,hike=0,mid=0,total=0;const keys=new Set();
    for(const r of snapshot.ranges){
      if(![r.lower,r.upper,r.probability].every(finite)||r.upper<=r.lower||r.probability<0||r.probability>100)return null;
      const key=r.lower+'|'+r.upper;if(keys.has(key))return null;keys.add(key);
      if(r.lower===baseline[0]&&r.upper===baseline[1])hold+=r.probability;
      else if(r.upper<=baseline[0])cut+=r.probability;
      else if(r.lower>=baseline[1])hike+=r.probability;
      else return null;
      mid+=(r.lower+r.upper)/2*r.probability;total+=r.probability;
    }
    const ranges=snapshot.ranges.slice().sort((a,b)=>a.lower-b.lower);
    if(ranges.some((r,i)=>i&&r.lower<ranges[i-1].upper)||Math.abs(total-100)>.15||!keys.has(baseline.join('|')))return null;
    return {cut,hold,hike,midpoint:mid/total};
  }
  function latestSnapshot(meeting){return meeting.snapshots.slice().sort((a,b)=>(a.observedAt||a.observedDate).localeCompare(b.observedAt||b.observedDate)).at(-1);}
  function changeSince(series,anchor){
    const rows=sorted(series.observations).filter(r=>finite(r.value)),latest=rows.at(-1),base=rows.filter(r=>r.date<=anchor).at(-1);
    if(!base||!latest||latest.date<=base.date)return null;
    return {from:base.date,to:latest.date,absolute:latest.value-base.value,percent:base.value===0?null:(latest.value/base.value-1)*100,bp:series.unit==='%'?(latest.value-base.value)*100:null};
  }
  function ageDays(date,now){return validDate(date)&&validDate(now)?Math.floor(day(now)-day(date)):null;}
  function validate(d){
    const e=[];if(!d||d.schemaVersion!==1||!validDate(d.checkedAt))return ['宏观数据结构或核对日期无效'];
    const sources=new Map((d.sources||[]).map(s=>[s.id,s]));
    if(sources.size!==(d.sources||[]).length)e.push('宏观来源重复');
    for(const s of sources.values())if(!['primary','provider','compiled'].includes(s.quality)||!/^https:\/\//.test(s.url)||!s.name||s.sha256!==null&&!/^[a-f0-9]{64}$/.test(s.sha256)||!s.retrieval)e.push('宏观来源不完整');
    function ref(r){const s=sources.get(r.sourceId);if(!s||r.quality!==s.quality)e.push('宏观字段与来源核验状态不一致');if(r.quality==='primary'&&s&&!['curl_original','browser_dom_excerpt','web_primary_checked'].includes(s.retrieval))e.push('原始核验缺凭据');}
    const p=d.policy;if(!p||p.unit!=='%'||!Array.isArray(p.range)||p.range.length!==2||!p.range.every(finite)||p.range[1]<=p.range[0]||p.range[0]<0||p.range[1]>25||!validDate(p.decisionDate)||p.decisionDate>d.checkedAt)e.push('政策利率口径无效');else ref(p);
    const codes={real10:['%','美国:国债实际收益率(以通胀为标的):10年(%)'],dxy:['指数','美元指数'],usdcny:['CNY/USD','中间价:美元兑人民币'],brent:['USD/桶','日现货FOB价:欧洲布伦特原油(美元/桶)']};
    const seriesKeys=new Set();for(const s of d.series||[]){ref(s);if(seriesKeys.has(s.id))e.push('宏观序列重复');seriesKeys.add(s.id);if(!codes[s.id]||s.unit!==codes[s.id][0]||s.originalName!==codes[s.id][1]||s.frequency!=='daily')e.push('宏观指标身份或单位错误');let prior='';for(const r of s.observations||[]){if(!validDate(r.date)||r.date>d.checkedAt||r.date<=prior||!finite(r.value))e.push('宏观观测日期重复、逆序、未来或空值');prior=r.date;}if(!s.observations?.length)e.push('宏观序列为空');}
    const dates=new Set();for(const m of d.meetings||[]){if(dates.has(m.meetingDate)||!validDate(m.meetingDate)||m.rateUnit!=='%')e.push('FOMC会议日期或利率单位错误');dates.add(m.meetingDate);let prior='';for(const s of m.snapshots||[]){ref(s);if(!validDate(s.observedDate)||s.observedDate>d.checkedAt||s.observedDate>=m.meetingDate||s.observedDate<(p?.decisionDate||'')||s.observedDate<=prior||s.probabilityUnit!=='%'||s.timezone!=='America/Chicago'||!chicagoTimestamp(s))e.push('预期时点、时区或政策基准不匹配');prior=s.observedDate;if(!probabilities(s,p?.range))e.push('会议概率分布无效');}if(!m.snapshots?.length)e.push('会议概率缺失');}
    const proj=d.projections;if(proj){ref(proj);if(proj.unit!=='%'||proj.basis!=='sep_year_end_midpoint'||!validDate(proj.asOf)||proj.asOf>d.checkedAt||!proj.points?.length||proj.points.some(r=>!Number.isInteger(r.year)||r.year<Number(proj.asOf.slice(0,4))||!finite(r.value)))e.push('点阵图口径无效');}
    for(const r of [...(d.releases||[]),...(d.flows||[])]){ref(r);if(!finite(r.value)||!r.unit||!validDate(r.periodEnd)||r.periodEnd>d.checkedAt||!validDate(r.publishedAt)||r.publishedAt<r.periodEnd||r.publishedAt>d.checkedAt)e.push('宏观统计期间或发布日期无效');}
    for(const r of d.events||[])if(!sources.has(r.sourceId)||!Number.isFinite(Date.parse(r.scheduledAt))||!r.period||!r.name)e.push('事件日历缺时间或来源');
    return e;
  }
  return {finite,probabilities,latestSnapshot,changeSince,ageDays,chicagoTimestamp,validate};
});
