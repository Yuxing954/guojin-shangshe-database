(function(){
 'use strict';
 const paths=['company-database.html','overseas-hotels.html'],page=location.pathname.split('/').pop(),key='gj-hotel-workspace-v1';let saved={};
 try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){}
 function safe(value,wanted){try{const u=new URL(value,location.href);return u.origin===location.origin&&u.pathname.split('/').pop()===wanted?u.pathname+u.search+u.hash:null;}catch(e){return null;}}
 if(paths.includes(page)&&!location.search){const last=safe(saved[page],page);if(last)history.replaceState(null,'',SiteUI.contextURL(last));}
 function remember(){if(!paths.includes(page))return;try{saved[page]=location.pathname+location.search+location.hash;localStorage.setItem(key,JSON.stringify(saved));}catch(e){} }
 function notify(text){let el=document.getElementById('hotel-toast');if(!el){el=document.createElement('div');el.id='hotel-toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=text;el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.hidden=true,3000);}
 window.HotelWorkspace={remember,notify};
 document.addEventListener('DOMContentLoaded',()=>{
  document.body.classList.add('hotel-workspace');
  document.querySelectorAll('[aria-label="重点公司栏目"] a').forEach(a=>{const p=new URL(a.href).pathname.split('/').pop(),href=safe(saved[p],p);if(href&&p!==page)a.href=href;a.addEventListener('click',remember);});
 });
 document.addEventListener('keydown',e=>{const b=e.target.closest('[data-db-company],[data-company],[data-hr-panel],[data-tab]');if(!b||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const items=[...b.parentElement.querySelectorAll('button')],i=items.indexOf(b),n=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowRight'?1:-1)+items.length)%items.length;e.preventDefault();items[n].focus();items[n].click();});
 window.addEventListener('pagehide',remember);
})();

