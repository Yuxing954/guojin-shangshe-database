(function(){
'use strict';
const query=new URLSearchParams(location.search),frame=document.getElementById('radar-frame'),open=document.getElementById('radar-open');
if(query.has('code')||query.has('ind')){
 const params=new URLSearchParams();
 for(const key of ['code','ind'])if(query.has(key))params.set(key,query.get(key));
 frame.src='etf-radar/docs/stock_detail.html?'+params.toString();
}
frame.addEventListener('load',()=>{try{const href=frame.contentWindow.location.href;if(new URL(href).origin===location.origin)open.href=href;}catch(e){}});
})();
