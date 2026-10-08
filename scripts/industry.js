(async function(){

  'use strict';

  const D=SiteData,M=IndustryModel,R=ResearchModel,$=id=>document.getElementById(id),size=18;

  const quality={primary:'原始披露',provider:'平台转引',legacy:'历史整理',derived:'计算值'};

  let snapshot,sources={},sector,metric,years=3,page=1,pool=[],research=[],companyError=false,researchError=false,relatedLoaded=false;
  const fmt=(value,precision=2)=>D.fmt(value,precision),signed=(value,precision=2)=>(value>0?'+':'')+fmt(value,precision);

  function activeMetric(){return sector.metrics.find(m=>m.id===metric);}

  function sourceLink(id){const s=sources[id]||{},url=D.link(s.url);return url?'<a href="'+D.esc(url)+'" target="_blank" rel="noopener">'+D.esc(s.name||'数据来源')+' ↗</a>':s.file?'<a href="'+D.esc(s.file)+'">'+D.esc(s.name)+' ↗</a>':D.esc(s.name||'来源待补齐');}

  function cards(){

    $('stats').innerHTML=sector.core.map(id=>{const m=sector.metrics.find(item=>item.id===id),p=M.latest(m);return '<button class="industry-card" data-metric="'+id+'" aria-pressed="'+String(id===metric)+'"><span class="industry-card-label">'+D.esc(m.label)+(m.environment?'<span class="industry-card-tag">经营环境</span>':'')+'</span><strong'+(!p?' class="industry-missing"':'')+'>'+(!p?'待补齐':fmt(p.value,m.precision)+'<small>'+D.esc(m.unit)+'</small>')+'</strong><span class="industry-card-change">'+(p&&Number.isFinite(p.change)?D.esc((p.changeLabel||'同比')+' '+signed(p.change)+(m.changeUnit||'%')):m.isRate?'源数据公布的可比增速':!p?D.esc(m.missing||'暂无已收录数据'):m.formula?'按相同期间数据计算':m.frequency+' · '+D.esc(quality[p.quality]||'已收录'))+'</span><span class="industry-card-date">'+D.esc(p?.periodLabel||m.scope)+'</span></button>';}).join('');

  }

  function chart(points,m){

    const clean=points.filter(p=>Number.isFinite(p.value));if(!clean.length)return '<p class="portal-empty">当前口径暂无可绘制数据，请切换指标或查看来源明细。</p>';

    const esc=D.esc,values=clean.map(p=>p.value),high=Math.max(...values),low=Math.min(...values),spread=high-low||Math.max(1,Math.abs(high)*.02),lo=low-spread*.1,hi=high+spread*.1;

    const lower=m.frequency==='季度累计'?0:lo,upper=m.frequency==='季度累计'?high*1.1:hi;

    const start=Date.parse(clean[0].endDate),end=Date.parse(clean.at(-1).endDate),x=p=>70+(Date.parse(p.endDate)-start)/Math.max(1,end-start)*830,y=v=>220-(v-lower)/(upper-lower)*175;

    const grid=[0,1,2].map(i=>{const v=upper-(upper-lower)*i/2;return '<line x1="70" y1="'+y(v)+'" x2="900" y2="'+y(v)+'" stroke="#eceef3"/><text x="58" y="'+(y(v)+4)+'" text-anchor="end">'+esc(fmt(v,m.unit.includes('美元')?4:m.precision))+'</text>';}).join('');

    const tip=p=>esc(p.periodLabel+'：'+fmt(p.value,m.precision)+' '+($('chart-mode').value==='change'?m.changeUnit||'%':m.unit));

    const marks=m.frequency==='季度累计'?clean.map(p=>'<rect x="'+(x(p)-7)+'" y="'+y(p.value)+'" width="14" height="'+(220-y(p.value))+'" rx="2"><title>'+tip(p)+'</title></rect>').join(''):'<polyline points="'+clean.map(p=>x(p)+','+y(p.value)).join(' ')+'" fill="none" stroke="#5158aa" stroke-width="2.5" stroke-linejoin="round"/>'+clean.map(p=>'<circle cx="'+x(p)+'" cy="'+y(p.value)+'" r="3" fill="#5158aa"><title>'+tip(p)+'</title></circle>').join('');

    return '<svg class="industry-chart '+(m.frequency==='季度累计'?'industry-bars':'')+'" viewBox="0 0 945 270" role="img" aria-label="'+esc(m.label+'趋势，共'+clean.length+'条观测记录')+'"><title>'+esc(m.label+'；'+m.scope)+'</title>'+grid+marks+'<text x="70" y="253">'+esc(clean[0].endDate)+'</text><text x="900" y="253" text-anchor="end">'+esc(clean.at(-1).endDate)+'</text></svg>';

  }

  function table(){

    const m=activeMetric(),all=M.inRange(m.points,years).slice().reverse(),count=Math.max(1,Math.ceil(all.length/size));page=Math.min(page,count);

    $('history').innerHTML=all.slice((page-1)*size,page*size).map(p=>'<tr><td>'+D.esc(p.periodLabel)+'</td><td>'+fmt(p.value,m.precision)+'</td><td>'+(!Number.isFinite(p.change)?'—':signed(p.change)+' '+D.esc(m.changeUnit||'%')+'<small> '+D.esc(p.changeLabel||'')+'</small>')+'</td><td class="industry-history-source">'+sourceLink(p.sourceId)+'<br>'+D.esc(quality[p.quality]||'')+'</td></tr>').join('')||'<tr><td colspan="4">暂无已收录数据</td></tr>';

    $('value-heading').textContent='数值（'+m.unit+'）';$('change-heading').textContent='变化（'+(m.changeUnit||'%')+'）';$('page-label').textContent=page+' / '+count+' · '+all.length+' 条';$('prev').disabled=page<=1;$('next').disabled=page>=count;$('download').disabled=!all.length;

    const ids=[...new Set(m.points.flatMap(p=>[p.sourceId,p.changeSourceId,...(p.inputs||[])].filter(Boolean)))];

    $('sources').innerHTML=ids.map(id=>{const s=sources[id];return '<div class="industry-source">'+sourceLink(id)+'<p>'+D.esc((s.provider||'')+' · '+(quality[s.quality]||''))+'</p><p>'+D.esc('发布日期：'+(s.publishedAt||'未记录')+' · 核对或采集：'+(s.retrievedAt||'未记录'))+'</p>'+(s.locator?'<p>'+D.esc(s.locator)+'</p>':'')+(s.indicator?'<p>原始指标：'+D.esc(s.indicator)+'</p>':'')+'</div>';}).join('')||'<p class="industry-empty">暂无来源记录。</p>';

    const revisions=snapshot.revisions.filter(r=>r.metricId===m.id);$('revision-label').textContent='来源差异与修订记录（'+revisions.length+' 条）';$('revisions').innerHTML=revisions.length?'<p>保留旧值以便回查；当前优先采用原始披露，其次采用平台转引。</p><ul>'+revisions.map(r=>'<li>'+D.esc(r.period)+'：'+fmt(r.previousValue,m.precision)+' → '+fmt(r.selectedValue,m.precision)+' '+D.esc(m.unit)+' · '+D.esc(sources[r.previousSourceId]?.provider||'')+' → '+D.esc(sources[r.selectedSourceId]?.provider||'')+'</li>').join('')+'</ul>':'<p>该指标尚无已记录的来源差异。</p>';

  }

  function render(){

    const m=activeMetric(),mode=$('chart-mode').value,all=M.inRange(m.points,years),points=M.chartPoints(m,years,mode);

    cards();$('metric-title').textContent=m.label+(mode==='change'?' · '+(m.yoyLabel||'同比变化'):'');$('metric-note').textContent=m.scope+' · '+m.frequency+' · '+(mode==='change'?m.changeUnit||'%':m.unit);

    $('coverage').textContent=all.length?all[0].endDate+' — '+all.at(-1).endDate:'';$('chart').innerHTML=chart(points,m);

    const short=all.length&&Number(years)&&Date.parse(all.at(-1).endDate)-Date.parse(m.points[0].endDate)<Number(years)*300*86400000;

    $('chart-note').textContent=[short?'按实际收录范围展示，尚不足'+years+'年。':'',m.frequency==='季度累计'?'柱图展示各期累计量，不代表单季度消费。':'',!m.isRate&&mode!=='change'&&all.some(p=>p.basis==='combined')?'1—2月合并金额不接入单月曲线，可在明细中查看。':'',mode==='change'?'缺失同比不绘制；不由累计同比替代。':''].filter(Boolean).join(' ');

    $('definition').textContent=m.scope+(m.formula?'。'+m.formula:'')+(m.scopeNote?'。'+m.scopeNote:'')+'。历史整理和平台转引保留来源状态；未记录的发布时间保持为空。';

    $('ranges').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.years)===years)));table();

  }

  function choose(id){metric=id;$('metric').value=id;const m=activeMetric(),changes=m.points.some(p=>Number.isFinite(p.change));$('chart-mode').disabled=m.isRate||!changes;$('chart-mode').value=sector.id==='hotel'&&changes?'change':'value';page=1;render();}

  function related(){
    if(!relatedLoaded){$('company-links').innerHTML='<p class="industry-empty">正在读取公司目录…</p>';$('research-links').innerHTML='<p class="industry-empty">正在读取相关研究…</p>';return;}
    const companies=pool.filter(c=>sector.companySector.split(',').includes(c['子行业'])),sectorUrl='companies.html?sector='+encodeURIComponent(sector.companySector);

    $('company-all').href=sectorUrl;$('company-links').innerHTML=companyError?'<p class="industry-empty">公司目录暂时无法读取，可进入公司页重试。</p>':companies.slice(0,5).map(c=>'<a class="industry-company-link" href="'+sectorUrl+'&company='+encodeURIComponent(c['证券代码'])+'"><span>'+D.esc(c['公司名称'])+'</span><small>'+D.esc(c['证券代码'])+' →</small></a>').join('')||'<p class="industry-empty">暂无已收录公司，后续按公告补齐。</p>';

    const items=research.filter(r=>R.sectorIds(r).includes(sector.researchSector)).sort((a,b)=>b.published.localeCompare(a.published)).slice(0,5);

    $('research-all').href='research.html?sector='+sector.researchSector;$('research-links').innerHTML=researchError?'<p class="industry-empty">研究内容暂时无法读取，可进入研究页重试。</p>':items.map(r=>'<a class="industry-research-link" href="'+D.esc(R.href(r))+'"><time datetime="'+D.esc(r.published)+'">'+D.esc(r.date.slice(5))+'</time><span>'+D.esc(r.title)+'</span></a>').join('')||'<p class="industry-empty">暂无近期已收录研究，可进入文库查看历史内容。</p>';

  }

  function select(){const key=location.hash.slice(1);sector=snapshot.sectors.find(s=>s.id===key)||snapshot.sectors[0];$('page-title').textContent=sector.name;document.title=sector.name+'行业数据 · 国金商社';$('page-subtitle').textContent=sector.question;$('sector-note').textContent=sector.note;$('sector-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.key===sector.id)));$('metric').innerHTML=sector.metrics.map(m=>'<option value="'+m.id+'">'+D.esc(m.label)+(m.environment?'（经营环境）':m.subset?'（子集）':'')+'</option>').join('');$('specialist').hidden=!sector.detailHref;$('specialist').href=sector.detailHref||'#';$('specialist').textContent='进入'+sector.name+'专题 →';$('history-details').open=false;const requested=new URLSearchParams(location.search).get('metric');choose(sector.metrics.some(m=>m.id===requested)?requested:sector.defaultMetric);related();}

  $('sector-tabs').onclick=e=>{const b=e.target.closest('[data-key]');if(b)location.hash=b.dataset.key;};$('stats').onclick=e=>{const b=e.target.closest('[data-metric]');if(b)choose(b.dataset.metric);};$('metric').onchange=e=>choose(e.target.value);$('chart-mode').onchange=render;$('ranges').onclick=e=>{const b=e.target.closest('[data-years]');if(b){years=Number(b.dataset.years);page=1;render();}};$('prev').onclick=()=>{page--;table();};$('next').onclick=()=>{page++;table();};$('download').onclick=()=>{const m=activeMetric(),blob=new Blob([M.csv(m,M.inRange(m.points,years),sources)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=sector.name+'-'+m.label+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};addEventListener('hashchange',()=>{if(snapshot)select();});

  try{

    snapshot=await D.json('data/industry/overview.json');sources=Object.fromEntries(snapshot.sources.map(s=>[s.id,s]));select();$('content').hidden=false;$('status').textContent='';$('snapshot-note').textContent='最近核对 '+(snapshot.checkedAt||'未记录')+' · 各指标以数据所属期间为准，页面生成时间不代表数据更新。';

    const results=await Promise.allSettled([D.json('data-manifest.json').then(m=>D.table(m.datasets.find(d=>d.id==='valuation').file)),D.json('data/research/recent.json')]);

    relatedLoaded=true;if(results[0].status==='fulfilled')pool=results[0].value;else companyError=true;
    if(results[1].status==='fulfilled')research=results[1].value.dbs.filter(d=>['views','minutes'].includes(d.id)).flatMap(d=>d.rows.map(r=>{const published=r['时间']||r['日期']||'';return {kind:d.id,title:r['标题']||'',published,date:published.slice(0,10),content:r['内容']||r['摘要']||'',sector:r['覆盖板块']||r['命中关键词']||'',company:r['相关标的']||'',url:D.link(r['原文链接']||r['下载链接']),file:r['文件名']||'',state:r['内容状态']||''};}));else researchError=true;related();

  }catch(error){$('content').hidden=true;$('status').innerHTML='行业数据暂时无法读取。<button class="portal-button" onclick="location.reload()">重新加载</button>';}

})();

