(function(){'use strict';const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let report,token=0;
const originals=new Map();let sourceTask;
async function readOriginals(date){
if(!sourceTask)sourceTask=SiteUI.request('data/daily/'+date+'.json').then(d=>{
if(report?.date!==date)return;
for(const rows of Object.values(d.sections||{}))for(const r of rows)if(r.url&&r.body)originals.set(r.url,r);
}).catch(()=>{sourceTask=null;throw new Error('原文读取失败');});
return sourceTask;
}
const refs=(items,expanded=false)=>(items||[]).filter(r=>/^https:\/\//.test(r.url||'')).map(r=>'<details class="daily-original" data-url="'+esc(r.url)+'"'+(expanded?' open':'')+'><summary>阅读原文 · '+esc(SiteUI.date(r.publishedAt))+'</summary><div class="daily-original-meta">'+esc(r.source||'原文')+'</div><div class="daily-original-body">正在读取原文…</div></details>').join('');
async function fillOriginals(date,id){
try{await readOriginals(date);if(id!==token)return;
document.querySelectorAll('.daily-original').forEach(el=>{
const row=originals.get(el.dataset.url);
el.querySelector('.daily-original-body').textContent=row?.body||'本期未保存该来源的原文。';
});
}catch(e){if(id===token)document.querySelectorAll('.daily-original-body').forEach(el=>{el.textContent='原文暂时读取失败，请重新选择该日期重试。';});}
}
function render(d){report=d;$('headline').textContent=d.headline;$('cutoff').textContent=d.date+' · '+(d.windowLabel||'截至北京时间16:00');$('focus-list').innerHTML=d.focus.map(r=>'<p class="daily-line"><strong>'+esc(r.title)+'。</strong>'+esc(r.summary)+'</p>'+refs(r.sources,true)).join('');$('industry-list').innerHTML=d.industries.map(r=>'<div class="daily-industry"><strong>'+esc(r.sector)+'</strong><div><p>'+esc(r.view)+'</p>'+refs(r.sources)+'<p class="daily-change"><span>'+esc(r.changeType)+'：</span>'+esc(r.change)+'</p></div></div>').join('');$('quiet').textContent=d.quiet||'';$('editorial').hidden=false;$('copy').disabled=false;$('download').disabled=false;$('status').textContent='';}
async function load(date){const id=++token;report=null;sourceTask=null;originals.clear();$('editorial').hidden=true;$('status').textContent='正在读取…';$('copy').disabled=true;$('download').disabled=true;try{const d=await SiteUI.request('data/daily/onepage/'+date+'.json');if(id!==token)return;if(d.schemaVersion!==2){$('status').textContent='该期尚未整理为新版行业简报';return;}render(d);fillOriginals(date,id);SiteUI.save({date});}catch(e){if(id===token)$('status').textContent='该期简报暂未发布或读取失败，请稍后重试';}}
function plain(){const d=report;return '国金商社日报｜'+d.date+'\n'+(d.windowLabel||'截至北京时间16:00')+'\n\n'+d.headline+'\n\n【重点段子】\n'+d.focus.map(r=>r.title+'。'+r.summary).join('\n\n')+'\n\n【行业观点与边际变化】\n'+d.industries.map(r=>r.sector+'：'+r.view+'\n'+r.changeType+'：'+r.change).join('\n\n')+(d.quiet?'\n\n'+d.quiet:'');}
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(plain());$('status').textContent='已复制';}catch(e){$('status').textContent='复制失败，请下载日报';}};$('download').onclick=()=>{const u=URL.createObjectURL(new Blob([plain()],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='国金商社日报-'+report.date+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};$('dates').onchange=e=>load(e.target.value);
SiteUI.request('data/daily/index.json').then(d=>{const dates=d.dates.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x));$('dates').innerHTML=dates.map(x=>'<option>'+x+'</option>').join('');const wanted=new URLSearchParams(location.search).get('date');$('dates').value=dates.includes(wanted)?wanted:dates[0];if(dates.length)load($('dates').value);else $('status').textContent='暂无日报';}).catch(()=>{$('status').textContent='日报目录读取失败，请刷新重试';});})();
