(function(root){
  'use strict';
  function attach(container,points){
    const svg=container.querySelector('svg');if(!svg||!points.length)return;
    container.classList.add('research-chart');
    const ns='http://www.w3.org/2000/svg',line=document.createElementNS(ns,'line'),dot=document.createElementNS(ns,'circle');
    line.setAttribute('class','chart-crosshair');line.setAttribute('y1','25');line.setAttribute('y2',String(svg.viewBox.baseVal.height-40));
    dot.setAttribute('class','chart-active-dot');dot.setAttribute('r','5');svg.append(line,dot);
    const tip=document.createElement('div');tip.className='research-tooltip';tip.setAttribute('role','status');tip.hidden=true;container.append(tip);
    function show(p){line.setAttribute('x1',p.x);line.setAttribute('x2',p.x);dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);line.style.display=dot.style.display='block';tip.textContent=p.text;tip.hidden=false;
      const bounds=svg.getBoundingClientRect(),host=container.getBoundingClientRect();const px=(p.x/svg.viewBox.baseVal.width)*bounds.width+bounds.left-host.left;
      tip.style.left=Math.max(8,Math.min(px+12,host.width-tip.offsetWidth-8))+'px';tip.style.top='16px';
    }
    function hide(){line.style.display=dot.style.display='none';tip.hidden=true;}
    svg.addEventListener('pointermove',e=>{const box=svg.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*svg.viewBox.baseVal.width;show(points.reduce((a,b)=>Math.abs(b.x-x)<Math.abs(a.x-x)?b:a));});
    svg.addEventListener('pointerleave',hide);
    svg.querySelectorAll('[data-chart-point]').forEach(el=>{const p=points[Number(el.dataset.chartPoint)];if(p){el.addEventListener('focus',()=>show(p));el.addEventListener('blur',hide);el.addEventListener('click',()=>show(p));}});
    hide();
  }
  root.ResearchChart={attach};
})(window);
