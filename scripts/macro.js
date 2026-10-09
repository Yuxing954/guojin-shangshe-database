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
  const state={country:params.get('country')==='US'?'US':'CN',category:params.get('category')||'',q:params.get('q')||'',
    available:params.get('available')==='1',id:params.get('indicator')||'',mode:['yoy','mom'].includes(params.get('mode'))?params.get('mode'):'value',
    years:[0,1,3,5,10].includes(+params.get('years'))&&params.has('years')?+params.get('years'):5,
    view:params.get('view')==='predictions'?'predictions':'indicators'};
  function save(){const p=new URLSearchParams();for(const key of ['country','category','q','id','mode','years','view'])if(state[key]!==''&&state[key]!==null)p.set(key==='id'?'indicator':key,state[key]);if(state.available)p.set('available','1');history.replaceState(null,'',location.pathname+'?'+p);}
  function download(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function showView(){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));$('indicators').hidden=state.view!=='indicators'||!catalog;$('predictions').hidden=state.view!=='predictions';save();if(state.view==='predictions')renderPredictions();}
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
    $('detail').innerHTML='<div class="portal-panel-head"><div><p class="eyebrow">'+esc(spec.category+' / '+M.frequency[spec.frequency])+'</p><h2 id="metric-title">'+esc(spec.name)+'</h2><span class="macro-state">'+esc(s)+'</span></div><button id="download" class="portal-button" '+(!list.length?'disabled':'')+'>下载指标 CSV</button></div>'+
      '<div class="macro-latest"><div><span>最新值 · '+esc(latest?.period||'未收录')+'</span><b>'+compact(latest?.value)+'</b><small>'+esc(spec.unit)+'</small></div>'+['yoy','mom'].map(mode=>'<div><span>'+esc(M.changeLabel(spec,mode))+'</span><b>'+number(latest?M.compare(spec,list,latest,mode):null)+'</b><small>'+esc(M.changeUnit(spec))+'</small></div>').join('')+'</div>'+
      '<div class="macro-meta"><span>发布日期：'+esc(latest?.releaseDate||'来源未提供')+'</span><span>季调 / 口径：'+esc(spec.adjustment)+'</span><span>数据来源：'+link(source.url,source.name)+'</span><span>最近成功获取：'+esc(stamp(data.fetchedAt))+'</span><span>最近检查：'+esc(stamp(data.checkedAt))+'</span><span>源数据库更新：'+esc(data.datasetUpdatedAt||'来源未提供')+'</span></div>'+
      '<p class="portal-note">'+esc(spec.definition)+'</p>'+(data.sourceOrganization?'<p class="portal-note">原始提供者：'+esc(data.sourceOrganization)+' '+link(data.metadataUrl,'指标元数据')+'</p>':'')+(latest?.footnotes?.length?'<p class="portal-note">修订脚注：'+esc(latest.footnotes.join('; '))+'</p>':'')+(data.error?'<p class="macro-disclosure">'+esc(data.error)+'</p>':'')+
      (unavailable?'<p class="portal-note">'+(spec.kind==='cumulative'?'累计值不自动计算同比环比；需要同口径官方变化率。':'日度数据不自动计算同比环比；需明确交易日对齐和月度聚合规则。')+'</p>':'<p class="portal-note">'+(spec.kind==='rate'?'百分比指标比较为百分点差值，不把增速再算增长率。':spec.kind==='balance'?'余额比较为原单位差值，避免负数基数导致误读。':'同比匹配上年同月/季度；环比匹配上月/季度，不补缺值、不折年化。')+'</p>')+
      '<div class="macro-controls"><label>口径<select id="mode"><option value="value">原始值</option>'+(!unavailable?'<option value="yoy">'+esc(M.changeLabel(spec,'yoy'))+'</option><option value="mom" '+(spec.frequency==='annual'?'disabled':'')+'>'+esc(M.changeLabel(spec,'mom'))+'</option>':'')+'</select></label><label>时间<select id="years"><option value="1">近1年</option><option value="3">近3年</option><option value="5">近5年</option><option value="10">近10年</option><option value="0">全部</option></select></label><span class="portal-note">单位：'+esc(state.mode==='value'?spec.unit:M.changeUnit(spec))+'</span></div><div class="macro-chart">'+graph(spec,data)+'</div>'+
      '<details class="macro-history" open><summary>历史明细与发布日期</summary><div class="portal-table-scroll"><table class="portal-table"><thead><tr><th>数据期间</th><th>数值 ('+esc(spec.unit)+')</th><th>'+esc(M.changeLabel(spec,'yoy'))+' ('+esc(M.changeUnit(spec))+')</th><th>'+esc(M.changeLabel(spec,'mom'))+' ('+esc(M.changeUnit(spec))+')</th><th>发布日期</th><th>来源</th></tr></thead><tbody id="history"></tbody></table></div><div class="portal-pager"><span id="page-label"></span><div><button id="prev">上一页</button> <button id="next">下一页</button></div></div></details>'+
      '<p class="portal-note">API：'+esc(source.api)+'<br>授权：'+esc(source.license)+' '+link(source.terms,'查看条款')+'</p>';
    $('mode').value=state.mode;$('years').value=String(state.years);
    $('mode').onchange=e=>{state.mode=e.target.value;renderDetail();save();};$('years').onchange=e=>{state.years=+e.target.value;renderDetail();save();};
    $('download').onclick=()=>download(M.csv(spec,data,source),spec.id+'.csv');
    $('prev').onclick=()=>{page--;renderHistory(spec,data);};$('next').onclick=()=>{page++;renderHistory(spec,data);};renderHistory(spec,data);
  }
  function render(){
    const filtered=M.filter(catalog.series,state,snapshot),all=catalog.series.filter(s=>s.country===state.country),withData=all.filter(s=>M.rows(snapshot.series[s.id]).length);
    if(!filtered.some(s=>s.id===state.id)){state.id=filtered[0]?.id||'';page=0;}
    $('summary').innerHTML='<span><b>'+all.length+'</b>项指标</span><span><b>'+withData.length+'</b>项有真实数据</span><span><b>'+all.filter(s=>snapshot.series[s.id]?.status==='error').length+'</b>项更新失败</span><span><b>'+all.filter(s=>snapshot.series[s.id]?.status==='pending').length+'</b>项待接入</span>';
    $('count').textContent=filtered.length+' 项';
    $('metric-list').innerHTML=filtered.length?filtered.map(spec=>{const data=snapshot.series[spec.id]||{},latest=M.rows(data).at(-1);return '<button class="macro-item" data-id="'+esc(spec.id)+'" aria-pressed="'+(state.id===spec.id)+'"><strong>'+esc(spec.name)+'</strong><small>'+esc(spec.category+' · '+M.frequency[spec.frequency]+' · '+spec.adjustment)+'</small><span class="macro-item-value">'+compact(latest?.value)+'</span> <small>'+esc(spec.unit+' · '+(latest?.period||'尚无数据')+' · '+M.status(spec,data))+'</small></button>';}).join(''):'<p class="portal-empty">没有匹配指标</p>';
    document.querySelectorAll('[data-country]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.country===state.country)));
    $('search').value=state.q;$('category').value=state.category;$('available').checked=state.available;
    renderDetail();save();
  }
  function renderPredictions(){
    if(!predictions){$('prediction-status').textContent=predictionError?'预测快照读取失败；点击“重试读取”。':'正在读取预测快照…';return;}
    const stale=(Date.now()-new Date(predictions.fetchedAt))/3600000>24;
    $('prediction-status').textContent=(predictions.status==='error'?'更新失败，保留上次快照。 ':stale?'快照已超过24小时，需更新。 ':'')+'成功获取：'+stamp(predictions.fetchedAt)+' · '+predictions.markets.length+' 个合约。'+(predictions.selectionNote||'');
    const q=$('prediction-search').value.trim().toLowerCase(),category=$('prediction-category').value;
    const list=predictions.markets.filter(m=>(!q||m.question.toLowerCase().includes(q))&&(!category||m.category===category));
    $('prediction-list').innerHTML=list.length?list.map(m=>'<article class="prediction-card"><span class="portal-tag">'+esc(m.category)+'</span><h3>'+esc(m.question)+'</h3>'+m.outcomes.map(o=>'<div class="prediction-outcome"><div><span>'+esc(o.name)+'</span><strong>'+number(o.probability*100)+'%</strong></div><progress max="1" value="'+o.probability+'" aria-label="'+esc(o.name+'市场隐含概率')+'"></progress></div>').join('')+'<div class="prediction-meta"><span>24h成交：$'+number(m.volume24h)+'</span><span>流动性：$'+number(m.liquidity)+'</span><span>价差：'+(M.finite(m.spread)?number(m.spread*100)+'¢':'未提供')+'</span><span>截止：'+esc(stamp(m.endDate))+'</span><span>源更新：'+esc(stamp(m.updatedAt))+'</span></div>'+link(m.url,'查看原始合约与结算规则 ↗')+(m.liquidity<10000?'<span class="macro-state">流动性偏低，价格对少量交易可能敏感。</span>':'')+'</article>').join(''):'<p class="portal-empty">没有符合筛选条件的预测合约。</p>';
    $('prediction-download').disabled=!list.length;
    $('prediction-download').onclick=()=>{const header=['事件','主题','结果','市场隐含概率','24h成交额USD','流动性USD','截止时间','源更新时间','快照时间','原始合约'];const rows=list.flatMap(m=>m.outcomes.map(o=>[m.question,m.category,o.name,o.probability,m.volume24h,m.liquidity,m.endDate,m.updatedAt,predictions.fetchedAt,m.url]));download('\uFEFF'+[header,...rows].map(r=>r.map(M.csvCell).join(',')).join('\r\n'),'polymarket-important.csv');};
  }
  async function read(url){const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}
  async function load(){
    $('load-state').textContent='正在读取宏观数据…';$('retry').hidden=true;
    const results=await Promise.allSettled([read('data/macro/catalog.json'),read('data/macro/snapshot.json'),read('data/macro/predictions.json')]);
    if(results[0].status==='fulfilled'&&results[1].status==='fulfilled'){
      catalog=results[0].value;snapshot=results[1].value;
      if(!Array.isArray(catalog.series)||!snapshot.series){$('load-state').textContent='宏观数据格式错误。';$('retry').hidden=false;return;}
      $('category').innerHTML='<option value="">全部分类</option>'+catalog.categories.map(c=>'<option>'+esc(c)+'</option>').join('');
      if(!catalog.categories.includes(state.category))state.category='';
      $('sources').innerHTML=Object.values(catalog.sources).map(s=>'<article><h3>'+link(s.url,s.name)+'</h3><p>'+esc(s.api)+'</p><p>'+esc(s.license)+' '+link(s.terms,'使用条款')+'</p></article>').join('');
      $('load-state').textContent='';render();
    }else{$('load-state').textContent='宏观数据读取失败；请检查网络后重试。';$('retry').hidden=false;}
    if(results[2].status==='fulfilled'&&Array.isArray(results[2].value.markets)){predictions=results[2].value;predictionError=false;}else{predictionError=true;$('retry').hidden=false;}
    showView();
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;showView();});
  document.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;state.id='';page=0;render();});
  $('search').oninput=e=>{state.q=e.target.value;page=0;render();};$('category').onchange=e=>{state.category=e.target.value;page=0;render();};$('available').onchange=e=>{state.available=e.target.checked;page=0;render();};
  $('metric-list').onclick=e=>{const b=e.target.closest('[data-id]');if(b){state.id=b.dataset.id;page=0;render();}};
  $('prediction-search').oninput=renderPredictions;$('prediction-category').onchange=renderPredictions;$('retry').onclick=load;
  load();
})();
