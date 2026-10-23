(function(){
 'use strict';
 const core=location.pathname.endsWith('/macro.html'),view=new URLSearchParams(location.search).get('view');
 const active=core?(['fedwatch','predictions'].includes(view)?view:'indicators'):'regional';
 for(const link of document.querySelectorAll('[data-macro-navigation] a')){
  const selected=core?link.dataset.view===active:link.getAttribute('href')==='regional-retail.html';
  if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 }
})();
