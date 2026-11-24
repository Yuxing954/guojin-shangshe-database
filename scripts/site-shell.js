(function(){
  'use strict';
  const U=SiteUI,page=location.pathname.split('/').pop()||'industry.html';
  const [section,title]=U.pages[page]||['tools','研究工具'];
  document.body.classList.add('site-page');document.body.dataset.siteSection=section;
  if(typeof window!=='undefined'&&window.parent!==window&&new URLSearchParams(location.search).get('embed')==='1'){const main=document.querySelector('body > main,body > .wrap');if(main)main.classList.add('site-main');return;}
  const paths={chart:'M4 3v17h17M8 16v-5m5 5V6m5 10V9',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',building:'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M3 21h18',calendar:'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14M9 14h1m4 0h1m-6 3h1',document:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',trend:'M3 20h18M4 15l6-6 4 3 6-8M15 4h5v5'};
  const icon=key=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';
  const products=[['earnings.html',U.pages['earnings.html']],...Object.entries(U.pages).filter(([href])=>href.endsWith('-product.html')),['tools.html',['tools','投研工具']],['database-qr.html',['tools','数据库二维码']]];
  const boards={
    industry:[['酒店','industry.html#hotel'],['免税','industry.html#dutyfree'],['旅游','industry.html#tourism'],['三峡游轮','cruise-dashboard.html'],['餐饮','industry.html#dining']],
    macro:[['中国指标','macro.html?view=indicators&country=CN'],['美国指标','macro.html?view=indicators&country=US'],['全国社零','national-retail.html'],['地方社零','regional-retail.html'],['预测市场','macro.html?view=predictions']],
    companies:[['国内酒店','company-database.html'],['海外酒店','overseas-hotels.html'],['国内同业对比','domestic-hotel-comparison.html'],['海外同业对比','overseas-hotel-comparison.html']],
    research:[['观点摘要','research.html?kind=digest'],['板块观点','research.html?kind=views'],['全部观点','research.html?kind=all_views'],['纪要文库','research.html?kind=minutes&scope=archived']],
    quotes:[['实时行情','quotes.html'],['黄金价格','quotes.html#gold']],
    tools:products.map(([url,[,name]])=>[name,url])
  };
  const style=document.createElement('link');
  style.rel='stylesheet';style.href='scripts/top-navigation.css';
  document.head.append(style);
  const header=document.createElement('header');
  header.className='gj-header';
  const groups=[...U.navigation,['tools','tools.html','产品','building']];
  header.innerHTML='<a class="gj-brand" href="industry.html"><img src="scripts/assets/brand/sinolink-mark.svg" alt="" width="30" height="30">零售&amp;社服数据库</a><nav aria-label="主要导航">'+groups.map(([key,,label])=>
    '<div class="gj-group"><button type="button" aria-expanded="false" aria-controls="gj-'+key+'" class="'+(key===section?'active':'')+'">'+label+' <small aria-hidden="true">⌄</small></button><div hidden class="gj-panel" id="gj-'+key+'"><div>'+boards[key].map(([name,url])=>'<a href="'+url+'">'+name+'</a>').join('')+'</div></div></div>').join('')+'<a href="daily.html">日报</a><a href="data-notes.html">数据来源与说明</a></nav>';
  document.querySelector('body > .site-nav')?.remove();
  document.body.classList.add('gj-top-layout');
  document.body.prepend(header);
  let open=null,timer;
  function show(group){
    clearTimeout(timer);
    if(open){open.firstElementChild.setAttribute('aria-expanded','false');open.lastElementChild.hidden=true;}
    open=group;
    if(open){open.firstElementChild.setAttribute('aria-expanded','true');open.lastElementChild.hidden=false;}
  }
  for(const group of header.querySelectorAll('.gj-group')){
    group.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(group);});
    group.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')timer=setTimeout(()=>show(null),160);});
    group.firstElementChild.addEventListener('click',e=>show(open===group&&!matchMedia('(hover:hover)').matches?null:group));
    group.lastElementChild.addEventListener('click',()=>show(null));
  }
  document.addEventListener('pointerdown',e=>{if(!header.contains(e.target))show(null);});
  header.addEventListener('focusout',e=>{if(open&&!open.contains(e.relatedTarget))show(null);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){open.firstElementChild.focus();show(null);}});
  const main=document.querySelector('body > main,body > .wrap,body > .main,body > .app > .main,body > .shell > .main')||document.querySelector('main');
  if(main){main.classList.add('site-main');if(!main.id)main.id='site-main';main.tabIndex=-1;main.setAttribute('aria-label',title);if(document.querySelector('.skip-link'))document.querySelector('.skip-link').href='#'+main.id;if(!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.href='#'+main.id;skip.className='skip-link';skip.textContent='跳到内容';document.body.prepend(skip);}}

  document.querySelectorAll('dialog').forEach(dialog=>{
    if(!dialog.hasAttribute('aria-labelledby')&&!dialog.hasAttribute('aria-label')){const heading=dialog.querySelector('h2,h3');if(heading&&heading.id)dialog.setAttribute('aria-labelledby',heading.id);else dialog.setAttribute('aria-label',title+'详情');}
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  });
})();



