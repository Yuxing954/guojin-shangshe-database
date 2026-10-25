(function(root){
'use strict';
function position(menu){
 if(!menu.open)return;
 for(let n=menu.parentElement;n&&n!==document.body;n=n.parentElement){const s=getComputedStyle(n);if(s.overflowX!=='visible'||s.overflowY!=='visible')n.classList.add('site-annotation-menu-host');if(n.classList.contains('site-chart-label-scope'))break;}
 const options=menu.querySelector('.site-value-options');if(!options)return;
 options.style.transform='';
 const box=options.getBoundingClientRect(),shift=Math.max(8-box.left,Math.min(0,innerWidth-8-box.right));
 const above=menu.getBoundingClientRect().top-box.height-6;
 const top=box.bottom>innerHeight-8&&above>=8?above:Math.max(8,Math.min(box.top,innerHeight-8-box.height));
 if(shift||top!==box.top)options.style.transform='translate('+shift+'px,'+(top-box.top)+'px)';
}
function wrap(content){
 const existing=content.closest('.site-value-menu');if(existing)return existing;
 const menu=document.createElement('details'),summary=document.createElement('summary');
 menu.className='site-value-menu';summary.textContent='图表标注';
 const options=content.classList.contains('site-value-options')?content:document.createElement('span');
 if(options!==content)options.className='site-value-options';
 if(content.isConnected)content.before(menu);
 menu.append(summary,options);if(options!==content)options.append(content);
 summary.addEventListener('click',e=>{e.preventDefault();const open=!menu.open;document.querySelectorAll('.site-value-menu[open]').forEach(m=>{if(m!==menu)m.open=false;});menu.open=open;position(menu);});
 menu.addEventListener('toggle',()=>position(menu));
 return menu;
}
document.addEventListener('pointerdown',e=>{document.querySelectorAll('.site-value-menu[open]').forEach(m=>{if(!m.contains(e.target))m.open=false;});});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.site-value-menu[open]').forEach(m=>{e.preventDefault();m.open=false;m.querySelector('summary').focus();});});
addEventListener('resize',()=>requestAnimationFrame(()=>document.querySelectorAll('.site-value-menu[open]').forEach(position)));
addEventListener('scroll',()=>document.querySelectorAll('.site-value-menu[open]').forEach(position),{capture:true,passive:true});
root.ChartAnnotations={wrap,position};
})(window);
