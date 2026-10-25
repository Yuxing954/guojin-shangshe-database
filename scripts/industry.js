(function(){
  'use strict';
  const labels={hotel:'酒店',dutyfree:'免税',gold:'黄金',tourism:'三峡游轮',dining:'餐饮',travel:'旅游'};
  function select(){
    let key=location.hash.slice(1);
    if(!labels[key] || key==='gold'){key='hotel';}
    document.title=labels[key]+'行业数据 · 零售&社服数据库';
    document.getElementById('sector-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.key===key)));
    document.getElementById('gold-content').hidden=key!=='gold';
    IndustryPanels.show(key);
    if(key==='gold')GoldDashboard.load();
  }
  document.getElementById('sector-tabs').onclick=e=>{const b=e.target.closest('[data-key]');if(b){SiteUI.save({panelView:'',panelSector:''});location.hash=b.dataset.key;}};
  addEventListener('hashchange',select);
  select();
})();

