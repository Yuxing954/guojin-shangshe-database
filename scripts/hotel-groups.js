(async function(){
 'use strict';
 const G=HotelGroupsModel,H=HotelMetrics,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=(v,d=0)=>v==null?'—':new Intl.NumberFormat('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v),signed=v=>(v>0?'+':'')+fmt(v,1),tone=v=>v>0?'hd-positive':v<0?'hd-negative':'hd-neutral';
 const q=new URLSearchParams(location.hash.slice(1)),state={period:q.get('period')||'latest'},plots=[{metric:'adr',prefix:'group',windowKey:'window',modeKey:'chart'},{metric:'heat',prefix:'heat',windowKey:'heatWindow',modeKey:'heatMode'},{metric:'price',prefix:'price',windowKey:'priceWindow',modeKey:'priceMode'},{metric:'hotels',prefix:'hotels',windowKey:'hotelsWindow',modeKey:'hotelsMode'},{metric:'rooms',prefix:'rooms',windowKey:'roomsWindow',modeKey:'roomsMode'}],colors=SiteUI.colors;
 for(const p of plots){state[p.windowKey]=['12','26','52','156','all'].includes(q.get(p.windowKey))?q.get(p.windowKey):'12';state[p.modeKey]=q.get('compare')==='all'&&['value','change'].includes(q.get(p.modeKey))?q.get(p.modeKey):'value';}
 let weekly=[],periods=[],update={},frame=0;
 const row=(id,metric)=>{const s=G.series(weekly,id,metric);return {s,o:G.observation(s,state.period)};};
 function save(){const p=new URLSearchParams({view:'groups',type:'weekly',compare:'all',period:state.period===periods.at(-1)?'latest':state.period});for(const plot of plots){p.set(plot.windowKey,state[plot.windowKey]);p.set(plot.modeKey,state[plot.modeKey]);}history.replaceState(null,'',SiteUI.contextURL(location.pathname+location.search+'#'+p.toString()));dispatchEvent(new Event('hashchange'));}
 const growth=o=>o?.yoy?'<span class="'+tone(o.yoy.value)+'">同比 '+signed(o.yoy.value)+'%</span>':'<span class="hd-neutral">同比 —</span>';
 function paint(){
  $('group-period').value=state.period;
  for(const p of plots){const s=G.weeklyMetrics[p.metric];$(p.prefix+'-metric-name').textContent=s.name;$(p.prefix+'-metric-name').dataset.metric=p.metric;$(p.prefix+'-scope').textContent='全国样本 · 锦江为中国区'+(['adr','heat','price'].includes(p.metric)?' · 入住日期':'');$(p.prefix+'-window').value=state[p.windowKey];}
  const r=weekly.find(o=>o.period_id===state.period),latest=weekly.find(o=>o.period_id===periods.at(-1));$('period-note').textContent=H.weekLabel(state.period)+(r?' · '+r.start_date+'—'+r.end_date:'');$('asof').textContent='酒店之家 · '+H.weekLabel(periods.at(-1))+(latest?' · 截至 '+latest.end_date:'');$('group-footer').textContent='来源：酒店之家'+(update.importedAt?' · 入库 '+SiteUI.date(update.importedAt):'');
  paintMatrix();save();draw();
 }
 function draw(){
  for(const p of plots){const s=G.weeklyMetrics[p.metric],points=G.compare(weekly,p.metric,state.period,state[p.windowKey]),host=$(p.prefix+'-trend');
   if(points.some(o=>o.values.some(v=>v.value!=null)))SiteCharts.drawPaired(host,points,{name:s.name+' · 集团对比',unit:s.unit,precision:s.precision||0,periodFormat:'week-short',changeUnit:'%',changePrecision:1,mode:state[p.modeKey],valueStyle:'line',colors,legend:'series',gap:15*86400000,trimEmpty:false});
   else host.innerHTML='<p class="hd-empty">所选范围暂无数据</p>';
   $(p.prefix+'-chart-mode').querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state[p.modeKey]);b.setAttribute('aria-pressed',String(b.dataset.mode===state[p.modeKey]));});
   const missing=points.some(o=>o.values.some(v=>v.value==null));$(p.prefix+'-chart-note').textContent='同周同比 · 未调整节假日错期'+(missing?' · 缺失期间留空':'');
  }
 }
 function paintMatrix(){const metrics=Object.keys(G.weeklyMetrics);$('group-matrix').innerHTML='<thead><tr><th>集团</th>'+metrics.map(m=>'<th>'+G.weeklyMetrics[m].name+' · '+G.weeklyMetrics[m].unit+'</th>').join('')+'</tr></thead><tbody>'+Object.entries(G.groups).map(([id,name])=>'<tr><td class="hg-row-name"><strong>'+esc(name)+'</strong><small>'+esc(H.weekLabel(state.period))+'</small></td>'+metrics.map(m=>{const {o}=row(id,m);return '<td>'+(o?'<button class="hg-cell" type="button" data-evidence-group="'+id+'" data-evidence-metric="'+m+'">'+fmt(o.value,G.weeklyMetrics[m].precision||0)+'<small>'+growth(o)+'</small></button>':'—')+'</td>';}).join('')+'</tr>').join('')+'</tbody>';}
 function evidence(metric,id){
  const ids=id?[id]:Object.keys(G.groups),definition=G.weeklyMetrics[metric];$('group-source-title').textContent=definition.name+' · '+H.weekLabel(state.period);
  $('group-source-body').innerHTML=ids.map(id=>{const {s,o}=row(id,metric);if(!o)return '<h3>'+esc(G.groups[id])+'</h3><p>该期暂无数据</p>';const fields=[['原始数值',fmt(o.value,Math.max(s.precision,2))+' '+s.unit],['来源指标',s.originalName],['范围',s.scope+' · 全国 · '+s.periodBasis],['来源定位',o.locator],['同比基期',o.yoy?o.yoy.priorPeriod+' · 原值 '+o.yoy.priorValue:'无可比基期，未强算']];return '<h3>'+esc(G.groups[id])+'</h3><dl>'+fields.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(H.weekLabel(v))+'</dd>').join('')+'</dl>';}).join('');$('group-source-dialog').showModal();
 }
 $('group-period').onchange=e=>{state.period=e.target.value;paint();};
 for(const p of plots){$(p.prefix+'-window').onchange=e=>{state[p.windowKey]=e.target.value;save();draw();};$(p.prefix+'-chart-mode').onclick=e=>{const b=e.target.closest('[data-mode]');if(b&&['value','change'].includes(b.dataset.mode)){state[p.modeKey]=b.dataset.mode;save();draw();}};}
 document.querySelectorAll('[data-plot-source]').forEach(b=>b.onclick=()=>evidence(b.dataset.plotSource));$('group-matrix').onclick=e=>{const b=e.target.closest('[data-evidence-group]');if(b)evidence(b.dataset.evidenceMetric,b.dataset.evidenceGroup);};$('group-source-close').onclick=()=>$('group-source-dialog').close();
 $('group-export').onclick=()=>{const windows=Object.fromEntries(plots.map(p=>[p.metric,state[p.windowKey]])),url=URL.createObjectURL(new Blob([G.csvAll(weekly,state.period,windows)],{type:'text/csv;charset=utf-8'}));Object.assign(document.createElement('a'),{href:url,download:'酒店之家集团对比_'+state.period+'.csv'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 document.querySelectorAll('[data-hotel-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const u=new URL(a.href,location.href);if(new URLSearchParams(location.search).get('embed')==='1')u.searchParams.set('embed','1');location.href=u.href;}));
 new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(weekly.length&&!$('dashboard').hidden&&$('group-trend').clientWidth>0)draw();});}).observe($('group-trend-panel'));
 try{const result=await Promise.allSettled([SiteUI.request('data/hotel_group_weekly.csv','text'),SiteUI.request('data/hotel-update-record.json')]);if(result[0].status!=='fulfilled')throw Error('集团周度数据读取失败');weekly=H.csv(result[0].value);periods=G.periods(weekly);if(!periods.length)throw Error('没有集团数据');if(!periods.includes(state.period))state.period=periods.at(-1);if(result[1].status==='fulfilled')update=result[1].value;
  $('group-period').innerHTML=[...periods].reverse().map(p=>'<option value="'+p+'">'+H.weekLabel(p)+'</option>').join('');for(const p of plots)$(p.prefix+'-window').innerHTML=[['12','最近12周'],['26','近半年'],['52','近1年'],['156','近3年'],['all','全部历史']].map(([v,n])=>'<option value="'+v+'">'+n+'</option>').join('');$('dashboard').hidden=false;paint();
 }catch(e){$('load-error').hidden=false;$('load-error').innerHTML='酒店之家集团数据暂时无法读取。<button type="button" onclick="location.reload()">重试</button>';$('asof').textContent='读取失败';}
})();

