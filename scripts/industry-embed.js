(function(){
  'use strict';
  if(window.parent===window||new URLSearchParams(location.search).get('embed')!=='1')return;
  document.body.classList.add('industry-embedded');
  const main=document.querySelector('body > main')||document.querySelector('body > .wrap');if(!main)return;
  const header=main.querySelector('.hd-header,.hero,.portal-header'),stamp=document.getElementById('asof')||document.getElementById('checked');
  if(header){if(stamp){header.before(stamp);stamp.classList.add('embedded-asof');}header.remove();}
  document.querySelectorAll('.crumbs,[aria-label="行业板块"]').forEach(el=>el.remove());document.documentElement.classList.remove('industry-embedding');
  let pending=false,last='';
  function phase(){
    const error=document.getElementById('load-error'),retry=document.getElementById('retry');
    if(error&&!error.hidden||retry&&!retry.hidden||/无法读取|加载失败|读取失败/.test(stamp?.textContent||''))return 'error';
    const weekly=document.getElementById('dashboard'),holiday=document.getElementById('holiday-dashboard'),content=document.getElementById('content');
    if(weekly)return weekly.hidden?'loading':'ready';
    if(holiday)return holiday.hidden?'loading':'ready';
    if(content)return content.hidden?'loading':'ready';
    if(document.body.classList.contains('dutyfree-page')){
      if(document.getElementById('view-korea')?.classList.contains('on')){const state=document.getElementById('view-korea').dataset.status;return state==='error'?'error':state==='ready'?'ready':'loading';}
      if(!/月度截至/.test(stamp?.textContent||''))return 'loading';
      if(document.getElementById('view-holidays')?.classList.contains('on')){
        const root=document.getElementById('dutyfree-holidays');if(root?.querySelector('[role="alert"]'))return 'error';
        return document.getElementById('dh-cards')?.children.length&&document.getElementById('dh-chart')?.children.length?'ready':'loading';
      }
      return document.getElementById('hn-growth')?.getAttribute('data-chart-ready')==='true'?'ready':'loading';
    }return 'loading';
  }
  function send(){
    pending=false;const box=main.getBoundingClientRect(),layoutReady=box.width>0,height=layoutReady?Math.ceil(box.height+8):null,view=location.hash.slice(1),state=phase();
    const key=height+'|'+view+'|'+state+'|'+layoutReady;if(key===last)return;last=key;
    window.parent.postMessage({type:'industry-panel',height,view,state,layoutReady},location.origin);
  }
  function queue(){if(pending)return;pending=true;requestAnimationFrame(()=>requestAnimationFrame(send));}
  new ResizeObserver(queue).observe(main);new MutationObserver(queue).observe(main,{subtree:true,childList:true,attributes:true,characterData:true});
  addEventListener('resize',queue);addEventListener('hashchange',queue);addEventListener('pageshow',queue);
  addEventListener('pagehide',()=>window.parent.postMessage({type:'industry-panel',state:'loading',navigation:true},location.origin));
  queue();

  document.addEventListener('click',event=>{
    const link=event.target.closest('.hd-tabs a[href]');if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const url=new URL(link.href,location.href);if(url.origin!==location.origin)return;
    const file=url.pathname.split('/').pop();if(!['hotel-dashboard.html','hotel-holiday-dashboard.html','hotel-groups.html'].includes(file))return;
    const view=file==='hotel-groups.html'?'groups':file==='hotel-holiday-dashboard.html'?'holiday':new URLSearchParams(url.hash.slice(1)).get('view')||'overview';
    event.preventDefault();event.stopImmediatePropagation();parent.postMessage({type:'hotel-view',view},location.origin);
  },true);
  document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||link.target==='_blank'||link.hasAttribute('download'))return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname===location.pathname&&url.hash)return;link.target='_top';});
})();
