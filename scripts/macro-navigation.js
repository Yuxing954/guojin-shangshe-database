(function(){
  'use strict';
  const page=location.pathname.split('/').pop(),core=page==='macro.html';
  const icons={indicators:'<path d="M4 20h16M7 16V9M12 16V5M17 16v-5"/>',regional:'<path d="M3 20h18M5 20V9h6v11M13 20V4h6v16M7 12h2M7 15h2M15 8h2M15 12h2M15 16h2"/>',fedwatch:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',predictions:'<path d="M4 18 9 12l4 3 7-10M16 5h4v4"/>'};
  const items=[['indicators','核心指标','macro.html?view=indicators'],['regional','地方社零','regional-retail.html'],['fedwatch','FedWatch','macro.html?view=fedwatch'],['predictions','Polymarket','macro.html?view=predictions']];
  for(const nav of document.querySelectorAll('[data-macro-navigation]'))nav.innerHTML=items.map(([id,label,url])=>{const inside=core&&id!=='regional',active=core?id===(new URLSearchParams(location.search).get('view')||'indicators'):id==='regional',content='<span class="industry-sector-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[id]+'</svg></span><span>'+label+'</span>';return inside?'<button data-view="'+id+'" aria-pressed="'+active+'">'+content+'</button>':'<a class="macro-subtab'+(active?' current':'')+'" href="'+url+'"'+(active?' aria-current="page"':'')+'>'+content+'</a>';}).join('');
})();
