(function(root){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const frequency={annual:'年度',quarterly:'季度',monthly:'月度',daily:'日度'};
  function dateOf(period){
    if(/^\d{4}$/.test(period))return new Date(period+'-12-31T00:00:00Z');
    if(/^\d{4}-Q[1-4]$/.test(period))return new Date(Date.UTC(+period.slice(0,4),+period.slice(-1)*3,0));
    if(/^\d{4}-\d{2}$/.test(period))return new Date(Date.UTC(+period.slice(0,4),+period.slice(-2),0));
    return new Date(period+'T00:00:00Z');
  }
  function rows(data){return (data?.observations||[]).filter(r=>finite(r.value)).slice().sort((a,b)=>a.period.localeCompare(b.period));}
  function priorPeriod(period,freq,mode){
    const y=+period.slice(0,4);
    if(mode==='yoy')return String(y-1)+period.slice(4);
    if(freq==='annual')return null;
    if(freq==='quarterly'){const q=+period.slice(-1);return q===1?(y-1)+'-Q4':y+'-Q'+(q-1);}
    if(freq==='monthly'){const m=+period.slice(-2);return (m===1?y-1:y)+'-'+String(m===1?12:m-1).padStart(2,'0');}
    return null;
  }
  function compare(spec,list,row,mode){
    if(spec.id==='cn-retail'&&mode==='yoy'&&Object.hasOwn(row,'officialYoy'))return finite(row.officialYoy)?row.officialYoy:null;
    if(spec.kind==='cumulative')return null;
    // Daily series use only exact calendar matches: no implicit trading-day or monthly aggregation.
    if(spec.frequency==='daily')return null;
    const period=priorPeriod(row.period,spec.frequency,mode);
    const previous=list.find(r=>r.period===period);
    if(!previous)return null;
    if(spec.kind==='rate'||spec.kind==='balance')return Number((row.value-previous.value).toFixed(10));
    if(previous.value<=0)return null;
    return Number(((row.value/previous.value-1)*100).toFixed(10));
  }
  function changeUnit(spec){return spec.kind==='rate'?'百分点':spec.kind==='balance'?spec.unit:'%';}
  function changeLabel(spec,mode){
    if(spec.id==='cn-retail'&&spec.kind==='level'&&mode==='yoy')return '同比（官方口径）';
    if(mode==='mom'&&spec.frequency==='annual')return '环比（不适用）';
    const base=mode==='yoy'?'较上年同期':spec.frequency==='quarterly'?'较上季':'较上月';
    return base+(spec.kind==='rate'||spec.kind==='balance'?'差值':'变化');
  }
  function status(spec,data,now=new Date()){
    if(data?.status==='error')return '更新失败';
    if(data?.status==='empty')return rows(data).length?'本次无新数据':'上游无数据';
    const list=rows(data);if(!list.length)return '待接入';
    if((now-dateOf(list.at(-1).period))/86400000>spec.staleDays)return '数据滞后';
    return '已收录';
  }
  function filter(series,state,snapshot){
    const q=(state.q||'').toLocaleLowerCase().trim();
    return series.filter(s=>s.country===state.country&&(!state.category||s.category===state.category)&&
      (!state.available||rows(snapshot.series[s.id]).length)&&
      (!q||[s.name,s.category,s.code||'',s.definition].join(' ').toLocaleLowerCase().includes(q)));
  }
  function chartRows(spec,data,mode,years,now=new Date()){
    const list=rows(data), boundary=new Date(now);boundary.setUTCFullYear(boundary.getUTCFullYear()-years);
    return list.filter(r=>!years||dateOf(r.period)>=boundary).map(r=>({...r,chartValue:mode==='value'?r.value:compare(spec,list,r,mode)}));
  }
  function csvCell(value){
    let text=value===null||value===undefined?'':String(value);
    // Prevent spreadsheet formulas, while preserving ordinary numeric negatives.
    if(/^\s*[=+@]/.test(text)||/^[\t\r]/.test(text)||(/^\s*-/.test(text)&&!/^\s*-\d+(\.\d+)?$/.test(text)))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function csv(spec,data,source){
    const list=rows(data);
    const header=['指标','国家','数据期间','数值','单位','频率','季调与口径','同比变化','环比变化','变化单位','发布日期','源数据库更新日','获取时间','原始来源','原始提供者','修订脚注','官方同比%'];
    return '\uFEFF'+[header,...list.map(r=>[spec.name,spec.country,r.period,r.value,spec.unit,frequency[spec.frequency],spec.adjustment,
      compare(spec,list,r,'yoy'),compare(spec,list,r,'mom'),changeUnit(spec),r.releaseDate,data.datasetUpdatedAt,data.fetchedAt,r.sourceUrl||data.sourceUrl||source.url,data.sourceOrganization||source.name,(r.footnotes||[]).join('; '),r.officialYoy])].map(row=>row.map(csvCell).join(',')).join('\r\n');
  }
  function safeUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'#';}catch{return '#';}}
  const groups=[
    {id:'growth',label:'增长消费',CN:['gdp-quarter','pmi','retail','industrial-growth','disposable-income'],US:['gdp-quarter','retail','personal-income','industrial-production']},
    {id:'prices',label:'通胀就业',CN:['cpi','ppi','unemployment'],US:['cpi','core-cpi','pce','payroll','unemployment','earnings']},
    {id:'property',label:'地产投资',CN:['property-sales','property-investment','fixed-investment'],US:['housing-starts']},
    {id:'money',label:'货币利率',CN:['m2','tsf','lpr','usdcny'],US:['fed-rate','treasury10']},
    {id:'external',label:'外贸收支',CN:['exports-monthly','imports-monthly'],US:['trade-balance']}
  ];
  const references={growth:['gdp-growth'],prices:['cpi-annual']};
  function curated(series,state,snapshot){
    const q=(state.q||'').trim().toLocaleLowerCase(),country=state.country==='US'?'US':'CN';
    const chosen=groups.filter(g=>!state.group||g.id===state.group),specs=new Map(series.map(s=>[s.id,s]));
    const find=key=>specs.get(country.toLowerCase()+'-'+key);
    const matches=s=>s&&(!q||[s.name,s.code||'',s.category].join(' ').toLocaleLowerCase().includes(q));
    const core=chosen.flatMap(g=>g[country].map(find)).filter(matches);
    const annual=chosen.flatMap(g=>(references[g.id]||[]).map(find)).filter(matches);
    return {core,available:core.filter(s=>rows(snapshot.series[s.id]).length),pending:core.filter(s=>!rows(snapshot.series[s.id]).length),references:[]};
  }
  function groupOf(id){return groups.find(g=>['CN','US'].some(c=>g[c].some(key=>c.toLowerCase()+'-'+key===id)||(references[g.id]||[]).some(key=>c.toLowerCase()+'-'+key===id)));}
  function mergeConsumption(catalog,snapshot,feed){
    if(!Array.isArray(feed?.observations)||!Array.isArray(feed.sources))throw new Error('消费数据格式错误');
    const sourceMap=new Map(feed.sources.map(s=>[s.id,s]));
    const mappings=[['cn-cpi','cpi','monthly','month','%'],['cn-retail','retail','monthly','month','亿元'],['cn-disposable-income','income_national','quarterly','ytd','元']];
    for(const [id,input,frequency,basis,unit] of mappings){
      const spec=catalog.series.find(s=>s.id===id),inputSpec=feed.indicators?.find(s=>s.id===input);
      if(!spec||inputSpec?.unit!==unit||spec.frequency!==frequency)continue;
      const observations=feed.observations.filter(r=>r.indicatorId===input&&r.frequency===frequency&&r.basis===basis).map(r=>{
        const source=sourceMap.get(r.sourceId),url=safeUrl(source?.url);
        if(!finite(r.value)||!source||source.quality!=='official'||!/^https:\/\/([a-z0-9-]+\.)*stats\.gov\.cn\//.test(url)||!/^\d{4}-\d{2}-\d{2}$/.test(source.publishedAt)||source.publishedAt>snapshot.cutoff||!/^\d{4}-(\d{2}|Q[1-4])$/.test(r.period))throw new Error('消费数据来源或期间未通过核验');
        return {period:r.period,value:r.value,releaseDate:source.publishedAt,sourceUrl:url,footnotes:[basis==='ytd'?'年初累计，非单季':'当月；缺失期不补值'],officialYoy:finite(r.yoy)?r.yoy:null};
      });
      if(!observations.length)continue;
      if(new Set(observations.map(r=>r.period)).size!==observations.length)throw new Error('消费数据期间重复');
      const existing=snapshot.series[id];
      // Prefer the existing macro source if it already contains a newer period.
      if(rows(existing).at(-1)?.period>rows({observations}).at(-1).period)continue;
      snapshot.series[id]={status:'ready',observations,checkedAt:feed.checkedAt,fetchedAt:null,sourceOrganization:'国家统计局',sourceUrl:observations.at(-1).sourceUrl,reusedFrom:'data/consumption-macro/observations.json'};
    }
    return snapshot;
  }
  function headline(spec,data){
    const list=rows(data),latest=list.at(-1);if(!latest)return {value:null,unit:spec.unit,label:''};
    if(['us-cpi','us-core-cpi'].includes(spec.id)&&spec.kind!=='rate')return {value:compare(spec,list,latest,'yoy'),unit:'%',label:'同比'};
    if(spec.id==='us-payroll'&&data.metric!=='monthly-change'){
      const previous=list.find(r=>r.period===priorPeriod(latest.period,'monthly','mom'));
      return {value:previous?latest.value-previous.value:null,unit:spec.unit,label:'较上月增减'};
    }
    if(['cn-retail','cn-disposable-income'].includes(spec.id)&&finite(latest.officialYoy))return {value:latest.officialYoy,unit:'%',label:spec.kind==='cumulative'?'累计同比':'官方同比'};
    return {value:latest.value,unit:spec.unit,label:''};
  }
  function mergeAutomatic(catalog,snapshot,feed){
    if(feed?.version!==1||!feed.series||feed.publicRedistributionApproved!==true)throw new Error('自动数据格式或授权错误');
    for(const [id,data] of Object.entries(feed.series)){
      const spec=catalog.series.find(s=>s.id===id);if(!spec||!rows(data).length)continue;
      const previous=new Map(rows(snapshot.series[id]).map(r=>[r.period,r]));
      const observations=rows(data).map(r=>{const known=previous.get(r.period);return {...r,releaseDate:r.releaseDate||(known?.value===r.value?known.releaseDate:null),originalSourceUrl:known?.value===r.value?known.sourceUrl:null};});
      if(data.spec)Object.assign(spec,data.spec);
      snapshot.series[id]={...data,observations};
    }
    if(feed.cutoff>snapshot.cutoff)snapshot.cutoff=feed.cutoff;
    return snapshot;
  }
  const api={finite,frequency,dateOf,rows,compare,status,filter,chartRows,changeUnit,changeLabel,csv,csvCell,safeUrl,groups,curated,groupOf,headline,mergeConsumption,mergeAutomatic};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MacroModel=api;
})(typeof window==='object'?window:globalThis);
