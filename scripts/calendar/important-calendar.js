(function(){
'use strict';
const M=window.ImportantCalendar,$=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,loading,view='upcoming',region='',month=M.date(Date.now()).slice(0,7),selected='',visible=[];
const query=new URLSearchParams(location.search);
if(/^\d{4}-\d{2}$/.test(query.get('im')||'')&&Number(query.get('im').slice(5))>=1&&Number(query.get('im').slice(5))<=12)month=query.get('im');
if(query.get('iv')==='month')view='month';
if(['中国','海外'].includes(query.get('region')))region=query.get('region');
function sync(){const q=new URLSearchParams(location.search);if(!$('importantPanel').hidden){q.set('tab','important');if(view==='month'){q.set('iv','month');q.set('im',month);}else{q.delete('iv');q.delete('im');}if(region)q.set('region',region);else q.delete('region');}else{for(const key of ['tab','iv','im','region'])q.delete(key);}history.replaceState(null,'',location.pathname+(q.size?'?'+q:''));}
function tab(name,update=true){
 const important=name==='important';$('importantPanel').hidden=!important;$('earningsPanel').hidden=important;
 document.querySelectorAll('[data-calendar-tab]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.calendarTab===name));});
 if(update)sync();
 if(important)boot();else document.dispatchEvent(new Event('calendar:earnings'));
}
function row(e,now){const past=Date.parse(e.scheduledAt)<now;return '<article class="ic-event'+(past?' ic-past':'')+'"><div class="ic-date"><strong>'+esc(e.beijingDate.slice(5).replace('-',' / '))+'</strong><span>'+esc(e.beijingTime)+'</span></div><div class="ic-event-body"><div class="ic-title"><h3>'+esc(e.title)+'</h3><span>'+esc(e.period)+'</span></div><p>'+esc(e.focus)+'</p>'+(e.meetingStart?'<small>会议日期（美东）：'+esc(e.meetingStart.slice(5))+'—'+esc(e.meetingEnd.slice(5))+'；上方为决议公布时间</small>':'')+'</div><div class="ic-actions"><span class="ic-badge">'+(past?'时间已过':'官方日程')+'</span><a href="'+esc(e.href)+'">查看数据 →</a><a href="'+esc(e.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(e.source)+' ↗</a></div></article>';}
function render(){
 if(!data)return;const now=Date.now(),today=M.date(now);
 document.querySelectorAll('[data-important-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.importantView===view)));
 document.querySelectorAll('[data-important-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.importantRegion===region)));
 visible=M.select(data,{now,month:view==='month'?month:'',region});
 $('importantMonthBoard').hidden=view!=='month';
 $('importantRange').textContent=view==='month'?month.replace('-','年')+'月':'未来60天';
 $('importantPrev').disabled=month<=data.coverageStart.slice(0,7);$('importantNext').disabled=month>=data.coverageEnd.slice(0,7);
 let rows=visible;
 if(view==='month'){
  $('importantGrid').innerHTML=M.days(month).map(d=>{const events=visible.filter(e=>e.beijingDate===d),outside=!d.startsWith(month);return '<button type="button" class="ic-day'+(outside?' ic-outside':'')+(d===today?' ic-today':'')+(d===selected?' ic-selected':'')+'" data-important-day="'+d+'" aria-label="'+d+'，'+events.length+'项事件" aria-pressed="'+(d===selected)+'"'+(outside?' disabled':'')+'><span>'+Number(d.slice(-2))+'</span>'+events.map(e=>'<small>'+esc(e.title)+'</small>').join('')+'</button>';}).join('');
  if(selected){rows=visible.filter(e=>e.beijingDate===selected);$('importantListTitle').textContent=selected.replaceAll('-',' / ');$('importantClearDay').hidden=false;}else{$('importantListTitle').textContent='本月重要事件';$('importantClearDay').hidden=true;}
 }else{$('importantListTitle').textContent='接下来关注';$('importantClearDay').hidden=true;}
 $('importantEventCount').textContent=rows.length+' 项';
 const exhausted=today>data.coverageEnd;
 $('importantNotice').hidden=!exhausted;$('importantNotice').textContent='当前官方日程收录至 '+data.coverageEnd+'，后续日程待核验更新。';
 $('importantList').innerHTML=rows.length?rows.map(e=>row(e,now)).join(''):'<p class="ic-empty">'+(selected?'当天没有收录的重要事件':exhausted?'后续官方日程待更新':view==='month'?'本月没有收录的重要事件':'未来60天暂无该范围的重要事件')+'</p>';
 $('importantExport').disabled=!visible.length;
 $('importantCoverage').textContent='日程范围 '+data.coverageStart+'—'+data.coverageEnd+' · 核对 '+data.checkedAt;
 if(!$('importantPanel').hidden)sync();
}
async function boot(){
 if(data){render();return;}if(loading)return loading;
 $('importantStatus').hidden=false;$('importantStatus').textContent='正在读取重要日程…';$('importantBody').hidden=true;
 loading=(async()=>{try{const response=await fetch('data/important-calendar.json?v=20261014',{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);data=M.validate(await response.json());$('importantStatus').hidden=true;$('importantBody').hidden=false;render();}catch(e){$('importantStatus').textContent='重要日程加载失败，请重试。';const b=document.createElement('button');b.textContent='重新加载';b.onclick=()=>{loading=null;boot();};$('importantStatus').append(b);}finally{loading=null;}})();return loading;
}
document.querySelectorAll('[data-calendar-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.calendarTab));
document.querySelectorAll('[data-important-view]').forEach(b=>b.onclick=()=>{view=b.dataset.importantView;selected='';render();});
document.querySelectorAll('[data-important-region]').forEach(b=>b.onclick=()=>{region=b.dataset.importantRegion;selected='';render();});
for(const [id,step] of [['importantPrev',-1],['importantNext',1]])$(id).onclick=()=>{month=M.shift(month,step);selected='';render();};
function currentMonth(){const current=M.date(Date.now()).slice(0,7);return data?current<data.coverageStart.slice(0,7)?data.coverageStart.slice(0,7):current>data.coverageEnd.slice(0,7)?data.coverageEnd.slice(0,7):current:current;}
 $('importantToday').onclick=()=>{month=currentMonth();selected='';render();};
 $('importantGrid').onclick=e=>{const b=e.target.closest('[data-important-day]');if(b){selected=b.dataset.importantDay;render();}};
 $('importantClearDay').onclick=()=>{selected='';render();};
 $('importantExport').onclick=()=>{const url=URL.createObjectURL(new Blob([M.calendar(visible)],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='重要数据日历.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 setInterval(()=>{if(data&&!$('importantPanel').hidden)render();},60000);
 tab(query.get('tab')==='important'?'important':'earnings',false);
})();
