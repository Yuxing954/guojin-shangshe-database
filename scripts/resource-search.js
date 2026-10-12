(async function(){
  'use strict';
  const D=SiteData,M=ResourceModel,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),size=20;
  let items=[],kind=params.get('type')||'',page=1,ready=false;
  if(!['','company','minutes','views','industry'].includes(kind))kind='';
  $('query').value=params.get('q')||'';
  function render(){
    if(!ready)return;
    const q=$('query').value.trim(),found=M.search(items,q,kind),pages=Math.max(1,Math.ceil(found.length/size));page=Math.min(page,pages);
    const query=new URLSearchParams();if(q)query.set('q',q);if(kind)query.set('type',kind);history.replaceState(null,'',location.pathname+(query.size?'?'+query:''));
    $('resource-types').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));
    $('search-status').textContent=(q?'“'+q+'” · ':'已收录目录 · ')+found.length+' 项';
    $('search-results').innerHTML=found.slice((page-1)*size,page*size).map(r=>'<article class="resource-result"><div><span class="portal-tag">'+D.esc(M.labels[r.kind])+'</span><span class="portal-note">'+D.esc(r.date||'日期待核对')+'</span></div><a class="resource-result-title" href="'+D.esc(M.safeHref(r.href))+'">'+D.esc(r.title)+'</a><p class="portal-note">'+D.esc([r.code,r.kind==='views'?'':M.sector(r.sector)].filter(Boolean).join(' · '))+'</p></article>').join('')||'<div class="portal-empty">暂无匹配资料</div>';
    $('search-pager').hidden=pages<=1;$('search-page').textContent=page+' / '+pages;$('search-prev').disabled=page<=1;$('search-next').disabled=page>=pages;
  }
  $('resource-search').onsubmit=e=>{e.preventDefault();page=1;render();};
  $('query').oninput=SiteUI.debounce(()=>{page=1;render();});
  $('resource-types').onclick=e=>{const b=e.target.closest('[data-kind]');if(b){kind=b.dataset.kind;page=1;render();}};
  $('search-prev').onclick=()=>{page--;render();};$('search-next').onclick=()=>{page++;render();};
  try{const data=await D.json('data/research/resource-index.json');items=data.items;ready=true;$('search-coverage').textContent='';render();}catch(e){$('search-status').innerHTML='资料目录暂时无法读取。 <button class="portal-button" id="search-retry" type="button">重试</button>';$('search-retry').onclick=()=>location.reload();}
})();

