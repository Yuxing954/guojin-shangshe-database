(function(){
 'use strict';
 const root=document.getElementById('hotel-hci');if(!root)return;
 const $=id=>document.getElementById(id),fmt=v=>v==null?'—':Number(v).toFixed(1),pct=v=>v==null?'—':(v>0?'+':'')+fmt(v)+'%';
 let data;
 function render(){
  if(!data)return;
  const metric=data.metrics.find(m=>m.id===$('hci-metric').value),year=$('hci-year').value,mode=$('hci-mode').value;
  const rows=data.observations.filter(r=>r.metric===metric.id&&(!year||r.period.startsWith(year)));
  const latest=rows.at(-1);
  $('hci-summary').textContent=latest?latest.period+' · 指数 '+fmt(latest.value)+' · 同比 '+pct(latest.yoy)+' · 环比 '+pct(latest.mom):'暂无数据';
  SiteCharts.drawPaired($('hci-chart'),rows.map(r=>({period:r.period,x:Date.parse(r.period+'-01T00:00:00Z'),value:r.value,change:r.yoy})),{mode,unit:'指数',changeUnit:'%',changeLabel:'同比',name:metric.name,precision:1,changePrecision:1,periodFormat:'month',gap:45*86400000});
  $('hci-table').innerHTML='<thead><tr><th>月份</th><th>指数</th><th>同比</th><th>环比</th><th>来源发布日期</th><th>来源</th></tr></thead><tbody>'+rows.slice().reverse().map(r=>'<tr><td>'+r.period+'</td><td>'+fmt(r.value)+'</td><td'+(r.growthStatus==='conflict'?' title="原文与图表不一致，待核验"':'')+'>'+pct(r.yoy)+(r.growthStatus==='conflict'?' · 待核验':'')+'</td><td>'+pct(r.mom)+'</td><td>'+r.sourcePublishedAt+'</td><td><a target="_blank" rel="noopener" href="'+r.sourceUrl+'">原文 ↗</a> · <a target="_blank" rel="noopener" href="'+r.sourceImage+'">原表 ↗</a>'+(r.growthSourceUrl&&r.growthSourceUrl!==r.sourceUrl?' · <a target="_blank" rel="noopener" href="'+r.growthSourceUrl+'">增速出处 ↗</a>':'')+'</td></tr>').join('')+'</tbody>';
 }
 async function load(){
  $('hci-status').textContent='正在读取月度指数…';$('hci-status').hidden=false;$('hci-retry').hidden=true;
  try{const response=await fetch('data/hotel-hci/observations.json');if(!response.ok)throw Error('HTTP '+response.status);data=await response.json();
   $('hci-metric').innerHTML=data.metrics.map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('');$('hci-metric').value='adr_index';
   $('hci-year').innerHTML='<option value="">全部历史</option>'+[...new Set(data.observations.map(r=>r.period.slice(0,4)))].sort().reverse().map(y=>'<option>'+y+'</option>').join('');
   $('hci-status').hidden=true;$('hci-content').hidden=false;render();
  }catch(e){$('hci-status').textContent='住宿业消费指数读取失败';$('hci-retry').hidden=false;}
 }
 ['hci-metric','hci-year','hci-mode'].forEach(id=>$(id).addEventListener('change',render));$('hci-retry').onclick=load;
 let timer;addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(render,100);});
 let lastWidth=0;new ResizeObserver(()=>{const width=root.clientWidth;if(width>0&&width!==lastWidth){lastWidth=width;render();}}).observe(root);
 load();
})();

