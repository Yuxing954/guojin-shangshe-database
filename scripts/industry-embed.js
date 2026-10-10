(function(){
  'use strict';
  if(window.parent===window||new URLSearchParams(location.search).get('embed')!=='1')return;
  document.body.classList.add('industry-embedded');
  const main=document.querySelector('body > main')||document.querySelector('body > .wrap');
  if(!main)return;
  const header=main.querySelector('.hd-header,.hero,.portal-header'),stamp=document.getElementById('asof')||document.getElementById('checked');
  if(header){if(stamp){header.before(stamp);stamp.classList.add('embedded-asof');}header.hidden=true;}
  document.querySelectorAll('.crumbs,[aria-label="行业板块"]').forEach(el=>el.hidden=true);
  let pending=false,last='';
  function size(){pending=false;const height=Math.ceil(main.getBoundingClientRect().height+8),view=location.hash.slice(1),key=height+'|'+view;if(key===last)return;last=key;window.parent.postMessage({type:'industry-panel',height,view},location.origin);}
  function queue(){if(pending)return;pending=true;requestAnimationFrame(size);}
  new ResizeObserver(queue).observe(main);new MutationObserver(queue).observe(main,{subtree:true,childList:true,attributes:true,characterData:true});addEventListener('resize',queue);addEventListener('hashchange',queue);queue();
  document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||link.target==='_blank'||link.hasAttribute('download'))return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname===location.pathname&&url.hash)return;link.target='_top';});
})();
