(function(){
  'use strict';
  const U=SiteUI,page=location.pathname.split('/').pop()||'index.html';
  if(page==='database.html'){const destination=U.route(location.hash.slice(1)||'coverage-live',location.search);if(destination){location.replace(destination);return;}}
  const [section,title]=U.pages[page]||['tools','研究工具'];
  document.body.classList.add('site-page');document.body.dataset.siteSection=section;
  if(window.parent!==window&&new URLSearchParams(location.search).get('embed')==='1'){const main=document.querySelector('body > main,body > .wrap');if(main)main.classList.add('site-main');return;}
  const paths={home:'M3 10l9-7 9 7M5 9v12h5v-7h4v7h5V9',chart:'M4 3v17h17M8 16v-5m5 5V6m5 10V9',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',building:'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M3 21h18',calendar:'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14M9 14h1m4 0h1m-6 3h1',document:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',trend:'M3 20h18M4 15l6-6 4 3 6-8M15 4h5v5',search:'M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0'};
  const icon=key=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';
  const nav=document.createElement('aside');nav.className='site-nav';
  nav.innerHTML='<a class="site-brand" href="index.html"><b>SINOLINK</b><span>国金商社数据库</span></a><form class="site-search" action="search.html" role="search"><input type="search" name="q" aria-label="站内搜索" placeholder="公司、纪要、指标"><button type="submit" aria-label="搜索">'+icon('search')+'</button></form><nav aria-label="主要导航">'+U.navigation.map(([key,href,label,glyph])=>'<a href="'+href+'"'+(section===key?' class="current" aria-current="page"':'')+'>'+icon(glyph)+'<span>'+label+'</span></a>').join('')+'</nav><div class="site-nav-bottom"><a href="dashboard.html"'+(page==='dashboard.html'?' aria-current="page"':'')+'>数据浏览器</a><a href="database.html#watch-assistant"'+(page==='database.html'?' aria-current="page"':'')+'>历史工具</a><small>商贸零售 · 社会服务</small></div>';
  document.body.prepend(nav);
  const main=document.querySelector('body > main,body > .wrap,body > .main,body > .app > .main,body > .shell > .main')||document.querySelector('main');
  if(main){main.classList.add('site-main');if(!main.id)main.id='site-main';main.tabIndex=-1;main.setAttribute('aria-label',title);if(document.querySelector('.skip-link'))document.querySelector('.skip-link').href='#'+main.id;if(!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.href='#'+main.id;skip.className='skip-link';skip.textContent='跳到内容';document.body.prepend(skip);}}
  document.querySelectorAll('dialog').forEach(dialog=>{
    if(!dialog.hasAttribute('aria-labelledby')&&!dialog.hasAttribute('aria-label')){const heading=dialog.querySelector('h2,h3');if(heading&&heading.id)dialog.setAttribute('aria-labelledby',heading.id);else dialog.setAttribute('aria-label',title+'详情');}
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  });
  if(page==='database.html'&&main){
    const bar=document.createElement('header');bar.className='portal-header';bar.innerHTML='<div><p class="eyebrow">研究工具</p><h1>历史工具</h1></div><label>模块 <select id="tool-module"><option value="watch-assistant">盯盘助手</option></select></label>';main.prepend(bar);
    function select(){const key=location.hash.slice(1)||'watch-assistant',destination=U.route(key,location.search);if(destination){location.replace(destination);return;}const target=document.getElementById(key)||document.getElementById('watch-assistant');if(!target)return;[...main.children].filter(s=>!['SCRIPT','STYLE'].includes(s.tagName)&&s!==bar).forEach(s=>s.classList.toggle('portal-inactive-module',s!==target&&!s.contains(target)&&!target.contains(s)));if(target.id==='watch-assistant'){target.classList.add('open');target.setAttribute('aria-hidden','false');document.getElementById('watch-close').onclick=()=>location.assign('quotes.html');}document.getElementById('tool-module').value=target.id;}
    document.getElementById('tool-module').onchange=e=>{location.hash=e.target.value;};addEventListener('hashchange',select);select();
  }
})();

