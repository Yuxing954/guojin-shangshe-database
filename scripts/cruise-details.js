(function(){
 'use strict';
 const $=id=>document.getElementById(id),esc=SiteData.esc,host=$('cruise-details');
 let data;
 const fmt=(value,digits=2)=>value==null?'—':Number(value).toLocaleString('zh-CN',{maximumFractionDigits:digits});
 const link=(url,label)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener">'+label+'</a>';
 function table(id,title,rows,fields,evidence){
  const sourceById=new Map(data.sources.map(s=>[s.id,s]));
  return '<h3>'+title+'</h3><div class="cruise-table-wrap cruise-history" tabindex="0" role="region" aria-label="'+title+'，可横向滚动"><table id="'+id+'"><thead><tr><th>指标 / 月份</th>'+rows.map(r=>'<th data-period="'+r.period+'">'+r.period+'</th>').join('')+'</tr></thead><tbody>'+fields.map(f=>'<tr'+(f.focus?' class="cruise-focus"':'')+'><th scope="row">'+f.name+'</th>'+rows.map(r=>{const v=f.value(r);return '<td'+(v==null?' class="missing"':'')+'>'+fmt(v,f.digits??2)+'</td>';}).join('')+'</tr>').join('')+'<tr class="cruise-table-sources"><th scope="row">官方来源</th>'+rows.map(r=>{const s=sourceById.get(r.sourceId),img=r.evidence[evidence];return '<td>'+(s?link(s.url,'原文'):'—')+(img?' · '+link(img,'原图'):'')+'</td>';}).join('')+'</tr></tbody></table></div>';
 }
 function render(){
  if(!data)return;const year=$('year').value,rows=data.records.filter(r=>year==='all'||r.period.startsWith(year));
  host.innerHTML='<section class="cruise-panel cruise-detail-panel"><div class="cruise-detail-head"><h2>游客结构 · 月度</h2><a href="data/tourism/three-gorges-details.csv" download>下载结构与船公司 CSV</a></div>'+table('age-table','国内游客年龄结构（%）',rows,data.ageLabels.map((name,i)=>({name,value:r=>r.ages[i]})),'ages')+table('origin-table','游客来源地',rows,[{name:'国内游客（万人）',value:r=>r.origins.domestic,digits:4},{name:'国（境）外游客（万人）',value:r=>r.origins.foreign,digits:4},{name:'国（境）外游客占比（%）',value:r=>r.origins.foreignShare}],'origins')+'</section><section class="cruise-panel cruise-detail-panel"><div class="cruise-detail-head"><h2>湖北籍省际游轮 · 月度客运量（万人）</h2><a href="data-notes.html#tourism">数据说明</a></div>'+table('company-table','船公司客运量',rows,[...data.companyLabels.map((name,i)=>({name,value:r=>r.companies[i],digits:4,focus:i===6})),{name:'宜昌交运客运量占比（%）',value:r=>r.jiaoyunShare,focus:true},{name:'宜昌交运同比（测算，%）',value:r=>r.jiaoyunYoY,focus:true}],'companies')+'</section>';
  requestAnimationFrame(()=>host.querySelectorAll('.cruise-history').forEach(w=>{w.scrollLeft=w.scrollWidth;}));
 }
 async function load(){
  try{data=await SiteData.json('data/tourism/three-gorges-details.json');if(data.records?.length!==33)throw Error('invalid');render();}
  catch{host.innerHTML='<div role="alert" class="cruise-panel">游客结构与船公司数据暂时无法读取。<button id="details-retry">重试</button></div>';$('details-retry').onclick=load;}
 }
 $('year').addEventListener('change',render);load();
})();
