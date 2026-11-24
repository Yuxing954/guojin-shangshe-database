(function(){
  'use strict';
  const search=location.search.slice(1),anchor=location.hash.slice(1);
  const target=SiteUI.route(anchor,search,false)||((anchor||search?'industry.html':'workspace.html')+location.search+location.hash);
  location.replace(target);
})();
