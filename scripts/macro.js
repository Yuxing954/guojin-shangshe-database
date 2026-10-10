(function(){
  'use strict';
  const M=window.MacroModel,D=window.MacroDashboardModel,$=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>M.finite(v)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(v):'—';
  const compact=v=>!M.finite(v)?'—':Math.abs(v)>=1e12?number(v/1e12)+'万亿':Math.abs(v)>=1e8?number(v/1e8)+'亿':number(v);
  const stamp=v=>{if(!v)return '未提供';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' 北京时间';};
  const link=(url,label)=>'<a href="'+esc(M.safeUrl(url))+'" target="_blank" rel="noopener">'+esc(label)+'</a>';
  let catalog,snapshot,predictions,predictionError=false,predictionLoading=false,page=0,chartPoints=[],predictionExpanded=false,searchTimer,resizeTimer;
  const params=new URLSearchParams(location.search);
  const state={country:params.get('country')==='US'?'US':'CN',group:params.get('group')||'',q:params.get('q')||'',
    id:params.get('indicator')||'',mode:['yoy','mom'].includes(params.get('mode'))?params.get('mode'):'value',
    years:[0,1,3,5,10].includes(+params.get('years'))&&params.has('years')?+params.get('years'):5,
    view:['predictions','fedwatch'].includes(params.get('view'))?params.get('view'):'indicators',frequency:['monthly','quarterly','daily'].includes(params.get('frequency'))?params.get('frequency'):'',health:['attention','pending'].includes(params.get('health'))?params.get('health'):'',comparison:params.get('comparison')||''};
  function save(){const p=new URLSearchParams();for(const key of ['predictionTopic','predictionQuery','predictionSort','meeting']){const value=new URLSearchParams(location.search).get(key);if(value)p.set(key,value);}for(const key of ['country','group','q','id','mode','years','view','frequency','health','comparison'])if(state[key]!==''&&state[key]!==null)p.set(key==='id'?'indicator':key,state[key]);history.replaceState(null,'',location.pathname+'?'+p);}
  function download(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function showView(){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));$('countries').hidden=state.view!=='indicators';$('indicators').hidden=state.view!=='indicators'||!catalog;$('predictions').hidden=state.view!=='predictions';$('fedwatch').hidden=state.view!=='fedwatch';if(state.view!=='indicators'){$('load-state').textContent='';$('skeleton').hidden=true;$('data-warning').hidden=true;}save();if(state.view==='fedwatch')ForecastDesk.loadFedwatch();if(state.view==='predictions'){renderPredictions();loadPredictions();}}
  function graph(spec,data,mode=state.mode){
    chartPoints=[];const points=M.chartRows(spec,data,mode,state.years,new Date(snapshot.cutoff+'T23:59:59Z'));
    const values=points.filter(r=>M.finite(r.chartValue));
    if(!values.length)return '<p class="portal-empty">所选区间或口径没有可用数据。可切换“原始值”或“全部”。</p>';
    const w=Math.max(320,document.querySelector('.macro-chart')?.clientWidth||(state.comparison&&innerWidth>1200?($('detail').clientWidth-76)/2:$('detail').clientWidth-60)||720),h=300,left=58,right=24,top=28,bottom=40;
    let lo=Math.min(...values.map(r=>r.chartValue)),hi=Math.max(...values.map(r=>r.chartValue));
    const pad=(hi-lo||Math.abs(hi)*.05||1)*.1;lo-=pad;hi+=pad;
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
      if(chartPoints.length%Math.max(1,Math.ceil(values.length/120))===0||row===values.at(-1))dots+='<circle tabindex="0" data-chart-point="'+chartPoints.length+'" cx="'+x(row).toFixed(2)+'" cy="'+y(row).toFixed(2)+'" r="3"><title>'+esc(row.period+'：'+number(row.chartValue)+' '+(mode==='value'?spec.unit:M.changeUnit(spec)))+'</title></circle>';
      chartPoints.push({x:x(row),y:y(row),text:spec.name+'\n'+row.period+'：'+number(row.chartValue)+' '+(mode==='value'?spec.unit:M.changeUnit(spec))+'\n发布：'+(row.releaseDate||'来源未提供')});
      previous=row;
    }flush();
    let grid='';for(let i=0;i<4;i++){const gy=top+i*(h-top-bottom)/3;grid+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+gy+'" y2="'+gy+'" stroke="#eceef5"/><text x="'+(left-8)+'" y="'+(gy+4)+'" text-anchor="end">'+esc(compact(hi-i*(hi-lo)/3))+'</text>';}
    return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">'+esc(spec.name)+'历史走势</title><desc id="chart-desc">'+esc(values.length+'个观测值；详细数值见历史明细和CSV。缺失区间不连线。')+'</desc>'+grid+lines+dots+'<text x="'+left+'" y="'+(h-12)+'">'+esc(points[0].period)+'</text><text x="'+(w-right)+'" y="'+(h-12)+'" text-anchor="end">'+esc(points.at(-1).period)+'</text></svg>';
  }
  function renderHistory(spec,data){
    const list=M.rows(data),descending=list.slice().reverse(),slice=descending.slice(page*24,(page+1)*24);
    $('history').innerHTML=slice.length?slice.map(r=>'<tr><td>'+esc(r.period)+'</td><td>'+number(r.value)+'</td><td>'+number(M.compare(spec,list,r,'yoy'))+'</td><td>'+number(M.compare(spec,list,r,'mom'))+'</td><td>'+esc(r.releaseDate||'来源未提供')+'</td><td>'+link(r.sourceUrl||data.sourceUrl||catalog.sources[spec.source].url,'原始来源')+'</td></tr>').join(''):'<tr><td colspan="6">尚无真实观测值</td></tr>';
    $('page-label').textContent=list.length?'第 '+(page+1)+' / '+Math.ceil(list.length/24)+' 页 · '+list.length+' 条':'0 条';$('prev').disabled=page===0;$('next').disabled=(page+1)*24>=list.length;
  }
  function renderDetail(){
    const spec=catalog.series.find(s=>s.id===state.id);if(!spec){$('detail').innerHTML='<p class="portal-empty">没有匹配指标。请调整筛选条件。</p>';return;}
    const data=snapshot.series[spec.id]||{},source=catalog.sources[spec.source],list=M.rows(data),latest=list.at(-1),s=M.status(spec,data);
    const unavailable=spec.kind==='cumulative'||spec.frequency==='daily';
    const candidates=D.core(catalog,state.country,snapshot).filter(s=>s.id!==spec.id&&M.rows(snapshot.series[s.id]).length);
    const comparison=candidates.find(s=>s.id===state.comparison);if(!comparison)state.comparison='';
    const compareControl='<label>比较<select id="comparison"><option value="">不比较</option>'+candidates.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('')+'</select></label>';
    const head=M.headline(spec,data);
    if(unavailable||(spec.frequency==='annual'&&state.mode==='mom'))state.mode='value';
    if(!latest){$('detail').innerHTML='<h2 id="metric-title">'+esc(spec.name)+'</h2><p class="portal-note">待补齐 · '+esc(M.frequency[spec.frequency])+'</p><p>'+link(source.url,'查看官方来源 ↗')+'</p>';return;}
    const changes=unavailable?[]:spec.frequency==='annual'?['yoy']:['yoy','mom'];
    $('detail').innerHTML='<div class="portal-panel-head"><div><p class="eyebrow">'+esc((M.groupOf(spec.id)?.label||spec.category)+' · '+M.frequency[spec.frequency])+'</p><h2 id="metric-title">'+esc(spec.name)+'</h2><span class="macro-state">'+esc(s)+'</span></div><button id="download" class="portal-button">下载 CSV</button></div>'+
      '<div class="macro-latest"><div><span>最新读数 · '+esc(latest.period)+'</span><b>'+compact(head.value)+'</b><small>'+esc(head.unit+(head.label?' · '+head.label:''))+'</small></div>'+changes.map(mode=>'<div><span>'+esc(M.changeLabel(spec,mode))+'</span><b>'+number(M.compare(spec,list,latest,mode))+'</b><small>'+esc(M.changeUnit(spec))+'</small></div>').join('')+'</div>'+
      '<p class="macro-source-line">'+link(latest.originalSourceUrl||latest.sourceUrl||data.sourceUrl||source.url,data.provider?.includes('Choice')?data.sourceOrganization+' · Choice':source.name)+' · '+esc(spec.adjustment)+'<br>发布日期：'+esc(latest.releaseDate||'来源未提供')+(M.finite(latest.officialYoy)?' · 官方同比 '+number(latest.officialYoy)+'%':'')+'</p>'+(data.error?'<p class="macro-state">更新失败，保留历史数据。</p>':'')+
      (data.coverage?'<p class="macro-coverage">'+esc(data.coverage.start+' — '+data.coverage.end+' · '+data.coverage.count+'期 · '+(data.coverage.missingPeriods.length?data.coverage.missingPeriods.length+'期缺失':'区间内无缺期'))+(data.coverage.historyShort?' · 历史覆盖不足':'')+(data.coverage.structuralPeriods.length?' · 合并发布月份不拆分':'')+'</p>':'')+
      '<div class="macro-controls"><label>口径<select id="mode"><option value="value">原始值</option>'+(!unavailable?'<option value="yoy">'+esc(M.changeLabel(spec,'yoy'))+'</option><option value="mom" '+(spec.frequency==='annual'?'disabled':'')+'>'+esc(M.changeLabel(spec,'mom'))+'</option>':'')+'</select></label><label>时间<select id="years"><option value="1">近1年</option><option value="3">近3年</option><option value="5">近5年</option><option value="10">近10年</option><option value="0">全部</option></select></label><span class="portal-note">单位：'+esc(state.mode==='value'?spec.unit:M.changeUnit(spec))+'</span>'+compareControl+'</div><div class="macro-chart-grid'+(comparison?' has-comparison':'')+'"><div class="macro-chart-block"><p class="macro-chart-label"><b>'+esc(spec.name)+'</b>'+esc(state.mode==='value'?spec.adjustment:M.changeLabel(spec,state.mode))+' · '+esc(state.mode==='value'?spec.unit:M.changeUnit(spec))+'</p><div id="primary-chart" class="macro-chart">'+graph(spec,data)+'</div></div>'+(comparison?'<div class="macro-chart-block"><p class="macro-chart-label"><b>'+esc(comparison.name)+'</b>'+esc(comparison.adjustment)+' · '+esc(comparison.unit)+'</p><div id="comparison-chart" class="macro-chart"></div></div>':'')+'</div>'+(comparison?'<p class="macro-chart-note">比较图按相同时间窗口、各自原始单位与频率展示；纵轴独立，曲线高度不能直接比较。比较项始终为原始值。'+(comparison.frequency!==spec.frequency?' 两项发布频率不同，未进行聚合或插值。':'')+'</p>':'')+'<p class="chart-help">悬停、轻触或按 Tab 聚焦数据点查看数值 · 图表缺期断线</p>'+
      '<details class="macro-history"><summary>历史明细</summary><div class="portal-table-scroll"><table class="portal-table"><thead><tr><th>数据期间</th><th>数值 ('+esc(spec.unit)+')</th><th>'+esc(M.changeLabel(spec,'yoy'))+' ('+esc(M.changeUnit(spec))+')</th><th>'+esc(M.changeLabel(spec,'mom'))+' ('+esc(M.changeUnit(spec))+')</th><th>发布日期</th><th>来源</th></tr></thead><tbody id="history"></tbody></table></div><div class="portal-pager"><span id="page-label"></span><div><button id="prev">上一页</button> <button id="next">下一页</button></div></div></details>'+
      '<details class="macro-method"><summary>口径与来源</summary><p>'+esc(spec.definition)+'</p><p>'+esc(unavailable?'累计及日度序列不推算同比环比。':spec.kind==='rate'?'百分比指标比较为百分点差值。':spec.kind==='balance'?'余额比较为原单位差值。':'同比、环比匹配准确期间，不补缺值。')+'</p><p>最近获取：'+esc(stamp(data.fetchedAt))+'<br>最近检查：'+esc(stamp(data.checkedAt))+'<br>源库更新：'+esc(data.datasetUpdatedAt||'未提供')+'</p>'+(data.coverage?.missingPeriods?.length?'<p>真实缺期：'+esc(data.coverage.missingPeriods.join('、'))+'</p>':'')+(data.reusedFrom?'<p>复用站内已核验的 '+link('https://yuxing954.github.io/guojin-shangshe-database/consumption-macro.html','消费专题')+' 数据；官方同比单列，不用金额重算替代。</p>':'')+(data.sourceOrganization?'<p>原始提供者：'+esc(data.sourceOrganization)+(data.metadataUrl?' '+link(data.metadataUrl,'元数据'):'')+'</p>':'')+(latest.footnotes?.length?'<p>修订脚注：'+esc(latest.footnotes.join('; '))+'</p>':'')+'<p>API：'+esc(data.provider?.includes('Choice')?'后端通过已连接的Choice MCP更新，浏览器不接触密钥':source.api)+'<br>授权：'+esc(data.provider?.includes('Choice')?'用户已明确确认公开展示与下载授权':source.license)+' '+link(source.terms,'条款')+'</p></details>';
    ResearchChart.attach($('primary-chart'),chartPoints);
    if(comparison){$('comparison-chart').innerHTML=graph(comparison,snapshot.series[comparison.id],'value');ResearchChart.attach($('comparison-chart'),chartPoints);}
    $('comparison').value=state.comparison;$('comparison').onchange=e=>{state.comparison=e.target.value;renderDetail();save();};
    $('mode').value=state.mode;$('years').value=String(state.years);
    $('mode').onchange=e=>{state.mode=e.target.value;renderDetail();save();};$('years').onchange=e=>{state.years=+e.target.value;renderDetail();save();};
    $('download').onclick=()=>download(M.csv(spec,data,source),spec.id+'.csv');
    $('prev').onclick=()=>{page--;renderHistory(spec,data);};$('next').onclick=()=>{page++;renderHistory(spec,data);};renderHistory(spec,data);
  }
  function selectMetric(id){state.id=id;state.q='';state.group='';state.frequency='';state.health='';state.mode='value';page=0;render();$('detail').scrollIntoView({behavior:'auto',block:'nearest'});$('metric-title')?.setAttribute('tabindex','-1');$('metric-title')?.focus({preventScroll:true});}
  function spark(spec,data){
    const points=D.headlineRows(spec,data).slice(-12),finite=points.filter(r=>M.finite(r.chartValue));if(!finite.length)return '';
    const lo=Math.min(...finite.map(r=>r.chartValue)),hi=Math.max(...finite.map(r=>r.chartValue)),first=M.dateOf(points[0].period),last=M.dateOf(points.at(-1).period);
    return '<svg class="macro-spark" viewBox="0 0 90 32" aria-hidden="true">'+D.segments(spec,points).map(part=>'<polyline points="'+part.map(r=>(3+(M.dateOf(r.period)-first)/(last-first||1)*84).toFixed(2)+','+(29-(r.chartValue-lo)/(hi-lo||1)*26).toFixed(2)).join(' ')+'"/>').join('')+'</svg>';
  }
  function renderOverview(){
    const all=D.core(catalog,state.country,snapshot),available=all.filter(s=>M.rows(snapshot.series[s.id]).length);
    const releases=D.releases(catalog,snapshot,state.country);
    $('overview-title').textContent=(state.country==='CN'?'中国':'美国')+' · 核心读数';
    $('overview-meta').textContent=available.length+'/'+all.length+' 项已收录 · 快照截止 '+snapshot.cutoff+(releases.items.length?' · 最近发布 '+releases.items[0].releaseDate:'');
    $('kpi-grid').innerHTML=D.featured[state.country].map((id,index)=>{
      const spec=catalog.series.find(s=>s.id===id);if(!spec)return '';const data=snapshot.series[id]||{},head=D.readout(spec,data),latest=head.latest,delta=head.delta,status=M.status(spec,data);
      return '<button class="macro-kpi'+(index>=4?' is-support':'')+'" data-kpi="'+esc(id)+'" aria-pressed="'+(id===state.id)+'" aria-label="'+esc(spec.name+'，'+compact(head.value)+' '+head.unit+'，'+(latest?.period||'暂无数据')+'，查看历史')+'"><span class="macro-kpi-top"><span>'+esc(spec.name)+'</span><span class="macro-kpi-category">'+esc(M.groupOf(id)?.label)+'</span></span><span class="macro-kpi-reading"><strong>'+compact(head.value)+'</strong><small>'+esc(head.unit)+'</small></span><span class="macro-kpi-period">'+esc((latest?.period||'暂无数据')+' · '+M.frequency[spec.frequency]+(head.label?' · '+head.label:''))+'</span><span class="macro-kpi-previous">上期 '+number(head.previous?.chartValue)+' '+esc(head.unit)+'</span><span class="macro-kpi-release">发布 '+esc(latest?.releaseDate||'未提供')+'</span><span class="macro-kpi-bottom"><span class="macro-kpi-change '+(delta?.value>0?'macro-up':delta?.value<0?'macro-down':'')+'">'+(delta?esc(delta.label)+' '+(delta.value>0?'+':'')+number(delta.value)+' '+esc(delta.unit):'差值 —')+'</span>'+spark(spec,data)+'</span>'+(status!=='已收录'||data.coverage?.missingPeriods?.length?'<span class="macro-kpi-note">'+esc(status!=='已收录'?status:'历史存在缺期')+'</span>':'')+'</button>';
    }).join('');
    MacroMorning.render(catalog,snapshot,state.country,selectMetric);
  }
  function render(){
    if(!catalog)return;
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
    const results=await Promise.allSettled([read('data/macro/catalog.json'),read('data/macro/snapshot.json'),read('data/consumption-macro/observations.json'),read('data/macro/automatic-series.json')]);
    $('skeleton').hidden=true;
    if(results[0].status==='fulfilled'&&results[1].status==='fulfilled'){
      const nextCatalog=results[0].value,nextSnapshot=results[1].value;
      if(!Array.isArray(nextCatalog.series)||!nextCatalog.sources||!nextSnapshot.series){$('load-state').textContent='宏观数据格式错误。';$('retry').hidden=false;return;}
      catalog=nextCatalog;snapshot=nextSnapshot;const warnings=[];
      if(results[2].status==='fulfilled'){
        try{const copy=JSON.parse(JSON.stringify(snapshot));M.mergeConsumption(catalog,copy,results[2].value);snapshot=copy;}
        catch{warnings.push('消费披露核验未通过');}
      }else warnings.push('消费披露读取失败');
      if(results[3].status==='fulfilled'){
        try{const c=structuredClone(catalog),copy=structuredClone(snapshot);M.mergeAutomatic(c,copy,results[3].value);catalog=c;snapshot=copy;}
        catch{warnings.push('补充历史核验未通过');}
      }else warnings.push('补充历史读取失败');
      if(warnings.length){$('data-warning').textContent=warnings.join('；')+'。当前展示可用快照，部分指标及历史可能不完整。';$('data-warning').hidden=false;$('retry').hidden=false;}
      const legacy=catalog.series.find(s=>s.country===state.country&&s.category===params.get('category')&&M.groupOf(s.id));
      if(!state.group&&legacy)state.group=M.groupOf(legacy.id).id;
      if(!M.groups.some(g=>g.id===state.group))state.group='';
      $('groups').innerHTML=[{id:'',label:'全部'},...M.groups].map(g=>'<button data-group="'+g.id+'" aria-pressed="'+(state.group===g.id)+'">'+esc(g.label)+'</button>').join('');
      $('load-state').textContent='';render();
    }else{$('load-state').textContent='宏观数据读取失败；请检查网络后重试。';$('retry').hidden=false;}
    showView();
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;showView();if(state.view==='indicators'&&!catalog)load();});
  document.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;state.id='';state.comparison='';page=0;render();});
  $('search').oninput=e=>{state.q=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;render();},180);};
  $('frequency').onchange=e=>{state.frequency=e.target.value;page=0;render();};$('health').onchange=e=>{state.health=e.target.value;page=0;render();};
  $('reset-filters').onclick=()=>{clearTimeout(searchTimer);state.q='';state.group='';state.frequency='';state.health='';page=0;render();};
  $('kpi-grid').onclick=e=>{const b=e.target.closest('[data-kpi]');if(b){clearTimeout(searchTimer);selectMetric(b.dataset.kpi);}};
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(catalog&&state.view==='indicators')renderDetail();},150);});
  $('groups').onclick=e=>{const b=e.target.closest('[data-group]');if(b){state.group=b.dataset.group;state.id='';page=0;render();}};
  for(const id of ['metric-list','reference-list','pending-list'])$(id).onclick=e=>{const b=e.target.closest('[data-id]');if(b){state.id=b.dataset.id;page=0;render();}};
  $('prediction-search').oninput=()=>{predictionExpanded=false;renderPredictions();};$('prediction-category').onchange=()=>{predictionExpanded=false;renderPredictions();};$('retry').onclick=load;
  load();
})();




