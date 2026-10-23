(function(root){
  'use strict';
  const navigation=[['industry','industry.html','行业数据','chart'],['macro','macro.html?view=indicators','宏观数据','globe'],['companies','company-database.html','重点公司','building'],['earnings','earnings.html','财报日历','calendar'],['research','research.html','观点纪要','document'],['quotes','quotes.html','实时行情','trend']];
  const pages={
    'retail-monthly-product.html':['tools','社零月度产品'],
    'cpi-monthly-product.html':['tools','CPI月度产品'],
    'daily.html':['daily','国金商社日报'],
    'overseas-hotels.html':['companies','海外酒店'],
    'overseas-hotel-comparison.html':['companies','海外酒店公司对比'],
    'domestic-hotel-comparison.html':['companies','国内酒店公司对比'],
    'data-notes.html':['tools','数据来源与说明'],
    'travel-dashboard.html':['industry','旅游'],'cruise-dashboard.html':['industry','三峡游轮'],'industry.html':['industry','行业数据'],'dining.html':['industry','餐饮'],'hotel-groups.html':['industry','酒店集团'],'hotel-dashboard.html':['industry','酒店'],'hotel-holiday-dashboard.html':['industry','酒店假期数据'],'dutyfree-dashboard.html':['industry','免税'],'gold-jewelry.html':['industry','黄金'],
    'regional-retail.html':['macro','地方社零'],'macro.html':['macro','核心指标'],'company-database.html':['companies','重点公司数据库'],'companies.html':['quotes','覆盖池'],'earnings.html':['earnings','财报日历'],'research.html':['research','观点纪要'],'search.html':['research','站内搜索'],'quotes.html':['quotes','实时行情'],'dashboard.html':['tools','数据浏览器'],'hotel-weekly-product.html':['tools','酒店周度产品']};
  const legacy={'watch-assistant':'hotel-weekly-product.html','coverage-live':'quotes.html','sec-hotel':'industry.html#hotel','sec-taxfree':'industry.html#dutyfree','sec-gold':'industry.html#gold','sec-overseas':'industry.html#hotel','sec-dining':'industry.html#dining','sec-f':'quotes.html','consumer-focus':'quotes.html','sec-u':'quotes.html','sec-m':'research.html','sec-r':'research.html','sec-mkt':'research.html'};
  function route(key,search='',fallback=false){const target=legacy[key]||(fallback?'hotel-weekly-product.html':'');if(!target)return '';const url=new URL(target,'https://site.invalid/');for(const [k,v] of new URLSearchParams(search))url.searchParams.set(k,v);return url.pathname.slice(1)+url.search+url.hash;}
  async function request(path,format='json',timeout=15000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(path,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return format==='text'?await response.text():await response.json();}finally{clearTimeout(timer);}}
  function date(value){if(!value)return '日期未提供';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value);return Number.isNaN(d.getTime())?'日期未提供':new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}
  function save(values){const u=new URL(location.href);for(const [k,v] of Object.entries(values)){if(v===''||v==null)u.searchParams.delete(k);else u.searchParams.set(k,String(v));}history.replaceState(null,'',u.pathname+u.search+u.hash);}
  function debounce(fn,delay=150){let timer;return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay);};}

  const api={navigation,pages,route,request,date,save,debounce};if(typeof module==='object'&&module.exports)module.exports=api;else root.SiteUI=api;
})(typeof window==='object'?window:globalThis);









// Shared skin preference. Runs in each document, including industry iframes.
(function(root){
  'use strict';
  if(!root.document||!root.SiteUI)return;
  const doc=root.document,key='sinolink-site-skin',valid=value=>value==='dark'||value==='light';
  const script=doc.currentScript;
  const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('site-theme.css?v=20261023skin1',script?script.src:doc.baseURI).href;style.id='site-theme-styles';doc.head.append(style);
  let skin='light';
  try{const stored=root.localStorage.getItem(key);if(valid(stored))skin=stored;}catch{}
  // The parent's current choice also works when browser storage is unavailable.
  try{if(root.parent!==root&&valid(root.parent.document.documentElement.dataset.siteTheme))skin=root.parent.document.documentElement.dataset.siteTheme;}catch{}
  function apply(value,persist=false){
    if(!valid(value))return;
    skin=value;doc.documentElement.dataset.siteTheme=value;
    const picker=doc.getElementById('site-skin');if(picker)picker.value=value;
    const meta=doc.querySelector('meta[name="theme-color"]');if(meta)meta.content=value==='dark'?'#0d1420':'#4d58a4';
    if(persist){try{root.localStorage.setItem(key,value);}catch{}}
    doc.querySelectorAll('iframe').forEach(frame=>{try{if(frame.contentWindow.SiteUI?.setSkin)frame.contentWindow.SiteUI.setSkin(value);else frame.contentDocument.documentElement.dataset.siteTheme=value;}catch{}});
  }
  root.SiteUI.setSkin=apply;
  root.SiteUI.mountSkin=function(nav){
    if(nav.querySelector('#site-skin'))return;
    const label=doc.createElement('label');label.className='site-skin-control';label.htmlFor='site-skin';
    const caption=doc.createElement('span');caption.textContent='皮肤';const select=doc.createElement('select');select.id='site-skin';select.name='skin';
    for(const [value,text]of [['light','现有浅色'],['dark','深海金']]){const option=doc.createElement('option');option.value=value;option.textContent=text;select.append(option);}
    select.value=skin;select.addEventListener('change',()=>apply(select.value,true));label.append(caption,select);nav.querySelector('.site-brand').after(label);
  };
  root.addEventListener('storage',event=>{if(event.key===key)apply(valid(event.newValue)?event.newValue:'light');});
  apply(skin);
})(typeof window==='object'?window:globalThis);

