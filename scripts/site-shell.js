(function(){
  'use strict';
  const page=location.pathname.split('/').pop()||'index.html';
  if(page==='database.html'&&(!location.hash||location.hash==='#coverage-live')){location.replace('quotes.html'+location.search);return;}
  const section=page==='index.html'?'home':['industry.html','hotel-dashboard.html','dutyfree-dashboard.html'].includes(page)?'industry':['companies.html','earnings.html'].includes(page)?'companies':['research.html','search.html'].includes(page)?'research':page==='quotes.html'?'quotes':'tools';
  document.body.classList.add('site-page');document.body.dataset.siteSection=section;
  const searchStyle=document.createElement('link');searchStyle.rel='stylesheet';searchStyle.href='scripts/resource-search.css?v=1';document.head.append(searchStyle);
  const nav=document.createElement('aside');nav.className='site-nav';nav.innerHTML='<a class="site-brand" href="index.html"><b>SINOLINK</b><span>国金商社数据库</span></a><form class="site-search" action="search.html" role="search"><input type="search" name="q" aria-label="站内搜索" placeholder="公司、纪要、指标"><button type="submit" aria-label="搜索">⌕</button></form><nav aria-label="主要导航">'+[['home','index.html','◫','首页'],['industry','industry.html','▤','行业数据'],['companies','companies.html','▦','公司数据'],['research','research.html','▧','观点纪要'],['quotes','quotes.html','↗','实时行情']].map(([k,href,icon,label])=>'<a href="'+href+'" '+(section===k?'class="current" aria-current="page"':'')+'><span aria-hidden="true">'+icon+'</span>'+label+'</a>').join('')+'</nav><div class="site-nav-bottom"><a href="earnings.html">财报日历 ↗</a><small>商贸零售 · 社会服务</small></div>';document.body.prepend(nav);
  if(page!=='index.html'){const main=document.querySelector('body > main,body > .wrap,body > .main,body > .app > .main');if(main)main.classList.add('site-main');}
  // Route old deep links to the new destinations without losing specialist views.
  document.querySelectorAll('a[href="index.html#sec-hotel"]').forEach(a=>{a.href='industry.html#hotel';a.textContent='← 行业数据';});
  document.querySelectorAll('a[href="index.html#sec-f"],a[href="index.html#consumer-focus"]').forEach(a=>a.href='companies.html');
  if(page==='database.html'){
    const root=document.querySelector('.main');if(!root)return;
    const bar=document.createElement('div');bar.className='portal-tools-nav';bar.innerHTML='<a href="index.html">首页</a><span> / 行情与研究工具</span><label>当前模块<select id="tool-module"><option value="coverage-live">实时行情</option><option value="consumer-focus">重点公司</option><option value="watch-assistant">盯盘助手</option><option value="sec-f">财务数据</option><option value="sec-gold">黄金珠宝</option><option value="sec-overseas">跨境出海</option><option value="sec-dining">餐饮茶饮</option><option value="sec-u">标的池</option><option value="sec-mkt">市场观点</option><option value="sec-m">纪要文库</option></select></label>';root.prepend(bar);
    function select(){const key=location.hash.slice(1)||'coverage-live';if(key==='coverage-live'){location.replace('quotes.html'+location.search);return;}const target=document.getElementById(key);if(!target)return;const sections=root.querySelectorAll('section[id]');sections.forEach(s=>s.classList.toggle('portal-inactive-module',s!==target&&!(s.contains(target))&&!(target.contains(s))));const picker=document.getElementById('tool-module');if([...picker.options].some(o=>o.value===key))picker.value=key;}
    document.getElementById('tool-module').onchange=e=>{location.hash=e.target.value;};addEventListener('hashchange',select);select();
  }
})();
