(function(root){
'use strict';
const states=new Map(),NS='http://www.w3.org/2000/svg';let pinned=null,queued=false;
function groups(points){
  const map=new Map();
  points.forEach((p,index)=>{if(!Number.isFinite(p.x)||!p.text)return;const key=p.x.toFixed(3);if(!map.has(key))map.set(key,{x:p.x,y:p.y,indices:[],texts:[]});const g=map.get(key);g.indices.push(index);if(!g.texts.includes(p.text))g.texts.push(p.text);});
  return [...map.values()].sort((a,b)=>a.x-b.x);
}
function attach(container,points,options={}){
  const svg=container?.matches?.('svg')?container:container?.querySelector('svg');if(!svg)return;
  states.get(svg)?.destroy();
  const data=groups(points);if(!data.length)return;
  const host=svg.parentElement,abort=new AbortController(),listen=(node,event,fn)=>node.addEventListener(event,fn,{signal:abort.signal});
  svg.classList.add('site-interactive-chart');svg.setAttribute('tabindex','0');svg.setAttribute('data-chart-ready','true');
  const tip=document.createElement('div');tip.className='site-chart-tooltip research-tooltip';tip.role='status';tip.hidden=true;host.append(tip);
  const line=document.createElementNS(NS,'line');line.setAttribute('class','site-chart-guide');line.setAttribute('y1','16');line.setAttribute('y2',String(Math.max(18,svg.viewBox.baseVal.height-32)));line.hidden=true;line.style.display='none';svg.append(line);
  let index=data.length-1,isPinned=false;
  function place(g,event){
    const matrix=svg.getScreenCTM(),point=svg.createSVGPoint();point.x=g.x;point.y=Number.isFinite(g.y)?g.y:svg.viewBox.baseVal.height/2;
    const screen=matrix?point.matrixTransform(matrix):{x:event?.clientX||0,y:event?.clientY||0};
    const box=svg.getBoundingClientRect(),tx=event?.clientX??screen.x,ty=event?.clientY??Math.max(box.top+40,screen.y);
    tip.style.left=Math.max(8,Math.min(tx+16,innerWidth-tip.offsetWidth-8))+'px';
    tip.style.top=Math.max(8,Math.min(ty+16,innerHeight-tip.offsetHeight-8))+'px';
  }
  function show(i,event){
    index=Math.max(0,Math.min(data.length-1,i));const g=data[index];
    tip.textContent=g.texts.join('\n')+(isPinned?'\n已固定 · 再次点击或 Esc 关闭':'');
    tip.hidden=false;tip.dataset.pinned=String(isPinned);
    line.setAttribute('x1',g.x);line.setAttribute('x2',g.x);line.style.display=options.crosshair===false?'none':'block';
    options.onSelect?.(g.indices[0]);place(g,event);
  }
  function hide(force=false){if(isPinned&&!force)return;isPinned=false;if(pinned===state)pinned=null;tip.hidden=true;line.style.display='none';options.onClear?.();}
  function nearest(event){
    const matrix=svg.getScreenCTM();if(!matrix)return index;const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
    const x=p.matrixTransform(matrix.inverse()).x;
    return data.reduce((a,g,i)=>Math.abs(g.x-x)<Math.abs(data[a].x-x)?i:a,0);
  }
  const state={svg,hide,destroy(){hide(true);abort.abort();tip.remove();line.remove();states.delete(svg);}};states.set(svg,state);
  listen(svg,'pointermove',e=>{if(!isPinned)show(nearest(e),e);});
  listen(svg,'pointerleave',()=>hide());
  listen(svg,'click',e=>{const next=nearest(e);if(isPinned&&next===index){hide(true);return;}pinned?.hide(true);isPinned=true;pinned=state;show(next,e);});
  listen(svg,'focus',()=>{if(tip.hidden)show(index);});
  listen(svg,'blur',()=>hide());
  listen(svg,'keydown',e=>{if(e.key==='Escape'){hide(true);e.preventDefault();}else if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?0:e.key==='End'?data.length-1:index+(e.key==='ArrowLeft'?-1:1));}});
  svg.querySelectorAll('[data-chart-point],circle[tabindex],.combo-hit').forEach(node=>listen(node,'focus',()=>{
    const x=Number(node.getAttribute('cx')??(Number(node.getAttribute('x'))+Number(node.getAttribute('width'))/2));
    if(Number.isFinite(x))show(data.reduce((a,g,i)=>Math.abs(g.x-x)<Math.abs(data[a].x-x)?i:a,0));
  }));
}
function nativePoints(svg){
  return [...svg.querySelectorAll('circle>title,rect>title')].filter(t=>!t.parentElement.closest('defs')).map(t=>{
    const n=t.parentElement,circle=n.tagName==='circle';return {x:Number(n.getAttribute(circle?'cx':'x'))+(circle?0:Number(n.getAttribute('width'))/2),y:Number(n.getAttribute(circle?'cy':'y')),text:t.textContent};
  });
}
let barTip=null,barTarget=null;
function barShow(target,pin=false){
  if(!barTip){barTip=document.createElement('div');barTip.className='site-chart-tooltip research-tooltip';barTip.role='status';document.body.append(barTip);}
  if(pin)pinned?.hide(true);
  barTarget=target;barTip.textContent=target.dataset.chartTooltip+(pin?'\n已固定 · 再次点击或 Esc 关闭':'');barTip.hidden=false;barTip.dataset.pinned=String(pin);
  const box=target.getBoundingClientRect();barTip.style.left=Math.max(8,Math.min(box.left+20,innerWidth-barTip.offsetWidth-8))+'px';barTip.style.top=Math.max(8,Math.min(box.bottom+8,innerHeight-barTip.offsetHeight-8))+'px';
  if(pin)pinned={svg:target,hide(){barTip.hidden=true;barTarget=null;pinned=null;}};
}
document.addEventListener('pointerover',e=>{const target=e.target.closest('[data-chart-tooltip]');if(target&&!pinned)barShow(target);});
document.addEventListener('focusin',e=>{const target=e.target.closest('[data-chart-tooltip]');if(target&&!pinned)barShow(target);});
document.addEventListener('pointerout',e=>{if(barTarget&&!barTarget.contains(e.relatedTarget)&&!pinned)barTip.hidden=true;});
document.addEventListener('focusout',()=>{if(barTip&&!pinned)barTip.hidden=true;});
document.addEventListener('click',e=>{const target=e.target.closest('[data-chart-tooltip]');if(target&&!target.closest('button,a')){if(pinned?.svg===target)pinned.hide(true);else barShow(target,true);}});
function scan(){
  queued=false;for(const [svg,state] of states)if(!svg.isConnected)state.destroy();
  document.querySelectorAll('.forecast-outcome,.fedwatch-range,.dh-bar-row,.gj-stacked [title],.retail-row').forEach(node=>{
    if(!node.dataset.chartTooltip)node.dataset.chartTooltip=node.getAttribute('aria-label')||node.getAttribute('title')||node.textContent.trim();
    if(!node.closest('button,a'))node.tabIndex=0;
  });
  document.querySelectorAll('svg').forEach(svg=>{if(states.has(svg))return;const points=nativePoints(svg);if(points.length)attach(svg,points);});
}
function schedule(){if(!queued){queued=true;requestAnimationFrame(scan);}}
function canvas(Chart){
  if(!Chart||Chart.registry.plugins.get('site-chart-interaction'))return;
  Chart.defaults.font.family='Inter, "Microsoft YaHei", sans-serif';Chart.defaults.font.size=12;
  Chart.register({id:'site-chart-interaction',beforeInit(chart){
    chart.options.interaction={...chart.options.interaction,mode:'index',intersect:false};
    chart.options.events=['mousemove','mouseout','click','touchstart','touchmove'];
    Object.assign(chart.options.plugins.tooltip,{enabled:true,mode:'index',intersect:false,backgroundColor:'#172b46',titleColor:'#fff',bodyColor:'#fff',padding:12,cornerRadius:8,titleFont:{size:14},bodyFont:{size:13}});
  },afterInit(chart){
    const node=chart.canvas;node.tabIndex=0;const abort=new AbortController();chart.$siteAbort=abort;
    node.addEventListener('keydown',e=>{if(e.key==='Escape'){chart.$sitePinned=null;chart.setActiveElements([]);chart.tooltip.setActiveElements([],{x:0,y:0});chart.update('none');}},{signal:abort.signal});
    document.addEventListener('pointerdown',e=>{if(chart.$sitePinned&&!node.contains(e.target)){chart.$sitePinned=null;chart.setActiveElements([]);chart.tooltip.setActiveElements([],{x:0,y:0});chart.update('none');}},{signal:abort.signal});
  },beforeEvent(chart,args){
    if(chart.$sitePinned&&args.event.type!=='click')return false;
  },afterEvent(chart,args){
    if(args.event.type!=='click')return;
    const active=chart.getElementsAtEventForMode(args.event,'index',{intersect:false},true);
    const index=active[0]?.index;if(index==null)return;
    if(chart.$sitePinned?.index===index){chart.$sitePinned=null;chart.setActiveElements([]);chart.tooltip.setActiveElements([],{x:0,y:0});}
    else{chart.$sitePinned={index};chart.setActiveElements(active);chart.tooltip.setActiveElements(active,{x:args.event.x,y:args.event.y});}
    args.changed=true;
  },afterDestroy(chart){chart.$siteAbort?.abort();}});
}
root.SiteCharts={attach,scan,canvas,groups};
document.addEventListener('pointerdown',e=>{if(pinned&&!pinned.svg.contains(e.target))pinned.hide(true);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')pinned?.hide(true);});
addEventListener('scroll',()=>{for(const state of states.values())state.hide(true);},{passive:true});
addEventListener('resize',()=>{for(const state of states.values())state.hide(true);});
function start(){scan();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
