(function(){
  'use strict';
  const search=location.search.slice(1),anchor=location.hash.slice(1);
  const target=SiteUI.route(anchor,search,false)||('industry.html'+location.search+location.hash);
  location.replace(target);
})();
