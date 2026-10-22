(function(){
  'use strict';
  const M=RegionalRetail,F=M.finite,E=SiteData.esc,colors=['#17365d','#3b73a5','#8f2635','#bb5260','#606975'],dashes=['','','','',''],focusHandlers=new WeakMap();
  const settings=new Map();
  function control(host,redraw){
    const key=host.id;let toggle=document.querySelector('[data-labels-for="'+key+'"]');
    if(!settings.has(key)){let value=true;try{value=localStorage.getItem('retail-labels:'+key)!=='off';}catch{}settings.set(key,value);}
    if(!toggle){const label=document.createElement('label');label.className='regional-label-switch';label.innerHTML='<input type="checkbox" data-labels-for="'+key+'">显示数值';host.before(label);toggle=label.firstElementChild;}
    toggle.checked=settings.get(key);host.classList.toggle('labels-off',!toggle.checked);toggle.onchange=()=>{settings.set(key,toggle.checked);try{localStorage.setItem('retail-labels:'+key,toggle.checked?'on':'off');}catch{}host.classList.toggle('labels-off',!toggle.checked);if(redraw)redraw();};return toggle.checked;
  }
  function axisLabel(point,frequency){return frequency==='quarterly'&&/^\d{4}-\d{2}$/.test(point.period)?point.period.slice(2,4)+'Q'+Math.ceil(Number(point.period.slice(5))/3):(point.periodLabel||point.period);}
  function legend(index){const i=index%colors.length;return '<svg class="regional-legend-line" width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><line x1="0" y1="6" x2="28" y2="6" stroke="'+colors[i]+'" stroke-width="3" stroke-dasharray="'+dashes[i]+'"/></svg>';}
  function draw(host,series,options={}){
    const showLabels=control(host,()=>draw(host,series,options));
    const old=focusHandlers.get(host);if(old){host.removeEventListener('focusin',old.show);host.removeEventListener('focusout',old.hide);focusHandlers.delete(host);}
    const unit=options.unit||'%',field=options.field||'yoy',description=(field==='amount'?'金额':'同比')+'历史趋势';
    const points=series[0]?.points||[],values=series.flatMap(s=>s.points.map(p=>p.value)).filter(F);
    if(!values.length){host.innerHTML='<div class="regional-empty">所选区间暂无数据</div>';return;}
    const w=Math.max(260,host.clientWidth),h=showLabels?Math.max(w<500?560:440,Math.ceil(values.length*44/Math.max(160,w-90))*18+120):360,left=w<500?38:48,right=30,top=32,bottom=38,lo=Math.min(0,...values),hi=Math.max(1,...values),span=hi-lo||1,x=i=>left+i*(w-left-right)/Math.max(1,points.length-1),y=v=>h-bottom-(v-lo)/span*(h-top-bottom);
    const grid=[lo,(lo+hi)/2,hi].map(v=>'<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#e3e6ef"/><text x="4" y="'+(y(v)+4)+'">'+v.toFixed(1)+'</text>').join('');
    const labelPositions=points.map((_,i)=>{const items=series.map((s,j)=>({j,v:s.points[i]?.value})).filter(p=>F(p.v)).sort((a,b)=>b.v-a.v),out={};let last=3;for(const p of items){out[p.j]=Math.max(last+18,y(p.v)-10);last=out[p.j];}if(last>h-bottom-5){const shift=last-(h-bottom-5);for(const p of items)out[p.j]-=shift;}return out;});
    const occupied=[];
    for(let i=0;i<points.length;i++)for(let j=0;j<series.length;j++){const v=series[j].points[i]?.value;if(!F(v))continue;const width=v.toFixed(1).length*7.8+10,cx=x(i),preferred=labelPositions[i][j];let placed=null;for(let offset=0;offset<h;offset+=19){for(const cy of offset?[preferred-offset,preferred+offset]:[preferred]){const box={l:cx-width/2,r:cx+width/2,t:cy-14,b:cy+4};if(box.t<5||box.b>h-bottom-6||occupied.some(a=>a.l<box.r&&a.r>box.l&&a.t<box.b&&a.b>box.t))continue;placed={box,cy};break;}if(placed)break;}if(placed){occupied.push(placed.box);labelPositions[i][j]=placed.cy;}}
    const lines=series.map((s,index)=>{const color=s.color||colors[index%colors.length];let segments=[],current=[];s.points.forEach((p,i)=>{if(F(p.value))current.push(x(i)+','+y(p.value));else if(current.length){segments.push(current);current=[];}});if(current.length)segments.push(current);return segments.map(segment=>segment.length>1?'<polyline points="'+segment.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-dasharray="'+dashes[index%colors.length]+'"/>':'').join('')+s.points.map((p,i)=>F(p.value)?'<circle data-time="'+i+'" tabindex="0" cx="'+x(i)+'" cy="'+y(p.value)+'" r="'+(points.length>30?3:4.2)+'" fill="'+color+'" aria-label="'+E(s.label+' '+(p.periodLabel||p.period)+' '+p.value.toFixed(1)+unit+(p.provenance?.[field]?.derived?' · '+M.valueLabel(p,field):''))+'"><title>'+E(s.label+' '+(p.periodLabel||p.period)+' '+p.value.toFixed(1)+unit+(p.provenance?.[field]?.derived?' · '+M.valueLabel(p,field):'')+(F(p.n)?' · '+p.n+'城'+(p.estimatedN?'（含测算'+p.estimatedN+'城）':''):''))+'</title></circle>'+(showLabels?(Math.abs(labelPositions[i][index]-y(p.value))>24?'<line x1="'+x(i)+'" x2="'+x(i)+'" y1="'+y(p.value)+'" y2="'+(labelPositions[i][index]+3)+'" stroke="'+color+'" opacity=".25"/>':'')+'<text class="regional-value-label" x="'+x(i)+'" y="'+labelPositions[i][index]+'" text-anchor="middle" style="fill:'+color+'">'+p.value.toFixed(1)+'</text>':''):'').join('');}).join('');
    const step=Math.max(1,Math.ceil((points.length-1)/(w<500?3:10)));
    const ticks=points.map((p,i)=>i===0||i===points.length-1||(i%step===0&&x(i)-x(0)>65&&x(points.length-1)-x(i)>65)?'<text x="'+x(i)+'" y="'+(h-8)+'" text-anchor="'+(i===0?'start':i===points.length-1?'end':'middle')+'">'+axisLabel(p,options.frequency)+'</text>':'').join('');
    host.innerHTML='<div class="regional-plot-scroll"><svg style="width:'+w+'px" class="regional-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+E(description)+'，缺期断线"><title>'+E(description+'（'+unit+'）')+'</title>'+grid+lines+ticks+'</svg></div><div class="regional-chart-tooltip" role="tooltip" hidden></div>';

    const tip=host.querySelector('[role=tooltip]');
    function show(event){const point=event.target.closest('[data-time]');if(!point)return;const i=Number(point.dataset.time);tip.innerHTML='<b>'+(points[i].periodLabel||points[i].period)+'</b>'+series.map((s,n)=>{const p=s.points[i];return '<span><i style="background:'+(s.color||colors[n%colors.length])+'"></i>'+E(s.label)+'：'+(F(p?.value)?p.value.toFixed(1)+unit+(p.provenance?.[field]?.derived?' · '+M.valueLabel(p,field):''):'—')+(F(p?.n)?'（'+p.n+'城'+(p.estimatedN?'，含测算'+p.estimatedN+'城':'')+'）':'')+'</span>';}).join('');tip.hidden=false;const box=point.getBoundingClientRect(),parent=host.getBoundingClientRect();tip.style.left=Math.max(0,Math.min(box.left-parent.left+12,host.clientWidth-tip.offsetWidth))+'px';tip.style.top=Math.max(0,box.top-parent.top-tip.offsetHeight-12)+'px';}
    const hide=()=>{tip.hidden=true;};host.onpointerover=show;host.onclick=show;host.onpointerleave=hide;host.addEventListener('focusin',show);host.addEventListener('focusout',hide);focusHandlers.set(host,{show,hide});
  }
  window.RegionalRetailCharts={draw,colors,control,legend,axisLabel};
})();
