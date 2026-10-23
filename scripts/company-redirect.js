(function(){
 const domestic=location.pathname.includes('domestic-'),p=new URLSearchParams(location.search);
 if(!p.has('peers'))p.set('peers',domestic?'jinjiang,btg,hworld,atour':'marriott,hyatt,ihg,hilton');
 if(p.get('tab')==='comparison')p.delete('tab');
 const u=new URL(domestic?'company-database.html':'overseas-hotels.html',location.href);u.search=p.toString();location.replace(u.href);
})();
