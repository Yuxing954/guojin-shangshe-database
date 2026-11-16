(function(){
 'use strict';
 const $=id=>document.getElementById(id),fmt=(v,d=0)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—',pct=v=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(2)+'%':'—';let data;
 function render(){
  const rows=data.rows.filter(r=>$('year').value==='all'||r.month.startsWith($('year').value));
  const last=rows.at(-1);
  $('kpis').innerHTML=last?[['新增招聘帖数',fmt(last.posts)+' 个',pct(last.posts_yoy)],['招聘年均薪资',fmt(last.salary,2)+' 元/年',pct(last.salary_yoy)]].map(([name,value,yoy])=>'<article><span>'+name+' · '+last.month+'</span><strong>'+value+'</strong><span>同比 '+yoy+'</span></article>').join(''):'';
  $('matrix').innerHTML='<thead><tr><th>月份</th><th>新增招聘帖数（个）</th><th>同比</th><th>招聘年均薪资（元/年）</th><th>同比</th><th>周数（本期 / 基期）</th></tr></thead><tbody>'+[...rows].reverse().map(r=>'<tr><td>'+r.month+'</td><td>'+fmt(r.posts)+'</td><td>'+pct(r.posts_yoy)+'</td><td>'+fmt(r.salary,2)+'</td><td>'+pct(r.salary_yoy)+'</td><td>'+r.weeks+' / '+r.prior_weeks+'</td></tr>').join('')+'</tbody>';
  for(const [key,name,unit] of [['posts','新增招聘帖数','个'],['salary','招聘年均薪资','元/年']])SiteCharts.drawPaired($(key+'-chart'),rows.map(r=>({label:r.month,period:r.month,value:r[key],change:r[key+'_yoy']})),{name,unit,mode:$('mode').value,precision:key==='posts'?0:2});
 }
 async function load(){
  $('load-error').hidden=true;$('retry').hidden=true;
  try{data=await SiteData.json('data/recruitment/observations.json');if(!Array.isArray(data.rows)||!data.rows.length)throw Error('empty');$('dashboard').hidden=false;$('asof').textContent='全国 · '+data.rows[0].month+'—'+data.rows.at(-1).month+' · 周度合并月度 · 通联 Datayes';render();}
  catch(e){$('asof').textContent='招聘数据读取失败';$('load-error').textContent='数据暂时无法读取，请重试。';$('load-error').hidden=false;$('retry').hidden=false;}
 }
 $('year').onchange=render;$('mode').onchange=render;$('retry').onclick=load;load();
})();