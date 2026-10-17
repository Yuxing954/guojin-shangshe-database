(function(root){
'use strict';
// Numeric scale helpers also serve the Node data-rendering checks.
if(typeof module==='object'&&module.exports){module.exports={niceScale,axisFormat};return;}
const states=new Map(),NS='http://www.w3.org/2000/svg';let pinned=null,queued=false;
function groups(points){
  const map=new Map();
  points.forEach((p,index)=>{if(!Number.isFinite(p.x)||!p.text)return;const key=p.x.toFixed(3);if(!map.has(key))map.set(key,{x:p.x,y:p.y,indices:[],texts:[]});const g=map.get(key);g.indices.push(index);if(!g.texts.includes(p.text))g.texts.push(p.text);});
  return [...map.values()].sort((a,b)=>a.x-b.x);
}
// Apply the shared design to the legacy SVG renderers as well as paired charts.
function themeChart(svg){
  if(svg.classList.contains('quotes-chart'))return; // Market candle colors encode price direction.
  svg.dataset.siteChartTheme='blue-gold';
  if(svg.classList.contains('site-paired-chart'))return;
  const ink=['#2167a0','#ac863d','#668397','#538db5','#8d7852','#476777'];
  const pale=['#abcfe8','#e6d4ab','#c3d0d9','#bfdcec','#d8ccb5','#acc2ce'];
  const colorMap=new Map(),key=(node,prop)=>getComputedStyle(node)[prop];
  const colorIndex=color=>{if(!colorMap.has(color))colorMap.set(color,colorMap.size%ink.length);return colorMap.get(color);};
  const lines=[...svg.querySelectorAll('polyline,path')].filter(n=>!n.closest('defs')&&!n.classList.contains('site-axis-rule')&&key(n,'fill')==='none'&&key(n,'stroke')!=='none');
  const dots=[...svg.querySelectorAll('circle')].filter(n=>!n.closest('defs'));
  const bars=[...svg.querySelectorAll('rect')].filter(n=>!n.closest('defs')&&!n.classList.contains('combo-hit')&&key(n,'fill')!=='none'&&key(n,'fill')!=='transparent');
  const originalLines=lines.map(n=>[n,colorIndex(key(n,'stroke'))]);
  const originalDots=dots.map(n=>[n,colorIndex(key(n,'stroke')==='none'?key(n,'fill'):key(n,'stroke'))]);
  const originalBars=bars.map(n=>[n,colorIndex(key(n,'fill'))]);
  originalLines.forEach(([n,i])=>{n.style.setProperty('stroke',ink[i],'important');n.style.strokeWidth='2.6';n.style.strokeLinejoin='round';n.style.strokeLinecap='round';});
  originalDots.forEach(([n,i])=>{n.style.setProperty('fill','white','important');n.style.setProperty('stroke',ink[i],'important');n.style.strokeWidth='1.8';});
  originalBars.forEach(([n,i])=>{n.style.setProperty('fill',pale[i],'important');n.style.opacity='1';});
  // Some legacy renderers draw only paths. Add hollow markers on their real vertices.
  if(!dots.length){
    const group=document.createElementNS(NS,'g');group.classList.add('site-legacy-markers');group.setAttribute('aria-hidden','true');
    originalLines.forEach(([n,i])=>{
      const values=n.tagName==='polyline'?(n.getAttribute('points')||'').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi):null;
      const pairs=values?Array.from({length:Math.floor(values.length/2)},(_,j)=>[+values[2*j],+values[2*j+1]]):[...(n.getAttribute('d')||'').matchAll(/[ML]\s*(-?\d*\.?\d+(?:e[-+]?\d+)?)[,\s]+(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi)].map(m=>[+m[1],+m[2]]);
      const stride=Math.max(1,Math.ceil(pairs.length/60));pairs.forEach(([x,y],j)=>{if(j%stride&&j!==pairs.length-1)return;const dot=document.createElementNS(NS,'circle');for(const [k,v]of Object.entries({cx:x,cy:y,r:3,fill:'white',stroke:ink[i],'stroke-width':1.8}))dot.setAttribute(k,v);group.append(dot);});
    });if(group.childNodes.length)svg.append(group);
  }
  const host=svg.parentElement;
  host.querySelectorAll('.hd-legend i,.gj-legend i,.legend i').forEach(n=>{const color=key(n,'backgroundColor');if(colorMap.has(color))n.style.backgroundColor=ink[colorMap.get(color)];});
}

// Keep dense legacy plots readable on touch screens without widening the page.
function mobileChart(svg){
  if(svg.classList.contains('site-paired-chart')||!svg.querySelector('text'))return;
  let frame=svg.parentElement;
  if(!frame.classList.contains('site-chart-scroll')){
    frame=document.createElement('div');frame.className='site-chart-scroll';
    frame.tabIndex=0;frame.setAttribute('role','region');
    frame.setAttribute('aria-label','趋势图，可横向滑动查看');
    svg.before(frame);frame.append(svg);
  }
  const width=svg.viewBox.baseVal.width;
  if(width){
    const sizes=[...svg.querySelectorAll('text')].map(n=>parseFloat(getComputedStyle(n).fontSize)).filter(n=>n>0);
    const size=sizes.length?Math.min(...sizes):12;
    svg.style.setProperty('--site-readable-width',Math.ceil(width*Math.min(1,12/size))+'px');
  }
}
function mobileTable(table){
  table.classList.add('site-data-table');
  const parent=table.parentElement;
  if(parent.classList.contains('site-table-scroll'))return;
  if(['auto','scroll'].includes(getComputedStyle(parent).overflowX)){
    parent.classList.add('site-table-scroll');
    parent.tabIndex=0;parent.setAttribute('role','region');parent.setAttribute('aria-label','数据表，可横向滑动查看');return;
  }
  const frame=document.createElement('div');frame.className='site-table-scroll';frame.tabIndex=0;
  frame.setAttribute('role','region');frame.setAttribute('aria-label','数据表，可横向滑动查看');
  table.before(frame);frame.append(table);
}
// One opt-in value label control per chart panel; display state never changes source data.
const valueScopes=new WeakMap();
function shortValue(text){
  const tail=String(text??'').trim().split(/[\n：]/).at(-1);
  const matches=[...tail.matchAll(/[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s*(?:%|pct|百分点|元\/克|元|亿元|万元|万人次|万件|家|间|点|美元|港元))?/g)];
  return matches.at(-1)?.[0]||'';
}
function chartScope(svg){return svg.closest('.hd-tier-trend,.hd-card,.gj-card,.morning-trend,.morning-trend-card,#quote-detail,.board-panel,.portal-panel')||svg.closest('article,section')||svg.parentElement.parentElement;}
function valuesControl(svg){
  if(svg.matches('[aria-hidden=true],.macro-spark')||svg.closest('button,a'))return null;
  const scope=chartScope(svg);if(!scope)return null;
  let config=valueScopes.get(scope);
  const legacy=scope.querySelector('input[data-chart-labels]');
  if(legacy){if(!config){config={scope,hotel:false,node:legacy.closest('label')};valueScopes.set(scope,config);}config.value=legacy.checked;config.change=legacy.checked;return config;}
  const hotel=document.body.classList.contains('hotel-page'),metric=scope.querySelector('#metric-switch')?.querySelector('[aria-pressed=true]')?.textContent.trim()||scope.querySelector('[data-metric][aria-pressed=true]')?.textContent.trim()||document.querySelector('#metric-switch [aria-pressed=true],#holiday-metric-switch [aria-pressed=true]')?.textContent.trim()||'数值';
  if(!config){config={scope,hotel,value:false,change:false};valueScopes.set(scope,config);}
  if(!config.node?.isConnected){
    const node=document.createElement('span');node.className='site-value-options';config.node=node;
    for(const key of hotel?['value','change']:['value']){
      const label=document.createElement('label'),input=document.createElement('input'),caption=document.createElement('span');label.className='site-value-option';input.type='checkbox';input.dataset.valueKind=key;input.checked=config[key];input.addEventListener('change',()=>{config[key]=input.checked;if(!hotel)config.change=input.checked;for(const state of [...states.values()])if(state.valueScope===scope)state.refreshValues();});label.append(input,caption);node.append(label);config[key+'Caption']=caption;
    }
    const fields=[...scope.querySelectorAll('select,input[type=date]')].filter(n=>chartScope(n)===scope&&!n.closest('.site-value-options')&&(/window|range|history-start|from|\bto\b|years|price-end/.test(n.id)||/范围|区间/.test(n.getAttribute('aria-label')||'')||/范围|期间|开始|结束/.test(n.closest('label')?.textContent||'')));
    const field=fields.at(-1),anchor=field?.closest('label')||field;
    if(anchor){let row=anchor.parentElement;if(!row.classList.contains('site-chart-options')){row=document.createElement('span');row.className='site-chart-options';anchor.before(row);row.append(anchor);}row.append(node);}
    else{const head=scope.querySelector('.hd-card-head,.gj-card-head,.board-panel-head,.portal-panel-head,.quotes-chart-options,.sector-controls,.macro-detail-controls');if(head)head.append(node);else{node.classList.add('site-value-options-standalone');const host=svg.closest('.site-chart-scroll')||svg;host.before(node);}}
  }
  config.valueCaption.textContent=hotel&&metric!=='数值'?'显示 '+metric:'显示数值';if(hotel)config.changeCaption.textContent='显示同比';
  return config;
}
function valueLabels(svg,points,config){
  svg.querySelector('.site-value-labels')?.remove();if(!config||!config.value&&!config.change)return;
  const explicit=points.flatMap(p=>p.labels||[]),hasExplicit=points.some(p=>Array.isArray(p.labels));
  const labels=hasExplicit?explicit:points.filter(p=>Number.isFinite(p.y)).map(p=>({x:p.x,y:p.y,text:p.label||shortValue(p.text),kind:p.kind||'value'}));
  if(!hasExplicit&&!labels.length)for(const p of nativePoints(svg))labels.push({...p,text:shortValue(p.text),kind:'value'});
  const layer=document.createElementNS(NS,'g');layer.classList.add('site-value-labels');layer.setAttribute('aria-hidden','true');
  const width=svg.viewBox.baseVal.width,height=svg.viewBox.baseVal.height,occupied=[];
  for(const p of labels){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!p.text||!(p.kind==='change'?config.change:config.value))continue;
    const text=String(p.text),tw=text.length*6.7+8,x=Math.max(tw/2+3,Math.min(width-tw/2-3,p.x));let y=Math.max(28,Math.min(height-36,p.y-11));
    for(let i=0;i<36;i++){const next=Math.max(28,Math.min(height-36,p.y+(i?Math.ceil(i/2)*16*(i%2?1:-1):-11)));if(!occupied.some(b=>Math.abs(b.x-x)<(b.w+tw)/2+2&&Math.abs(b.y-next)<14)){y=next;break;}y=next;}
    occupied.push({x,y,w:tw});
    const n=document.createElementNS(NS,'text');n.classList.add('site-value-label');n.dataset.kind=p.kind||'value';n.setAttribute('x',x);n.setAttribute('y',y);n.setAttribute('text-anchor','middle');if(p.color)n.style.fill=p.color;n.textContent=text;layer.append(n);
  }svg.append(layer);
}
function prepareValues(svg,points,config){
  if(points.paired&&config){
    const meta=points.paired,showValue=config.value,showChange=config.change;
    if(meta.showValue!==showValue||meta.showChange!==showChange||svg.dataset.valuesMode!==String(showValue)+'|'+String(showChange)){
      const result=paired(meta.rows,{...meta.options,valueLabels:showValue,yoyLabels:showChange});
      const oldWrap=svg.parentElement,oldOverflow=oldWrap.scrollWidth-oldWrap.clientWidth,wasAtEnd=oldOverflow<=0||oldWrap.scrollLeft>=oldOverflow-2,oldRatio=oldOverflow>0?oldWrap.scrollLeft/oldOverflow:1;
      const shell=document.createElement('div');shell.innerHTML=result.html;const next=shell.querySelector('svg');svg.setAttribute('viewBox',next.getAttribute('viewBox'));svg.innerHTML=next.innerHTML;
      svg.dataset.valuesMode=String(showValue)+'|'+String(showChange);
      const expanded=showValue||showChange;
      svg.style.setProperty('width',expanded?next.viewBox.baseVal.width+'px':'100%','important');svg.style.setProperty('min-width',expanded?next.viewBox.baseVal.width+'px':'0','important');svg.style.setProperty('max-width',expanded?'none':'100%','important');svg.style.setProperty('height','auto','important');svg.style.setProperty('min-height','0','important');
      if(!svg.parentElement.classList.contains('site-chart-scroll')){const wrap=document.createElement('div');wrap.className='site-chart-scroll';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','图表，可横向滚动');svg.before(wrap);wrap.append(svg);}
      points=result.points;
      if(expanded)requestAnimationFrame(()=>{const wrap=svg.parentElement;wrap.scrollLeft=(wrap.scrollWidth-wrap.clientWidth)*(wasAtEnd?1:oldRatio);});
    }
  }valueLabels(svg,points,config);return points;
}
function attach(container,points,options={}){
  const svg=container?.matches?.('svg')?container:container?.querySelector('svg');if(!svg)return;
  states.get(svg)?.destroy();
  svg.querySelector('.site-legacy-markers')?.remove();
  const originalPoints=points,config=valuesControl(svg);points=prepareValues(svg,points,config);
  themeChart(svg);
  mobileChart(svg);
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
    tip.textContent=g.texts.join('\n');
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
  const state={svg,hide,valueScope:config?.scope,refreshValues(){attach(svg,originalPoints,options);},refresh(){if(tip.hidden)return;const b=svg.getBoundingClientRect();if(b.bottom<0||b.top>innerHeight)hide(true);else place(data[index]);},destroy(){hide(true);abort.abort();tip.remove();line.remove();states.delete(svg);}};states.set(svg,state);
  listen(svg,'pointermove',e=>{if(e.pointerType==='touch')return;if(!isPinned)show(nearest(e),e);});
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
  barTarget=target;barTip.textContent=target.dataset.chartTooltip;barTip.hidden=false;barTip.dataset.pinned=String(pin);
  const box=target.getBoundingClientRect();barTip.style.left=Math.max(8,Math.min(box.left+20,innerWidth-barTip.offsetWidth-8))+'px';barTip.style.top=Math.max(8,Math.min(box.bottom+8,innerHeight-barTip.offsetHeight-8))+'px';
  if(pin)pinned={svg:target,hide(){barTip.hidden=true;barTarget=null;pinned=null;}};
}
document.addEventListener('pointerover',e=>{const target=e.target.closest('[data-chart-tooltip]');if(target&&!pinned)barShow(target);});
document.addEventListener('focusin',e=>{const target=e.target.closest('[data-chart-tooltip]');if(target&&!pinned)barShow(target);});
document.addEventListener('pointerout',e=>{if(barTarget&&!barTarget.contains(e.relatedTarget)&&!pinned)barTip.hidden=true;});
document.addEventListener('focusout',()=>{if(barTip&&!pinned)barTip.hidden=true;});
document.addEventListener('click',e=>{const target=e.target.closest('[data-chart-tooltip]');if(target&&!target.closest('button,a')){if(pinned?.svg===target)pinned.hide(true);else barShow(target,true);}});
function scan(){
  document.querySelectorAll('main table,.site-main table').forEach(mobileTable);
  queued=false;for(const [svg,state] of states)if(!svg.isConnected)state.destroy();
  document.querySelectorAll('.forecast-outcome,.fedwatch-range,.gj-probability-row,.dh-bar-row,.gj-stacked [title],.retail-row').forEach(node=>{
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

// Shared numeric axes. Tick precision follows the interval, never the raw extrema.
function niceScale(values,options={}){
  const vs=values.filter(Number.isFinite);let lo=vs.length?Math.min(...vs):0,hi=vs.length?Math.max(...vs):1;
  if(options.zero){lo=Math.min(0,lo);hi=Math.max(0,hi);}
  if(lo===hi){const pad=Math.abs(lo)*.05||1;lo-=pad;hi+=pad;if(options.zero&&vs.every(v=>v>=0))lo=0;}
  const intervals=options.intervals||5,raw=(hi-lo)/intervals,power=10**Math.floor(Math.log10(raw));
  const step=([1,2,2.5,5,10].find(n=>n>=raw/power)||10)*power;
  lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
  if(Number.isFinite(options.min))lo=Math.max(options.min,lo);
  if(Number.isFinite(options.max))hi=Math.min(options.max,hi);
  const clean=v=>Number(v.toPrecision(12)),ticks=[];
  for(let i=0;i<20;i++){const v=clean(Math.ceil((lo-step*1e-9)/step)*step+i*step);if(v>hi+step*1e-8)break;if(v>=lo-step*1e-8)ticks.push(v);}
  return {min:clean(lo),max:clean(hi),step:clean(step),ticks,format:v=>axisFormat(v,step,Math.max(Math.abs(lo),Math.abs(hi)))};
}
function axisFormat(value,step=1,extent=Math.abs(value)){
  if(!Number.isFinite(value))return '—';
  const magnitude=extent,divisor=magnitude>=1e12?1e12:magnitude>=1e8?1e8:magnitude>=1e7?1e4:1;
  const suffix=divisor===1e12?'万亿':divisor===1e8?'亿':divisor===1e4?'万':'';
  let digits=0;while(digits<8&&Math.abs(step/divisor*10**digits-Math.round(step/divisor*10**digits))>1e-8)digits++;
  return new Intl.NumberFormat('zh-CN',{maximumFractionDigits:digits}).format(Math.abs(value)<Math.abs(step)*1e-9?0:value/divisor)+suffix;
}

function paired(rows,opt={}){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>Number.isFinite(v)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:opt.precision??2}).format(v):'—';
  const mode=opt.mode||'combo',showValue=mode!=='change',showChange=mode!=='value',unit=opt.unit||'',changeUnit=opt.changeUnit||'%';
  let normalized=rows.map((r,i)=>({...r,x:Number.isFinite(r.x)?r.x:i,values:r.values||[{name:opt.name||'数值',value:r.value,change:r.change,color:'#2167a0'}]}));
  if(opt.trimEmpty){
    const active=r=>r.values.some(s=>showValue&&Number.isFinite(s.value)||showChange&&Number.isFinite(s.change));
    const first=normalized.findIndex(active);let last=normalized.length-1;
    while(last>=0&&!active(normalized[last]))last--;
    normalized=first<0?[]:normalized.slice(first,last+1);
  }
  const valid=normalized.filter(r=>r.values.some(s=>showValue&&Number.isFinite(s.value)||showChange&&Number.isFinite(s.change)));
  if(!valid.length)return {html:'<p class="portal-empty">暂无数据</p>',points:[]};
  const labelled=opt.valueLabels||opt.yoyLabels,seriesSlots=Math.max(...normalized.map(r=>r.values.length));
  const w=Math.max(labelled?normalized.length*(seriesSlots===1?52:24+seriesSlots*32)+152:240,opt.width||Math.min(900,typeof innerWidth==='number'?innerWidth-64:900)),h=w<520?300:340,L=w<520?58:76,R=showChange&&showValue?(w<520?52:76):24,T=42,B=48,bottom=h-B;
  const xs=normalized.map(r=>r.x),xmin=Math.min(...xs),xmax=Math.max(...xs),width=w-L-R;
  const unique=[...new Set(xs)].sort((a,b)=>a-b),delta=unique.length>1?Math.min(...unique.slice(1).map((x,i)=>x-unique[i])):1;
  const margin=width/(unique.length+1)/2,px=x=>L+margin+(x-xmin)/(xmax-xmin||1)*(width-margin*2);
  function domain(key){return niceScale(normalized.flatMap(r=>r.values.map(s=>s[key])),{zero:true});}
  const valueScale=domain('value'),changeScale=domain('change'),vd=[valueScale.min,valueScale.max],cd=[changeScale.min,changeScale.max],py=(v,d)=>bottom-(v-d[0])/(d[1]-d[0])*(bottom-T);
  const palette=['#2167a0','#ac863d','#668397','#538db5','#8d7852','#476777'],barPalette=['#abcfe8','#e6d4ab','#c3d0d9','#bfdcec','#d8ccb5','#acc2ce'],colors=Array.from({length:Math.max(...normalized.map(r=>r.values.length))},(_,i)=>palette[i%palette.length]);
  let svg='<svg class="site-paired-chart" style="height:auto!important;min-height:0" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(opt.name||'历史趋势')+'"><title>'+esc(opt.name||'历史趋势')+'</title>';
  const primary=showValue?vd:cd,primaryScale=showValue?valueScale:changeScale;
  svg+='<text class="site-axis-label" x="'+L+'" y="20">'+esc(showValue?'数值（'+unit+'）':(opt.changeLabel||'同比')+'（'+changeUnit+'）')+'</text>';
  if(showValue&&showChange)svg+='<text class="site-axis-label site-change-axis" x="'+(w-R)+'" y="20" text-anchor="end">'+esc((opt.changeLabel||'同比')+'（'+changeUnit+'）')+'</text>';
  for(const v of primaryScale.ticks){const y=py(v,primary);svg+='<line class="site-grid'+(v===0?' site-zero':'')+'" x1="'+L+'" x2="'+(w-R)+'" y1="'+y+'" y2="'+y+'"/><text class="site-tick" x="'+(L-12)+'" y="'+(y+4)+'" text-anchor="end">'+esc(primaryScale.format(v))+'</text>';}
  if(showValue&&showChange)for(const v of changeScale.ticks)svg+='<text class="site-change-axis site-tick" x="'+(w-R+12)+'" y="'+(py(v,cd)+4)+'">'+esc(changeScale.format(v))+'</text>';
  svg+='<path class="site-axis-rule" d="M'+L+','+T+'V'+bottom+'H'+(w-R)+(showValue&&showChange?'V'+T:'')+'" fill="none"/>';
  const seriesCount=Math.max(...normalized.map(r=>r.values.length)),barWidth=Math.min(44,width*delta/(xmax-xmin+delta)*.72)/seriesCount;
  const points=[];
  normalized.forEach((r,ri)=>{
    const text=r.period+'\n'+r.values.map(s=>(seriesCount>1?s.name+'：':'')+(showValue?fmt(s.value)+(Number.isFinite(s.value)?' '+unit:''):'')+(showValue&&showChange?'  |  ':'')+(showChange?(opt.changeLabel||'同比')+' '+(Number.isFinite(s.change)?new Intl.NumberFormat('zh-CN',{minimumFractionDigits:opt.changePrecision??0,maximumFractionDigits:opt.changePrecision??opt.precision??2}).format(s.change):'—')+(Number.isFinite(s.change)?' '+changeUnit:''):'')).join('\n');
    points.push({x:px(r.x),text,labels:r.values.flatMap((s,si)=>[
      ...(showValue&&Number.isFinite(s.value)?[{x:px(r.x)+(si-(seriesCount-1)/2)*barWidth,y:py(s.value,vd),text:fmt(s.value),kind:'value',color:colors[si%colors.length]}]:[]),
      ...(showChange&&Number.isFinite(s.change)?[{x:px(r.x),y:py(s.change,cd),text:(s.change>0?'+':'')+new Intl.NumberFormat('zh-CN',{minimumFractionDigits:opt.changePrecision??1,maximumFractionDigits:opt.changePrecision??1}).format(s.change)+(changeUnit==='%'?'%':changeUnit==='百分点'?'pct':changeUnit),kind:'change',color:colors[si%colors.length]}]:[])
    ])});
    if(showValue)r.values.forEach((s,si)=>{if(!Number.isFinite(s.value))return;const y=py(s.value,vd),zero=py(0,vd);svg+='<rect class="site-value-bar" x="'+(px(r.x)+(si-seriesCount/2)*barWidth)+'" y="'+Math.min(y,zero)+'" width="'+Math.max(.8,barWidth-1)+'" height="'+Math.max(1,Math.abs(zero-y))+'" rx="2" fill="'+barPalette[si%barPalette.length]+'" opacity="1"><title>'+esc(text)+'</title></rect>';});
    const step=Math.max(1,Math.ceil(normalized.length/Math.max(2,Math.floor(width/110))));
    if(ri===0||ri===normalized.length-1||w>=520&&ri%step===0&&normalized.length-ri>step/2)svg+='<text x="'+px(r.x)+'" y="'+(h-17)+'" text-anchor="'+(ri===0?'start':ri===normalized.length-1?'end':'middle')+'">'+esc(String(r.period).replace(/年/g,'·').replace(/月/g,''))+'</text>';
  });
  if(showChange)for(let si=0;si<seriesCount;si++){let path='',prior=null;for(const r of normalized){const s=r.values[si];if(!Number.isFinite(s?.change)){prior=null;continue;}const gap=r.breakBefore||prior&&(r.x-prior.x)>(opt.gap??Infinity);path+=(prior&&!gap?'L':'M')+px(r.x)+','+py(s.change,cd)+' ';prior=r;}svg+='<path class="site-line-halo" d="'+path+'" fill="none" stroke="white" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/><path class="site-change-line" d="'+path+'" fill="none" stroke="'+colors[si%colors.length]+'" stroke-width="2.5" stroke-linejoin="round"/>';normalized.forEach((r,ri)=>{if(Number.isFinite(r.values[si]?.change)&&(ri%Math.max(1,Math.ceil(normalized.length/(w<520?24:80)))===0||ri===normalized.length-1))svg+='<circle data-chart-point="'+si+'" tabindex="0" cx="'+px(r.x)+'" cy="'+py(r.values[si].change,cd)+'" r="'+(normalized.length>80?2.4:3.4)+'" fill="white" stroke="'+colors[si%colors.length]+'" stroke-width="1.8"><title>'+esc(points[normalized.indexOf(r)].text)+'</title></circle>';});}
  svg+='</svg>';
  const legend=seriesCount>1?normalized.find(r=>r.values.length===seriesCount).values.map((s,i)=>'<span><i style="background:'+colors[i%colors.length]+'"></i>'+esc(s.name)+'</span>').join(''):'';
  points.paired={rows,options:opt,showValue:!!opt.valueLabels,showChange:!!opt.yoyLabels};
  return {html:(labelled?'<div class="site-chart-scroll" style="overflow-x:auto;max-width:100%" tabindex="0" role="region" aria-label="趋势图，可横向滚动">'+svg.replace('style="height:auto!important;min-height:0"','style="height:auto!important;min-height:0;min-width:'+w+'px"')+'</div>':svg)+'<div class="site-chart-legend">'+(showValue?'<span><i class="site-bar-key"></i>数值 · '+esc(unit)+'</span>':'')+(showChange?'<span><i class="site-line-key"></i>'+esc(opt.changeLabel||'同比')+' · '+esc(changeUnit)+'</span>':'')+legend+'</div>',points};
}
const pairedObservers=new WeakMap();
function drawPaired(host,rows,opt={}){
  const style=typeof getComputedStyle==='function'?getComputedStyle(host):null;
  const width=(host.clientWidth||900)-(parseFloat(style?.paddingLeft)||0)-(parseFloat(style?.paddingRight)||0);
  const result=paired(rows,{...opt,width});host.innerHTML=result.html;attach(host,result.points);
  pairedObservers.get(host)?.disconnect();
  if(typeof ResizeObserver!=='undefined'){let last=host.clientWidth;const observer=new ResizeObserver(()=>{if(host.clientWidth>0&&Math.abs(host.clientWidth-last)>2){observer.disconnect();drawPaired(host,rows,opt);}});observer.observe(host);pairedObservers.set(host,observer);}
  return result;
}

root.SiteCharts={attach,scan,canvas,groups,paired,drawPaired,niceScale,axisFormat};
document.addEventListener('pointerdown',e=>{if(pinned&&!pinned.svg.contains(e.target))pinned.hide(true);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')pinned?.hide(true);});
addEventListener('scroll',()=>{for(const state of states.values())state.refresh();},{passive:true});
addEventListener('resize',()=>{for(const state of states.values())state.hide(true);});
function start(){scan();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window==='object'?window:{});




