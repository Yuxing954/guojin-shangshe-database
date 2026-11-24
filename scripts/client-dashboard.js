(function(root,factory){
  'use strict';
  const model=factory(
    typeof module==='object'&&module.exports?require('./research-model.js'):root.ResearchModel,
    typeof module==='object'&&module.exports?require('./site-data.js'):root.SiteData
  );
  if(typeof module==='object'&&module.exports){module.exports=model;return;}
  root.ClientDashboardModel=model;
  const $=id=>document.getElementById(id),esc=model.escape;
  const params=new URLSearchParams(location.search);
  let selected=model.specs.some(s=>s.id===params.get('metric'))?params.get('metric'):'hotel';
  let windowSize=['12','24','52','all'].includes(params.get('window'))?params.get('window'):'24';
  let researchKind='views',research=[],researchUpdated='',companyManifest=null,daily=null;
  const series=new Map(),states={industry:'loading',travel:'loading',research:'loading',companies:'loading',daily:'loading'};
  const group=id=>id==='travel'?'travel':'industry';
  const format=(value,precision=2)=>Number.isFinite(value)?value.toLocaleString('zh-CN',{minimumFractionDigits:precision,maximumFractionDigits:precision}):'—';
  const safeHref=(value,fallback='data-notes.html')=>{
    try{const url=new URL(value,location.href);if(url.protocol==='https:'||url.protocol==='http:'&&url.origin===location.origin)return url.href;}catch(e){}
    return fallback;
  };
  const retry=(key,label='读取失败')=>'<span>'+esc(label)+'</span><button class="client-retry" type="button" data-retry="'+key+'">重试</button>';
  function save(){const p=new URLSearchParams(location.search);p.set('metric',selected);p.set('window',windowSize);history.replaceState(null,'',location.pathname+'?'+p);}
  function visiblePoints(metric){return windowSize==='all'?metric.points:metric.points.slice(-Number(windowSize));}
  function sourceLabel(metric,point){
    const sources=model.pointSources(metric,point),labels=[...new Set(sources.map(s=>s.publisher||s.organization||s.name).filter(Boolean))];
    const provider=[...new Set(sources.map(s=>s.provider).filter(p=>p&&p!=='原始披露'&&p!=='仓库历史数据'))];
    const name=metric.id==='dining'&&provider.some(p=>/Choice/i.test(p))?'Choice EDB':labels.join(' / ')||'来源记录';
    return name+(metric.id==='dutyfree'&&provider.some(p=>/Choice/i.test(p))?' · Choice转引':'');
  }
  function renderKpis(){
    $('client-kpis').innerHTML=model.specs.map(spec=>{
      const metric=series.get(spec.id),point=metric&&model.latest(metric),state=states[group(spec.id)];
      const change=point&&Number.isFinite(point.change)?(point.change>0?'+':'')+format(point.change,1)+'%':'—';
      const changeText=point?(point.changeLabel||'同比')+' '+change:'同比 —';
      const period=point?point.periodLabel:'期间 —';
      const basis=point?.basisLabel||metric?.scope||spec.basis;
      const source=point?'<button type="button" class="client-source-button" data-source="'+spec.id+'">来源 · '+esc(sourceLabel(metric,point))+' ↗</button>':'<div class="client-kpi-state">'+(state==='error'?retry(group(spec.id)):state==='ready'?'暂无可用数据':'正在读取…')+'</div>';
      return '<article class="card client-kpi" data-metric="'+spec.id+'" data-active="'+(selected===spec.id)+'"><div class="card-body"><div class="client-kpi-top"><span class="client-sector">'+spec.icon+esc(spec.sector)+'</span><span class="badge bg-secondary-lt">'+spec.frequency+'</span></div><button type="button" class="client-kpi-title" data-select-metric="'+spec.id+'" aria-pressed="'+(selected===spec.id)+'" aria-label="查看'+esc(spec.label)+'趋势">'+esc(spec.label)+'</button><div class="client-kpi-value">'+format(point?.value,metric?.precision??spec.precision)+'<small>'+esc(metric?.unit||spec.unit)+'</small></div><div class="client-kpi-change">'+esc(changeText)+'</div><div class="client-kpi-period">'+esc(period)+'<br>'+esc(basis)+'</div>'+source+'</div></article>';
    }).join('');
  }
  function renderTrend(){
    const metric=series.get(selected),host=$('client-trend'),ready=metric&&metric.points.length;
    $('client-metric').value=selected;$('client-window').value=windowSize;
    $('client-trend-export').disabled=!ready;$('client-trend-source').disabled=!ready;
    $('client-trend-open').href=metric?.href||model.specs.find(s=>s.id===selected).href;
    if(!ready){
      $('client-trend-name').textContent=model.specs.find(s=>s.id===selected).label;
      $('client-trend-period').textContent='';$('client-trend-count').textContent='';
      host.innerHTML='<div class="client-state" role="status">'+(states[group(selected)]==='error'?retry(group(selected)):states[group(selected)]==='ready'?'暂无可用历史数据':'正在读取趋势…')+'</div>';
      return;
    }
    const points=visiblePoints(metric);
    $('client-trend-name').textContent=metric.label+' · '+metric.unit;
    $('client-trend-period').textContent=points[0].periodLabel+' — '+points.at(-1).periodLabel;
    $('client-trend-count').textContent=points.length+'期 · '+metric.frequency;
    SiteCharts.drawPaired(host,points.map(p=>({period:p.periodLabel,value:p.value,change:p.change})),{
      name:metric.label,unit:metric.unit,mode:'value',valueStyle:metric.frequency==='周度'?'line':'bar',precision:metric.precision,colors:['#206bc4'],periodTickFormat:value=>model.axisLabel(ChartPeriod.format(value))
    });
  }
  function renderResearch(){
    document.querySelectorAll('[data-research-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.researchKind===researchKind)));
    $('client-research-open').href='research.html?kind='+researchKind;
    const list=$('client-research-list');
    if(states.research!=='ready'){
      list.innerHTML='<li class="client-state" role="status">'+(states.research==='error'?retry('research'):'正在读取研究…')+'</li>';return;
    }
    const rows=research.filter(row=>row.kind===researchKind).slice(0,6);
    list.innerHTML=rows.map(row=>'<li class="list-group-item"><a class="client-research-title" href="'+esc(ResearchModel.href(row))+'">'+esc(row.title)+'</a><div class="client-research-meta"><time datetime="'+esc(row.published.replace(' ','T'))+'">'+esc(ResearchModel.publicationTime(row.published))+'</time><span class="badge bg-secondary-lt">'+esc(row.kind==='views'?'观点':ResearchModel.labels[ResearchModel.format(row)])+'</span>'+(row.author?'<span>'+esc(row.author)+'</span>':'')+'</div></li>').join('')||'<li class="client-state">暂无匹配商社板块的记录</li>';
    $('client-research-asof').textContent=researchUpdated?'索引入库 '+researchUpdated.slice(0,10):'';
  }
  function renderDaily(){
    const copy=$('client-daily-copy'),link=$('client-daily-link');
    if(!daily){copy.innerHTML=states.daily==='error'?retry('daily','日报读取失败'):states.daily==='empty'?'暂无已发布日报':'正在读取日报…';link.hidden=true;return;}
    copy.innerHTML='<time datetime="'+esc(daily.date)+'">'+esc(daily.date)+'</time>'+esc(daily.headline||'行业日报');
    link.href='daily.html?date='+encodeURIComponent(daily.date);link.hidden=false;
  }
  function renderCompanies(){
    const host=$('client-company-links');
    if(!companyManifest){host.innerHTML='<div class="client-kpi-state">'+(states.companies==='error'?retry('companies'):'正在读取公司…')+'</div>';return;}
    host.innerHTML=companyManifest.companies.filter(c=>['jinjiang','btg','hworld','atour'].includes(c.id)).map(c=>'<a href="company-database.html?company='+encodeURIComponent(c.id)+'">'+(c.logo?'<img src="'+esc(safeHref(c.logo,''))+'" alt="" width="28" height="28">':'')+'<span>'+esc(c.name)+'<small>'+esc(c.ticker)+'</small></span></a>').join('');
  }
  function renderUpdates(){
    const rows=[];
    for(const spec of model.specs){const metric=series.get(spec.id),point=metric&&model.latest(metric);if(point)rows.push({label:spec.label,detail:'数据期间 · '+metric.frequency,date:point.periodLabel,href:metric.href});}
    if(companyManifest)rows.push({label:'四家酒店公司',detail:'数据整理 · '+(companyManifest.quarters?.at(-1)||''),date:companyManifest.updatedAt||'—',href:'company-database.html?peers=jinjiang,btg,hworld,atour'});
    if(researchUpdated)rows.push({label:'观点与纪要',detail:'索引入库',date:researchUpdated.slice(0,10),href:'research.html'});
    const failed=['industry','travel','companies','research'].filter(key=>states[key]==='error');
    $('client-updates').innerHTML=rows.map(row=>'<tr><td>'+esc(row.label)+'<small>'+esc(row.detail)+'</small></td><td>'+esc(row.date)+'</td><td><a href="'+esc(row.href)+'" aria-label="查看'+esc(row.label)+'">查看 ↗</a></td></tr>').join('')+failed.map(key=>'<tr><td colspan="3">'+retry(key,({industry:'行业',travel:'旅游',companies:'公司',research:'研究'})[key]+'记录读取失败')+'</td></tr>').join('')||'<tr><td colspan="3">正在读取数据期间…</td></tr>';
  }
  function renderData(){renderKpis();renderTrend();renderUpdates();}
  async function load(key){
    states[key]='loading';
    if(key==='industry'||key==='travel')renderData();
    if(key==='research')renderResearch();if(key==='daily')renderDaily();if(key==='companies')renderCompanies();
    try{
      if(key==='industry'){
        const payload=await SiteUI.request('data/industry/overview.json');
        const metrics=model.fromIndustry(payload);
        if(metrics.length!==3)throw Error('missing industry metrics');
        metrics.forEach(metric=>series.set(metric.id,metric));
      }else if(key==='travel'){
        const metric=model.fromTravel(await SiteUI.request('data/tourism/dashboard.json'));
        if(!metric.points.length)throw Error('missing travel periods');series.set(metric.id,metric);
      }else if(key==='research'){
        const payload=await SiteUI.request('data/research/recent-preview.json');
        if(!Array.isArray(payload.dbs))throw Error('missing research index');
        research=model.researchEntries(payload);researchUpdated=payload.updatedAt||'';
      }else if(key==='companies'){
        const payload=await SiteUI.request('data/companies/domestic-hotels.json');
        if(!Array.isArray(payload.companies))throw Error('missing companies');companyManifest=payload;
      }else if(key==='daily'){
        const index=await SiteUI.request('data/daily/index.json');
        const date=(index.dates||[]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1);
        if(!date){states.daily='empty';renderDaily();return;}
        const report=await SiteUI.request('data/daily/onepage/'+date+'.json');
        if(report.schemaVersion!==2||report.date!==date)throw Error('invalid daily');daily=report;
      }
      states[key]='ready';
    }catch(error){states[key]='error';}
    if(key==='industry'||key==='travel')renderData();
    if(key==='research')renderResearch();if(key==='daily')renderDaily();if(key==='companies')renderCompanies();
    renderUpdates();
  }
  function showSource(id,all=false){
    const metric=series.get(id);if(!metric)return;
    const points=all?visiblePoints(metric):[model.latest(metric)].filter(Boolean);
    const sources=[...new Map(points.flatMap(point=>model.pointSources(metric,point)).map(source=>[source.id,source])).values()];
    $('client-source-title').textContent=metric.label+' · 来源';
    $('client-source-content').innerHTML='<p>'+esc(points[0]?.periodLabel||'')+(points.length>1?' — '+esc(points.at(-1).periodLabel):'')+' · '+esc(metric.unit)+'</p>'+[...new Set(points.map(p=>p.basisLabel||metric.scope).filter(Boolean))].map(text=>'<p>'+esc(text)+'</p>').join('')+sources.map(source=>{
      const href=source.url||(/^data\//.test(source.file||'')?source.file:'data-notes.html#'+metric.sectorId);
      return '<div class="client-source-record"><strong>'+esc(source.name||source.publisher||'原始来源')+'</strong>'+(source.provider?'<p>'+esc(source.provider)+'</p>':'')+(source.publishedAt?'<p>发布 '+esc(source.publishedAt)+'</p>':'')+(source.file?'<p>'+esc(source.file)+'</p>':'')+'<a href="'+esc(safeHref(href))+'" target="_blank" rel="noopener">查看来源 ↗</a></div>';
    }).join('')+'<a href="data-notes.html#'+esc(metric.sectorId)+'">数据口径 ↗</a>';
    $('client-source-dialog').showModal();
  }
  function selectMetric(id){selected=id;save();renderKpis();renderTrend();}
  document.addEventListener('click',event=>{
    const retryButton=event.target.closest('[data-retry]');if(retryButton){load(retryButton.dataset.retry);return;}
    const metricButton=event.target.closest('[data-select-metric]');if(metricButton){selectMetric(metricButton.dataset.selectMetric);return;}
    const sourceButton=event.target.closest('[data-source]');if(sourceButton){showSource(sourceButton.dataset.source);return;}
    const researchButton=event.target.closest('[data-research-kind]');if(researchButton){researchKind=researchButton.dataset.researchKind;renderResearch();}
  });
  $('client-metric').addEventListener('change',event=>selectMetric(event.target.value));
  $('client-window').addEventListener('change',event=>{windowSize=event.target.value;save();renderTrend();});
  $('client-trend-source').addEventListener('click',()=>showSource(selected,true));
  $('client-trend-export').addEventListener('click',()=>{
    const metric=series.get(selected);if(!metric)return;
    const points=visiblePoints(metric),url=URL.createObjectURL(new Blob([model.csv(metric,points)],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=metric.label+'_'+points[0].period+'_'+points.at(-1).period+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  renderData();renderResearch();renderCompanies();renderDaily();
  Object.keys(states).forEach(key=>load(key));
})(typeof globalThis!=='undefined'?globalThis:this,function(ResearchModel,SiteData){
  'use strict';
  const icon=path=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';
  const specs=[
    {id:'hotel',metricId:'hotel_revpar',label:'全国酒店 RevPAR',sector:'酒店',frequency:'周度',unit:'元',precision:2,basis:'全国 · 全部档次',href:'industry.html#hotel',icon:icon('M4 21V5h10v16M14 10h6v11M3 21h18M7 9h4M7 13h4M7 17h4')},
    {id:'dutyfree',metricId:'dutyfree_sales',label:'离岛免税购物金额',sector:'免税',frequency:'月度',unit:'亿元',precision:2,basis:'海南 · 当月',href:'industry.html#dutyfree',icon:icon('M5 8h14l1 13H4L5 8ZM9 8V6a3 3 0 0 1 6 0v2M8 13h8')},
    {id:'dining',metricId:'dining_revenue',label:'全国餐饮收入',sector:'餐饮',frequency:'月度',unit:'亿元',precision:0,basis:'全国 · 当月',href:'national-retail.html',icon:icon('M5 3v6a3 3 0 0 0 6 0V3M8 3v18M18 3v18M18 3c-5 4-4 10 0 10')},
    {id:'travel',label:'国内出游人次',sector:'旅游',frequency:'季度',unit:'亿人次',precision:2,basis:'全国 · 单季',href:'industry.html#travel',icon:icon('M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18')}
  ];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sourceMap=payload=>Object.fromEntries((payload.sources||[]).map(source=>[source.id,source]));
  const latest=metric=>metric.points.filter(point=>Number.isFinite(point.value)).at(-1)||null;
  const axisLabel=value=>String(value??'').replace(/^(\d{4}|\d{2})W(\d{1,2})(?:\s*[·|].*)?$/i,(_,year,week)=>year.slice(-2)+'W'+week.padStart(2,'0'));
  const pointSources=(metric,point)=>(point?.sourceIds||[point?.sourceId]).map(id=>metric.sources[id]).filter(Boolean);
  function fromIndustry(payload){
    const sources=sourceMap(payload),metrics=(payload.sectors||[]).flatMap(sector=>sector.metrics||[]);
    return specs.filter(spec=>spec.metricId).flatMap(spec=>{
      const metric=metrics.find(metric=>metric.id===spec.metricId);if(!metric)return[];
      const points=(metric.points||[]).filter(point=>point.basis!=='combined').map(point=>({...point,basisLabel:spec.basis})).sort((a,b)=>(a.endDate||a.period).localeCompare(b.endDate||b.period));
      const href=spec.id==='dining'&&points.length?'national-retail.html?month='+encodeURIComponent(points.at(-1).period)+'&basis=month':spec.href;
      return [{...spec,href,sectorId:spec.id,unit:metric.unit,precision:metric.precision??spec.precision,scope:spec.basis,points,sources}];
    });
  }
  function fromTravel(payload){
    const spec=specs.find(spec=>spec.id==='travel'),sources=sourceMap(payload);
    const points=(payload.domestic?.quarters||[]).filter(row=>row.scope==='quarter').map(row=>{
      const quarter=Number(row.quarter),year=Number(row.year),endMonth=quarter*3;
      return {period:row.period,periodLabel:row.period,startDate:year+'-'+String(endMonth-2).padStart(2,'0')+'-01',endDate:new Date(Date.UTC(year,endMonth,0)).toISOString().slice(0,10),value:row.trips,change:row.tripsYoY,changeLabel:/计算|测算/.test(row.tripsYoYBasis||'')?'同比（计算）':'同比',basis:'quarter',basisLabel:'单季 · '+(row.tripsBasis||'口径待核验'),sourceId:row.sourceId,sourceIds:row.tripsSourceIds||[row.sourceId],changeBasis:row.tripsYoYBasis||'',comparisonSourceIds:row.comparisonTripsSourceIds||[]};
    }).sort((a,b)=>a.endDate.localeCompare(b.endDate));
    return {...spec,sectorId:'travel',scope:spec.basis,points,sources};
  }
  function link(value){if(typeof value==='string'&&value.startsWith('{')){try{value=JSON.parse(value);}catch(e){return'';}}return typeof value==='object'&&value?value.link||'':String(value||'');}
  function researchEntries(payload){
    const records=(payload.dbs||[]).filter(db=>['views','minutes'].includes(db.id)).flatMap(db=>(db.rows||[]).map(row=>{
      const content=ResearchModel.plainContent(row['内容']||row['摘要']||''),original=ResearchModel.plainContent(row['标题']||'');
      const published=String(row['原始发布时间']||row['时间']||row['日期']||'');
      return {kind:db.id,title:db.id==='views'?ResearchModel.recoverTitle(original,content):original,published,date:published.slice(0,10),content,author:row['作者']||'',sector:row['覆盖板块']||'',company:row['相关标的']||'',url:link(row['原文链接']||row['下载链接']),file:row['文件名']||'',state:row['内容状态']||''};
    })).filter(row=>row.title&&row.date&&ResearchModel.sectorIds(row).some(id=>id!=='other'));
    const unique=new Map();for(const row of records){const key=row.kind+'|'+(ResearchModel.topic(row)||row.published+'|'+row.title)+'|'+row.file;if(!unique.has(key))unique.set(key,row);}
    return [...unique.values()].sort((a,b)=>b.published.localeCompare(a.published));
  }
  function csv(metric,points){
    const headers=['指标','数据期间','期间开始','期间结束','统计口径','数值','单位','同比（%）','同比口径','来源','来源URL或文件','发布日期','同比基期来源'];
    const rows=points.map(point=>{
      const sources=pointSources(metric,point),comparison=(point.comparisonSourceIds||(point.changeCalculation?.priorSourceId?[point.changeCalculation.priorSourceId]:[])).map(id=>metric.sources[id]).filter(Boolean);
      return [metric.label,point.periodLabel,point.startDate,point.endDate,point.basisLabel||metric.scope,point.value,metric.unit,point.change,point.changeBasis||point.changeLabel,sources.map(s=>s.name).join(' | '),sources.map(s=>s.url||s.file||'').join(' | '),sources.map(s=>s.publishedAt||'').join(' | '),comparison.map(s=>s.name).join(' | ')];
    });
    return SiteData.encodeCsv(rows.map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]]))),headers);
  }
  return {specs,escape,latest,axisLabel,pointSources,fromIndustry,fromTravel,researchEntries,csv};
});
