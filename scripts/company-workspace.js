(function(){
 'use strict';
 const $=id=>document.getElementById(id),esc=v=>SiteData.esc(String(v??'')),names=['RevPAR','ADR','OCC'];
 const comparison=()=>document.body.dataset.view==='comparison',actions=document.querySelector('.oh-actions');
 const params=new URLSearchParams(location.search),plots=new WeakMap();let metric=Math.max(0,['revpar','adr','occ'].indexOf(params.get('cwMetric')||params.get('peerMetric'))),advanced=false,menu,lastContent;
 function exportMenu(){
  if(!actions)return;
  actions.classList.add('cw-actions');
  const source=actions.querySelector('a[href*="data-notes"]');if(source)source.classList.add('cw-source-link');
  if(!menu){menu=document.createElement('details');menu.className='cw-export';menu.innerHTML='<summary>导出数据</summary><div class="cw-export-items"></div>';actions.append(menu);const all=$('oh-export-all');if(all)menu.lastChild.append(all);}
  const current=$('oh-toolbar')?.querySelector('#oh-export-view');
  menu.querySelector('#oh-export-view')?.remove();if(current){current.textContent='导出当前筛选';menu.lastChild.prepend(current);}
  menu.hidden=!menu.lastChild.children.length;menu.open=false;
  $('oh-profile')?.append(actions);
 }
 document.addEventListener('click',e=>{if(menu&&!menu.contains(e.target))menu.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.open){menu.open=false;menu.querySelector('summary').focus();}});
 function filters(){
  const toolbar=$('oh-toolbar');if(!toolbar)return;
  let more=toolbar.querySelector('#dh-advanced');
  const region=toolbar.querySelector('#oh-region,#oh-peer-region');
  if(!more&&region){more=document.createElement('details');more.className='dh-advanced';more.id='cw-advanced';more.open=advanced;more.innerHTML='<summary>更多筛选</summary><div class="dh-filter-grid"></div>';more.addEventListener('toggle',()=>advanced=more.open);toolbar.append(more);more.lastChild.append(region.closest('label'));}
  toolbar.querySelector('.cw-filter-tags')?.remove();
  if(more){const tags=document.createElement('div');tags.className='cw-filter-tags';tags.setAttribute('aria-label','已选筛选条件');
   const ids=['oh-from','oh-period','oh-region','oh-peer-region','oh-category','oh-operation','oh-currency'];
   tags.innerHTML=ids.map(id=>$(id)).filter(e=>e&&more.contains(e)).map(e=>'<span>'+esc(e.selectedOptions[0]?.textContent)+'</span>').join('');more.before(tags);
  }
 }
 function panel(host,index){
  const article=host.closest('[data-cw-plot]');if(!host.isConnected||!$('oh-content')?.contains(host)||!article||article.hidden||Number(article.dataset.cwPlot)!==metric)return;
  const cfg=plots.get(host),box=$('cw-peer-reading');if(!cfg||!box)return;
  const row=cfg.rows[index]||cfg.rows.at(-1);if(!row)return;
  const f=(v,p)=>Number.isFinite(v)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:p}).format(v):'—';
  box.innerHTML='<div class="oh-block-head"><h3>'+esc(row.period)+' · '+names[metric]+'</h3><small>'+esc([...($('oh-profile')?.querySelectorAll('p,.oh-tag')||[])].map(e=>e.textContent).join(' · ')+' · '+cfg.opt.unit)+'</small></div><div class="oh-scroll"><table class="oh-table"><thead><tr><th>公司 / 口径</th><th>'+names[metric]+' · '+esc(cfg.opt.unit)+'</th><th>同比 · '+esc(cfg.opt.changeUnit)+'</th></tr></thead><tbody>'+row.values.map((v,i)=>'<tr><td>'+esc(v.name)+(index===cfg.rows.length-1&&document.querySelectorAll('.cw-full-summary tbody tr')[i]?.querySelector('td:first-child small')?'<small>'+esc(document.querySelectorAll('.cw-full-summary tbody tr')[i].querySelector('td:first-child small').textContent)+'</small>':'')+'</td><td>'+f(v.value,cfg.opt.precision)+'</td><td>'+f(v.change,1)+'</td></tr>').join('')+'</tbody></table></div>';
 }
 function connect(host,result){
  if(!comparison())return;
  SiteCharts.attach(host,result.points,{onSelect:i=>panel(host,i),onClear:()=>panel(host,plots.get(host).rows.length-1)});
 }
 function plot(host,rows,opt){
  plots.get(host)?.observer?.disconnect();
  const cfg={rows,opt};plots.set(host,cfg);
  const result=SiteCharts.drawPaired(host,rows,opt);connect(host,result);
  if(comparison()&&typeof ResizeObserver!=='undefined'){
   let width=host.clientWidth;cfg.observer=new ResizeObserver(()=>{if(host.clientWidth&&host.clientWidth!==width){width=host.clientWidth;requestAnimationFrame(()=>{if(host.isConnected){const fresh=SiteCharts.paired(rows,{...opt,width:host.clientWidth});connect(host,fresh);}});}});cfg.observer.observe(host);
  }return result;
 }
 function selectMetric(i){
  metric=i;const url=new URL(location.href);url.searchParams.set('cwMetric',['revpar','adr','occ'][i]);history.replaceState(null,'',url);
  document.querySelectorAll('[data-cw-metric]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.cwMetric)===i)));
  document.querySelectorAll('.oh-kpi').forEach(c=>c.classList.toggle('cw-selected',Number(c.querySelector('[data-cw-metric]')?.dataset.cwMetric)===i));
  document.querySelectorAll('[data-cw-plot]').forEach(a=>{a.hidden=Number(a.dataset.cwPlot)!==i;if(!a.hidden){const host=a.querySelector('.oh-plot'),cfg=plots.get(host);if(cfg){plot(host,cfg.rows,cfg.opt);panel(host,cfg.rows.length-1);}}});
 }
 function metrics(){
  const content=$('oh-content'),hosts=[...content.querySelectorAll('.oh-plot')].filter(h=>/^(dh-chart-|oh-op-plot-|oh-peer-plot-)/.test(h.id));if(!hosts.length)return;
  const available=[];hosts.forEach(h=>{const i=Number(h.id.match(/(\d+)$/)[1]);available.push(i);h.closest('article').dataset.cwPlot=i;});
  if(!available.includes(metric))metric=available[0];
  content.querySelector('.dh-charts')?.classList.add('cw-one-chart');
  if(comparison()){
   const tabs=document.createElement('div');tabs.className='cw-metric-tabs';tabs.setAttribute('aria-label','对比指标');
   tabs.innerHTML=available.map(i=>'<button type="button" data-cw-metric="'+i+'">'+names[i]+'</button>').join('');content.prepend(tabs);
   const original=content.querySelector('article:not([data-cw-plot])');
   if(original){const details=document.createElement('details');details.className='oh-history cw-full-summary';details.innerHTML='<summary>完整指标与来源</summary>';original.before(details);details.append(original);}
   const reading=document.createElement('article');reading.id='cw-peer-reading';reading.className='oh-block';tabs.after(reading);
  }else{
   content.querySelectorAll('.oh-kpi').forEach((card,i)=>{const label=card.querySelector(':scope>span');if(!label||!names.includes(label.textContent))return;const button=document.createElement('button');button.type='button';button.className='cw-metric-select';button.dataset.cwMetric=i;button.textContent=label.textContent;button.setAttribute('aria-label',label.textContent+'趋势');label.replaceWith(button);card.classList.add('cw-metric-card');});
  }
  content.querySelectorAll('[data-cw-metric]').forEach(b=>b.onclick=()=>selectMetric(Number(b.dataset.cwMetric)));
  selectMetric(metric);
 }
 function mountActions(){if(actions)$('oh-profile')?.append(actions);}
 function enhance(){const content=$('oh-content');if(!content||content.firstElementChild===lastContent)return;exportMenu();filters();metrics();lastContent=content.firstElementChild;}
 function begin(){menu?.querySelector('#oh-export-view')?.remove();}
 const iconPaths={
  jinjiang:'M4 21V8l8-5 8 5v13M3 21h18M8 9h8M8 13h2m4 0h2M10 21v-5h4v5',
  btg:'M3 21h18M5 21V9h14v12M3 9l9-6 9 6M8 12v4m8-4v4M10 21v-5h4v5',
  hworld:'M3 21h18M5 21V7h6v14M11 21V3h7v18M7 10h2m-2 4h2m4-8h3m-3 4h3m-3 4h3M14 21v-4',
  atour:'M4 21h16M6 21V10h12v11M4 10l8-4 8 4M9 13h1m4 0h1M10 21v-5h4v5M12 6V3m0 2c2-2 4-2 5-1',
  marriott:'M3 21h18M5 21V4h5v17M14 21V4h5v17M10 9h4m-4 5h4M7 7h1m-1 4h1m8-4h1m-1 4h1',
  hyatt:'M4 21h16M6 21V9a6 6 0 0 1 12 0v12M9 21V10a3 3 0 0 1 6 0v11M9 14h6',
  ihg:'M4 21h16M6 21V12h12v9M9 21v-5h6v5M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8M8 6h8M12 2c-2 2-2 6 0 8 2-2 2-6 0-8',
  hilton:'M3 21h18M5 21V4h4v17M15 21V4h4v17M9 10h6m-6 4h6M6 7h2m8 0h2'
 };
 function companyButton(c){return '<button type="button" class="oh-company" data-company="'+esc(c.id)+'" aria-pressed="false"><span class="cw-company-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(iconPaths[c.id]||iconPaths.hworld)+'"/></svg></span><span><strong>'+esc(c.name)+'</strong><small>'+esc(c.ticker)+'</small></span><span class="cw-check" aria-hidden="true">✓</span></button>';}
 window.CompanyWorkspace={enhance,plot,mountActions,begin,companyButton};
})();
