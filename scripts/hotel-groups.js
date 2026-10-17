(async function(){
 'use strict';
 const G=HotelGroupsModel,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=(v,d=0)=>v==null?'—':new Intl.NumberFormat('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v),signed=v=>(v>0?'+':'')+fmt(v,1),tone=v=>v>0?'hd-positive':v<0?'hd-negative':'hd-neutral';
 const q=new URLSearchParams(location.hash.slice(1)),state={id:Object.hasOwn(G.groups,q.get('group'))?q.get('group'):'hworld',metric:Object.hasOwn(G.weeklyMetrics,q.get('metric'))?q.get('metric'):'adr',period:q.get('period')||'latest',window:['12','26','52','156','all'].includes(q.get('window'))?q.get('window'):'12',mode:['combo','value','change'].includes(q.get('chart'))?q.get('chart'):'combo'};
 let weekly=[],periods=[],update={},frame=0;
 const row=(id=state.id,metric=state.metric)=>{const s=G.series(weekly,id,metric);return {s,o:G.observation(s,state.period)};};
 function save(){const p=new URLSearchParams({view:'groups',type:'weekly',group:state.id,metric:state.metric,period:state.period===periods.at(-1)?'latest':state.period,window:state.window,chart:state.mode});history.replaceState(null,'',location.pathname+location.search+'#'+p.toString());dispatchEvent(new Event('hashchange'));}
 const growth=o=>o?.yoy?'<span class="'+tone(o.yoy.value)+'">同比 '+signed(o.yoy.value)+'%</span>':'<span class="hd-neutral">同比 —</span>';
 function paint(){
  $('group-metric').value=state.metric;$('group-period').value=state.period;$('group-window').value=state.window;
  const {s,o}=row();
  $('group-cards').innerHTML=Object.entries(G.groups).map(([id,name])=>{const r=row(id);return '<button type="button" class="hg-card" data-group="'+id+'" aria-pressed="'+(id===state.id)+'"><span class="hg-card-name">'+esc(name)+'<span class="hg-card-mark">'+(id===state.id?'正在查看':'查看走势')+'</span></span><span class="hg-card-value">'+fmt(r.o?.value)+'<small>'+esc(r.s.unit)+'</small></span><span class="hg-card-growth">'+growth(r.o)+'</span><span class="hg-card-scope">'+(id==='jinjiang'?'中国区样本':'全国样本')+' · '+esc(r.s.periodBasis)+'</span></button>';}).join('');
  $('group-company-name').textContent=G.groups[state.id];$('group-metric-name').textContent=s.name;$('group-metric-name').dataset.metric=state.metric;
  $('group-scope').textContent=(state.id==='jinjiang'?'中国区样本':'全国样本')+' · '+s.periodBasis;
  const r=weekly.find(o=>o.period_id===state.period);$('period-note').textContent=state.period+(r?' · '+r.start_date+'—'+r.end_date:'');
  const latest=weekly.find(o=>o.period_id===periods.at(-1));$('asof').textContent='酒店之家 · '+periods.at(-1)+(latest?' · 截至 '+latest.end_date:'');
  $('group-footer').textContent='来源：酒店之家'+(update.importedAt?' · 入库 '+SiteUI.date(update.importedAt):'');
  $('group-evidence').disabled=!o;paintMatrix();save();draw();
 }
 function draw(){
  const {s}=row(),selected=G.windowRows(s,state.period,state.window,periods),points=selected.map(o=>({period:o.period,value:o.value,change:o.yoy?.value??null}));
  if(points.some(p=>p.value!=null))SiteCharts.drawPaired($('group-trend'),points,{name:G.groups[state.id]+' · '+s.name,unit:s.unit,precision:0,changeUnit:'%',changePrecision:1,mode:state.mode,trimEmpty:false});
  else $('group-trend').innerHTML='<p class="hd-empty">所选范围暂无数据</p>';
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));});
  $('group-chart-note').textContent='同周同比 · 未调整节假日错期'+(selected.some(o=>o.value==null)?' · 缺失期间留空':'');
 }
 function paintMatrix(){
  const metrics=Object.keys(G.weeklyMetrics);$('group-matrix').innerHTML='<thead><tr><th>集团</th>'+metrics.map(m=>'<th>'+G.weeklyMetrics[m].name+' · '+G.weeklyMetrics[m].unit+'</th>').join('')+'</tr></thead><tbody>'+Object.entries(G.groups).map(([id,name])=>'<tr><td class="hg-row-name"><strong>'+esc(name)+'</strong><small>'+esc(state.period)+'</small></td>'+metrics.map(m=>{const {o}=row(id,m);return '<td>'+(o?'<button class="hg-cell" type="button" data-evidence-group="'+id+'" data-evidence-metric="'+m+'">'+fmt(o.value)+'<small>'+growth(o)+'</small></button>':'—')+'</td>';}).join('')+'</tr>').join('')+'</tbody>';
 }
 function evidence(id=state.id,metric=state.metric){
  const {s,o}=row(id,metric);if(!o)return;const fields=[['数据周',o.period],['日期',o.startDate+'—'+o.endDate],['原始数值',fmt(o.value,3)+' '+s.unit],['集团范围',s.scope+' · 全国'],['日期口径',s.periodBasis],['来源','酒店之家'],['来源定位',o.locator],['同比基期',o.yoy?o.yoy.priorPeriod+' · 原值 '+o.yoy.priorValue:'无可比基期，未强算'],['同比',o.yoy?signed(o.yoy.value)+'%':'—']];
  $('group-source-title').textContent=G.groups[id]+' · '+s.name;$('group-source-body').innerHTML='<dl>'+fields.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>';$('group-source-dialog').showModal();
 }
 $('group-metric').onchange=e=>{state.metric=e.target.value;paint();};$('group-period').onchange=e=>{state.period=e.target.value;paint();};$('group-cards').onclick=e=>{const b=e.target.closest('[data-group]');if(b){state.id=b.dataset.group;paint();}};$('group-window').onchange=e=>{state.window=e.target.value;save();draw();};
 $('group-chart-mode').onclick=e=>{const b=e.target.closest('[data-mode]');if(b){state.mode=b.dataset.mode;save();draw();}};$('group-evidence').onclick=()=>evidence();$('group-matrix').onclick=e=>{const b=e.target.closest('[data-evidence-group]');if(b)evidence(b.dataset.evidenceGroup,b.dataset.evidenceMetric);};$('group-source-close').onclick=()=>$('group-source-dialog').close();
 $('group-export').onclick=()=>{const url=URL.createObjectURL(new Blob([G.csv(weekly,state.metric,state.period,state.window)],{type:'text/csv;charset=utf-8'}));Object.assign(document.createElement('a'),{href:url,download:'酒店之家集团_'+state.metric+'_'+state.period+'.csv'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 document.querySelectorAll('[data-hotel-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const u=new URL(a.href,location.href);if(new URLSearchParams(location.search).get('embed')==='1')u.searchParams.set('embed','1');location.href=u.href;}));
 new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(weekly.length&&!$('dashboard').hidden&&$('group-trend').clientWidth>0)draw();});}).observe($('group-trend-panel'));
 try{
  const result=await Promise.allSettled([SiteUI.request('data/hotel_group_weekly.csv','text'),SiteUI.request('data/hotel-update-record.json')]);if(result[0].status!=='fulfilled')throw Error('集团周度数据读取失败');
  weekly=HotelMetrics.csv(result[0].value);periods=G.periods(weekly);if(!periods.length)throw Error('没有集团数据');if(!periods.includes(state.period))state.period=periods.at(-1);if(result[1].status==='fulfilled')update=result[1].value;
  $('group-period').innerHTML=[...periods].reverse().map(p=>'<option>'+p+'</option>').join('');$('group-metric').innerHTML=Object.entries(G.weeklyMetrics).map(([v,m])=>'<option value="'+v+'">'+m.name+'</option>').join('');$('group-window').innerHTML=[['12','最近12周'],['26','近半年'],['52','近1年'],['156','近3年'],['all','全部历史']].map(([v,n])=>'<option value="'+v+'">'+n+'</option>').join('');
  $('dashboard').hidden=false;paint();
 }catch(e){$('load-error').hidden=false;$('load-error').innerHTML='酒店之家集团数据暂时无法读取。<button type="button" onclick="location.reload()">重试</button>';$('asof').textContent='读取失败';}
})();
