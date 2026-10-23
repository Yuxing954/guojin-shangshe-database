(function(){
 'use strict';
 const $=id=>document.getElementById(id),esc=SiteData.esc,M=CruiseAnalysisModel,params=new URLSearchParams(location.hash.slice(1));
 let model,view=['audience','operators'].includes(params.get('view'))?params.get('view'):'overview',period='',company=6,count='12',season='passengers',resize;const labelState=new Map();
 const fmt=(v,d=2)=>M.finite(v)?Number(v).toLocaleString('zh-CN',{maximumFractionDigits:d}):'—',signed=(v,u='百分点')=>M.finite(v)?(v>0?'+':'')+fmt(v)+' '+u:'—';
 const a=(url,label)=>url?'<a href="'+esc(url)+'" target="_blank" rel="noopener">'+label+'</a>':'—';
 const card=(title,value,unit,delta)=>'<article class="cruise-kpi site-kpi"><h2>'+title+'</h2><strong>'+fmt(value)+'<small>'+unit+'</small></strong><p>'+delta+'</p></article>';
 const panel=(title,id,extra='')=>'<article class="cruise-panel board-panel" data-chart-values-default><div class="ca-panel-head"><h2>'+title+'</h2>'+extra+'</div><div class="ca-chart" id="'+id+'"></div></article>';
 function controls(){return '<div class="ca-controls"><label>分析月份<select id="ca-period">'+model.periods.map(p=>'<option'+(p===period?' selected':'')+'>'+p+'</option>').join('')+'</select></label>'+(view==='operators'?'<label>船公司<select id="ca-company">'+model.details.companyLabels.map((n,i)=>'<option value="'+i+'"'+(i===company?' selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label>':'')+'<label>趋势范围<select id="ca-window">'+[['12','近12个月'],['24','近24个月'],['all','全部已收录']].map(([v,n])=>'<option value="'+v+'"'+(v===count?' selected':'')+'>'+n+'</option>').join('')+'</select></label><button id="ca-export">导出分析 CSV</button><span class="ca-sources">'+a(model.sourceById.get(model.at(period).detail?.sourceId)?.url,'当月官方原文')+' · <a href="data-notes.html#tourism" target="_blank" rel="noopener">口径</a></span></div>';}
 function header(){if(view==='overview')return;$('asof').textContent=period+' · '+(view==='audience'?'客群与季节':'公司竞争')+' · 结构：官方月报 / 行业总量：原披露及转引';}
 function applyView(save=true){
  document.querySelectorAll('[data-cruise-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cruiseView===view)));
  $('cruise-overview').hidden=view!=='overview';$('cruise-analysis').hidden=view==='overview';$('export').hidden=view!=='overview';$('runtime-csv').hidden=view!=='overview';
  if(save){const p=new URLSearchParams(location.hash.slice(1));p.set('view',view);history.replaceState(null,'',SiteUI.contextURL('#'+p));}
  if(view!=='overview'){render();header();}else dispatchEvent(new Event('resize'));
 }
 function chart(id,rows,options){SiteCharts.drawPaired($(id),rows,{width:Math.max(280,$(id).clientWidth),precision:2,changePrecision:2,...options});}
 function audience(){
  const x=model.audience(period);$('ca-kpis').innerHTML=card('60岁以上国内游客',x.senior,'%', '较上年同月 '+signed(x.seniorDelta))+card('18岁以下国内游客',x.minor,'%', '较上年同月 '+signed(x.minorDelta))+card('境外游客占比',x.foreignShare,'%', '较上年同月 '+signed(x.foreignShareDelta))+card('境外客运量',x.foreign,'万人','同比（测算） '+signed(x.foreignYoY,'%'));
  const s=model.seasons(period,season),unit=season==='passengers'?'万人':'%';
  $('ca-panels').innerHTML=panel('近三年同月对比','ca-season','<label>指标<select id="ca-season-select">'+[['passengers','行业客运量'],['load','床位载客率'],['foreignShare','境外游客占比'],['senior','60岁以上国内游客'],['minor','18岁以下国内游客']].map(([v,n])=>'<option value="'+v+'"'+(v===season?' selected':'')+'>'+n+'</option>').join('')+'</select></label>')+'<article class="cruise-panel ca-age-panel"><h2>同月国内游客年龄结构（%）</h2><div id="ca-age-bars"></div><div class="ca-legend">'+model.details.ageLabels.map((n,i)=>'<span><i style="background:'+colors[i]+'"></i>'+esc(n)+'</span>').join('')+'</div><div class="cruise-table-wrap"><table id="ca-age-table"></table></div></article>'+panel('境外客流与占比','ca-foreign')+'<article class="cruise-panel"><h2>国内与境外客流（万人）</h2><div class="cruise-table-wrap"><table id="ca-origin-table"></table></div></article>';
  chart('ca-season',s.rows,{name:'同月对比',unit,mode:'value',valueStyle:'line',legend:'series'});
  const comparison=model.ageComparison(period);
  $('ca-age-bars').innerHTML=comparison.map(r=>'<div class="ca-age-row"><b>'+r.period+'</b><div class="ca-age-stack">'+(r.ages.every(M.finite)?r.ages.map((v,i)=>'<span style="flex:'+v+';background:'+colors[i]+'" title="'+esc(model.details.ageLabels[i]+' '+fmt(v)+'%')+'">'+(v>=7?fmt(v,1)+'%':'')+'</span>').join(''):'<span class="ca-empty">未披露单月年龄结构</span>')+'</div></div>').join('');
  $('ca-age-table').innerHTML='<thead><tr><th>年龄</th>'+comparison.map(r=>'<th>'+r.period+'</th>').join('')+'</tr></thead><tbody>'+model.details.ageLabels.map((n,i)=>'<tr><th>'+esc(n)+'</th>'+comparison.map(r=>'<td>'+fmt(r.ages[i])+'</td>').join('')+'</tr>').join('')+'<tr><th>来源</th>'+comparison.map(r=>'<td>'+a(model.sourceById.get(r.sourceId)?.url,'原文')+' · '+a(r.evidence,'原图')+'</td>').join('')+'</tr></tbody>';
  const periods=model.windowPeriods(period,count);chart('ca-foreign',periods.map(p=>({period:p,value:model.audience(p).foreign,change:model.audience(p).foreignShare})),{name:'境外客运量',unit:'万人',changeLabel:'境外占比',changeUnit:'%',mode:'combo'});
  $('ca-origin-table').innerHTML='<thead><tr>'+['月份','国内','境外','境外同比（测算，%）','境外占比（%）','来源'].map(n=>'<th>'+n+'</th>').join('')+'</tr></thead><tbody>'+[...periods].reverse().map(p=>{const r=model.audience(p);return '<tr><td>'+p+'</td><td>'+fmt(r.domestic,4)+'</td><td>'+fmt(r.foreign,4)+'</td><td>'+fmt(r.foreignYoY)+'</td><td>'+fmt(r.foreignShare)+'</td><td>'+a(model.sourceById.get(model.at(p).detail?.sourceId)?.url,'官方原文')+'</td></tr>';}).join('')+'</tbody>';
  $('ca-season-select').onchange=e=>{season=e.target.value;render();};
 }
 const colors=SiteUI.colors;
 function operators(){
  const x=model.company(period,company);$('ca-kpis').innerHTML=card('所选公司客运量',x.value,'万人','同比（测算） '+signed(x.yoy,'%'))+card('行业份额'+(x.shareStatus==='测算'?'（测算）':''),x.share,'%', '较上年同月 '+signed(x.shareDelta))+card('较行业增速',x.excess,'百分点','行业披露同比 '+signed(x.industryYoY,'%'))+'<article class="cruise-kpi site-kpi"><h2>湖北七公司样本排名</h2><strong>'+fmt(x.rank,0)+'<small>/ '+x.sampleCount+'家已披露</small></strong><p>按当月客运量</p></article>';
  $('ca-panels').innerHTML='<article class="cruise-panel"><h2>湖北籍省际游轮客运量（万人）</h2><div id="ca-ranking"></div></article>'+panel('所选公司客流与行业份额','ca-company-history')+panel('公司与行业客运量同比（%）','ca-company-growth')+'<article class="cruise-panel ca-wide"><h2>公司横向对比 · '+period+'</h2><div class="cruise-table-wrap"><table id="ca-company-table"></table></div></article>';
  const ranking=model.ranking(period),max=Math.max(.01,...ranking.filter(r=>M.finite(r.value)).map(r=>r.value));
  $('ca-ranking').innerHTML=ranking.map(r=>'<button class="ca-rank-row" data-company="'+r.index+'" aria-pressed="'+(r.index===company)+'"><span>'+esc(r.name)+'</span><span class="ca-rank-track">'+(M.finite(r.value)?'<i style="width:'+Math.max(0,r.value/max*100)+'%"></i>':'')+'</span><b>'+fmt(r.value,4)+'</b><small>'+signed(r.yoy,'%')+'</small></button>').join('');
  const periods=model.windowPeriods(period,count);
  chart('ca-company-history',periods.map(p=>{const r=model.company(p,company);return {period:p,value:r.value,change:r.share};}),{name:x.name,unit:'万人',changeLabel:'行业份额',changeUnit:'%',mode:'combo'});
  chart('ca-company-growth',periods.map(p=>{const r=model.company(p,company);return {period:p,values:[{name:x.name+'（测算）',value:r.yoy},{name:'行业披露',value:r.industryYoY}]};}),{name:'客运量同比',unit:'%',mode:'value',valueStyle:'line',legend:'series'});
  $('ca-company-growth').closest('article').classList.add('ca-wide');
  $('ca-company-table').innerHTML='<thead><tr>'+['湖北籍省际游轮企业','本月（万人）','上年同月','同比（测算，%）','行业份额（%）','份额同比（百分点）','较行业增速（百分点）','本期 / 基期来源'].map(n=>'<th>'+n+'</th>').join('')+'</tr></thead><tbody>'+ranking.map(r=>'<tr'+(r.index===company?' class="cruise-focus"':'')+'><th>'+esc(r.name)+'</th>'+[r.value,r.prior,r.yoy].map((v,i)=>'<td>'+fmt(v,i===2?2:4)+'</td>').join('')+'<td>'+fmt(r.share)+'<small class="ca-tag">'+r.shareStatus+'</small></td><td>'+fmt(r.shareDelta)+'</td><td>'+fmt(r.excess)+'</td><td>'+a(model.sourceById.get(r.sourceId)?.url,'本期')+' / '+a(model.sourceById.get(r.priorSourceId)?.url,'基期')+'</td></tr>').join('')+'</tbody>';
  $('ca-ranking').onclick=e=>{const b=e.target.closest('[data-company]');if(b){company=+b.dataset.company;render();}};
 }
 function render(){
  if(view==='overview')return;if(!model){$('cruise-analysis').innerHTML='<div class="cruise-panel" role="status">正在读取分析数据…</div>';return;}
  document.querySelectorAll('#ca-panels .ca-chart').forEach(c=>{const input=c.closest('article').querySelector('[data-value-kind="value"]');if(input)labelState.set(c.id,input.checked);});
  $('cruise-analysis').innerHTML=controls()+'<div id="ca-kpis" class="cruise-kpis ca-kpis"></div><div id="ca-panels" class="ca-panels"></div>';
  if(view==='audience')audience();else operators();header();
  document.querySelectorAll('#ca-panels .ca-chart').forEach(c=>{const input=c.closest('article').querySelector('[data-value-kind="value"]');if(input&&labelState.has(c.id)&&input.checked!==labelState.get(c.id)){input.checked=labelState.get(c.id);input.dispatchEvent(new Event('change',{bubbles:true}));}});
  $('ca-period').onchange=e=>{period=e.target.value;render();};$('ca-window').onchange=e=>{count=e.target.value;render();};if($('ca-company'))$('ca-company').onchange=e=>{company=+e.target.value;render();};
  $('ca-export').onclick=()=>{const u=URL.createObjectURL(new Blob([model.csv(period,view,company,count)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=u;link.download='三峡游轮_'+view+'_'+period+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 }
 async function load(){try{const [core,details]=await Promise.all([SiteData.json('data/tourism/three-gorges-cruises.json'),SiteData.json('data/tourism/three-gorges-details.json')]);model=M.create(core,details);if(!model.periods.length)throw Error('empty');period=model.periods.at(-1);if(view!=='overview')render();}catch{if(view!=='overview'){$('cruise-analysis').innerHTML='<div class="cruise-panel" role="alert">分析数据暂时无法读取。<button id="ca-retry">重试</button></div>';$('ca-retry').onclick=load;}}}
 document.querySelectorAll('[data-cruise-view]').forEach(b=>b.onclick=()=>{view=b.dataset.cruiseView;applyView();if(!model)load();});
 addEventListener('hashchange',()=>{const v=new URLSearchParams(location.hash.slice(1)).get('view');view=['audience','operators'].includes(v)?v:'overview';applyView(false);});
 addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>{if(model&&view!=='overview')render();},200);});
 window.CruiseAnalysis={active:()=>view!=='overview'};applyView(false);load();
})();

