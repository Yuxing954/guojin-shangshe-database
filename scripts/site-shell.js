(function(){
  'use strict';
  const U=SiteUI,page=location.pathname.split('/').pop()||'index.html';
  const [section,title]=U.pages[page]||['tools','研究工具'];
  document.body.classList.add('site-page');document.body.dataset.siteSection=section;
  if(typeof window!=='undefined'&&window.parent!==window&&new URLSearchParams(location.search).get('embed')==='1'){const main=document.querySelector('body > main,body > .wrap');if(main)main.classList.add('site-main');return;}
  const paths={home:'M3 10l9-7 9 7M5 9v12h5v-7h4v7h5V9',chart:'M4 3v17h17M8 16v-5m5 5V6m5 10V9',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',building:'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M3 21h18',calendar:'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14M9 14h1m4 0h1m-6 3h1',document:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',trend:'M3 20h18M4 15l6-6 4 3 6-8M15 4h5v5',search:'M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0'};
  const icon=key=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';
  const nav=document.createElement('aside');nav.className='site-nav';
  nav.innerHTML='<a class="site-brand" href="index.html"><b>SINOLINK</b><span>国金商社数据库</span></a><form class="site-search" action="search.html" role="search"><input type="search" name="q" aria-label="站内搜索" placeholder="公司、纪要、指标"><button type="submit" aria-label="搜索">'+icon('search')+'</button></form><nav aria-label="主要导航">'+U.navigation.map(([key,href,label,glyph])=>'<a href="'+href+'"'+(section===key?' class="current" aria-current="page"':'')+'>'+icon(glyph)+'<span>'+label+'</span></a>').join('')+'</nav><div class="site-nav-bottom"><a href="dashboard.html"'+(page==='dashboard.html'?' aria-current="page"':'')+'>数据浏览器</a><a href="hotel-weekly-product.html"'+(page==='hotel-weekly-product.html'?' aria-current="page"':'')+'>酒店周度产品</a><small>商贸零售 · 社会服务</small></div>';
  document.body.prepend(nav);
  const main=document.querySelector('body > main,body > .wrap,body > .main,body > .app > .main,body > .shell > .main')||document.querySelector('main');
  if(main){main.classList.add('site-main');if(!main.id)main.id='site-main';main.tabIndex=-1;main.setAttribute('aria-label',title);if(document.querySelector('.skip-link'))document.querySelector('.skip-link').href='#'+main.id;if(!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.href='#'+main.id;skip.className='skip-link';skip.textContent='跳到内容';document.body.prepend(skip);}}

  if(main&&U.createWorkspace){
  const deskButton=document.createElement('button');deskButton.type='button';deskButton.className='site-workspace-open';deskButton.textContent='☆ 我的工作台';nav.querySelector('.site-search').after(deskButton);
    let browserStorage;try{browserStorage=localStorage;}catch(_){browserStorage={getItem(){throw Error('storage unavailable');},setItem(){throw Error('storage unavailable');}};}
    const workspace=U.createWorkspace(browserStorage,location.href);
    const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const current=()=>{const params=new URLSearchParams(location.search),record=params.get('record')||params.get('file'),heading=document.querySelector('dialog[open] h2')?.textContent?.trim(),metric=document.querySelector('#metric-title,#detail-title,#primary-title')?.textContent?.trim(),symbol=params.get('symbol');return {href:workspace.link(location.href),title:record||heading||((document.querySelector('h1')?.textContent?.trim()||title)+(symbol?' · '+symbol:metric?' · '+metric:''))};};
    const actions=document.createElement('div');actions.className='site-page-actions';actions.innerHTML='<button type="button" id="site-save-page" aria-pressed="false">☆ 收藏当前页</button><button type="button" id="site-open-workspace">我的工作台</button><span class="site-workspace-status" role="status"></span>';
    main.prepend(actions);
    const dialog=document.createElement('dialog');dialog.className='site-workspace-dialog';dialog.setAttribute('aria-labelledby','site-workspace-title');
    dialog.innerHTML='<div class="site-workspace-heading"><div><span class="site-workspace-kicker">研究工作台</span><h2 id="site-workspace-title">我的收藏与最近浏览</h2></div><button type="button" aria-label="关闭工作台" class="site-workspace-close">×</button></div><div class="site-workspace-body"><input type="search" id="site-workspace-search" aria-label="搜索收藏与最近浏览" placeholder="搜索收藏与最近浏览"><div class="site-workspace-section"><h3>我的收藏 <span id="site-saved-count"></span></h3><div id="site-saved-list"></div></div><div class="site-workspace-section"><div class="site-workspace-section-head"><h3>最近浏览</h3><button type="button" id="site-clear-recent">清空记录</button></div><div id="site-recent-list"></div></div><p class="site-workspace-note">仅保存在当前浏览器</p></div>';
    document.body.append(dialog);
    const list=(items,removable)=>items.map(x=>'<div class="site-workspace-row"><a href="'+escape(x.href)+'"><strong>'+escape(x.title)+'</strong><span>'+escape(U.pages[x.href.split(/[?#]/)[0]]?.[1]||'研究页面')+' ↗</span></a>'+(removable?'<button type="button" data-workspace-remove="'+escape(x.href)+'" aria-label="取消收藏 '+escape(x.title)+'">取消收藏</button>':'')+'</div>').join('');
    function refresh(){
      const state=workspace.read(),item=current(),saved=state.saved.some(x=>x.href===item.href),q=dialog.querySelector('input').value.trim().toLowerCase(),match=x=>!q||x.title.toLowerCase().includes(q)||x.href.toLowerCase().includes(q);
      const save=actions.querySelector('#site-save-page');save.textContent=saved?'★ 已收藏':'☆ 收藏当前页';save.setAttribute('aria-pressed',String(saved));
      dialog.querySelector('#site-saved-count').textContent=state.saved.length?String(state.saved.length):'';
      dialog.querySelector('#site-saved-list').innerHTML=list(state.saved.filter(match),true)||'<div class="site-workspace-empty">'+(q?'没有匹配的收藏':'暂无收藏')+'</div>';
      dialog.querySelector('#site-recent-list').innerHTML=list(state.recent.filter(match),false)||'<div class="site-workspace-empty">'+(q?'没有匹配的记录':'暂无浏览记录')+'</div>';
      dialog.querySelector('#site-clear-recent').disabled=!state.recent.length;
      dialog.querySelector('.site-workspace-note').textContent=state.persistent?'仅保存在当前浏览器':'浏览器未允许保存，仅本次浏览有效';
      const home=document.querySelector('#workspace-home');
      if(home){home.innerHTML=state.saved.length?list(state.saved.slice(0,4),false):'<div class="site-workspace-empty">暂无收藏</div>';}
    }
    const remember=()=>{const item=current();if(item.href&&page!=='index.html'){workspace.visit(item.href,item.title);}refresh();};
    function open(){remember();dialog.showModal();dialog.querySelector('input').focus();}
    deskButton.onclick=open;actions.querySelector('#site-open-workspace').onclick=open;
    actions.querySelector('#site-save-page').onclick=()=>{const item=current();workspace.toggle(item.href,item.title);refresh();actions.querySelector('[role=status]').textContent=workspace.read().persistent?'':'当前浏览器无法长期保存收藏';};
    dialog.querySelector('.site-workspace-close').onclick=()=>dialog.close();
    dialog.querySelector('input').oninput=refresh;
    dialog.querySelector('#site-clear-recent').onclick=()=>{workspace.clearRecent();refresh();};
    dialog.addEventListener('click',event=>{const remove=event.target.closest('[data-workspace-remove]');if(remove){workspace.remove(remove.dataset.workspaceRemove);refresh();}});
    document.querySelector('#home-workspace-open')?.addEventListener('click',open);
    addEventListener('hashchange',remember);addEventListener('popstate',remember);addEventListener('site:route-change',remember);
    addEventListener('pagehide',()=>{if(page!=='index.html'){const item=current();workspace.visit(item.href,item.title);}});
    addEventListener('storage',()=>{workspace.reload();refresh();});setTimeout(remember,400);refresh();
  }

  document.querySelectorAll('dialog').forEach(dialog=>{
    if(!dialog.hasAttribute('aria-labelledby')&&!dialog.hasAttribute('aria-label')){const heading=dialog.querySelector('h2,h3');if(heading&&heading.id)dialog.setAttribute('aria-labelledby',heading.id);else dialog.setAttribute('aria-label',title+'详情');}
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  });
})();
