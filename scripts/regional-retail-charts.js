(function(){
  'use strict';
  const M=RegionalRetail,F=M.finite,E=SiteData.esc,colors=['#5969a4','#bd8c55','#45958b','#aa698e'],focusHandlers=new WeakMap();
  function draw(host,series,options={}){
    const old=focusHandlers.get(host);if(old){host.removeEventListener('focusin',old.show);host.removeEventListener('focusout',old.hide);focusHandlers.delete(host);}
    const unit=options.unit||'%',field=options.field||'yoy',description=(field==='amount'?'金额':'同比')+'历史趋势';
    const points=series[0]?.points||[],values=series.flatMap(s=>s.points.map(p=>p.value)).filter(F);
    if(!values.length){host.innerHTML='<div class="regional-empty">所选区间暂无数据</div>';return;}
    const w=Math.max(260,host.clientWidth),h=w<500?260:290,left=w<500?42:54,right=18,top=25,bottom=34,lo=Math.min(0,...values),hi=Math.max(1,...values),span=hi-lo||1,x=i=>left+i*(w-left-right)/Math.max(1,points.length-1),y=v=>h-bottom-(v-lo)/span*(h-top-bottom);
    const grid=[lo,(lo+hi)/2,hi].map(v=>'<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#e3e6ef"/><text x="4" y="'+(y(v)+4)+'">'+v.toFixed(1)+'</text>').join('');
    const lines=series.map((s,index)=>{const color=s.color||colors[index%colors.length];let segments=[],current=[];s.points.forEach((p,i)=>{if(F(p.value))current.push(x(i)+','+y(p.value));else if(current.length){segments.push(current);current=[];}});if(current.length)segments.push(current);return segments.map(segment=>segment.length>1?'<polyline points="'+segment.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="2.3"/>':'').join('')+s.points.map((p,i)=>F(p.value)?'<circle data-time="'+i+'" tabindex="0" cx="'+x(i)+'" cy="'+y(p.value)+'" r="'+(points.length>30?2.7:3.7)+'" fill="'+color+'" aria-label="'+E(s.label+' '+p.period+' '+p.value.toFixed(1)+unit+(p.provenance?.[field]?.derived?' · '+M.valueLabel(p,field):''))+'"><title>'+E(s.label+' '+p.period+' '+p.value.toFixed(1)+unit+(p.provenance?.[field]?.derived?' · '+M.valueLabel(p,field):'')+(F(p.n)?' · '+p.n+'城'+(p.estimatedN?'（含测算'+p.estimatedN+'城）':''):''))+'</title></circle>':'').join('');}).join('');
    const step=Math.max(1,Math.ceil((points.length-1)/(w<500?3:7)));
    const ticks=points.map((p,i)=>i===0||i===points.length-1||(i%step===0&&x(i)-x(0)>65&&x(points.length-1)-x(i)>65)?'<text x="'+x(i)+'" y="'+(h-8)+'" text-anchor="'+(i===0?'start':i===points.length-1?'end':'middle')+'">'+p.period+'</text>':'').join('');
    host.innerHTML='<svg class="regional-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+E(description)+'，缺期断线"><title>'+E(description+'（'+unit+'）')+'</title>'+grid+lines+ticks+'</svg><div class="regional-chart-tooltip" role="tooltip" hidden></div>';
    const tip=host.querySelector('[role=tooltip]');
    function show(event){const point=event.target.closest('[data-time]');if(!point)return;const i=Number(point.dataset.time);tip.innerHTML='<b>'+points[i].period+'</b>'+series.map((s,n)=>{const p=s.points[i];return '<span><i style="background:'+(s.color||colors[n%colors.length])+'"></i>'+E(s.label)+'：'+(F(p?.value)?p.value.toFixed(1)+unit+(p.provenance?.[field]?.derived?' · '+M.valueLabel(p,field):''):'—')+(F(p?.n)?'（'+p.n+'城'+(p.estimatedN?'，含测算'+p.estimatedN+'城':'')+'）':'')+'</span>';}).join('');tip.hidden=false;const box=point.getBoundingClientRect(),parent=host.getBoundingClientRect();tip.style.left=Math.max(0,Math.min(box.left-parent.left+12,w-tip.offsetWidth))+'px';tip.style.top=Math.max(0,box.top-parent.top-tip.offsetHeight-12)+'px';}
    const hide=()=>{tip.hidden=true;};host.onpointerover=show;host.onclick=show;host.onpointerleave=hide;host.addEventListener('focusin',show);host.addEventListener('focusout',hide);focusHandlers.set(host,{show,hide});
  }
  window.RegionalRetailCharts={draw,colors};
})();
