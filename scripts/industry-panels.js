(function(){
  'use strict';
  const pages={hotel:'hotel-dashboard.html',dutyfree:'dutyfree-dashboard.html',dining:'dining.html'},labels={hotel:'酒店',dutyfree:'免税',dining:'餐饮'},panels=new Map();
  function show(id){
    const host=document.getElementById('industry-panels');host.hidden=!pages[id];
    panels.forEach((panel,key)=>panel.wrap.hidden=key!==id);
    if(!pages[id]||panels.has(id))return;
    const wrap=document.createElement('section'),status=document.createElement('p'),frame=document.createElement('iframe');
    wrap.className='industry-panel';status.className='portal-status';status.textContent='正在读取'+labels[id]+'数据…';status.setAttribute('role','status');
    frame.id='panel-'+id;frame.className='industry-panel-frame';frame.title=labels[id];frame.setAttribute('aria-label',labels[id]+'数据');
    const url=new URL(pages[id],location.href);url.searchParams.set('embed','1');
    const view=new URLSearchParams(location.search).get('panelView');if(view)url.hash=view;
    let timer;const load=()=>{clearTimeout(timer);status.hidden=false;status.textContent='正在读取'+labels[id]+'数据…';frame.src=url.href;timer=setTimeout(()=>{status.textContent=labels[id]+'数据暂时无法读取。';const retry=document.createElement('button');retry.className='portal-button';retry.textContent='重试';retry.onclick=load;status.append(' ',retry);},15000);};
    wrap.append(status,frame);host.append(wrap);panels.set(id,{wrap,frame,status,ready:()=>{clearTimeout(timer);status.hidden=true;}});load();
  }
  addEventListener('message',event=>{
    if(event.origin!==location.origin||!event.data||event.data.type!=='industry-panel')return;
    const panel=[...panels.values()].find(p=>p.frame.contentWindow===event.source);if(!panel)return;
    const height=Number(event.data.height);if(Number.isFinite(height)&&height>0&&height<100000){panel.frame.style.height=Math.ceil(height)+'px';panel.ready();}
    if(location.hash==='#'+[...panels.entries()].find(([,p])=>p===panel)[0]&&typeof event.data.view==='string')SiteUI.save({panelView:event.data.view});
  });
  window.IndustryPanels={show};
})();
