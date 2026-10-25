(function(){
  'use strict';
  const U=SiteUI,page=location.pathname.split('/').pop()||'industry.html';
  const [section,title]=U.pages[page]||['tools','研究工具'];
  document.body.classList.add('site-page');document.body.dataset.siteSection=section;
  if(typeof window!=='undefined'&&window.parent!==window&&new URLSearchParams(location.search).get('embed')==='1'){const main=document.querySelector('body > main,body > .wrap');if(main)main.classList.add('site-main');return;}
  const paths={chart:'M4 3v17h17M8 16v-5m5 5V6m5 10V9',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',building:'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M3 21h18',calendar:'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14M9 14h1m4 0h1m-6 3h1',document:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',trend:'M3 20h18M4 15l6-6 4 3 6-8M15 4h5v5'};
  const icon=key=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';
  const products=[['earnings.html',U.pages['earnings.html']],...Object.entries(U.pages).filter(([href])=>href.endsWith('-product.html'))];
  const isProduct=products.some(([href])=>href===page);
  const productOpen=isProduct&&matchMedia('(min-width:761px)').matches;
  const productLinks=products.map(([href,[,label]])=>'<a href="'+href+'"'+(page===href?' aria-current="page"':'')+'><span>'+label+'</span><span aria-hidden="true">↗</span></a>').join('');
  const nav=document.querySelector('body > .site-nav')||document.createElement('aside');nav.className='site-nav';
  nav.innerHTML='<a class="site-brand" href="industry.html" aria-label="国金证券 · 零售&amp;社服数据库"><img src="scripts/assets/brand/sinolink-mark.svg" width="32" height="32" alt=""><span class="site-brand-name"><b>零售&amp;社服数据库</b></span></a><nav aria-label="主要导航">'+U.navigation.map(([key,href,label,glyph])=>'<a href="'+href+'"'+(section===key?' class="current" aria-current="page"':'')+'>'+icon(glyph)+'<span>'+label+'</span></a>').join('')+'</nav><div class="site-nav-bottom"><a href="https://h-jett.github.io/etf-radar/index.html" target="_blank" rel="noopener noreferrer">国家队持仓 ↗</a><a href="data-notes.html"'+(page==='data-notes.html'?' aria-current="page"':'')+'>数据来源与说明</a><div class="site-resource-actions"><button type="button" class="site-resource-entry'+(isProduct?' current':'')+'" id="site-products-toggle" aria-expanded="'+productOpen+'" aria-controls="site-products-panel">'+icon('building')+'<span>产品</span><span class="site-product-chevron" aria-hidden="true">⌃</span></button><a class="site-resource-entry'+(page==='daily.html'?' current':'')+'" href="daily.html"'+(page==='daily.html'?' aria-current="page"':'')+'>'+icon('document')+'<span>日报</span></a></div><div class="site-products-panel" id="site-products-panel" role="region" aria-label="全部产品"'+(productOpen?'':' hidden')+'>'+productLinks+'</div></div>';
  document.body.prepend(nav);
  const productToggle=nav.querySelector('#site-products-toggle'),productPanel=nav.querySelector('#site-products-panel');
  const setProductsOpen=open=>{productToggle.setAttribute('aria-expanded',String(open));productPanel.hidden=!open;};
  productToggle.addEventListener('click',()=>setProductsOpen(productPanel.hidden));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!productPanel.hidden){const restore=productPanel.contains(document.activeElement);setProductsOpen(false);if(restore)productToggle.focus();}});
  document.addEventListener('click',event=>{if(!productPanel.hidden&&!productPanel.contains(event.target)&&!productToggle.contains(event.target))setProductsOpen(false);});
  const main=document.querySelector('body > main,body > .wrap,body > .main,body > .app > .main,body > .shell > .main')||document.querySelector('main');
  if(main){main.classList.add('site-main');if(!main.id)main.id='site-main';main.tabIndex=-1;main.setAttribute('aria-label',title);if(document.querySelector('.skip-link'))document.querySelector('.skip-link').href='#'+main.id;if(!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.href='#'+main.id;skip.className='skip-link';skip.textContent='跳到内容';document.body.prepend(skip);}}

  document.querySelectorAll('dialog').forEach(dialog=>{
    if(!dialog.hasAttribute('aria-labelledby')&&!dialog.hasAttribute('aria-label')){const heading=dialog.querySelector('h2,h3');if(heading&&heading.id)dialog.setAttribute('aria-labelledby',heading.id);else dialog.setAttribute('aria-label',title+'详情');}
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  });
})();



