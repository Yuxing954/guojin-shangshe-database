(async function(){
 'use strict';
 const D=SiteData,M=ResourceModel,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),size=20;
 let items=[],kind=params.get('type')||'',page=Math.max(1,Number(params.get('page'))||1),restorePage=page,ready=false,attachmentTask,attachmentReady=false,attachmentError=false,warnings=[];
 if(!['','company','minutes','views','industry','attachment'].includes(kind))kind='';
 $('query').value=params.get('q')||'';
 function render(){
  if(!ready)return;
  const q=$('query').value.trim(),found=M.search(items,q,kind),pages=Math.max(1,Math.ceil(found.length/size));if(restorePage&&(!(q||kind==='attachment')||attachmentReady||attachmentError)){page=restorePage;restorePage=0;}page=Math.min(page,pages);
  SiteUI.save({q,type:kind,page:page>1?page:''});
  $('resource-types').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));
  $('search-status').textContent=(q?'“'+q+'” · ':'已收录目录 · ')+found.length+' 项'+(!attachmentReady&&(q||kind==='attachment')?' · 附件索引'+(attachmentError?'读取失败':'读取中'):'');
  const current=found.slice((page-1)*size,page*size),groups=['industry','company','views','minutes','attachment'];
  $('search-results').innerHTML=groups.map(group=>{const rows=current.filter(r=>r.kind===group);return rows.length?'<section class="site-search-group"><h2>'+D.esc(M.labels[group])+'</h2>'+rows.map(r=>'<article class="resource-result"><div><span class="portal-tag">'+D.esc(M.labels[r.kind])+'</span><span class="portal-note">'+D.esc(r.period?'数据期 '+r.period:r.date?'发布 '+SiteUI.date(r.date):'目录条目 · 未提供日期')+'</span></div><a class="resource-result-title" href="'+D.esc(M.safeHref(r.href))+'">'+D.esc(r.title)+'</a><p class="portal-note">'+D.esc([r.code,r.module,r.kind==='views'?'':M.sector(r.sector),r.status].filter(Boolean).join(' · '))+'</p></article>').join('')+'</section>':'';}).join('')||'<div class="portal-empty">暂无匹配资料</div>';
  $('search-pager').hidden=pages<=1;$('search-page').textContent=page+' / '+pages;$('search-prev').disabled=page<=1;$('search-next').disabled=page>=pages;
  $('search-coverage').textContent=warnings.join('；');
  if((q||kind==='attachment')&&!attachmentReady&&!attachmentTask&&!attachmentError)loadAttachments();
 }
 async function loadAttachments(){
  attachmentTask=D.json('data/research/library.json');
  try{const library=await attachmentTask;items.push(...library.records.map(r=>({id:'attachment:'+r.id,kind:'attachment',title:r.name,company:r.company||'',aliases:[r.name],sector:(r.sectors||[]).join(' '),date:r.published||r.date,href:'research.html?kind=minutes&scope=all&asset='+encodeURIComponent(r.id),status:r.format==='audio'&&!r.processing?.textAvailable?'录音 · 未转写':r.processing?.textAvailable?'有可读文字':r.processing?.status==='awaiting_file'?'原件待获取':'附件目录'})));attachmentReady=true;}catch{attachmentError=true;warnings.push('附件目录读取失败，其他结果仍可用');}finally{attachmentTask=null;render();if(attachmentError){const b=document.createElement('button');b.textContent='重试附件索引';b.onclick=()=>{attachmentError=false;warnings=warnings.filter(w=>!w.startsWith('附件目录'));loadAttachments();b.remove();};$('search-coverage').append(b);}}
 }
 $('resource-search').onsubmit=e=>{e.preventDefault();page=1;render();};
 $('query').oninput=SiteUI.debounce(()=>{page=1;render();});
 $('resource-types').onclick=e=>{const b=e.target.closest('[data-kind]');if(b){kind=b.dataset.kind;page=1;render();}};
 $('search-prev').onclick=()=>{page--;render();};$('search-next').onclick=()=>{page++;render();};
 try{
  const data=await D.json('data/research/resource-index.json');items=data.items;
  const extra=await Promise.allSettled([D.json('data-manifest.json'),D.json('data/macro/catalog.json')]);
  items.push(...SiteMetrics.searchItems());
  if(extra[0].status==='fulfilled')items.push(...extra[0].value.datasets.map(d=>({id:'dataset:'+d.id,kind:'industry',title:d.name,href:'dashboard.html?dataset='+encodeURIComponent(d.id),module:d.category,period:d.latestPeriod||d.asOf||'',aliases:[d.id]})));else warnings.push('数据集目录读取失败');
  if(extra[1].status==='fulfilled')items.push(...SiteMetrics.searchItems(SiteMetrics.fromCatalog(extra[1].value)));else warnings.push('宏观指标目录读取失败');
  const seen=new Set();items=items.filter(r=>{const key=r.kind+'|'+r.href+'|'+r.title;if(seen.has(key))return false;seen.add(key);return true;});ready=true;render();
 }catch(e){$('search-status').innerHTML='资料目录暂时无法读取。 <button class="portal-button" id="search-retry" type="button">重试</button>';$('search-retry').onclick=()=>location.reload();}
})();
