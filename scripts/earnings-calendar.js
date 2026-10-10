(function(){
'use strict';
const M=window.EarningsCalendar,D=window.SiteData,$=id=>document.getElementById(id),esc=D.esc;
const KEY='sinolink-earnings-preferences-v2';
let pool=[],snapshot,archive,all=[],visible=[],summaries=[],watch=[],legacy={},view='list',anchor='',selected='',pageSize=50,recentLimit=10;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=v=>v?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(v))+' 北京时间':'暂无数据';
const periodLabel=p=>p.slice(0,4)+' '+(M.TYPES[M.reportType(p)]||p);
const link=(url,label)=>M.url(url)?'<a target="_blank" rel="noopener noreferrer" href="'+esc(M.url(url))+'">'+esc(label)+' ↗</a>':'<span class="ec-muted">原文待补</span>';
const tag=r=>r.kind!=='formal'?'ec-forecast':r.actual?'ec-formal':'ec-scheduled';
function toast(text){$('toast').textContent=text;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').textContent='',5000);}
function restore(){try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');watch=Array.isArray(p.watch)?p.watch.filter(x=>typeof x==='string').map(M.code):[];}catch{toast('关注设置读取失败');}try{legacy=JSON.parse(localStorage.getItem('sinolink-earnings-v1')||'{}').records||{};}catch{legacy={};}}
function saveWatch(next){try{localStorage.setItem(KEY,JSON.stringify({watch:next}));watch=next;return true;}catch{toast('当前浏览器无法保存关注');return false;}}
function filters(){return {search:$('search').value,sector:$('sector').value,market:$('market').value,watched:$('watchOnly').checked,watch,today:today()};}
function syncURL(){const p=new URLSearchParams();for(const [id,key] of [['search','q'],['sector','sector'],['market','market']])if($(id).value)p.set(key,$(id).value);if(view!=='list')p.set('view',view);if(anchor!==today()&&view!=='list')p.set('date',anchor);if($('history').checked)p.set('history','1');if($('watchOnly').checked)p.set('watch','1');history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
function applyURL(){const p=new URLSearchParams(location.search);for(const [id,key] of [['search','q'],['sector','sector'],['market','market']]){const v=p.get(key);if(v!=null&&(id==='search'||[...$(id).options].some(o=>o.value===v)))$(id).value=v;}if(['month','week','list'].includes(p.get('view')))view=p.get('view');anchor=M.validDate(p.get('date'))?p.get('date'):today();selected=anchor;$('watchOnly').checked=p.get('watch')==='1';$('history').checked=p.get('history')==='1';if($('history').checked)view='list';}
function eventButton(e,small=false){return '<button class="ec-event '+tag(e)+(small?' ec-small':'')+'" data-record="'+esc(e.id)+'" aria-label="'+esc(e.name+' '+periodLabel(e.period)+' '+e.dateLabel+' '+e.date)+'"><b>'+esc(e.name)+'</b><span>'+esc(small?e.dateLabel:periodLabel(e.period)+' · '+e.dateLabel)+'</span></button>';}
function companyButton(c,id){return '<button class="ec-company" '+(id?'data-record="'+esc(id)+'"':'data-company="'+esc(c.code)+'"')+'>'+esc(c.name)+(watch.includes(c.code)?'<span aria-label="已关注"> ★</span>':'')+'</button><small>'+esc(c.code)+' · '+esc(c.sector)+' · '+esc(c.market)+'</small>';}
function render(){
 if(!snapshot)return;
 all=M.rows(pool,snapshot,'');visible=M.filter(all,filters());
 // Match companies as well as records, including companies with no dates.
 const companies=M.filter(pool.map(c=>({...c,kind:'formal',period:'',source:null})),filters());
 const matchedCodes=new Set([...companies,...visible].map(r=>M.code(r.code)));
 summaries=M.recent(pool,snapshot,today()).filter(c=>matchedCodes.has(c.code));
 const next=summaries.flatMap(c=>c.next?[c.next]:[]),near=M.upcoming(next,today(),30);
 $('count').textContent=summaries.length+' 家公司 · 未来 30 天 '+near.length+' 家安排';
 $('recentView').hidden=view!=='list';$('calendarView').hidden=view==='list';
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 if(view==='list'){
  const historyMode=$('history').checked;
  $('upcomingSection').hidden=historyMode;$('listTitle').textContent=historyMode?'披露历史':'最近披露';
  if(historyMode){
   $('historyMore').textContent='加载更多';
   const sorted=[...visible].sort((a,b)=>(b.actual||b.expected||b.announcementDate||'').localeCompare(a.actual||a.expected||a.announcementDate||'')||a.code.localeCompare(b.code));
   $('rows').innerHTML=sorted.length?sorted.slice(0,pageSize).map(r=>'<tr><td>'+companyButton(r,r.id)+'</td><td data-label="报告期">'+esc(periodLabel(r.period))+'<small>'+esc(M.KINDS[r.kind])+'</small></td><td data-label="实际披露日">'+esc(r.actual||'待公布')+'</td><td data-label="预计披露日">'+esc(r.expected||'待公布')+'<small>'+M.status(r,today())+'</small></td></tr>').join(''):'<tr><td colspan="4" class="ec-empty">没有匹配记录</td></tr>';
   $('listCount').textContent=Math.min(pageSize,sorted.length)+' / '+sorted.length+' 条';$('historyMore').hidden=sorted.length<=pageSize;
  }else{
   const groups=new Map();for(const r of near){if(!groups.has(r.expected))groups.set(r.expected,[]);groups.get(r.expected).push(r);}
   $('reminders').innerHTML=groups.size?[...groups].map(([date,records])=>'<div class="ec-date-group"><time>'+date.slice(5).replace('-','月')+'日</time><div>'+records.map(r=>eventButton({...r,date:r.expected,dateLabel:'预计披露'})).join('')+'</div></div>').join(''):'<div class="ec-empty">未来 30 天暂无已公布预约</div>';
   $('rows').innerHTML=summaries.length?summaries.slice(0,recentLimit).map(c=>{const id=c.latest?.id||c.next?.id;const next=c.next?'<button class="ec-next" data-record="'+esc(c.next.id)+'">'+c.next.expected+'</button><small>'+esc(periodLabel(c.next.period))+' · 预计</small>':c.overdue?'<button class="ec-overdue" data-record="'+esc(c.overdue.id)+'">'+esc(c.overdue.expected)+'</button><small>预约日已过</small>':'<span class="ec-muted">待公布</span>';return '<tr><td>'+companyButton(c,id)+'</td><td data-label="最近财报">'+esc(c.latest?periodLabel(c.latest.period):'暂无数据')+'</td><td data-label="实际披露日">'+(c.latest?'<button class="ec-actual" data-record="'+esc(c.latest.id)+'">'+c.latest.actual+'</button>':'<span class="ec-muted">待公布</span>')+'</td><td data-label="下次披露">'+next+'</td></tr>';}).join(''):'<tr><td colspan="4" class="ec-empty">没有匹配公司</td></tr>';
   $('listCount').textContent='每家公司最近一期 · '+Math.min(recentLimit,summaries.length)+' / '+summaries.length+' 家';$('historyMore').hidden=summaries.length<=recentLimit;$('historyMore').textContent='显示全部 '+summaries.length+' 家公司';
  }
 }else{
  const events=M.eventsFor(visible),[year,month]=anchor.split('-').map(Number),days=view==='week'?M.weekDays(anchor):M.monthDays(year,month-1);
  $('rangeTitle').textContent=view==='week'?days[0]+' — '+days[6]:year+' 年 '+month+' 月';
  $('grid').classList.toggle('ec-week',view==='week');
  $('grid').innerHTML=days.map(date=>{const eventsOnDay=events.filter(e=>e.date===date),limit=3;return '<div class="ec-day '+(view==='month'&&date.slice(0,7)!==anchor.slice(0,7)?'ec-outside ':'')+(selected===date?'ec-selected ':'')+(date===today()?'ec-today':'')+'"><button class="ec-day-number" data-date="'+date+'" aria-label="'+date+'，'+eventsOnDay.length+' 项" aria-pressed="'+(selected===date)+'">'+Number(date.slice(8))+'</button>'+eventsOnDay.slice(0,limit).map(e=>eventButton(e,true)).join('')+(eventsOnDay.length>limit?'<button class="ec-more" data-date="'+date+'">+'+(eventsOnDay.length-limit)+'</button>':'')+'</div>';}).join('');
  $('selectedDate').textContent=selected;
  const day=events.filter(e=>e.date===selected);$('dayEvents').innerHTML=day.length?day.map(e=>eventButton(e)).join(''):'<span class="ec-muted">当天没有披露安排</span>';
 }
 syncURL();
}
async function detail(id,companyCode){
 let r=all.find(x=>x.id===id);
 const company=r||pool.find(c=>c.code===companyCode);if(!company)return;
 if(!r)r={...company,id:company.code+'|pending',kind:'formal',period:'',source:null};
 $('detailTitle').textContent=r.name;$('detailSubtitle').textContent=r.code+' · '+r.market+' · '+r.sector+(r.period?' · '+periodLabel(r.period):'');
 const reservations=(r.reservations||[]).map(x=>'<li>'+esc(x.label||'预约')+' '+esc(x.date)+(x.announcedAt?'<small>通知发布 '+esc(x.announcedAt)+'</small>':'')+(x.url?link(x.url,'预约公告原文'):'')+'</li>').join('');
 const histories=(r.history||[]).map(x=>'<li>'+esc(time(x.observedAt))+' · '+esc({expected:'预约日期',actual:'实际披露',announcementDate:'公告日期',url:'原文链接'}[x.field])+'：'+esc(x.from||'待公布')+' → '+esc(x.to||'待公布')+'</li>').join('');
 const previous=M.rows(pool,snapshot,'').filter(x=>x.code===r.code&&x.id!==r.id).sort((a,b)=>(b.actual||b.expected||b.announcementDate||'').localeCompare(a.actual||a.expected||a.announcementDate||''));
 const old=Object.entries(legacy).find(([key])=>key.split('|')[0]===r.period&&M.code(key.split('|')[1])===r.code)?.[1];
 const announcementSource=snapshot.sources.find(s=>s.id===r.announcementSourceId);
 $('detailBody').innerHTML='<div class="ec-detail-actions"><button id="watchCompany">'+(watch.includes(r.code)?'★ 已关注':'☆ 关注公司')+'</button><span class="ec-badge '+tag(r)+'">'+M.status(r,today())+'</span></div><p>'+esc(r.title||'财报日期待公布')+'</p><dl class="ec-dates"><div><dt>预约 / 预计披露日</dt><dd>'+esc(r.expected||'待公布')+'</dd></div><div><dt>实际披露日</dt><dd>'+esc(r.actual||'待公布')+'</dd></div><div><dt>公告发布日期</dt><dd>'+esc(r.announcementDate||'待公布')+'</dd></div></dl><div class="ec-provenance">'+link(r.url,'公告原文')+'<p>'+esc(r.source?.label||'暂无数据')+' · 更新 '+esc(time(r.updatedAt))+'</p>'+(announcementSource?'<small>原文 / 公告日期：'+esc(announcementSource.label)+'</small>':'')+(r.announcementPublishedAt?'<p>公告上传 '+esc(r.announcementPublishedAt)+' 北京时间</p>':'')+'</div>'+(reservations?'<details><summary>预约与变更</summary><ol class="ec-history">'+reservations+'</ol></details>':'')+(histories?'<details><summary>日期更新记录</summary><ol class="ec-history">'+histories+'</ol></details>':'')+'<h3>披露历史</h3><div class="ec-previous">'+(previous.length?previous.map(x=>'<button data-record="'+esc(x.id)+'"><span>'+esc(periodLabel(x.period))+'</span><b>'+esc(x.actual||x.expected||'待公布')+'</b><small>'+M.status(x,today())+'</small></button>').join(''):'<span class="ec-muted">暂无历史记录</span>')+'</div>'+(old?'<details><summary>个人旧记录 · 未经核验</summary><p>'+esc(old.actual||old.expected||'未填写')+' · '+esc(old.notes||'')+'</p></details>':'')+'<details><summary>历史归档 / 预告与快报</summary><div id="archiveHistory"><button id="loadArchive">查看</button></div></details>'+(r.evidence?'<details><summary>Choice 核验依据</summary><pre>'+esc(JSON.stringify(r.evidence,null,2))+'</pre></details>':'');
 $('watchCompany').onclick=()=>{const next=watch.includes(r.code)?watch.filter(c=>c!==r.code):[...watch,r.code];if(saveWatch(next)){$('watchCompany').textContent=watch.includes(r.code)?'★ 已关注':'☆ 关注公司';render();}};
 $('loadArchive').onclick=async()=>{try{archive=archive||M.validateSnapshot(await D.json('data/earnings-calendar-archive.json'));const ids=new Set(all.map(x=>x.id));const records=M.rows(pool,archive,'').filter(x=>x.code===r.code&&!ids.has(x.id));$('archiveHistory').innerHTML=records.length?records.sort((a,b)=>(b.actual||b.announcementDate||'').localeCompare(a.actual||a.announcementDate||'')).map(x=>'<p>'+esc(periodLabel(x.period))+' · '+esc(M.KINDS[x.kind])+' · '+esc(x.actual||x.announcementDate||x.expected||'待公布')+'<small>'+esc(x.source?.label||'')+' · '+esc(time(x.updatedAt))+'</small>'+link(x.url,'公告原文')+'</p>').join(''):'<span class="ec-muted">无额外归档记录</span>';}catch{toast('归档读取失败，可重试');}};
 if(!$('detail').open)$('detail').showModal();
}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.querySelector('main').addEventListener('click',e=>{const b=e.target.closest('[data-record]');if(b)detail(b.dataset.record);const c=e.target.closest('[data-company]');if(c)detail(null,c.dataset.company);const day=e.target.closest('[data-date]');if(day){selected=anchor=day.dataset.date;render();}});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;if(view!=='list')$('history').checked=false;pageSize=50;render();});
for(const id of ['sector','market','watchOnly'])$(id).onchange=()=>{pageSize=50;recentLimit=10;render();};
$('search').oninput=()=>{pageSize=50;recentLimit=10;render();};$('history').onchange=()=>{view='list';pageSize=50;$('moreOptions').open=false;render();};
$('historyMore').onclick=()=>{if($('history').checked)pageSize+=50;else recentLimit=Infinity;render();};
document.addEventListener('click',e=>{if(!$('moreOptions').contains(e.target))$('moreOptions').open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('moreOptions').open=false;});
function shift(n){if(view==='week')anchor=M.addDays(anchor,7*n);else{const d=new Date(anchor.slice(0,7)+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);anchor=d.toISOString().slice(0,10);}selected=anchor;render();}
$('prev').onclick=()=>shift(-1);$('next').onclick=()=>shift(1);$('today').onclick=()=>{anchor=selected=today();render();};
$('closeDetail').onclick=()=>$('detail').close();
$('csv').onclick=()=>download(M.csv(visible,today()),'财报日历-'+today()+'.csv','text/csv;charset=utf-8');
$('ics').onclick=()=>{const next=summaries.flatMap(c=>c.next?[c.next]:[]);if(!next.length){toast('当前筛选暂无已公布预约');return;}download(M.calendar(next,{today:today(),days:3}),'财报日历-'+today()+'.ics','text/calendar;charset=utf-8');};
async function boot(){try{
 const manifest=await D.json('data-manifest.json'),calendarFile=manifest.datasets.find(x=>x.id==='earnings_calendar')?.file;
 if(!calendarFile)throw Error('数据清单缺少财报配置');
 const [directory,data]=await Promise.all([D.json('data/coverage-companies.json'),D.json(calendarFile)]);snapshot=M.validateSnapshot(data);
 if(snapshot.primarySource!=='choice-mcp'||snapshot.records.some(r=>r.sourceId!=='choice-mcp'))throw Error('财报日期尚未同步 Choice');
 const coveredCodes=new Set(snapshot.records.map(r=>M.code(r.code)));
 pool=directory.companies.filter(c=>coveredCodes.has(M.code(c.code))).map(c=>({...c,code:M.code(c.code),market:/\.(SH|SZ)$/.test(c.code)?'A股':/\.HK$/.test(c.code)?'港股':'美股'}));
 if(!pool.length)throw Error('覆盖池为空');
 $('sector').innerHTML='<option value="">全部行业</option>'+[...new Set(pool.map(c=>c.sector))].map(s=>'<option>'+esc(s)+'</option>').join('');
 restore();applyURL();$('sourceStatus').textContent='Choice MCP · 更新 '+time(snapshot.updatedAt);
 $('sources').innerHTML='<p>'+link('https://choice.eastmoney.com/','Choice · 东方财富')+' · '+esc(time(snapshot.updatedAt))+'</p><p>实际 / 预计披露日期；公告原文及发布日期单独核验</p><a href="https://github.com/Yuxing954/guojin-shangshe-database/blob/main/docs/earnings-workbench.md" target="_blank" rel="noopener">数据口径与更新 ↗</a>';
 $('content').hidden=false;$('error').hidden=true;render();
}catch(e){$('content').hidden=true;$('sourceStatus').textContent='Choice 日期加载失败';$('error').hidden=false;$('error').innerHTML='<span>'+esc(e.message)+'</span> <button id="retry">重新加载</button>';$('retry').onclick=boot;}}
boot();
})();
