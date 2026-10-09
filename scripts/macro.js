(function(){
  'use strict';
  const M=window.MacroModel,$=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>M.finite(v)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(v):'—';
  const compact=v=>!M.finite(v)?'—':Math.abs(v)>=1e12?number(v/1e12)+'万亿':Math.abs(v)>=1e8?number(v/1e8)+'亿':number(v);
  const stamp=v=>v?String(v).replace('T',' ').replace(/\+00:00|Z/,' UTC'):'未提供';
  const link=(url,label)=>'<a href="'+esc(M.safeUrl(url))+'" target="_blank" rel="noopener">'+esc(label)+'</a>';
  let catalog,snapshot,predictions,predictionError=false,page=0;
  const params=new URLSearchParams(location.search);
  const state={country:params.get('country')==='US'?'US':'CN',group:params.get('group')||'',q:params.get('q')||'',
    id:params.get('indicator')||'',mode:['yoy','mom'].includes(params.get('mode'))?params.get('mode'):'value',
    years:[0,1,3,5,10].includes(+params.get('years'))&&params.has('years')?+params.get('years'):5,
    view:params.get('view')==='predictions'?'predictions':'indicators'};
  function save(){const p=new URLSearchParams();for(const key of ['country','group','q','id','mode','years','view'])if(state[key]!==''&&state[key]!==null)p.set(key==='id'?'indicator':key,state[key]);history.replaceState(null,'',location.pathname+'?'+p);}
  function download(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function showView(){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));$('countries').hidden=state.view!=='indicators';$('indicators').hidden=state.view!=='indicators'||!catalog;$('predictions').hidden=state.view!=='predictions';save();if(state.view==='predictions')renderPredictions();}
  function graph(spec,data){
    const points=M.chartRows(spec,data,state.mode,state.years,new Date(snapshot.cutoff+'T23:59:59Z'));
    const values=points.filter(r=>M.finite(r.chartValue));
    if(!values.length)return '<p class="portal-empty">所选区间或口径没有可用数据。可切换“原始值”或“全部”。</p>';
    const w=720,h=280,left=84,right=24,top=28,bottom=40;
    let lo=Math.min(...values.map(r=>r.chartValue)),hi=Math.max(...values.map(r=>r.chartValue));
    const pad=(hi-lo||Math.abs(hi)*.05||1)*.1;lo-=pad;hi+=pad;
    const first=M.dateOf(points[0].period).getTime(),last=M.dateOf(points.at(-1).period).getTime();
    const x=r=>left+(M.dateOf(r.period).getTime()-first)/(last-first||1)*(w-left-right);
    const y=r=>top+(hi-r.chartValue)/(hi-lo)*(h-top-bottom);
    let lines='',segment=[],dots='';
    function flush(){if(segment.length)lines+='<polyline points="'+segment.join(' ')+'"/>';segment=[];}
    let previous=null;
    for(const row of points){
      const gap=previous&&(M.dateOf(row.period)-M.dateOf(previous.period))/86400000;
      const maximum={annual:400,quarterly:110,monthly:40,daily:7}[spec.frequency];
      if(gap>maximum)flush();
      if(!M.finite(row.chartValue)){flush();previous=row;continue;}
      segment.push(x(row).toFixed(2)+','+y(row).toFixed(2));
      dots+='<circle cx="'+x(row).toFixed(2)+'" cy="'+y(row).toFixed(2)+'" r="3"><title>'+esc(row.period+'：'+number(row.chartValue)+' '+(state.mode==='value'?spec.unit:M.changeUnit(spec)))+'</title></circle>';
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
    if(unavailable||(spec.frequency==='annual'&&state.mode==='mom'))state.mode='value';
    if(!latest){$('detail').innerHTML='<h2 id="metric-title">'+esc(spec.name)+'</h2><p class="portal-note">待补齐 · '+esc(M.frequency[spec.frequency])+'</p><p>'+link(source.url,'查看官方来源 ↗')+'</p>';return;}
    const changes=unavailable?[]:spec.frequency==='annual'?['yoy']:['yoy','mom'];
    $('detail').innerHTML='<div class="portal-panel-head"><div><p class="eyebrow">'+esc((M.groupOf(spec.id)?.label||spec.category)+' · '+M.frequency[spec.frequency])+'</p><h2 id="metric-title">'+esc(spec.name)+'</h2><span class="macro-state">'+esc(s)+'</span></div><button id="download" class="portal-button">下载 CSV</button></div>'+
      '<div class="macro-latest"><div><span>最新值 · '+esc(latest.period)+'</span><b>'+compact(latest.value)+'</b><small>'+esc(spec.unit)+'</small></div>'+changes.map(mode=>'<div><span>'+esc(M.changeLabel(spec,mode))+'</span><b>'+number(M.compare(spec,list,latest,mode))+'</b><small>'+esc(M.changeUnit(spec))+'</small></div>').join('')+'</div>'+
      '<p class="macro-source-line">'+link(latest.originalSourceUrl||latest.sourceUrl||data.sourceUrl||source.url,data.provider?.includes('Choice')?data.sourceOrganization+' · Choice':source.name)+' · '+esc(spec.adjustment)+'<br>发布日期：'+esc(latest.releaseDate||'来源未提供')+(M.finite(latest.officialYoy)?' · 官方同比 '+number(latest.officialYoy)+'%':'')+'</p>'+(data.error?'<p class="macro-state">更新失败，保留历史数据。</p>':'')+
      (data.coverage?'<p class="macro-coverage">'+esc(data.coverage.start+' — '+data.coverage.end+' · '+data.coverage.count+'期 · '+(data.coverage.missingPeriods.length?data.coverage.missingPeriods.length+'期缺失':'区间内无缺期'))+(data.coverage.historyShort?' · 历史覆盖不足':'')+(data.coverage.structuralPeriods.length?' · 合并发布月份不拆分':'')+'</p>':'')+
      '<div class="macro-controls"><label>口径<select id="mode"><option value="value">原始值</option>'+(!unavailable?'<option value="yoy">'+esc(M.changeLabel(spec,'yoy'))+'</option><option value="mom" '+(spec.frequency==='annual'?'disabled':'')+'>'+esc(M.changeLabel(spec,'mom'))+'</option>':'')+'</select></label><label>时间<select id="years"><option value="1">近1年</option><option value="3">近3年</option><option value="5">近5年</option><option value="10">近10年</option><option value="0">全部</option></select></label><span class="portal-note">单位：'+esc(state.mode==='value'?spec.unit:M.changeUnit(spec))+'</span></div><div class="macro-chart">'+graph(spec,data)+'</div>'+
      '<details class="macro-history"><summary>历史明细</summary><div class="portal-table-scroll"><table class="portal-table"><thead><tr><th>数据期间</th><th>数值 ('+esc(spec.unit)+')</th><th>'+esc(M.changeLabel(spec,'yoy'))+' ('+esc(M.changeUnit(spec))+')</th><th>'+esc(M.changeLabel(spec,'mom'))+' ('+esc(M.changeUnit(spec))+')</th><th>发布日期</th><th>来源</th></tr></thead><tbody id="history"></tbody></table></div><div class="portal-pager"><span id="page-label"></span><div><button id="prev">上一页</button> <button id="next">下一页</button></div></div></details>'+
      '<details class="macro-method"><summary>口径与来源</summary><p>'+esc(spec.definition)+'</p><p>'+esc(unavailable?'累计及日度序列不推算同比环比。':spec.kind==='rate'?'百分比指标比较为百分点差值。':spec.kind==='balance'?'余额比较为原单位差值。':'同比、环比匹配准确期间，不补缺值。')+'</p><p>最近获取：'+esc(stamp(data.fetchedAt))+'<br>最近检查：'+esc(stamp(data.checkedAt))+'<br>源库更新：'+esc(data.datasetUpdatedAt||'未提供')+'</p>'+(data.coverage?.missingPeriods?.length?'<p>真实缺期：'+esc(data.coverage.missingPeriods.join('、'))+'</p>':'')+(data.reusedFrom?'<p>复用站内已核验的 '+link('https://yuxing954.github.io/guojin-shangshe-database/consumption-macro.html','消费宏观')+' 数据；官方同比单列，不用金额重算替代。</p>':'')+(data.sourceOrganization?'<p>原始提供者：'+esc(data.sourceOrganization)+(data.metadataUrl?' '+link(data.metadataUrl,'元数据'):'')+'</p>':'')+(latest.footnotes?.length?'<p>修订脚注：'+esc(latest.footnotes.join('; '))+'</p>':'')+'<p>API：'+esc(data.provider?.includes('Choice')?'后端通过已连接的Choice MCP更新，浏览器不接触密钥':source.api)+'<br>授权：'+esc(data.provider?.includes('Choice')?'用户已明确确认公开展示与下载授权':source.license)+' '+link(source.terms,'条款')+'</p></details>';
    $('mode').value=state.mode;$('years').value=String(state.years);
    $('mode').onchange=e=>{state.mode=e.target.value;renderDetail();save();};$('years').onchange=e=>{state.years=+e.target.value;renderDetail();save();};
    $('download').onclick=()=>download(M.csv(spec,data,source),spec.id+'.csv');
    $('prev').onclick=()=>{page--;renderHistory(spec,data);};$('next').onclick=()=>{page++;renderHistory(spec,data);};renderHistory(spec,data);
  }
  function render(){
    if(!catalog)return;
    const selected=M.curated(catalog.series,state,snapshot),all=[...selected.available,...selected.references,...selected.pending];
    if(!all.some(s=>s.id===state.id)){state.id=all[0]?.id||'';page=0;}
    $('summary').textContent='';$('count').textContent=selected.available.length+' 项';
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
    if(!predictions){$('prediction-status').textContent=predictionError?'预测快照读取失败；点击“重试读取”。':'正在读取预测快照…';return;}
    const stale=(Date.now()-new Date(predictions.fetchedAt))/3600000>24;
    $('prediction-status').textContent=(predictions.status==='error'?'更新失败 · ':stale?'快照超过24小时 · ':'')+'更新：'+stamp(predictions.fetchedAt)+' · '+predictions.markets.length+' 个合约';
    $('prediction-selection').textContent=predictions.selectionNote||'';
    const q=$('prediction-search').value.trim().toLowerCase(),category=$('prediction-category').value;
    const list=predictions.markets.filter(m=>(!q||[m.questionZh,m.question].filter(Boolean).join(' ').toLowerCase().includes(q))&&(!category||m.category===category));
    $('prediction-list').innerHTML=list.length?list.map(m=>'<article class="prediction-card"><span class="portal-tag">'+esc(m.category)+'</span><h3>'+esc(m.questionZh||'预测合约（中文译名待补充）')+'</h3><details class="prediction-original"><summary>查看英文原文</summary><p>'+esc(m.question)+'</p></details>'+m.outcomes.map(o=>'<div class="prediction-outcome"><div><span>'+esc(o.nameZh||o.name)+'</span><strong>'+number(o.probability*100)+'%</strong></div><progress max="1" value="'+o.probability+'" aria-label="'+esc((o.nameZh||o.name)+'市场隐含概率')+'"></progress></div>').join('')+'<div class="prediction-meta"><span>24h成交：$'+number(m.volume24h)+'</span><span>流动性：$'+number(m.liquidity)+'</span><span>价差：'+(M.finite(m.spread)?number(m.spread*100)+'¢':'未提供')+'</span><span>截止：'+esc(stamp(m.endDate))+'</span><span>源更新：'+esc(stamp(m.updatedAt))+'</span></div>'+link(m.url,'查看原始合约与结算规则 ↗')+(m.liquidity<10000?'<span class="macro-state">流动性偏低，价格对少量交易可能敏感。</span>':'')+'</article>').join(''):'<p class="portal-empty">没有符合筛选条件的预测合约。</p>';
    $('prediction-download').disabled=!list.length;
    $('prediction-download').onclick=()=>{const header=['事件（中文）','事件（英文原文）','主题','结果（中文）','结果（英文原文）','市场隐含概率','24h成交额USD','流动性USD','截止时间','源更新时间','快照时间','原始合约'];const rows=list.flatMap(m=>m.outcomes.map(o=>[m.questionZh,m.question,m.category,o.nameZh,o.name,o.probability,m.volume24h,m.liquidity,m.endDate,m.updatedAt,predictions.fetchedAt,m.url]));download('\uFEFF'+[header,...rows].map(r=>r.map(M.csvCell).join(',')).join('\r\n'),'polymarket-important.csv');};
  }
  async function read(url){const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}
  async function load(){
    $('load-state').textContent='正在读取宏观数据…';$('retry').hidden=true;
    const results=await Promise.allSettled([read('data/macro/catalog.json'),read('data/macro/snapshot.json'),read('data/macro/predictions.json'),read('data/consumption-macro/observations.json'),read('data/macro/automatic-series.json')]);
    if(results[0].status==='fulfilled'&&results[1].status==='fulfilled'){
      catalog=results[0].value;snapshot=results[1].value;
      if(!Array.isArray(catalog.series)||!snapshot.series){$('load-state').textContent='宏观数据格式错误。';$('retry').hidden=false;return;}
      if(results[3].status==='fulfilled'){
        try{const copy=JSON.parse(JSON.stringify(snapshot));M.mergeConsumption(catalog,copy,results[3].value);snapshot=copy;}
        catch{console.warn('站内消费数据核验未通过，保留宏观快照。');}
      }
      if(results[4].status==='fulfilled'){
        try{M.mergeAutomatic(catalog,snapshot,results[4].value);}
        catch{console.warn('自动数据核验未通过，保留官方快照。');}
      }
      // Preserve old category links by translating them to the new research groups.
      const legacy=catalog.series.find(s=>s.country===state.country&&s.category===params.get('category')&&M.groupOf(s.id));
      if(!state.group&&legacy)state.group=M.groupOf(legacy.id).id;
      if(!M.groups.some(g=>g.id===state.group))state.group='';
      $('groups').innerHTML=[{id:'',label:'全部'},...M.groups].map(g=>'<button data-group="'+g.id+'" aria-pressed="'+(state.group===g.id)+'">'+esc(g.label)+'</button>').join('');
      $('load-state').textContent='';render();
    }else{$('load-state').textContent='宏观数据读取失败；请检查网络后重试。';$('retry').hidden=false;}
    if(results[2].status==='fulfilled'&&Array.isArray(results[2].value.markets)){predictions=results[2].value;predictionError=false;}else{predictionError=true;$('retry').hidden=false;}
    showView();
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;showView();});
  document.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;state.id='';page=0;render();});
  $('search').oninput=e=>{state.q=e.target.value;page=0;render();};
  $('groups').onclick=e=>{const b=e.target.closest('[data-group]');if(b){state.group=b.dataset.group;state.id='';page=0;render();}};
  for(const id of ['metric-list','reference-list','pending-list'])$(id).onclick=e=>{const b=e.target.closest('[data-id]');if(b){state.id=b.dataset.id;page=0;render();}};
  $('prediction-search').oninput=renderPredictions;$('prediction-category').onchange=renderPredictions;$('retry').onclick=load;
  load();
})();
