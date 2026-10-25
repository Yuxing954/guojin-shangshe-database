(function(){
'use strict';
const M=RegionalRetail,F=M.finite,E=SiteData.esc,colors=['#163a63','#5d8caf','#747a80','#aa905b','#76551e'],labelColors=['#163a63','#35658b','#56606a','#816226','#76551e'];
const settings=new Map(),states=new WeakMap();
// Bar charts retain their independent on/off value control.
function control(host,redraw){host.closest('.regional-panel')?.classList.add('site-chart-label-scope');const key=host.id;let toggle=document.querySelector('[data-labels-for="'+key+'"]');if(!settings.has(key)){let value=true;try{value=localStorage.getItem('retail-labels:'+key)!=='off';}catch{}settings.set(key,value);}if(!toggle){const label=document.createElement('label');label.className='regional-label-switch';label.innerHTML='<input type="checkbox" data-labels-for="'+key+'">显示数值';host.before(label);ChartAnnotations.wrap(label);toggle=label.querySelector('input');}toggle.checked=settings.get(key);host.classList.toggle('labels-off',!toggle.checked);toggle.onchange=()=>{settings.set(key,toggle.checked);try{localStorage.setItem('retail-labels:'+key,toggle.checked?'on':'off');}catch{}host.classList.toggle('labels-off',!toggle.checked);if(redraw)redraw();};return toggle.checked;}
function axisLabel(p,frequency){return ChartPeriod.format(frequency==='quarterly'&&/^\d{4}-\d{2}$/.test(p.period)?p.period.slice(0,4)+'Q'+Math.ceil(Number(p.period.slice(5))/3):(p.periodLabel||p.period));}
function legend(i){return '<svg class="regional-legend-line" width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><line x1="0" y1="6" x2="28" y2="6" stroke="'+colors[i%colors.length]+'" stroke-width="3" stroke-dasharray=""/></svg>';}
function getState(host){if(!states.has(host)){let mode='all';try{const saved=localStorage.getItem('retail-value-mode:'+host.id);if(saved==='latest'){mode='all';localStorage.setItem('retail-value-mode:'+host.id,'all');}else if(['all','off'].includes(saved))mode=saved;else if(localStorage.getItem('retail-labels:'+host.id)==='off')mode='off';}catch{}states.set(host,{mode,split:false,hidden:new Set(),selected:null});}return states.get(host);}
function draw(host,input,options={}){
 const st=getState(host),unit=options.unit||'%',field=options.field||'yoy',description=(field==='amount'?'金额':'同比')+'历史趋势';
 const periodMap=new Map();for(const s of input)for(const p of s.points)if(!periodMap.has(p.period))periodMap.set(p.period,p);
 const points=[...periodMap.values()].sort((a,b)=>a.period.localeCompare(b.period));
 const series=input.map((s,j)=>{const map=new Map(s.points.map(p=>[p.period,p]));return {...s,j,color:s.color||colors[j%colors.length],labelColor:s.labelColor||labelColors[j%labelColors.length],points:points.map(p=>map.get(p.period)||{period:p.period,value:null})};});
 const values=series.flatMap(s=>s.points.map(p=>p.value)).filter(F),visible=series.filter(s=>!st.hidden.has(s.label)),multi=series.length>1;
 const lo=Math.min(0,...values),hi=Math.max(1,...values),span=hi-lo||1;
 const toolbar='<div class="regional-chart-toolbar"><div class="regional-trend-filters"></div><div class="regional-trend-actions"><label>数值 <select data-value-mode="'+host.id+'" aria-label="'+host.id+'数值显示"><option value="all"'+(st.mode==='all'?' selected':'')+'>适量</option><option value="off"'+(st.mode==='off'?' selected':'')+'>关闭</option></select></label>'+(multi?'<div class="regional-view-toggle" role="group" aria-label="图表布局"><button type="button" data-layout="combined" aria-pressed="'+!st.split+'">合并</button><button type="button" data-layout="split" aria-pressed="'+st.split+'">分开</button></div>':'')+'<button type="button" data-chart-reset>重置</button></div></div>';
 const key=multi?'<div class="regional-interactive-legend" style="--series-count:'+series.length+'" aria-label="曲线选择">'+series.map(s=>'<span class="regional-legend-item" style="--series-color:'+s.color+'"><input type="checkbox" data-visible="'+s.j+'" aria-label="显示'+E(s.label)+'"'+(!st.hidden.has(s.label)?' checked':'')+'><button type="button" data-highlight="'+s.j+'" aria-label="突出'+E(s.label)+'" aria-pressed="'+(st.selected===s.label)+'">'+legend(s.j)+'<span class="regional-legend-name">'+E(s.label)+(F(s.anchorN)?'<small>'+s.anchorN+'城样本</small>':'')+'</span></button></span>').join('')+'</div>':'';
 const section=host.closest('.regional-panel'),head=section?.querySelector('.regional-section-head');
 section?.classList.add('site-chart-label-scope');
 if(!st.filters){st.filters=head?[...head.children].filter(e=>e.matches('.regional-chart-controls,label')):[];}
 host.innerHTML=toolbar+key+'<div class="regional-chart-panels'+(st.split&&multi?' is-split':'')+'"></div><div class="regional-chart-tooltip" role="tooltip" hidden></div>';
 const valueSelect=host.querySelector('[data-value-mode]'),valueLabel=valueSelect.closest('label');valueLabel.firstChild.textContent='显示数值 ';const menu=ChartAnnotations.wrap(valueLabel);menu.open=!!st.menuOpen;menu.addEventListener('toggle',()=>st.menuOpen=menu.open);
 const filterHost=host.querySelector('.regional-trend-filters');for(const el of st.filters)filterHost.append(el);
 if(head){let status=head.querySelector('.regional-trend-status');if(!status){status=document.createElement('span');status.className='regional-trend-status';status.setAttribute('role','status');head.append(status);}status.textContent=(multi?visible.length+'/'+series.length+'条曲线 · ':'')+(points.length?axisLabel(points.at(-1),options.frequency):'暂无数据');}
 const panels=host.querySelector('.regional-chart-panels'),tip=host.querySelector('[role=tooltip]');
 const redraw=()=>draw(host,input,options);
 host.querySelector('[data-value-mode]').onchange=e=>{st.menuOpen=menu.open;st.mode=e.target.value;try{localStorage.setItem('retail-value-mode:'+host.id,st.mode);}catch{}redraw();};
 host.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>{st.split=b.dataset.layout==='split';redraw();host.querySelector('[data-layout="'+b.dataset.layout+'"]').focus();});
 host.querySelector('[data-chart-reset]').onclick=()=>{st.hidden.clear();st.selected=null;redraw();};
 host.querySelectorAll('[data-visible]').forEach(c=>c.onchange=()=>{const s=series[+c.dataset.visible];if(c.checked)st.hidden.delete(s.label);else {st.hidden.add(s.label);if(st.selected===s.label)st.selected=null;}redraw();host.querySelector('[data-visible="'+c.dataset.visible+'"]').focus();});
 function focusSeries(label){host.querySelectorAll('[data-series-group]').forEach(g=>{const s=series[+g.dataset.seriesGroup];g.style.opacity=label&&s.label!==label?'.16':'1';});}
 host.querySelectorAll('[data-highlight]').forEach(b=>{const s=series[+b.dataset.highlight];b.onpointerenter=()=>focusSeries(s.label);b.onpointerleave=()=>focusSeries(st.selected);b.onfocus=()=>focusSeries(s.label);b.onblur=()=>focusSeries(st.selected);b.onclick=()=>{st.selected=st.selected===s.label?null:s.label;host.querySelectorAll('[data-highlight]').forEach(x=>x.setAttribute('aria-pressed',series[+x.dataset.highlight].label===st.selected));focusSeries(st.selected);};});
 host.onkeydown=e=>{if(e.key==='Escape'){st.selected=null;tip.hidden=true;host.querySelectorAll('[data-highlight]').forEach(b=>b.setAttribute('aria-pressed','false'));focusSeries(null);}};
 if(!values.length||!visible.length){panels.innerHTML='<div class="regional-empty">'+(!values.length?'所选区间暂无数据':'曲线已全部隐藏')+'</div>';return;}
 const groups=st.split&&multi?visible.map(s=>[s]):[visible];
 for(const group of groups){
  const panel=document.createElement('div');panel.className='regional-small-panel';panels.append(panel);
  const w=Math.max(240,panel.clientWidth),split=st.split&&multi,left=w<500?34:46,right=w<500?108:155,top=28,bottom=38;
  const h=split?240:w<520?300:360;
  const labelStep=Math.max(1,Math.ceil((points.length-1)/Math.max(1,Math.floor((w-left-right)/72))));
  const x=i=>left+i*(w-left-right)/Math.max(1,points.length-1),y=v=>h-bottom-(v-lo)/span*(h-top-bottom),plotEnd=w-right;
  const grid=[...new Set([lo,(lo+hi)/2,hi,0])].sort((a,b)=>a-b).map(v=>'<line x1="'+left+'" x2="'+plotEnd+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="'+(v===0?'#a9b2c0':'#e3e6ef')+'"/><text x="2" y="'+(y(v)+4)+'">'+v.toFixed(1)+'</text>').join('');
  const ends=group.map(s=>({s,i:s.points.findLastIndex(p=>F(p.value))})).filter(e=>e.i>=0).map(e=>({...e,cy:y(e.s.points[e.i].value)})).sort((a,b)=>a.cy-b.cy);
  let last=top-34;for(const e of ends){e.cy=Math.max(e.cy,last+34);last=e.cy;}if(last>h-bottom-12){const shift=last-(h-bottom-12);for(const e of ends)e.cy-=shift;}
  const occupied=[];
  function valueLabel(cx,cy,value,color){
    const width=value.toFixed(1).length*7.8+10;if(width>plotEnd-left)return '';
    const tx=Math.max(left+width/2,Math.min(plotEnd-width/2,cx));let placed=null;
    for(let d=0;d<h;d+=19){for(const t of d?[cy-d,cy+d]:[cy]){const b={l:tx-width/2,r:tx+width/2,t:t-14,b:t+4};if(b.t<top||b.b>h-bottom-5||occupied.some(a=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t))continue;occupied.push(b);placed=t;break;}if(placed!==null)break;}
    if(placed===null)return '';
    return '<text class="regional-value-label" x="'+tx+'" y="'+placed+'" text-anchor="middle" style="fill:'+color+'">'+value.toFixed(1)+'</text>';
  }
  const lines=group.map(s=>{let seg=[],cur=[];s.points.forEach((p,i)=>{if(F(p.value))cur.push(x(i)+','+y(p.value));else if(cur.length){seg.push(cur);cur=[];}});if(cur.length)seg.push(cur);const end=ends.find(e=>e.s.j===s.j);return '<g data-series-group="'+s.j+'">'+seg.map(a=>a.length>1?'<polyline points="'+a.join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="2.5"/>':'').join('')+s.points.map((p,i)=>!F(p.value)?'':'<circle data-time="'+i+'" data-series="'+s.j+'" tabindex="0" cx="'+x(i)+'" cy="'+y(p.value)+'" r="'+(st.mode==='all'||i===end?.i?3.5:2)+'" fill="'+s.color+'" aria-label="'+E(s.label+' '+(p.periodLabel||p.period)+' '+p.value.toFixed(1)+unit)+'"><title>'+E(s.label+' '+(p.periodLabel||p.period)+' '+p.value.toFixed(1)+unit)+'</title></circle>'+(st.mode==='all'&&i!==end?.i&&i%labelStep===0?valueLabel(x(i),y(p.value)-10,p.value,s.labelColor):'')).join('')+(end?'<path d="M '+x(end.i)+' '+y(s.points[end.i].value)+' L '+(plotEnd+9)+' '+end.cy+' L '+(plotEnd+14)+' '+end.cy+'" fill="none" stroke="'+s.color+'" stroke-width="1" opacity=".65"/><text class="regional-end-name" x="'+(plotEnd+18)+'" y="'+(end.cy-3)+'" style="fill:'+s.labelColor+'"><title>'+E(s.label)+'</title>'+E(s.shortLabel||s.label)+'</text>'+(st.mode!=='off'?'<text class="regional-value-label regional-end-value" x="'+(plotEnd+18)+'" y="'+(end.cy+13)+'" style="fill:'+s.labelColor+'">'+s.points[end.i].value.toFixed(1)+unit+(end.i<points.length-1?' · '+E(axisLabel(s.points[end.i],options.frequency)):'')+'</text>':''):'')+'</g>';}).join('');
  const step=Math.max(1,Math.ceil((points.length-1)/(w<500?2:7)));
  const ticks=points.map((p,i)=>i===0||i===points.length-1||(i%step===0&&x(i)-left>58&&plotEnd-x(i)>58)?'<text class="site-period-tick" x="'+x(i)+'" y="'+(h-9)+'" text-anchor="'+(i===0?'start':i===points.length-1?'end':'middle')+'">'+E(axisLabel(p,options.frequency))+'</text>':'').join('');
  panel.innerHTML='<div class="regional-plot-scroll"><svg class="regional-chart" style="width:'+w+'px" viewBox="0 0 '+w+' '+h+'" data-y-min="'+lo+'" data-y-max="'+hi+'" role="img" aria-label="'+E(description+(split?' · '+group[0].label:'')+'，缺期断线')+'"><title>'+E(description+'（'+unit+'）')+'</title>'+grid+lines+'<line class="regional-crosshair" y1="'+top+'" y2="'+(h-bottom)+'" stroke="#94a3b8" stroke-dasharray="3 3" visibility="hidden"/>'+ticks+'</svg></div>';
  const svg=panel.querySelector('svg'),cross=panel.querySelector('.regional-crosshair');
  function show(i,clientX,clientY){i=Math.max(0,Math.min(points.length-1,i));cross.setAttribute('x1',x(i));cross.setAttribute('x2',x(i));cross.setAttribute('visibility','visible');tip.innerHTML='<b>'+E(points[i].periodLabel||points[i].period)+'</b>'+visible.map(s=>{const p=s.points[i];return '<span><i style="background:'+s.color+'"></i>'+E(s.label)+'：'+(F(p.value)?p.value.toFixed(1)+unit+(p.provenance?.[field]?.derived?' · '+E(M.valueLabel(p,field)):''):'—')+(F(p.n)?'（'+p.n+'城'+(p.estimatedN?'，含测算'+p.estimatedN+'城':'')+'）':'')+'</span>';}).join('');tip.hidden=false;const box=host.getBoundingClientRect();tip.style.left=Math.max(0,Math.min(clientX-box.left+12,host.clientWidth-tip.offsetWidth))+'px';tip.style.top=Math.max(0,clientY-box.top-tip.offsetHeight-10)+'px';}
  function pointer(e){const r=svg.getBoundingClientRect(),px=(e.clientX-r.left)*w/r.width,py=(e.clientY-r.top)*h/r.height;if(px<left||px>plotEnd||py<top||py>h-bottom)return;show(Math.round((px-left)/(plotEnd-left)*Math.max(1,points.length-1)),e.clientX,e.clientY);}
  svg.onpointermove=pointer;svg.onclick=pointer;svg.onpointerleave=()=>{tip.hidden=true;cross.setAttribute('visibility','hidden');};svg.addEventListener('focusin',e=>{const p=e.target.closest('[data-time]');if(p){const r=p.getBoundingClientRect();show(+p.dataset.time,r.left,r.top);}});svg.addEventListener('focusout',()=>{tip.hidden=true;cross.setAttribute('visibility','hidden');});
 }
 focusSeries(st.selected);
}
window.RegionalRetailCharts={draw,colors,labelColors,control,legend,axisLabel};
})();
