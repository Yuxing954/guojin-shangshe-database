(function(){
  'use strict';
  const M=window.MacroModel,D=window.MacroDashboardModel,E=window.MacroExpectations,$=id=>document.getElementById(id);
  let expectations;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>M.finite(v)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(v):'—';
  const compact=v=>!M.finite(v)?'—':Math.abs(v)>=1e12?number(v/1e12)+'万亿':Math.abs(v)>=1e8?number(v/1e8)+'亿':number(v);
  const stamp=v=>{if(!v)return '未提供';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' 北京时间';};
  const link=(url,label)=>'<a href="'+esc(M.safeUrl(url))+'" target="_blank" rel="noopener">'+esc(label)+'</a>';
  let catalog,snapshot,predictions,predictionError=false,predictionLoading=false,page=0,chartPoints=[],predictionExpanded=false,searchTimer,resizeTimer;
  const params=new URLSearchParams(location.search);
  const state={study:params.get('study')==='workspace'?'workspace':'overview',country:params.get('country')==='US'?'US':'CN',group:params.get('group')||'',q:params.get('q')||'',
    id:params.get('indicator')||'',mode:'value',
    years:[0,1,3,5,10].includes(+params.get('years'))&&params.has('years')?+params.get('years'):5,
    view:['predictions','fedwatch'].includes(params.get('view'))?params.get('view'):'indicators',frequency:['monthly','quarterly','daily'].includes(params.get('frequency'))?params.get('frequency'):'',health:['attention','pending'].includes(params.get('health'))?params.get('health'):''};
  function save(){const p=new URLSearchParams();p.set('study',state.study);for(const key of ['predictionTopic','predictionQuery','predictionSort','meeting']){const value=new URLSearchParams(location.search).get(key);if(value)p.set(key,value);}for(const key of ['country','group','q','id','mode','years','view','frequency','health'])if(state[key]!==''&&state[key]!==null)p.set(key==='id'?'indicator':key,state[key]);history.replaceState(null,'',location.pathname+'?'+p);}
  function download(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function showView(){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));$('countries').hidden=state.view!=='indicators';$('indicators').hidden=state.view!=='indicators'||!catalog;$('predictions').hidden=state.view!=='predictions';$('fedwatch').hidden=state.view!=='fedwatch';if(state.view!=='indicators'){$('load-state').textContent='';$('skeleton').hidden=true;$('data-warning').hidden=true;}save();if(state.view==='indicators'&&catalog)requestAnimationFrame(drawDetailChart);if(state.view==='fedwatch')ForecastDesk.loadFedwatch();if(state.view==='predictions'){renderPredictions();loadPredictions();}}
  function graph(spec,data){
    chartPoints=[];const definition=D.detailDefinition(spec),points=D.detailRows(spec,data,state.years,new Date(snapshot.cutoff+'T23:59:59Z'));
    const values=points.filter(r=>M.finite(r.chartValue));
    if(!values.length)return '<p class="portal-empty">所选区间暂无可绘制数据。</p>';
    const w=Math.max(240,$('primary-chart').clientWidth),h=innerWidth<=600?260:320,left=w<500?48:58,right=20,top=34,bottom=38;
    const scale=SiteCharts.niceScale(values.map(r=>r.chartValue)),lo=scale.min,hi=scale.max;
    const first=M.dateOf(points[0].period).getTime(),last=M.dateOf(points.at(-1).period).getTime();
    const x=r=>left+(M.dateOf(r.period).getTime()-first)/(last-first||1)*(w-left-right);
    const y=r=>top+(hi-r.chartValue)/(hi-lo)*(h-top-bottom);
    let lines='',segment=[],dots='';
    function flush(){if(segment.length>1)lines+='<polyline points="'+segment.join(' ')+'"/>';else if(segment.length){const [cx,cy]=segment[0].split(',');lines+='<circle class="macro-isolated-point" cx="'+cx+'" cy="'+cy+'" r="3"/>';}segment=[];}
    let previous=null;
    for(const row of points){
      const gap=previous&&(M.dateOf(row.period)-M.dateOf(previous.period))/86400000;
      const maximum={annual:400,quarterly:110,monthly:40,daily:7}[spec.frequency];
      if(gap>maximum)flush();
      if(!M.finite(row.chartValue)){flush();previous=row;continue;}
      segment.push(x(row).toFixed(2)+','+y(row).toFixed(2));
      if(chartPoints.length%Math.max(1,Math.ceil(values.length/120))===0||row===values.at(-1))dots+='<circle tabindex="0" data-chart-point="'+chartPoints.length+'" cx="'+x(row).toFixed(2)+'" cy="'+y(row).toFixed(2)+'" r="3"><title>'+esc(row.period+'：'+number(row.chartValue)+' '+definition.unit)+'</title></circle>';
      chartPoints.push({x:x(row),y:y(row),label:compact(row.chartValue),text:row.period+'：'+number(row.chartValue)+' '+definition.unit});
      previous=row;
    }flush();
    const labels=new Set(D.annotationIndices(chartPoints,{width:w,left,right}));
    chartPoints.forEach((p,i)=>p.labels=labels.has(i)?[{x:p.x,y:p.y,text:p.label,kind:'value'}]:[]);
    let grid='<text x="'+left+'" y="16" class="macro-chart-unit">'+esc((definition.label||'数值')+'（'+definition.unit+'）')+'</text>';for(const tick of scale.ticks){const gy=top+(hi-tick)/(hi-lo)*(h-top-bottom);grid+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+gy+'" y2="'+gy+'" stroke="#eceef5"/><text x="'+(left-8)+'" y="'+(gy+4)+'" text-anchor="end">'+esc(scale.format(tick))+'</text>';}
    return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">'+esc(spec.name+(definition.label?' · '+definition.label:''))+'历史走势</title><desc id="chart-desc">'+esc(values.length+'个观测值；详细数值可下载CSV。缺失区间不连线。')+'</desc>'+grid+lines+dots+'<text class="site-period-tick" x="'+left+'" y="'+(h-12)+'">'+esc(ChartPeriod.format(points[0].period))+'</text><text class="site-period-tick" x="'+(w-right)+'" y="'+(h-12)+'" text-anchor="end">'+esc(ChartPeriod.format(points.at(-1).period))+'</text></svg>';
  }
  function renderStudy(){
    const query=state.study==='workspace';$('indicators').classList.toggle('macro-overview-mode',!query);
    document.querySelectorAll('[data-study]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.study===state.study)));
    document.querySelector('.macro-overview').hidden=query;$('groups').hidden=!query;document.querySelector('.macro-search').hidden=!query;document.querySelector('.macro-list-panel').hidden=!query;
    $('workspace-heading').textContent=query?'指标查询':'趋势分析';$('download-latest').hidden=!query;
  }
  function drawDetailChart(){
    const host=$('primary-chart'),spec=catalog?.series.find(s=>s.id===state.id);
    if(!host||!spec||host.clientWidth<=0)return;
    host.innerHTML=graph(spec,snapshot.series[spec.id]||{});
    ResearchChart.attach(host,chartPoints);
  }
  function renderDetail(){
    const spec=catalog.series.find(s=>s.id===state.id);
    if(!spec){$('detail').innerHTML='<p class="portal-empty">没有匹配指标。</p>';return;}
    const data=snapshot.series[spec.id]||{},source=catalog.sources[spec.source],r=D.readout(spec,data),latest=r.latest;
    state.mode=D.detailDefinition(spec).mode;
    if(!latest){$('detail').innerHTML='<h2 id="metric-title">'+esc(spec.name)+'</h2><p class="portal-note">待补齐 · '+esc(M.frequency[spec.frequency])+'</p><p>'+link(source.url,'官方来源 ↗')+'</p>';return;}
    const sourceUrl=latest.originalSourceUrl||latest.sourceUrl||data.sourceUrl||source.url;
    $('detail').innerHTML='<div class="macro-trend-head"><div><p class="eyebrow">'+esc(M.frequency[spec.frequency]+' · '+latest.period)+'</p><h2 id="metric-title">'+esc(spec.name)+'</h2></div><label class="macro-range">时间<select id="years" aria-label="趋势时间范围"><option value="1">近1年</option><option value="3">近3年</option><option value="5">近5年</option><option value="10">近10年</option><option value="0">全部</option></select></label></div>'+
      '<div class="macro-latest"><div><b>'+compact(r.value)+'</b><small>'+esc(r.unit+(r.label?' · '+r.label:''))+'</small></div>'+(r.delta?'<div class="macro-trend-change"><span>'+esc(r.delta.label)+'</span><b>'+(r.delta.value>0?'+':'')+number(r.delta.value)+'</b><small>'+esc(r.delta.unit)+'</small></div>':'')+'</div>'+
      (data.error?'<p class="macro-state">'+esc(data.error)+'</p>':'')+
      '<div id="primary-chart" class="macro-chart board-chart"></div>'+
      '<div class="macro-trend-footer"><p class="macro-source-line">'+link(sourceUrl,data.provider?.includes('Choice')?data.sourceOrganization+' · Choice':source.name)+'<span>'+esc(spec.adjustment)+'</span>'+(latest.releaseDate?'<time>发布 '+esc(latest.releaseDate)+'</time>':'')+'</p><div><a href="data-notes.html#macro">数据说明</a><button id="download" class="macro-download">下载 CSV</button></div></div>';
    $('years').value=String(state.years);
    $('years').onchange=e=>{state.years=+e.target.value;drawDetailChart();save();};
    $('download').onclick=()=>download(M.csv(spec,data,source),spec.id+'.csv');
    drawDetailChart();
  }
  function selectMetric(id){if(!D.directory(catalog,snapshot,state).some(s=>s.id===id)){state.q='';state.group='';state.frequency='';state.health='';}if(state.id!==id)state.mode='value';state.id=id;page=0;render();$('metric-title')?.setAttribute('tabindex','-1');$('metric-title')?.focus({preventScroll:true});}
  function spark(spec,data){
    const points=D.headlineRows(spec,data).slice(-12),finite=points.filter(r=>M.finite(r.chartValue));if(!finite.length)return '';
    const lo=Math.min(...finite.map(r=>r.chartValue)),hi=Math.max(...finite.map(r=>r.chartValue)),first=M.dateOf(points[0].period),last=M.dateOf(points.at(-1).period);
    return '<svg class="macro-spark" viewBox="0 0 90 32" aria-hidden="true">'+D.segments(spec,points).map(part=>'<polyline points="'+part.map(r=>(3+(M.dateOf(r.period)-first)/(last-first||1)*84).toFixed(2)+','+(29-(r.chartValue-lo)/(hi-lo||1)*26).toFixed(2)).join(' ')+'"/>').join('')+finite.map(r=>'<circle cx="'+(3+(M.dateOf(r.period)-first)/(last-first||1)*84)+'" cy="'+(29-(r.chartValue-lo)/(hi-lo||1)*26)+'" r="2"><title>'+esc(spec.name+'\n'+r.period+'：'+number(r.chartValue)+' '+M.headline(spec,data).unit)+'</title></circle>').join('')+'</svg>';
  }
  function renderOverview(){
    const all=D.core(catalog,state.country,snapshot),available=all.filter(s=>M.rows(snapshot.series[s.id]).length);
    const releases=D.releases(catalog,snapshot,state.country);
    $('overview-title').textContent=(state.country==='CN'?'中国':'美国')+' · 核心读数';
    $('overview-meta').textContent=available.length+'/'+all.length+' 项已收录 · 快照截止 '+snapshot.cutoff+(releases.items.length?' · 最近发布 '+releases.items[0].releaseDate:'');
    const topics=state.country==='CN'?
      [{title:'增长与需求',ids:['cn-gdp-quarter','cn-retail']},{title:'景气与就业',ids:['cn-pmi','cn-unemployment']},{title:'价格与货币',ids:['cn-cpi','cn-m2']}]:
      [{title:'增长与就业',ids:['us-gdp-quarter','us-payroll']},{title:'通胀与失业',ids:['us-cpi','us-unemployment']},{title:'政策与利率',ids:['us-fed-rate','us-treasury10']}];
    const card=id=>{
      const spec=catalog.series.find(s=>s.id===id);if(!spec)return '';const data=snapshot.series[id]||{},head=D.readout(spec,data),latest=head.latest,delta=head.delta,status=M.status(spec,data);
      return '<button class="board-stat macro-kpi" data-kpi="'+esc(id)+'" aria-pressed="'+(id===state.id)+'" aria-label="'+esc(spec.name+'，'+compact(head.value)+' '+head.unit+'，'+(latest?.period||'暂无数据')+'，查看历史')+'"><span class="macro-kpi-top"><span>'+esc(spec.name)+'</span><span class="readout-selected">'+(id===state.id?'已选':'趋势 ↗')+'</span></span><span class="macro-kpi-period">'+esc((latest?.period||'暂无数据')+' · '+M.frequency[spec.frequency]+(head.label?' · '+head.label:''))+'</span><span class="macro-reading-row"><span class="macro-kpi-reading"><strong class="board-stat-value">'+compact(head.value)+'</strong><small>'+esc(head.unit)+'</small></span>'+spark(spec,data)+'</span><span class="macro-kpi-bottom"><span class="macro-kpi-change '+(delta?.value>0?'macro-up':delta?.value<0?'macro-down':'')+'">'+(delta?esc(delta.label)+' '+(delta.value>0?'+':'')+number(delta.value)+' '+esc(delta.unit):'上期差值 —')+'</span><span class="macro-kpi-previous">上期 '+number(head.previous?.chartValue)+' '+esc(head.unit)+'</span></span>'+'<span class="macro-kpi-meta">'+(latest?.releaseDate?'<span class="macro-kpi-release">发布 '+esc(latest.releaseDate)+'</span>':'')+(status!=='已收录'||data.coverage?.missingPeriods?.length?'<span class="macro-kpi-note" title="'+esc(data.error||status)+'">'+esc(status!=='已收录'?status:'历史存在缺期')+'</span>':'')+(data.coverage?.unpublishedPeriods?.length?'<span class="macro-kpi-context" title="'+esc(data.coverage.unpublishedPeriods[0].reason)+'">'+esc(data.coverage.unpublishedPeriods[0].period)+'官方未发布</span>':'')+'</span><span class="macro-kpi-forecast"></span></button>';
    };
    $('kpi-grid').innerHTML=topics.map((topic,index)=>'<section class="macro-topic"><h3><span>'+String(index+1).padStart(2,'0')+'</span>'+esc(topic.title)+'</h3><div class="macro-topic-cards">'+topic.ids.map(card).join('')+'</div></section>').join('');
    for(const button of $('kpi-grid').querySelectorAll('[data-kpi]')){const spec=catalog.series.find(s=>s.id===button.dataset.kpi);button.querySelector('.macro-kpi-forecast').innerHTML=E.card(expectations,spec,M.rows(snapshot.series[spec.id]).at(-1));}

  }
  function render(){
    if(!catalog)return;$('indicators').hidden=state.view!=='indicators';renderStudy();
    const filtered=D.directory(catalog,snapshot,state),selected={available:filtered.filter(s=>M.rows(snapshot.series[s.id]).length),pending:filtered.filter(s=>!M.rows(snapshot.series[s.id]).length),references:[]},all=filtered;
    if(!all.some(s=>s.id===state.id)){state.id=all[0]?.id||'';page=0;}renderOverview();
    $('summary').textContent='筛选结果 '+filtered.length+' / '+D.core(catalog,state.country,snapshot).length+' 项';$('count').textContent=filtered.length+' 项';
    $('frequency').value=state.frequency;$('health').value=state.health;
    if(state.frequency||state.health)$('more-filters').open=true;
    $('download-latest').disabled=!selected.available.length;$('download-latest').onclick=()=>download(D.latestCsv(filtered,snapshot,catalog.sources),'macro-'+state.country+'-latest.csv');
    const item=spec=>{const data=snapshot.series[spec.id]||{},latest=M.rows(data).at(-1),head=M.headline(spec,data);return '<button class="macro-item" data-id="'+esc(spec.id)+'" aria-pressed="'+(state.id===spec.id)+'"><strong>'+esc(spec.name)+'</strong><span class="macro-item-value">'+compact(head.value)+' <small>'+esc(head.unit+(head.label?' · '+head.label:''))+'</small></span><small>'+esc((latest?.period||'待补齐')+' · '+M.frequency[spec.frequency])+(M.status(spec,data)==='已收录'?'':' · '+esc(M.status(spec,data)))+'</small></button>';};
    const grouped=(list,draw)=>M.groups.map(g=>{const subset=list.filter(s=>M.groupOf(s.id)?.id===g.id);return subset.length?'<h3 class="macro-group-label">'+esc(g.label)+'</h3>'+subset.map(draw).join(''):'';}).join('');
    $('metric-list').innerHTML=selected.available.length?grouped(selected.available,item):'<p class="portal-empty">'+(state.q?'没有匹配的核心数据。':'月度、季度核心指标待补齐。')+'</p>';
    $('reference-list').innerHTML=selected.references.map(item).join('');$('reference-count').textContent=selected.references.length+' 项';$('reference-details').hidden=!selected.references.length;
    $('reference-details').open=!selected.available.length&&!!selected.references.length||selected.references.some(s=>s.id===state.id);
    $('pending-list').innerHTML=grouped(selected.pending,spec=>'<button class="macro-pending-item" data-id="'+esc(spec.id)+'" aria-pressed="'+(state.id===spec.id)+'">'+esc(spec.name)+'</button>');$('pending-count').textContent=selected.pending.length+' 项';$('pending-details').hidden=!selected.pending.length;
    $('pending-details').open=selected.pending.some(s=>s.id===state.id);
    document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===state.group)));
    document.querySelectorAll('[data-country]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.country===state.country)));
    $('search').value=state.q;
    renderDetail();save();
  }
  function renderPredictions(){
    if(!predictions){$('prediction-status').textContent=predictionError?'预测读取失败':'正在读取…';return;}
    ForecastDesk.renderPolymarket(predictions);
  }
  async function read(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);return await response.json();}finally{clearTimeout(timer);}}
  async function loadPredictions(){
    if(predictions||predictionLoading)return;predictionLoading=true;
    try{const value=await read('data/macro/predictions.json');if(!Array.isArray(value.markets))throw new Error('预测格式错误');predictions=value;predictionError=false;}
    catch{predictionError=true;$('retry').hidden=false;}finally{predictionLoading=false;if(state.view==='predictions')renderPredictions();}
  }
  async function load(){
    if(state.view==='fedwatch'){showView();return;}
    if(state.view==='predictions'){predictions=null;showView();return;}
    $('load-state').textContent='正在读取宏观数据…';$('retry').hidden=true;$('skeleton').hidden=false;$('data-warning').hidden=true;
    const results=await Promise.allSettled([read('data/macro/catalog.json'),read('data/macro/snapshot.json'),read('data/consumption-macro/observations.json'),read('data/macro/automatic-series.json'),read('data/macro/expectations.json')]);
    $('skeleton').hidden=true;
    if(results[0].status==='fulfilled'&&results[1].status==='fulfilled'){
      const nextCatalog=results[0].value,nextSnapshot=results[1].value;
      if(!Array.isArray(nextCatalog.series)||!nextCatalog.sources||!nextSnapshot.series){$('load-state').textContent='宏观数据格式错误。';$('retry').hidden=false;return;}
      catalog=nextCatalog;snapshot=nextSnapshot;const warnings=[];
      expectations=null;
      if(results[4].status==='fulfilled'){try{expectations=E.validate(results[4].value);}catch{warnings.push('预测数据核验未通过');}}else warnings.push('预测数据读取失败');
      if(results[2].status==='fulfilled'){
        try{const copy=JSON.parse(JSON.stringify(snapshot));M.mergeConsumption(catalog,copy,results[2].value);snapshot=copy;}
        catch{warnings.push('消费披露核验未通过');}
      }else warnings.push('消费披露读取失败');
      if(results[3].status==='fulfilled'){
        try{const c=structuredClone(catalog),copy=structuredClone(snapshot);M.mergeAutomatic(c,copy,results[3].value);catalog=c;snapshot=copy;}
        catch{warnings.push('补充历史核验未通过');}
      }else warnings.push('补充历史读取失败');
      if(warnings.length){$('data-warning').textContent=warnings.join('；')+'。当前展示可用快照，部分指标及历史可能不完整。';$('data-warning').hidden=false;$('retry').hidden=false;}
      snapshot.expectations=expectations;
      const legacy=catalog.series.find(s=>s.country===state.country&&s.category===params.get('category')&&M.groupOf(s.id));
      if(!state.group&&legacy)state.group=M.groupOf(legacy.id).id;
      if(!M.groups.some(g=>g.id===state.group))state.group='';
      $('groups').innerHTML=[{id:'',label:'全部'},...M.groups].map(g=>'<button data-group="'+g.id+'" aria-pressed="'+(state.group===g.id)+'">'+esc(g.label)+'</button>').join('');
      $('load-state').textContent='';render();
    }else{$('load-state').textContent='宏观数据读取失败；请检查网络后重试。';$('retry').hidden=false;}
    showView();
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;showView();if(state.view==='indicators'&&!catalog)load();});
  document.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;state.id='';page=0;render();});
  $('search').oninput=e=>{state.q=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;render();},180);};
  $('frequency').onchange=e=>{state.frequency=e.target.value;page=0;render();};$('health').onchange=e=>{state.health=e.target.value;page=0;render();};
  $('reset-filters').onclick=()=>{clearTimeout(searchTimer);state.q='';state.group='';state.frequency='';state.health='';page=0;render();};
  $('kpi-grid').onclick=e=>{const b=e.target.closest('[data-kpi]');if(b){clearTimeout(searchTimer);selectMetric(b.dataset.kpi);}};
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(catalog&&state.view==='indicators')renderDetail();},150);});
  $('groups').onclick=e=>{const b=e.target.closest('[data-group]');if(b){state.group=b.dataset.group;state.id='';page=0;render();}};
  for(const id of ['metric-list','reference-list','pending-list'])$(id).onclick=e=>{const b=e.target.closest('[data-id]');if(b)selectMetric(b.dataset.id);};
  document.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>{state.study=b.dataset.study;render();});
  $('prediction-search').oninput=()=>{predictionExpanded=false;renderPredictions();};$('prediction-category').onchange=()=>{predictionExpanded=false;renderPredictions();};$('retry').onclick=load;
  load();
})();







