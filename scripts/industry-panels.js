(function(){
  'use strict';
  const pages={hotel:'hotel-dashboard.html',dutyfree:'dutyfree-dashboard.html',tourism:'cruise-dashboard.html'},labels={hotel:'酒店',dutyfree:'免税',gold:'黄金',tourism:'三峡游轮'},panels=new Map();
  const host=document.getElementById('industry-panels'),stage=document.getElementById('industry-stage'),status=document.getElementById('status'),text=document.getElementById('industry-load-text'),retry=document.getElementById('industry-load-retry'),gold=document.getElementById('gold-content');
  let active='hotel',goldState='loading',goldPending=false;const hotelViews=new Map();let hotelWarmed=false;
  function paint(){
    const state=active==='gold'?goldState:panels.get(active)?.state||'loading',ready=state==='ready';
    stage.dataset.state=state;stage.setAttribute('aria-busy',String(!ready));status.hidden=ready;
    text.textContent=state==='error'?'数据暂时无法读取，请重试。':'正在读取数据…';retry.hidden=state!=='error';
    status.querySelector('.industry-loading-mark').hidden=state==='error';
  }
  retry.onclick=()=>{if(active==='gold'){location.reload();return;}panels.get(active)?.load(true);};
  function show(id){
    active=id;host.hidden=!pages[id];panels.forEach((p,key)=>p.wrap.hidden=key!==id);
    if(!pages[id]||panels.has(id)){paint();return;}
    const wrap=document.createElement('section'),frame=document.createElement('iframe');
    wrap.className='industry-panel';frame.id='panel-'+id;frame.className='industry-panel-frame';frame.dataset.state='loading';frame.title=labels[id];frame.setAttribute('aria-label',labels[id]+'数据');
    const url=new URL(pages[id],location.href);url.searchParams.set('embed','1');url.searchParams.set('v','20261022korea');
    const saved=new URLSearchParams(location.search),owner=saved.get('panelSector');let view=owner===id?saved.get('panelView'):null;
    if(view){const key=new URLSearchParams(view).get('view')||view;const allowed=id==='hotel'?['overview','cities','structure','holiday','groups']:id==='dutyfree'?['monthly','korea','holidays']:[];if(!allowed.includes(key))view=null;}
    if(id==='hotel'&&view&&new URLSearchParams(view).get('view')==='holiday')url.pathname=url.pathname.replace('hotel-dashboard.html','hotel-holiday-dashboard.html');
    if(id==='hotel'&&view&&new URLSearchParams(view).get('view')==='groups')url.pathname=url.pathname.replace('hotel-dashboard.html','hotel-groups.html');
    if(view)url.hash=view;
    const panel={wrap,frame,state:'loading',timer:null};
    panel.begin=()=>{clearTimeout(panel.timer);panel.state='loading';frame.dataset.state='loading';if(active===id)paint();panel.timer=setTimeout(()=>{panel.state='error';frame.dataset.state='error';if(active===id)paint();},30000);};
    panel.load=(reload=false)=>{let target=url.href;if(reload){try{const current=new URL(frame.contentWindow.location.href);if(current.origin===location.origin&&/\/(hotel-dashboard|hotel-holiday-dashboard|hotel-groups|dutyfree-dashboard|cruise-dashboard)\.html$/.test(current.pathname))target=current.href;}catch{}}panel.begin();frame.src=target;};
    wrap.append(frame);host.append(wrap);panels.set(id,panel);if(id==='hotel'){panel.viewKey=hotelKey(url.pathname);hotelViews.set(panel.viewKey,panel);}panel.load();
  }

  function hotelKey(path){return path.endsWith('hotel-groups.html')?'groups':path.endsWith('hotel-holiday-dashboard.html')?'holiday':'weekly';}
  function hotelFrame(key,view){
    if(hotelViews.has(key))return hotelViews.get(key);
    const current=panels.get('hotel'),frame=document.createElement('iframe'),url=new URL(key==='groups'?'hotel-groups.html':key==='holiday'?'hotel-holiday-dashboard.html':'hotel-dashboard.html',location.href);
    url.searchParams.set('embed','1');url.searchParams.set('v','20261022korea');url.hash='view='+view;
    frame.className='industry-panel-frame';frame.title=key==='groups'?'酒店集团':key==='holiday'?'酒店假期数据':'酒店经营数据';frame.id='panel-hotel-'+key;
    frame.style.cssText='position:absolute;top:0;left:0;width:100%;visibility:hidden;pointer-events:none';frame.setAttribute('aria-hidden','true');frame.inert=true;
    const panel={wrap:current.wrap,frame,state:'loading',timer:null,viewKey:key};
    panel.begin=()=>{clearTimeout(panel.timer);panel.state='loading';frame.dataset.state='loading';if(panels.get('hotel')===panel&&active==='hotel')paint();panel.timer=setTimeout(()=>{panel.state='error';frame.dataset.state='error';if(panels.get('hotel')===panel&&active==='hotel')paint();},30000);};
    panel.load=()=>{panel.begin();frame.src=url.href;};
    current.wrap.style.position='relative';current.wrap.append(frame);hotelViews.set(key,panel);panel.load();return panel;
  }
  function warmHotel(){
    if(hotelWarmed)return;hotelWarmed=true;
    for(const [key,view] of [['weekly','overview'],['groups','groups'],['holiday','holiday']])hotelFrame(key,view);
  }
  function selectHotel(view){
    const key=['groups','holiday'].includes(view)?view:'weekly',next=hotelFrame(key,view);
    hotelViews.forEach(panel=>{const selected=panel===next;panel.frame.id=selected?'panel-hotel':'panel-hotel-'+panel.viewKey;
      Object.assign(panel.frame.style,{position:selected?'relative':'absolute',top:'0',left:'0',width:'100%',visibility:selected?'visible':'hidden',pointerEvents:selected?'auto':'none'});
      panel.frame.inert=!selected;panel.frame.setAttribute('aria-hidden',String(!selected));
    });
    panels.set('hotel',next);
    if(key==='weekly'){try{const win=next.frame.contentWindow,params=new URLSearchParams(win.location.hash.slice(1));params.set('view',view);win.history.replaceState(null,'','#'+params);win.dispatchEvent(new CustomEvent('hotel:switch-view',{detail:view}));}catch{}}
    try{next.frame.contentWindow.dispatchEvent(new Event('resize'));}catch{}
    if(active==='hotel')paint();
    if(next.state==='ready'){try{SiteUI.save({panelSector:'hotel',panelView:next.frame.contentWindow.location.hash.slice(1)});}catch{}}
  }

  addEventListener('message',event=>{
    if(event.origin!==location.origin||!event.data)return;
    const entry=[...panels.entries(),...[...hotelViews.values()].map(p=>['hotel',p])].find(([,p])=>p.frame.contentWindow===event.source);if(!entry)return;
    if(event.data.type==='hotel-view'){if(entry[0]==='hotel'&&['overview','cities','structure','groups','holiday'].includes(event.data.view))selectHotel(event.data.view);return;}
    if(event.data.type!=='industry-panel')return;
    const [id,panel]=entry,data=event.data;
    if(data.state==='loading'&&data.navigation){panel.begin();return;}
    const height=Number(data.height);if(Number.isFinite(height)&&height>0&&height<100000)panel.frame.style.height=Math.ceil(height)+'px';
    if(['ready','error'].includes(data.state)){clearTimeout(panel.timer);if(data.state==='ready'&&!data.layoutReady){if(panel.state!=='ready'){panel.state='loading';panel.frame.dataset.state='loading';}}else{panel.state=data.state;panel.frame.dataset.state=data.state;}if(active===id&&panels.get(id)===panel)paint();if(id==='hotel'&&data.state==='ready'&&data.layoutReady)setTimeout(warmHotel,0);}
    // Layout messages alone never dismiss the loader or overwrite a saved view.
    if(active===id&&panels.get(id)===panel&&data.state==='ready'&&data.layoutReady&&typeof data.view==='string')SiteUI.save({panelSector:id,panelView:data.view});
  });
  function checkGold(){
    goldPending=false;
    const error=gold.querySelector('#load-error'),dashboard=gold.querySelector('#dashboard'),next=error&&!error.hidden?'error':dashboard&&!dashboard.hidden?'ready':'loading';
    if(next===goldState)return;
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{goldState=next;if(active==='gold')paint();});});
  }
  new MutationObserver(()=>{if(!goldPending){goldPending=true;requestAnimationFrame(checkGold);}}).observe(gold,{subtree:true,childList:true,attributes:true,characterData:true});
  window.IndustryPanels={show};
})();
