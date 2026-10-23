(function(){
 'use strict';
 const $=id=>document.getElementById(id),esc=v=>SiteData.esc(String(v??'')),names=['RevPAR','ADR','OCC'];
 const comparison=()=>document.body.dataset.view==='comparison',actions=document.querySelector('.oh-actions');
 const params=new URLSearchParams(location.search),plots=new WeakMap();let metric=Math.max(0,['revpar','adr','occ'].indexOf(params.get('cwMetric')||params.get('peerMetric'))),advanced=false,menu,lastContent;
 function exportMenu(){
  if(!actions)return;
  actions.classList.add('cw-actions');
  const source=actions.querySelector('a[href*="data-notes"]');if(source)source.classList.add('cw-source-link');
  if(!menu){menu=document.createElement('details');menu.className='cw-export';menu.innerHTML='<summary>导出数据</summary><div class="cw-export-items"></div>';actions.append(menu);const all=actions.querySelector('#oh-export-all');if(all)menu.lastChild.append(all);}
  const current=$('oh-toolbar')?.querySelector('#oh-export-view');
  menu.querySelector('#oh-export-view')?.remove();if(current){current.textContent='导出当前筛选';menu.lastChild.prepend(current);}
  menu.hidden=!menu.lastChild.children.length;menu.open=false;
  mountActions();
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
  box.innerHTML='<div class="oh-block-head"><h3>'+esc(row.period)+' · '+names[metric]+'</h3><small>'+esc(($('oh-profile')?.dataset.cwContext||'')+' · '+cfg.opt.unit)+'</small></div><div class="oh-scroll"><table class="oh-table"><thead><tr><th>公司 / 口径</th><th>'+names[metric]+' · '+esc(cfg.opt.unit)+'</th><th>同比 · '+esc(cfg.opt.changeUnit)+'</th></tr></thead><tbody>'+row.values.map((v,i)=>'<tr><td>'+esc(v.name)+(index===cfg.rows.length-1&&document.querySelectorAll('.cw-full-summary tbody tr')[i]?.querySelector('td:first-child small')?'<small>'+esc(document.querySelectorAll('.cw-full-summary tbody tr')[i].querySelector('td:first-child small').textContent)+'</small>':'')+'</td><td>'+f(v.value,cfg.opt.precision)+'</td><td>'+f(v.change,1)+'</td></tr>').join('')+'</tbody></table></div>';
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
   const reading=document.createElement('article');reading.id='cw-peer-reading';reading.className='oh-block';content.append(reading);const full=content.querySelector('.cw-full-summary');if(full)content.append(full);
  }else{
   content.querySelectorAll('.oh-kpi').forEach((card,i)=>{const label=card.querySelector(':scope>span');if(!label||!names.includes(label.textContent))return;const button=document.createElement('button');button.type='button';button.className='cw-metric-select';button.dataset.cwMetric=i;button.textContent=label.textContent;button.setAttribute('aria-label',label.textContent+'趋势');label.replaceWith(button);card.classList.add('cw-metric-card');});
  }
  content.querySelectorAll('[data-cw-metric]').forEach(b=>b.onclick=()=>selectMetric(Number(b.dataset.cwMetric)));
  selectMetric(metric);
 }
 function mountActions(){
  const profile=$('oh-profile');if(!profile)return;
  if(comparison()){
   const context=[...profile.querySelectorAll('p,.oh-tag')].map(e=>e.textContent).join(' · ');if(context)profile.dataset.cwContext=context;
   profile.replaceChildren();profile.hidden=true;
   const toolbar=$('oh-toolbar'),target=toolbar?.querySelector('.dh-tools,.oh-peer-filters')||toolbar;if(actions&&target)target.append(actions);
  }else{profile.hidden=false;if(actions)profile.append(actions);}
 }
 function enhance(){const content=$('oh-content');if(!content||content.firstElementChild===lastContent)return;exportMenu();filters();metrics();lastContent=content.firstElementChild;}
 function begin(){menu?.querySelector('#oh-export-view')?.remove();}
 function companyButton(c){return '<button type="button" class="oh-company" data-company="'+esc(c.id)+'" aria-pressed="false"><span class="cw-company-icon">'+CompanyLogos[c.id]+'</span><span><strong>'+esc(c.name)+'</strong><small>'+esc(c.ticker)+'</small></span><span class="cw-check" aria-hidden="true">✓</span></button>';}
 function clearSelection(){begin();if(menu)menu.open=false;$('oh-evidence')?.close();$('oh-profile')?.replaceChildren();$('oh-toolbar')?.replaceChildren();$('oh-content')?.replaceChildren();$('oh-workspace').hidden=true;$('oh-tabs').hidden=true;lastContent=null;exportMenu();if(actions)$('oh-companies').after(actions);}
 window.CompanyWorkspace={clearSelection,enhance,plot,mountActions,begin,companyButton};
})();
