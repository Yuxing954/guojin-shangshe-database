(function(root){
  'use strict';
  const navigation=[['home','index.html','首页','home'],['industry','industry.html','行业数据','chart'],['macro','consumption-macro.html','宏观数据','globe'],['companies','company-database.html','重点公司','building'],['earnings','earnings.html','财报日历','calendar'],['research','research.html','观点纪要','document'],['quotes','quotes.html','实时行情','trend']];
  const pages={
    'index.html':['home','研究首页'],'industry.html':['industry','行业数据'],'dining.html':['industry','餐饮'],'hotel-dashboard.html':['industry','酒店'],'dutyfree-dashboard.html':['industry','免税'],'gold-jewelry.html':['industry','黄金'],
    'consumption-macro.html':['macro','消费专题'],'macro.html':['macro','核心指标'],'company-database.html':['companies','重点公司数据库'],'companies.html':['quotes','覆盖池'],'earnings.html':['earnings','财报日历'],'research.html':['research','观点纪要'],'search.html':['research','站内搜索'],'quotes.html':['quotes','实时行情'],'dashboard.html':['tools','数据浏览器'],'hotel-weekly-product.html':['tools','酒店周度产品']};
  const legacy={'watch-assistant':'hotel-weekly-product.html','coverage-live':'quotes.html','sec-hotel':'industry.html#hotel','sec-taxfree':'industry.html#dutyfree','sec-gold':'industry.html#gold','sec-overseas':'industry.html#hotel','sec-dining':'industry.html#dining','sec-f':'quotes.html','consumer-focus':'quotes.html','sec-u':'quotes.html','sec-m':'research.html','sec-r':'research.html','sec-mkt':'research.html'};
  function route(key,search='',fallback=false){const target=legacy[key]||(fallback?'hotel-weekly-product.html':'');if(!target)return '';const url=new URL(target,'https://site.invalid/');for(const [k,v] of new URLSearchParams(search))url.searchParams.set(k,v);return url.pathname.slice(1)+url.search+url.hash;}
  async function request(path,format='json',timeout=15000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(path,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return format==='text'?await response.text():await response.json();}finally{clearTimeout(timer);}}
  function date(value){if(!value)return '日期未提供';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value);return Number.isNaN(d.getTime())?'日期未提供':new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}
  function save(values){const u=new URL(location.href);for(const [k,v] of Object.entries(values)){if(v===''||v==null)u.searchParams.delete(k);else u.searchParams.set(k,String(v));}history.replaceState(null,'',u.pathname+u.search+u.hash);if(typeof window==='object')window.dispatchEvent(new Event('site:route-change'));}
  function debounce(fn,delay=150){let timer;return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay);};}

  // Personal shortcuts remain on this browser; only same-site pages can be restored.
  function createWorkspace(storage,base){
    const key='sinolink.workspace.v1',allowed=new Set([...Object.keys(pages),'overseas.html','database.html']);
    const baseURL=new URL(base),directory=new URL('.',baseURL);let memory={saved:[],recent:[]},persistent=true,loaded=false;
    function link(value){try{const u=new URL(value,baseURL);if(u.origin!==directory.origin||!u.pathname.startsWith(directory.pathname))return '';const file=u.pathname.slice(directory.pathname.length);if(!allowed.has(file))return '';u.searchParams.delete('embed');return file+u.search+u.hash;}catch(_){return '';}}
    function clean(rows,limit){const seen=new Set();return (Array.isArray(rows)?rows:[]).filter(x=>x&&typeof x==='object').map(x=>({href:link(x.href),title:String(x.title||'研究页面').slice(0,160),at:Number(x.at)||0})).filter(x=>x.href&&!seen.has(x.href)&&seen.add(x.href)).slice(0,limit);}
    function read(){if(!loaded){loaded=true;try{const raw=storage.getItem(key);if(raw){const parsed=JSON.parse(raw);memory={saved:clean(parsed.saved,30),recent:clean(parsed.recent,12)};}}catch(_){persistent=false;}}return {saved:[...memory.saved],recent:[...memory.recent],persistent};}
    function write(state){memory={saved:clean(state.saved,30),recent:clean(state.recent,12)};try{storage.setItem(key,JSON.stringify(memory));persistent=true;}catch(_){persistent=false;}return read();}
    function visit(href,title){const state=read(),safe=link(href);if(!safe)return state;return write({...state,recent:[{href:safe,title,at:Date.now()},...state.recent.filter(x=>x.href!==safe)]});}
    function toggle(href,title){const state=read(),safe=link(href);if(!safe)return state;const exists=state.saved.some(x=>x.href===safe);return write({...state,saved:exists?state.saved.filter(x=>x.href!==safe):[{href:safe,title,at:Date.now()},...state.saved]});}
    function remove(href){const state=read();return write({...state,saved:state.saved.filter(x=>x.href!==href)});}
    function clearRecent(){return write({...read(),recent:[]});}
    return {read,visit,toggle,remove,clearRecent,link,reload(){loaded=false;return read();}};
  }

  const api={navigation,pages,route,request,date,save,debounce,createWorkspace};if(typeof module==='object'&&module.exports)module.exports=api;else root.SiteUI=api;
})(typeof window==='object'?window:globalThis);

