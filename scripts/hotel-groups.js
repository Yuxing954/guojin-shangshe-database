(async function(){
 'use strict';
 const G=HotelGroupsModel,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=(v,d=0)=>v==null?'—':new Intl.NumberFormat('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v),signed=(v,d=1)=>(v>0?'+':'')+fmt(v,d),tone=v=>v>0?'hd-positive':v<0?'hd-negative':'hd-neutral';
 const q=new URLSearchParams(location.hash.slice(1)),validId=['hworld','jinjiang','btg','atour'];
 const state={type:q.get('type')==='weekly'?'weekly':'reports',id:validId.includes(q.get('group'))?q.get('group'):'hworld',metric:q.get('metric')||'revpar',period:q.get('period')||'latest',window:q.get('window')||'12',mode:['combo','value','change'].includes(q.get('chart'))?q.get('chart'):'combo'};
 let data,weekly=[],available={},periods=[],frame=0;
 const row=(id=state.id,metric=state.metric)=>{const s=G.series(data,weekly,state.type,id,metric);return {s,o:G.observation(s,state.period)};};
 const readableScope=s=>s?[...new Set([s.region,s.scope,s.basis].filter(v=>v&&v!=='全部'&&v!=='集团整体'&&v!=='全国'))].join(' · ')||'集团整体':'该期暂无数据';
 const compactScope=(id,s)=>state.type==='weekly'?G.groups[id]:['revpar','occ','adr'].includes(state.metric)?({hworld:'中国酒店（HWC）',jinjiang:'境内有限服务型',btg:'中国全酒店',atour:'全酒店 · 含税'})[id]:readableScope(s);
 const metricOptions=()=>state.type==='weekly'?[['adr','ADR'],['hotels','酒店数'],['rooms','房间数']]:[['revpar','RevPAR'],['occ','OCC'],['adr','ADR'],['hotels','酒店数'],['rooms','房间数'],['revenue','营业收入'],['profit','利润']];
 function save(){const p=new URLSearchParams({view:'groups',type:state.type,group:state.id,metric:state.metric,period:state.period===periods.at(-1)?'latest':state.period,window:state.window,chart:state.mode});history.replaceState(null,'',location.pathname+location.search+'#'+p.toString());dispatchEvent(new Event('hashchange'));}
 function growthText(o){const y=o?.yoy;return y?'<span class="'+tone(y.value)+'">'+(y.unit==='%'||y.unit==='百分点'?'同比 ':'同比增减 ')+signed(y.value)+(y.unit==='百分点'?'pct':y.unit==='%'?'%':' '+esc(y.unit))+'</span>':'<span class="hd-neutral">同比 —</span>';}
 function configure(){
  const choices=metricOptions();if(!choices.some(([m])=>m===state.metric))state.metric=choices[0][0];
  $('group-metric').innerHTML=choices.map(([v,n])=>'<option value="'+v+'">'+n+'</option>').join('');$('group-metric').value=state.metric;
  periods=G.periods(data,weekly,state.type,state.metric);if(!periods.includes(state.period))state.period=periods.at(-1)||'';
  $('group-period').innerHTML=[...periods].reverse().map(p=>'<option>'+p+'</option>').join('');$('group-period').value=state.period;
  $('group-period-label').firstChild.textContent=state.type==='weekly'?'数据周 ':'报告期 ';
  const windows=state.type==='weekly'?[['12','最近12周'],['26','近半年'],['52','近1年'],['156','近3年'],['all','全部历史']]:[['8','近2年'],['12','近3年'],['20','近5年'],['all','全部历史']];
  if(!windows.some(([v])=>v===state.window))state.window='12';$('group-window').innerHTML=windows.map(([v,n])=>'<option value="'+v+'">'+n+'</option>').join('');$('group-window').value=state.window;
  document.querySelectorAll('[data-type]').forEach(b=>{b.classList.toggle('active',b.dataset.type===state.type);b.setAttribute('aria-pressed',String(b.dataset.type===state.type));b.disabled=!available[b.dataset.type];});
 }
 function paint(){
  configure();const {s,o}=row(),company=data.companies.find(c=>c.id===state.id);
  $('group-cards').innerHTML=data.companies.map(c=>{const r=row(c.id),a=G.display(r.s,r.o),short=compactScope(c.id,r.s);return '<button type="button" class="hg-card" data-group="'+c.id+'" aria-pressed="'+(c.id===state.id)+'"><span class="hg-card-name">'+esc(c.name)+'<span class="hg-card-mark">'+(c.id===state.id?'正在查看':'查看走势')+'</span></span><span class="hg-card-value">'+fmt(a.value,a.precision)+'<small>'+esc(a.unit)+'</small></span><span class="hg-card-growth">'+growthText(r.o)+'</span><span class="hg-card-scope">'+esc(short)+'<br>'+esc(r.s?.periodBasis||'')+(state.metric==='profit'?' · '+esc(r.s?.name||''):'')+'</span>'+((r.o?.sourceConflict||r.o?.issue)?'<span class="hg-card-warning">来源差异待核验</span>':'')+'</button>';}).join('');
  $('group-company-name').textContent=company.name;$('group-metric-name').textContent=s?.name||metricOptions().find(([v])=>v===state.metric)?.[1];$('group-metric-name').dataset.metric=state.metric;
  $('group-scope').textContent=[readableScope(s),s?.periodBasis,state.type==='weekly'&&state.metric==='adr'?'入住日期房价与财报ADR统计范围不同':''].filter(Boolean).join(' · ');
  const weeklyPeriod=weekly.find(r=>r.period_id===state.period);$('period-note').textContent=state.type==='weekly'?state.period+(weeklyPeriod?' · '+weeklyPeriod.start_date+'—'+weeklyPeriod.end_date:'')+' · 酒店之家集团样本':state.period+' · 各集团保留原报告范围';
  const financialLast=G.periods(data,weekly,'reports','revpar').at(-1),weeklyLast=weekly.map(r=>r.period_id).sort().at(-1);
  $('asof').textContent=[financialLast?'财报 '+financialLast:'',weeklyLast?'周度 '+weeklyLast:''].filter(Boolean).join(' · ');
  $('group-footer').textContent=state.type==='weekly'?'来源：酒店之家 · 以原始样本为准':'资料入库：'+(data.updatedAt||'未记录')+' · 来源：公司披露 / 研究底稿';
  $('group-evidence').disabled=!o;paintMatrix();save();draw();
 }
 function draw(){
  const {s,o}=row(),company=data.companies.find(c=>c.id===state.id),selected=G.windowRows(s,state.period,state.window,periods),a=G.display(s,o);
  const points=selected.map(r=>({period:r.period,value:G.display(s,r).value,change:G.growth(r)?.value??null}));
  if(points.some(p=>p.value!=null)){SiteCharts.drawPaired($('group-trend'),points,{name:company.name+' · '+(s?.name||state.metric),unit:a.unit,precision:a.precision,changeUnit:state.metric==='occ'?'pct':'%',changePrecision:1,mode:state.mode,gap:state.type==='weekly'?undefined:3,trimEmpty:false});}
  else $('group-trend').innerHTML='<p class="hd-empty">所选范围暂无可比数据</p>';
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));});
  const sourceNote=state.type==='weekly'?'ADR使用入住日期字段；同比对齐上年同周号，未调整节假日错期。':'财务为单季人民币；OCC同比为pct。各集团经营范围不同，不作同店排名。';
  $('group-chart-note').textContent=sourceNote+(selected.some(r=>r.value==null)?' 缺失期间留空。':'')+(selected.some(r=>r.sourceConflict||r.issue)?' 部分期间存在来源或口径差异，详见来源。':'');
 }
 function paintMatrix(){
  const metrics=state.type==='weekly'?['adr','hotels','rooms']:['revpar','occ','adr','hotels','rooms','opened','pipeline','revenue','profit'];
  const names={revpar:'RevPAR · 元',occ:'OCC · %',adr:'ADR · 元',hotels:'酒店数 · 家',rooms:'房间数 · 间',opened:'新开店 · 家',pipeline:'筹建酒店 · 家',revenue:'收入 · 亿元',profit:'利润 · 亿元'};
  $('group-matrix').innerHTML='<thead><tr><th>集团</th>'+metrics.map(m=>'<th>'+names[m]+'</th>').join('')+'</tr></thead><tbody>'+data.companies.map(c=>'<tr><td class="hg-row-name"><strong>'+esc(c.name)+'</strong><small>'+esc(state.period)+'</small></td>'+metrics.map(m=>{const {s,o}=row(c.id,m),a=G.display(s,o);return '<td>'+(o?'<button class="hg-cell" type="button" data-evidence-group="'+c.id+'" data-evidence-metric="'+m+'" aria-label="查看'+esc(c.name+' '+(s?.name||m))+'来源">'+fmt(a.value,a.precision)+'<small>'+growthText(o)+'</small>'+(m==='profit'?'<small>'+esc(s.name)+'</small>':'')+'</button>':'—')+'</td>';}).join('')+'</tr>').join('')+'</tbody>';
 }
 function evidence(id=state.id,metric=state.metric){
  const {s,o}=row(id,metric);if(!o)return;const c=data.companies.find(c=>c.id===id),source=data.sources?.find(x=>x.id===o.sourceId),prior=o.yoy?.priorId?s.observations.find(r=>r.id===o.yoy.priorId):null;
  const fields=[['报告期',o.period+' · '+s.periodBasis],['原始数值',fmt(o.value,3)+' '+s.unit+(s.currency?' / '+s.currency:'')],['统计范围',[s.region,s.scope,s.mode,s.basis].filter(Boolean).join(' · ')],['数据状态',({transcribed:'底稿转录 / 原披露',derived:'底稿推算'})[o.status]||o.status],['来源',o.report||source?.file],['来源定位',o.locator],['页码',o.pages],['核验层级',[o.verification,source?.verification].filter(Boolean).join(' · ')],['同比依据',o.yoy?(o.yoy.kind+' · '+signed(o.yoy.value)+(o.yoy.unit==='百分点'?'pct':o.yoy.unit)+(prior?' · 基期 '+prior.period+'，原值 '+prior.value:'')):'无可比基期，未强算'],['推算公式',o.formula],['来源说明',o.note],['截图定位',o.screenshotLocator],['原底稿定位',o.originalSource?o.originalSource.id+' · '+o.originalSource.locator+' · 原值 '+o.originalSource.value:null]];
  const rawURL=o.reportUrl||source?.url;let url='';try{const u=new URL(rawURL);if(['https:','http:'].includes(u.protocol))url=u.href;}catch{}
  $('group-source-title').textContent=c.name+' · '+s.name;$('group-source-body').innerHTML=(url?'<p><a href="'+esc(url)+'" target="_blank" rel="noopener">查看原报告 ↗</a></p>':'')+((o.sourceConflict||o.issue)?'<p class="hg-issue">该记录存在来源或口径差异，保留原值，请结合原报告核验。</p>':'')+'<dl>'+fields.filter(([,v])=>v!=null&&v!=='').map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>';$('group-source-dialog').showModal();
 }
 $('group-source').onclick=e=>{const b=e.target.closest('[data-type]');if(!b||b.disabled||state.type===b.dataset.type)return;state.type=b.dataset.type;state.metric=state.type==='weekly'?'adr':'revpar';state.period='latest';state.window='12';paint();};
 $('group-metric').onchange=e=>{state.metric=e.target.value;paint();};$('group-period').onchange=e=>{state.period=e.target.value;paint();};$('group-cards').onclick=e=>{const b=e.target.closest('[data-group]');if(b){state.id=b.dataset.group;paint();}};$('group-window').onchange=e=>{state.window=e.target.value;save();draw();};
 $('group-chart-mode').onclick=e=>{const b=e.target.closest('[data-mode]');if(b){state.mode=b.dataset.mode;save();draw();}};$('group-evidence').onclick=()=>evidence();$('group-matrix').onclick=e=>{const b=e.target.closest('[data-evidence-group]');if(b)evidence(b.dataset.evidenceGroup,b.dataset.evidenceMetric);};$('group-source-close').onclick=()=>$('group-source-dialog').close();
 $('group-export').onclick=()=>{const rows=data.companies.flatMap(c=>{const s=G.series(data,weekly,state.type,c.id,state.metric);return G.windowRows(s,state.period,state.window,periods).filter(o=>o.value!=null).map(o=>({...s,...o,companyId:c.id,metric:s.metric}));});const names=state.type==='weekly'?Object.entries(G.weeklyMetrics).map(([id,s])=>({id,name:s.name})):data.companies.flatMap(c=>Object.values(c.series).map(s=>({id:s.metric,name:s.name})));const csv=CompanyDatabaseModel.csv(rows,names),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));Object.assign(document.createElement('a'),{href:url,download:'酒店集团_'+state.type+'_'+state.metric+'_'+state.period+'.csv'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 document.querySelectorAll('[data-hotel-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const u=new URL(a.href,location.href);if(new URLSearchParams(location.search).get('embed')==='1')u.searchParams.set('embed','1');location.href=u.href;}));
 new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(data&&!$('dashboard').hidden&&$('group-trend').clientWidth>0)draw();});}).observe($('group-trend-panel'));
 try{
  const result=await Promise.allSettled([SiteUI.request('data/hotel-groups.json'),SiteUI.request('data/hotel_group_weekly.csv','text')]);available={reports:result[0].status==='fulfilled',weekly:result[1].status==='fulfilled'};
  if(!available.reports&&!available.weekly)throw Error('两类数据读取失败');
  data=available.reports?result[0].value:{companies:[{id:'hworld',name:'华住集团-S'},{id:'jinjiang',name:'锦江酒店'},{id:'btg',name:'首旅酒店'},{id:'atour',name:'亚朵集团'}].map(c=>({...c,series:{}})),sources:[]};
  if(available.weekly)weekly=HotelMetrics.csv(result[1].value);
  if(!available[state.type]){state.type=available.reports?'reports':'weekly';state.metric=state.type==='weekly'?'adr':'revpar';}
  $('dashboard').hidden=false;paint();
 }catch(e){$('load-error').hidden=false;$('load-error').innerHTML='酒店集团数据暂时无法读取。<button type="button" onclick="location.reload()">重试</button>';$('asof').textContent='读取失败';}
})();
