(function(root){
  'use strict';
  const M=root.MacroModel,D=root.MacroDashboardModel;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>M.finite(v)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(v):'—';
  let currentSnapshot,currentCountry,expanded=false;
  function draw(spec,data,cutoff){
    const rows=D.trendRows(spec,data,cutoff),finite=rows.filter(r=>M.finite(r.chartValue)),points=[];
    if(!finite.length)return {html:'<p class="portal-empty">暂无可用历史</p>',points};
    const width=440,height=180,left=48,right=18,top=20,bottom=32;
    let lo=Math.min(...finite.map(r=>r.chartValue)),hi=Math.max(...finite.map(r=>r.chartValue));
    const pad=(hi-lo||Math.abs(hi)*.05||1)*.15;lo-=pad;hi+=pad;
    const first=M.dateOf(rows[0].period),last=M.dateOf(rows.at(-1).period),head=M.headline(spec,data);
    const x=r=>left+(M.dateOf(r.period)-first)/(last-first||1)*(width-left-right);
    const y=v=>top+(hi-v)/(hi-lo)*(height-top-bottom);
    let html='';
    for(let i=0;i<3;i++){const value=hi-(hi-lo)*i/2,py=y(value);html+='<line class="morning-grid" x1="'+left+'" x2="'+(width-right)+'" y1="'+py+'" y2="'+py+'"/><text x="'+(left-7)+'" y="'+(py+4)+'" text-anchor="end">'+number(value)+'</text>';}
    const reference=spec.id==='cn-pmi'?50:0;
    if(reference>=lo&&reference<=hi)html+='<line class="morning-reference" x1="'+left+'" x2="'+(width-right)+'" y1="'+y(reference)+'" y2="'+y(reference)+'"/><text x="'+(width-right)+'" y="'+(y(reference)-5)+'" text-anchor="end">'+reference+'</text>';
    for(const part of D.segments(spec,rows)){
      if(part.length>1)html+='<polyline points="'+part.map(r=>x(r).toFixed(2)+','+y(r.chartValue).toFixed(2)).join(' ')+'"/>';
      for(const row of part){const i=points.length;points.push({x:x(row),y:y(row.chartValue),text:row.period+'：'+number(row.chartValue)+' '+head.unit});html+='<circle tabindex="0" data-chart-point="'+i+'" cx="'+x(row)+'" cy="'+y(row.chartValue)+'" r="3"'+(row===finite.at(-1)?' class="morning-last"':'')+'><title>'+esc(row.period+'：'+number(row.chartValue)+' '+head.unit)+'</title></circle>';}
    }
    html+='<text x="'+left+'" y="'+(height-7)+'">'+esc(rows[0].period)+'</text><text x="'+(width-right)+'" y="'+(height-7)+'" text-anchor="end">'+esc(rows.at(-1).period)+'</text>';
    return {html:'<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(spec.name+'近三年走势，'+head.unit+(head.label?'，'+head.label:'')+'，缺期断线')+'">'+html+'</svg>',points};
  }
  function render(catalog,snapshot,country,onSelect){
    if(currentSnapshot!==snapshot||currentCountry!==country){expanded=false;currentSnapshot=snapshot;currentCountry=country;}
    const feed=D.releases(catalog,snapshot,country),host=document.getElementById('release-rows'),button=document.getElementById('release-more');
    document.getElementById('release-meta').textContent=feed.items.length+' 项有发布日期'+(feed.unknown?' · '+feed.unknown+' 项未提供':'');
    function releaseTable(){
      host.innerHTML=(expanded?feed.items:feed.items.slice(0,5)).map(({spec,data,reading:r,releaseDate})=>{
        const source=catalog.sources[spec.source],url=r.latest.originalSourceUrl||r.latest.sourceUrl||data.sourceUrl||source?.url;
        return '<tr><td><time datetime="'+releaseDate+'">'+releaseDate+'</time></td><td><button data-morning-metric="'+esc(spec.id)+'">'+esc(spec.name)+'</button><small>'+esc(r.label||spec.adjustment)+'</small></td><td>'+esc(r.latest.period)+'</td><td class="morning-reading">'+number(r.value)+' <small>'+esc(r.unit)+'</small></td><td>'+number(r.previous?.chartValue)+' <small>'+esc(r.unit)+'</small></td><td class="'+(r.delta?.value>0?'macro-up':r.delta?.value<0?'macro-down':'')+'">'+(r.delta?(r.delta.value>0?'+':'')+number(r.delta.value)+' '+esc(r.delta.unit):'—')+'</td><td><a href="'+esc(M.safeUrl(url))+'" target="_blank" rel="noopener">来源 ↗</a></td></tr>';
      }).join('')||'<tr><td colspan="7">暂无已提供发布日期的数据</td></tr>';
      button.hidden=feed.items.length<=5;button.textContent=expanded?'收起':'全部发布';button.setAttribute('aria-expanded',String(expanded));
    }
    releaseTable();button.onclick=()=>{expanded=!expanded;releaseTable();};host.onclick=e=>{const b=e.target.closest('[data-morning-metric]');if(b)onSelect(b.dataset.morningMetric);};
    const trends=document.getElementById('morning-trends'),charts=[];
    trends.innerHTML=D.trends[country].map(id=>{
      const spec=catalog.series.find(s=>s.id===id);if(!spec)return '';
      const data=snapshot.series[id]||{},r=D.readout(spec,data),chart=draw(spec,data,snapshot.cutoff);charts.push({id,points:chart.points});
      return '<article class="morning-trend"><header><button data-morning-metric="'+id+'">'+esc(spec.name)+' <span aria-hidden="true">↗</span></button><span>'+esc(M.frequency[spec.frequency])+'</span></header><div class="morning-trend-value"><strong>'+number(r.value)+'</strong><span>'+esc(r.unit)+(r.label?' · '+esc(r.label):'')+'</span><time>'+esc(r.latest?.period||'暂无数据')+'</time></div><div id="morning-chart-'+id+'" class="morning-chart">'+chart.html+'</div></article>';
    }).join('');
    for(const chart of charts)root.ResearchChart.attach(document.getElementById('morning-chart-'+chart.id),chart.points);
    trends.onclick=e=>{const b=e.target.closest('[data-morning-metric]');if(b)onSelect(b.dataset.morningMetric);};
  }
  root.MacroMorning={render};
})(window);

