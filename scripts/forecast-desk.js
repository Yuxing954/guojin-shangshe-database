(function(){
 'use strict';
 const $=id=>document.getElementById(id),M=window.MacroModel,P=window.PredictionModel,F=window.FedwatchModel;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n=v=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(v):'—';
 const pct=v=>typeof v==='number'&&Number.isFinite(v)?n(v)+'%':'—';
 const money=v=>typeof v==='number'&&Number.isFinite(v)?'$'+(v>=1e6?n(v/1e6)+'百万':v>=1e4?n(v/1e4)+'万':n(v)):'—';
 const when=v=>{const d=new Date(v);return v&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'未提供';};
 const day=v=>v?String(v).slice(0,10):'未提供';
 const anchor=(url,label)=>'<a target="_blank" rel="noopener" href="'+esc(M.safeUrl(url))+'">'+esc(label)+'</a>';
 const exportCsv=(rows,name)=>{const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(M.csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const params=new URLSearchParams(location.search);let pm,wired=false,cme,cmeLoading=false,cmeError=false;
 function keep(values){const p=new URLSearchParams(location.search);Object.entries(values).forEach(([k,v])=>v?p.set(k,v):p.delete(k));history.replaceState(null,'',location.pathname+'?'+p);}
 const pmDay=v=>{const d=new Date(v);if(!v||Number.isNaN(d.getTime()))return '未提供';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const part=type=>parts.find(p=>p.type===type).value;return part('year')+'-'+part('month')+'-'+part('day');};
 const PM_PAGE_SIZE=24;let pmLimit=PM_PAGE_SIZE,pmGroups=[],pmSelected='',pmOutcome=0;
 const pmChange=o=>Number.isFinite(o.previousProbability)&&Number.isFinite(o.probability)?(o.probability-o.previousProbability)*100:null;
 function pmOutcomes(g,items){
  return items.flatMap(m=>{const yes=P.affirmative(m);return (yes?[yes]:m.outcomes).map(o=>({market:m,outcome:o,label:g.markets.length===1?(yes?'是':o.nameZh||o.name):P.optionLabel(g,m)+(yes?'':' · '+(o.nameZh||o.name))}));});
 }

 function eventRows(g){
  const rows=pmOutcomes(g,g.markets);
  if(g.markets.length===1&&P.affirmative(g.markets[0])){const no=g.markets[0].outcomes.find(o=>o.name==='No'||o.nameZh==='否');if(no)rows.push({market:g.markets[0],outcome:no,label:'否'});}
  return rows;
 }
 function chooseEvent(id){const restore=document.activeElement?.hasAttribute('data-pm-event');pmSelected=id;pmOutcome=0;drawPm();if(restore)Array.from(document.querySelectorAll('[data-pm-event]')).find(el=>el.dataset.pmEvent===id)?.focus({preventScroll:true});}
 function drawEvent(){
  const g=pmGroups.find(g=>g.id===pmSelected),host=$('prediction-focus');
  if(!g){host.innerHTML='<p class="portal-empty">暂无符合条件的事件</p>';$('prediction-event-select').innerHTML='';return;}
  const rows=eventRows(g);if(pmOutcome>=rows.length)pmOutcome=0;
  const row=rows[pmOutcome],prob=row&&Number.isFinite(row.outcome.probability)?row.outcome.probability*100:null;
  const independent=/触及|指定时点|持续至日期/.test(P.measurement(g));
  host.innerHTML='<div class="pm-focus-heading"><span>'+esc(g.dataType.label)+' · '+esc(P.measurement(g))+'</span><h2>'+esc(g.title)+'</h2></div>'+
   '<div class="pm-answer"><div><span class="pm-answer-caption">'+(independent?'所选条件':'所选结果')+'</span><h3>'+esc(row?.label||'未提供')+'</h3></div><div class="pm-big-number"><strong>'+pct(prob)+'</strong><span>市场隐含概率</span></div></div>'+
   '<div class="pm-results-heading"><h3>'+(independent?'各条件发生概率':'各结果概率对比')+'</h3><span>'+(independent?'各合约独立，不相加':'按原始合约概率展示')+'</span></div>'+
   '<div class="pm-results">'+rows.map((r,i)=>{const p=Number.isFinite(r.outcome.probability)?r.outcome.probability*100:null;return '<button type="button" class="pm-result" data-pm-outcome="'+i+'" aria-pressed="'+(i===pmOutcome)+'"><span class="pm-result-name">'+esc(r.label)+'</span><span class="pm-result-track" aria-hidden="true"><i style="width:'+(p??0)+'%"></i></span><strong>'+pct(p)+'</strong></button>';}).join('')+'</div>'+
   '<div class="pm-focus-footer"><span>'+(!g.complete?'部分收录 · ':'')+(g.endDate?'最早截止 '+esc(pmDay(g.endDate))+' · 北京时间':'截止时间未提供')+'</span><div>'+anchor(g.markets[0].url,'原始市场 ↗')+'<button type="button" data-prediction-event="'+esc(g.id)+'">合约明细</button></div></div>';
  document.querySelectorAll('[data-pm-event]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pmEvent===pmSelected)));
  $('prediction-event-select').value=pmSelected;
 }
 function openPmEvent(group){
  const dialog=$('prediction-dialog');$('prediction-dialog-title').textContent=group.title;
  $('prediction-dialog-meta').textContent=group.dataType.label+' · '+P.measurement(group)+' · '+group.markets.length+' 个合约'+(!group.complete?' · 部分收录':'')+' · 24h 成交 '+money(group.volume)+(pm.previousFetchedAt?' · 概率对照 '+pmDay(pm.previousFetchedAt)+' '+when(pm.previousFetchedAt)+' 北京时间':'');
  $('prediction-dialog-body').innerHTML='<div class="portal-table-scroll"><table class="portal-table board-table"><thead><tr><th>合约 / 结果</th><th>隐含概率</th><th>较对照 / pp</th><th>流动性</th><th>价差 / ¢</th><th>截止 / 北京时间</th><th>来源</th></tr></thead><tbody>'+group.markets.flatMap(m=>m.outcomes.map((o,i)=>{const change=pmChange(o);return '<tr><th scope="row"><b>'+esc(group.markets.length>1?P.optionLabel(group,m):m.questionZh||m.question)+'</b><span class="forecast-detail-outcome">'+esc(o.nameZh||o.name)+'</span>'+(i===0?'<small>'+esc(m.question)+'</small>':'')+'</th><td>'+pct(Number.isFinite(o.probability)?o.probability*100:null)+'</td><td>'+(change===null?'—':(change>0?'+':'')+n(change))+'</td><td>'+money(m.liquidity)+(m.liquidity!=null&&m.liquidity<10000?'<span class="forecast-badge caution">低流动性</span>':'')+'</td><td>'+(Number.isFinite(m.spread)?n(m.spread*100):'—')+'</td><td>'+(m.endDate?esc(pmDay(m.endDate)+' '+when(m.endDate)):'—')+'</td><td>'+anchor(m.url,'结算规则 ↗')+(m.updatedAt?'<small>源更新 '+esc(pmDay(m.updatedAt)+' '+when(m.updatedAt))+'</small>':'')+'</td></tr>';})).join('')+'</tbody></table></div>';
  dialog.showModal();
 }
 function renderPolymarket(data){
  pm=data;
  const available=P.groups(pm.markets,{wholeEvents:true}),counts=new Map(P.dataTypes.map(t=>[t.label,available.filter(g=>g.dataType.label===t.label).length]));
  const chosen=wired?$('prediction-category').value:(params.get('predictionTopic')|| (counts.get('央行利率')?'央行利率':''));
  const types=P.dataTypes.filter(t=>counts.get(t.label)||t.label===chosen);
  const options=[{label:'全部',value:'',count:available.length},...types.map(t=>({label:t.label,value:t.label,count:counts.get(t.label)}))];
  if(chosen&&!['all',...options.map(t=>t.value)].includes(chosen))options.push({label:chosen,value:chosen,count:available.filter(g=>g.category===chosen).length});
  $('prediction-topics').innerHTML=options.map(t=>'<button data-topic="'+esc(t.value)+'" aria-pressed="false">'+esc(t.label)+'</button>').join('');
  $('prediction-category').innerHTML=options.map(t=>'<option value="'+esc(t.value)+'">'+esc(t.label)+'</option>').join('');
  $('prediction-category').value=chosen==='all'?'':chosen;
  if(!wired){wired=true;$('prediction-search').value=params.get('predictionQuery')||'';$('prediction-category').value=params.has('predictionTopic')?(params.get('predictionTopic')==='all'?'':params.get('predictionTopic')):chosen;$('prediction-sort').value=params.get('predictionSort')==='deadline'?'deadline':'volume';
   $('prediction-topics').onclick=e=>{const b=e.target.closest('[data-topic]');if(b){$('prediction-category').value=b.dataset.topic;pmLimit=PM_PAGE_SIZE;drawPm();}};
   $('prediction-search').oninput=()=>{pmLimit=PM_PAGE_SIZE;drawPm();};$('prediction-sort').onchange=()=>{pmLimit=PM_PAGE_SIZE;drawPm();};$('prediction-more').onclick=()=>{pmLimit+=PM_PAGE_SIZE;drawPm();};$('prediction-reset').onclick=()=>{$('prediction-search').value='';$('prediction-category').value='';$('prediction-sort').value='volume';pmLimit=PM_PAGE_SIZE;drawPm();};
   $('prediction-list').onclick=e=>{const b=e.target.closest('[data-pm-event]');if(b)chooseEvent(b.dataset.pmEvent);};
   $('prediction-event-select').onchange=e=>chooseEvent(e.target.value);
   $('prediction-focus').onclick=e=>{const row=e.target.closest('[data-pm-outcome]'),detail=e.target.closest('[data-prediction-event]');if(row){pmOutcome=Number(row.dataset.pmOutcome);drawEvent();$('prediction-focus').querySelector('[data-pm-outcome="'+pmOutcome+'"]').focus({preventScroll:true});}else if(detail){const group=pmGroups.find(g=>g.id===detail.dataset.predictionEvent);if(group)openPmEvent(group);}};
   $('prediction-dialog-close').onclick=()=>$('prediction-dialog').close();
   const more=document.querySelector('.prediction-more-tools');
   document.addEventListener('click',e=>{if(!more.contains(e.target))more.open=false;});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&more.open){const restore=more.contains(document.activeElement);more.open=false;if(restore)more.querySelector('summary').focus();}});
  }drawPm();
 }
 function drawPm(){
  const topic=$('prediction-category').value,query=$('prediction-search').value,sort=$('prediction-sort').value;keep({predictionTopic:topic||'all',predictionQuery:query,predictionSort:sort});
  document.querySelectorAll('[data-topic]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topic===topic)));
  const groups=P.groups(pm.markets,{category:topic,query,sort,wholeEvents:true}),visible=groups.slice(0,pmLimit),stale=Date.now()-Date.parse(pm.fetchedAt)>24*3600000;pmGroups=groups;
  $('prediction-status').textContent=(pm.status==='error'?'更新失败 · 保留快照 · ':stale?'历史快照 · ':'快照 · ')+pmDay(pm.fetchedAt)+' '+when(pm.fetchedAt)+' 北京时间';

  if(!visible.some(g=>g.id===pmSelected)){pmSelected=visible[0]?.id||'';pmOutcome=0;}
  $('prediction-list').innerHTML=visible.map(g=>'<button class="pm-event" type="button" data-pm-event="'+esc(g.id)+'" aria-pressed="'+(g.id===pmSelected)+'"><span>'+esc(g.title)+'</span><small>'+esc(g.dataType.label)+(g.endDate?' · '+esc(pmDay(g.endDate))+' 截止':'')+'</small></button>').join('')||'<p class="portal-empty">暂无匹配事件</p>';
  $('prediction-event-select').innerHTML=visible.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.title)+'</option>').join('');
  drawEvent();
  $('prediction-more').hidden=groups.length<=pmLimit;$('prediction-more').textContent='再显示 '+Math.min(PM_PAGE_SIZE,Math.max(0,groups.length-pmLimit))+' 个事件';
  $('prediction-download').disabled=!groups.length;$('prediction-download').onclick=()=>exportCsv([['数据类型','概率口径','事件','原始事件标题','合约','英文原文','结果','隐含概率','24h成交USD','流动性USD','截止时间','源更新时间','快照时间','完整活跃事件收录','来源'],...groups.flatMap(g=>g.markets.flatMap(m=>m.outcomes.map(o=>[g.dataType.label,P.measurement(g),g.title,m.eventTitle||'',m.questionZh||m.question,m.question,o.nameZh||o.name,o.probability,m.volume24h,m.liquidity,m.endDate,m.updatedAt,pm.fetchedAt,g.complete,m.url])))],'polymarket-events.csv');
 }
 async function loadFedwatch(force=false){if(cmeLoading)return;if(cme&&!force){drawCme();return;}cmeLoading=true;$('fedwatch-status').textContent='正在读取…';try{const response=await fetch('data/gold-jewelry/macro.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('HTTP '+response.status);const value=await response.json();if(!Array.isArray(value.meetings)||!value.policy)throw new Error('格式错误');cme=value;cmeError=false;const meetings=value.meetings.filter(m=>Date.parse(m.meetingDate+'T23:59:59Z')>=Date.now()&&F.snapshots(m).length);$('fedwatch-meeting').innerHTML=meetings.map(m=>'<option value="'+esc(m.meetingDate)+'">'+esc(m.meetingDate)+'</option>').join('');if(meetings.some(m=>m.meetingDate===params.get('meeting')))$('fedwatch-meeting').value=params.get('meeting');$('fedwatch-meeting').onchange=()=>{setCompare();drawCme();};$('fedwatch-compare').onchange=drawCme;setCompare();drawCme();}catch{cmeError=true;if(cme)drawCme();else{$('fedwatch-status').textContent='CME 快照读取失败';$('fedwatch-content').innerHTML='<button id="fedwatch-retry" class="portal-button">重试读取</button>';$('fedwatch-retry').onclick=()=>loadFedwatch(true);}}finally{cmeLoading=false;}}
 function selectedCme(){const meeting=cme.meetings.find(m=>m.meetingDate===$('fedwatch-meeting').value);return {meeting,history:F.snapshots(meeting)};}
 function setCompare(){const {history}=selectedCme();$('fedwatch-compare').innerHTML='<option value="">不比较</option>'+history.slice(0,-1).reverse().map(s=>'<option value="'+esc(F.key(s))+'">'+esc(F.label(s))+'</option>').join('');$('fedwatch-compare').value=history.at(-2)?F.key(history.at(-2)):'';}
 function drawCme(){if(!cme)return;const {meeting,history}=selectedCme(),s=history.at(-1);$('fedwatch-download').disabled=!s;if(!s){$('fedwatch-status').textContent='暂无未来会议的有效概率快照';$('fedwatch-content').innerHTML='';return;}const previous=history.find(x=>F.key(x)===$('fedwatch-compare').value),buckets=F.aggregate(s,cme.policy),older=previous?F.aggregate(previous,cme.policy):null,rows=F.comparison(s,previous),source=cme.sources?.find(x=>x.id===s.sourceId);
  keep({meeting:meeting.meetingDate});$('fedwatch-status').textContent=(cmeError?'读取失败 · ':F.refreshWarning(cme.fedwatchUpdate,s))+(s.observedDate?((Date.now()-Date.parse(F.time(s))>24*3600000?'历史快照 · ':'快照 · ')+s.observedDate+(s.observedAt?' '+when(s.observedAt)+' 北京时间':'')):('整表获取 '+day(s.retrievedAt)+' '+when(s.retrievedAt)+' 北京时间'));
  $('fedwatch-content').innerHTML='<div class="forecast-policy">当前目标区间 <b>'+cme.policy.range.map(n).join('–')+'%</b><span>生效 '+esc(cme.policy.decisionDate)+'</span></div><div class="fedwatch-kpis board-kpis">'+[['cut','降息'],['hold','维持'],['hike','加息']].map(([key,label])=>{const value=buckets?.[key],change=older&&buckets?value-older[key]:null;return '<div class="fedwatch-kpi '+(key==='hold'?'primary':'')+' board-stat"><span>'+label+'</span><strong>'+pct(value)+'</strong><small>'+(change===null?'相对当前目标区间':(change>0?'+':'')+n(change)+' 个百分点 · 对照 '+F.label(previous))+'</small></div>';}).join('')+'</div><section class="portal-panel board-panel"><div class="forecast-head board-panel-head"><h3>'+meeting.meetingDate+' · 目标利率分布</h3><span>概率 %'+(previous?' · 对照 '+F.label(previous):'')+'</span></div><div class="fedwatch-distribution">'+rows.map(r=>'<div class="fedwatch-range" data-chart-tooltip="'+esc(F.label(s)+'\n'+n(r.lower)+'–'+n(r.upper)+'% · 概率：'+pct(r.probability)+(r.change===null?'':'\n较 '+F.label(previous)+'：'+n(r.change)+' 个百分点'))+'"><span>'+n(r.lower)+'–'+n(r.upper)+'%</span><div><i style="width:'+r.probability+'%"></i></div><strong>'+pct(r.probability)+'</strong><small>'+(r.change===null?'—':(r.change>0?'+':'')+n(r.change)+' pp')+'</small></div>').join('')+'</div><details class="forecast-method board-detail"><summary>历史明细与来源</summary><div class="portal-table-scroll"><table class="portal-table board-table"><thead><tr><th>快照日期</th><th>目标区间 %</th><th>概率 %</th><th>源时点</th></tr></thead><tbody>'+history.slice().reverse().flatMap(h=>h.ranges.map(r=>'<tr><td>'+esc(F.label(h))+'</td><td>'+n(r.lower)+'–'+n(r.upper)+'</td><td>'+n(r.probability)+'</td><td>'+esc(h.observedAt||'')+'</td></tr>')).join('')+'</tbody></table></div>'+anchor(source?.url||'https://www.cmegroup.com/fedwatch','CME FedWatch ↗')+' · 官方工具快照</details></section>';
  $('fedwatch-download').onclick=()=>exportCsv([['会议日期','快照日期','源时点','获取时间','时区','目标下限%','目标上限%','概率%','提供者','来源'],...history.flatMap(h=>h.ranges.map(r=>[meeting.meetingDate,h.observedDate,h.observedAt||'',h.retrievedAt||'',h.timezone,r.lower,r.upper,r.probability,'CME FedWatch',cme.sources?.find(x=>x.id===h.sourceId)?.url||'']))],'cme-fedwatch-'+meeting.meetingDate+'.csv');
  drawFullTable();
 }
 function drawFullTable(){
  const t=F.latestTable(cme);if(!t)return;const source=cme.sources?.find(s=>s.id===t.sourceId),selected=$('fedwatch-meeting').value;
  $('fedwatch-content').insertAdjacentHTML('beforeend','<details class="macro-data-details fedwatch-full-details"><summary>完整会议表与期货报价</summary><section class="portal-panel board-panel fedwatch-full"><div class="forecast-head board-panel-head"><div><h3>完整会议概率表</h3><span>'+t.rows.length+' 次会议 · '+t.columns.length+' 档区间</span></div><button id="fedwatch-table-download" class="portal-button">下载整表 CSV</button></div><p class="forecast-status">'+(t.observedAt?'源时点 '+esc(t.observedAt)+' · ':'')+'获取 '+day(t.retrievedAt)+' '+when(t.retrievedAt)+' 北京时间</p><div class="portal-table-scroll"><table class="portal-table board-table fedwatch-matrix"><thead><tr><th>会议日期</th>'+t.columns.map(r=>'<th>'+n(r.lower)+'–'+n(r.upper)+'%</th>').join('')+'</tr></thead><tbody>'+t.rows.map(r=>{const max=Math.max(...r.probabilities.filter(Number.isFinite));return '<tr'+(r.meetingDate===selected?' class="is-selected"':'')+'><th scope="row"><button class="fedwatch-meeting-link" data-fedwatch-meeting="'+esc(r.meetingDate)+'" aria-pressed="'+(r.meetingDate===selected)+'">'+esc(r.meetingDate)+'</button></th>'+r.probabilities.map(p=>'<td'+(p===null?'':' style="background:rgba(81,88,170,'+(.025+p/240)+')"')+'>'+(p===null?'—':p===max?'<strong>'+pct(p)+'</strong>':pct(p))+'</td>').join('')+'</tr>';}).join('')+'</tbody></table></div><details class="forecast-method board-detail"><summary>口径与来源</summary>目标利率区间由基点转换为 %；概率按原表保留，空白为 —，不归一化。'+anchor(source?.url,'CME FedWatch ↗')+(t.referenceObservedAt?'<p>Current 页参考源时点：'+esc(t.referenceObservedAt)+'</p>':'')+'</details><div class="forecast-head board-panel-head"><h3>联邦基金期货报价</h3><span>'+t.futures.length+' 个合约 · 原始价格</span></div><div class="portal-table-scroll"><table class="portal-table board-table fedwatch-futures"><thead><tr>'+t.futures.map(q=>'<th scope="col">'+esc(q.contract)+'<small>'+esc(q.contractMonth)+'</small></th>').join('')+'</tr></thead><tbody><tr>'+t.futures.map(q=>'<td>'+esc(q.rawPrice)+'</td>').join('')+'</tr></tbody></table></div></section></details>');
  document.querySelectorAll('[data-fedwatch-meeting]').forEach(b=>b.onclick=()=>{$('fedwatch-meeting').value=b.dataset.fedwatchMeeting;setCompare();drawCme();});
  $('fedwatch-table-download').onclick=()=>exportCsv([['记录类型','会议日期','合约','合约月份','目标下限%','目标上限%','概率%','报价','源时点','获取时间','参考源时点Current','来源'],...t.rows.flatMap(r=>r.probabilities.map((p,i)=>['会议概率',r.meetingDate,'','',t.columns[i].lower,t.columns[i].upper,p,'',t.observedAt||'',t.retrievedAt,t.referenceObservedAt||'',source?.url||''])),...t.futures.map(q=>['期货报价','',q.contract,q.contractMonth,'','','',q.rawPrice,t.observedAt||'',t.retrievedAt,t.referenceObservedAt||'',source?.url||''])],'cme-fedwatch-full-'+day(t.retrievedAt)+'.csv');
 }
 window.ForecastDesk={renderPolymarket,loadFedwatch};
})();



