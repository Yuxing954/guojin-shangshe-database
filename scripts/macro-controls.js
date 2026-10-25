(function(){
'use strict';
const menus=[...document.querySelectorAll('.regional-options')];
function position(el){const panel=el.querySelector(':scope>.regional-controls');if(!panel)return;panel.style.transform='';const b=panel.getBoundingClientRect();const shift=b.right>innerWidth-12?innerWidth-12-b.right:b.left<12?12-b.left:0;if(shift)panel.style.transform='translateX('+shift+'px)';}
for(const menu of menus){menu.querySelector('summary').addEventListener('click',e=>{e.preventDefault();menu.open=!menu.open;if(menu.open)position(menu);});menu.addEventListener('toggle',()=>{if(menu.open)position(menu);});}
document.addEventListener('click',e=>{for(const menu of menus)if(menu.open&&!menu.contains(e.target))menu.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const menu of menus)if(menu.open){menu.open=false;menu.querySelector('summary').focus();}});
addEventListener('resize',()=>{for(const menu of menus)if(menu.open)position(menu);});
})();