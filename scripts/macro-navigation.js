(function(){
 'use strict';
 function sync(view){
  const core=location.pathname.endsWith('/macro.html');
  const selected=core?(['fedwatch','predictions'].includes(view)?'forecasts':'indicators'):'consumption';
  document.querySelectorAll('[data-macro-section]').forEach(link=>{
   if(link.dataset.macroSection===selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-macro-subnav]').forEach(nav=>{
   nav.hidden=nav.dataset.macroSubnav!==selected;
   nav.querySelectorAll('a').forEach(link=>{
    const active=core?link.dataset.view===view:new URL(link.href).pathname===location.pathname;
    if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
   });
  });
 }
 window.MacroNavigation={sync};
 sync(new URLSearchParams(location.search).get('view'));
})();

