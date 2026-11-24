(function(root){
  'use strict';
  const navigation=[['workspace','workspace.html','工作台','workspace'],['industry','industry.html','行业数据','chart'],['macro','macro.html?view=indicators','宏观数据','globe'],['companies','company-database.html','重点公司','building'],['research','research.html','观点纪要','document'],['quotes','quotes.html','实时行情','trend']];
  const pages={
    'workspace.html':['workspace','工作台'],
    'tools.html':['tools','投研工具'],
    'recruitment.html':['industry','企业招聘'],
    'database-qr.html':['tools','数据库二维码'],
    'retail-monthly-product.html':['tools','社零月度产品'],
    'cpi-monthly-product.html':['tools','CPI月度产品'],
    'daily.html':['daily','国金商社日报'],
    'overseas-hotels.html':['companies','海外酒店'],
    'overseas-hotel-comparison.html':['companies','海外酒店公司对比'],
    'domestic-hotel-comparison.html':['companies','国内酒店公司对比'],
    'data-notes.html':['tools','数据来源与说明'],
    'travel-dashboard.html':['industry','旅游'],'cruise-dashboard.html':['industry','三峡游轮'],'industry.html':['industry','行业数据'],'dining.html':['industry','餐饮'],'hotel-groups.html':['industry','酒店集团'],'hotel-dashboard.html':['industry','酒店'],'hotel-holiday-dashboard.html':['industry','酒店假期数据'],'dutyfree-dashboard.html':['industry','免税'],'gold-jewelry.html':['industry','黄金'],
    'national-retail.html':['macro','全国社零'],'regional-retail.html':['macro','地方社零'],'macro.html':['macro','核心指标'],'company-database.html':['companies','重点公司数据库'],'companies.html':['quotes','覆盖池'],'earnings.html':['tools','财报日历'],'research.html':['research','观点纪要'],'search.html':['research','站内搜索'],'quotes.html':['quotes','实时行情'],'dashboard.html':['tools','数据浏览器'],'hotel-weekly-product.html':['tools','酒店周度产品']};
  const legacy={'watch-assistant':'hotel-weekly-product.html','coverage-live':'quotes.html','sec-hotel':'industry.html#hotel','sec-taxfree':'industry.html#dutyfree','sec-gold':'industry.html#gold','sec-overseas':'industry.html#hotel','sec-dining':'industry.html#dining','sec-f':'quotes.html','consumer-focus':'quotes.html','sec-u':'quotes.html','sec-m':'research.html','sec-r':'research.html','sec-mkt':'research.html'};
  function route(key,search='',fallback=false){const target=legacy[key]||(fallback?'hotel-weekly-product.html':'');if(!target)return '';const url=new URL(target,'https://site.invalid/');for(const [k,v] of new URLSearchParams(search))url.searchParams.set(k,v);return url.pathname.slice(1)+url.search+url.hash;}
  async function request(path,format='json',timeout=15000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(path,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return format==='text'?await response.text():await response.json();}finally{clearTimeout(timer);}}
  function date(value){if(!value)return '日期未提供';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value);return Number.isNaN(d.getTime())?'日期未提供':new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}
  function save(values){const u=new URL(location.href);for(const [k,v] of Object.entries(values)){if(v===''||v==null)u.searchParams.delete(k);else u.searchParams.set(k,String(v));}history.replaceState(null,'',u.pathname+u.search+u.hash);}
  function debounce(fn,delay=150){let timer;return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay);};}

  // Metadata uses full years; compact chart labels remain independent.
  function periodLabel(value){
    const text=String(value??'').trim();let m;
    if((m=text.match(/^(\d{4})-?W(\d{1,2})$/i)))return m[1]+'年第'+Number(m[2])+'周';
    if((m=text.match(/^(\d{4})-?Q([1-4])$/i)))return m[1]+'年第'+m[2]+'季度';
    if((m=text.match(/^(\d{4})-?H([12])$/i)))return m[1]+'年'+(m[2]==='1'?'上':'下')+'半年';
    if((m=text.match(/^(\d{4})-(\d{1,2})$/)))return m[1]+'年'+Number(m[2])+'月';
    return text;
  }
  function asOf(element,value,details=[],label='数据截至'){
    if(!element)return;
    const doc=element.ownerDocument,span=(className,text)=>{const e=doc.createElement('span');e.className=className;e.textContent=text;return e;};
    element.classList.add('dashboard-asof');
    const primary=span('dashboard-asof-primary','');
    primary.append(span('dashboard-asof-label',label),span('dashboard-asof-value',periodLabel(value)||'暂无数据'));
    const nodes=[primary];
    for(const detail of details.filter(v=>v!==null&&v!==undefined&&v!=='')){
      const item=span('dashboard-asof-item',''),separator=span('dashboard-asof-separator','｜');separator.setAttribute('aria-hidden','true');
      item.append(separator,span('dashboard-asof-detail',periodLabel(detail)));nodes.push(item);
    }
    element.replaceChildren(...nodes);
  }
  const paths={workspace:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',chart:'M4 3v17h17M8 16v-5m5 5V6m5 10V9',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',building:'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M3 21h18',calendar:'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14M9 14h1m4 0h1m-6 3h1',document:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',trend:'M3 20h18M4 15l6-6 4 3 6-8M15 4h5v5',search:'M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0M16 16l5 5'};
  function icon(key){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';}
  const products=[['earnings.html',pages['earnings.html']],...Object.entries(pages).filter(([href])=>href.endsWith('-product.html')),['tools.html',['tools','投研工具']],['database-qr.html',['tools','数据库二维码']]];
  // Shared by the runtime and static first paint; no duplicate navigation templates.
  function shellNavigation(page,section,productOpen=false){
    const isProduct=products.some(([href])=>href===page);
    const productLinks=products.map(([href,[,label]])=>'<a href="'+href+'"'+(page===href?' aria-current="page"':'')+'><span>'+label+'</span><span aria-hidden="true">↗</span></a>').join('');
    return '<a class="site-brand navbar-brand" href="workspace.html" aria-label="国金商社 · 零售&amp;社服数据库"><img src="scripts/assets/brand/sinolink-mark.svg" width="32" height="32" alt=""><span class="site-brand-name"><b>国金商社</b><small>零售 &amp; 社服数据库</small></span></a><div class="site-nav-label">研究中心</div><nav class="nav nav-pills" aria-label="主要导航">'+navigation.map(([key,href,label,glyph])=>'<a class="nav-link'+(section===key?' current active':'')+'" href="'+href+'"'+(section===key?' aria-current="page"':'')+'>'+icon(glyph)+'<span>'+label+'</span></a>').join('')+'</nav><div class="site-nav-bottom"><div class="site-resource-actions"><a class="catalog-search-link" href="search.html" aria-label="搜索数据库">'+icon('search')+'</a><button type="button" class="site-resource-entry'+(isProduct?' current':'')+'" id="site-products-toggle" aria-expanded="'+productOpen+'" aria-controls="site-products-panel">'+icon('building')+'<span>产品</span><span class="site-product-chevron" aria-hidden="true">⌃</span></button><a class="site-resource-entry'+(page==='daily.html'?' current':'')+'" href="daily.html"'+(page==='daily.html'?' aria-current="page"':'')+'>'+icon('document')+'<span>日报</span></a></div><div class="site-products-panel" id="site-products-panel" role="region" aria-label="全部产品"'+(productOpen?'':' hidden')+'>'+productLinks+'</div></div>';
  }
  function workspaceBar(title){return '<div class="site-workspace-path"><a href="workspace.html">国金商社</a><span aria-hidden="true">/</span><span>'+title+'</span></div><form class="catalog-search" action="search.html" method="get" role="search" aria-label="全库检索"><button type="submit" aria-label="搜索">'+icon('search')+'</button><input class="form-control" type="search" name="q" aria-label="全库搜索" placeholder="搜索指标、公司、观点" required><kbd class="site-search-shortcut" aria-hidden="true">⌘ K</kbd></form><a class="site-source-link" href="data-notes.html">'+icon('document')+'<span>数据来源</span></a>';}
  const api={navigation,pages,route,request,date,save,debounce,periodLabel,asOf,products,icon,shellNavigation,workspaceBar};if(typeof module==='object'&&module.exports)module.exports=api;else root.SiteUI=api;
})(typeof window==='object'?window:globalThis);

