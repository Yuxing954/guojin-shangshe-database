(function(){
 'use strict';
 const $=id=>document.getElementById(id),fmt=(v,d=0)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—',pct=(v,d=2)=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(d)+'%':'—';
 const metrics={posts:{name:'新增招聘帖数',unit:'万个',factor:10000},salary:{name:'招聘年均薪资',unit:'万元/年',factor:10000}};
 let data,selected=[],active='posts';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function chart(key,rows,host){
  const m=metrics[key],d=Number($('digits').value);
  const points=rows.map(r=>({period:r.month,value:Number.isFinite(r[key])?r[key]/m.factor:null,change:r[key+'_yoy']}));
  return SiteCharts.drawPaired(host,points,{name:m.name,unit:m.unit,mode:$('mode').value,precision:d,minimumFractionDigits:d,changePrecision:d,layout:'spacious'});
 }
 function exportSvg(key){
  const host=$(key+'-chart'),original=host.querySelector('svg'),svg=original.cloneNode(true),vb=original.viewBox.baseVal;
  const src=[original,...original.querySelectorAll('*')],dst=[svg,...svg.querySelectorAll('*')];
  src.forEach((node,i)=>{const css=getComputedStyle(node);for(const prop of ['fill','stroke','stroke-width','stroke-dasharray','font-family','font-size','font-weight','text-anchor','opacity','paint-order'])dst[i].style.setProperty(prop,css.getPropertyValue(prop));});
  svg.querySelectorAll('.site-chart-guide').forEach(n=>n.remove());
  svg.removeAttribute('style');svg.setAttribute('x','0');svg.setAttribute('y','64');svg.setAttribute('width',vb.width);svg.setAttribute('height',vb.height);
  const h=vb.height+146,m=metrics[key],text=(x,y,t,size=13)=>'<text x="'+x+'" y="'+y+'" fill="#1d3852" font-size="'+size+'">'+esc(t)+'</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+vb.width+'" height="'+h+'" viewBox="0 0 '+vb.width+' '+h+'" style="font-family:Microsoft YaHei,Arial,sans-serif"><rect width="100%" height="100%" fill="white"/>'+text(20,26,m.name,18)+text(20,50,selected[0].month+'—'+selected.at(-1).month)+'<g>'+new XMLSerializer().serializeToString(svg)+'</g>'+text(20,vb.height+94,host.querySelector('.site-chart-legend')?.textContent||'')+text(20,h-20,'来源：通联 Datayes · 周度合并月度')+'</svg>';
 }
 function render(){
  if(!data)return;const rows=data.rows.filter(r=>$('year').value==='all'||r.month.startsWith($('year').value));selected=$('range').value==='all'?rows:rows.slice(-Number($('range').value));
  const last=rows.at(-1);$('kpis').innerHTML=last?[['新增招聘帖数',fmt(last.posts)+' 个',pct(last.posts_yoy)],['招聘年均薪资',fmt(last.salary,2)+' 元/年',pct(last.salary_yoy)]].map(([name,v,g])=>'<article><span>'+name+' · '+last.month+'</span><strong>'+v+'</strong><span>同比 '+g+'</span></article>').join(''):'';
  $('matrix').innerHTML='<thead><tr><th>月份</th><th>新增招聘帖数（个）</th><th>同比</th><th>招聘年均薪资（元/年）</th><th>同比</th><th>周数（本期 / 基期）</th></tr></thead><tbody>'+[...rows].reverse().map(r=>'<tr><td>'+r.month+'</td><td>'+fmt(r.posts)+'</td><td>'+pct(r.posts_yoy)+'</td><td>'+fmt(r.salary,2)+'</td><td>'+pct(r.salary_yoy)+'</td><td>'+r.weeks+' / '+r.prior_weeks+'</td></tr>').join('')+'</tbody>';
  for(const key of Object.keys(metrics))chart(key,selected,$(key+'-chart'));
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function save(key){
  const status=$('export-status');status.textContent='正在生成高清图片…';
  let url;
  try{const svg=exportSvg(key),image=new Image();url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const canvas=document.createElement('canvas');canvas.width=image.naturalWidth*2;canvas.height=image.naturalHeight*2;canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('export');download(blob,metrics[key].name+'_'+selected[0].month+'_'+selected.at(-1).month+'.png');status.textContent='高清 PNG 已生成';}catch(e){status.textContent='图片生成失败，请重试或使用截图视图。';}finally{if(url)URL.revokeObjectURL(url);}
 }
 document.addEventListener('click',e=>{const preview=e.target.closest('[data-preview]'),png=e.target.closest('[data-png]');if(preview){active=preview.dataset.preview;$('shot-title').textContent=metrics[active].name;$('shot').style.maxHeight=Math.max(260,(window.parent===window?innerHeight:window.parent.innerHeight)-40)+'px';$('shot').showModal();chart(active,selected,$('shot-chart'));if(window.frameElement)window.frameElement.scrollIntoView({block:'start'});}if(png)save(png.dataset.png);});
 $('shot-close').onclick=()=>$('shot').close();$('shot-save').onclick=()=>save(active);
 async function load(){
  $('load-error').hidden=true;$('retry').hidden=true;
  try{data=await SiteData.json('data/recruitment/observations.json');if(!Array.isArray(data.rows)||!data.rows.length)throw Error('empty');$('dashboard').hidden=false;$('asof').textContent='全国 · '+data.rows[0].month+'—'+data.rows.at(-1).month+' · 周度合并月度 · 通联 Datayes';render();}
  catch(e){$('asof').textContent='招聘数据读取失败';$('load-error').textContent='数据暂时无法读取，请重试。';$('load-error').hidden=false;$('retry').hidden=false;}
 }
 for(const id of ['year','mode','digits','range'])$(id).onchange=render;
 $('retry').onclick=load;load();
})();
