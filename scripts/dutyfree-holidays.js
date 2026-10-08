(function(root){
  'use strict';
  const holidays=['元旦','春节','清明','五一','端午','中秋','国庆及中秋国庆'];
  const group=r=>r.comparison_group||r.holiday_group||r.holiday;
  const num=v=>typeof v==='number'&&Number.isFinite(v);
  const filter=(records,holiday,year,kind='holiday')=>records.filter(r=>r.kind===kind&&(holiday==='全部'||group(r)===holiday)&&(year==='全部'||r.year===Number(year))).sort((a,b)=>b.year-a.year||holidays.indexOf(group(a))-holidays.indexOf(group(b)));
  const change=(current,previous)=>num(current)&&num(previous)&&previous!==0?(current/previous-1)*100:null;
  const model={holidays,group,filter,change,num};
  if(typeof module==='object'&&module.exports){module.exports=model;return;}
  root.DutyfreeHolidays=model;
  const el=document.getElementById('dutyfree-holidays');if(!el)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,d=2)=>num(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const pct=v=>num(v)?(v>0?'+':'')+fmt(v,1)+'%':'—';
  const metrics={daily_sales:['日均销售额','亿元',2],sales:['假期销售额','亿元',2],shoppers:['购物人次','万人次',2],daily_shoppers:['日均购物人次','万人次',2],spend:['每购物人次金额','元',0]};
  let data,holiday='端午',year='全部',metric='daily_sales';
  function visibility(){el.hidden=location.pathname.endsWith('industry.html')&&location.hash!=='#dutyfree';}
  addEventListener('hashchange',visibility);visibility();
  el.innerHTML='<p class="dh-message" role="status">正在读取节假日数据…</p>';
  function sources(r){return '<details class="dh-source"><summary>来源与口径</summary><p>'+esc(data.sourceFile)+' · '+esc(r.sheet)+' · '+esc(r.quality)+'</p><p>'+esc(r.notes.join(' ')||'沿用原表当年公布口径。')+'</p><p>'+esc(r.yoy_basis||'缺少可比同比')+'</p><ul>'+Object.entries(r.source_cells).map(([key,s])=>'<li>'+esc((s.sheet||r.sheet)+'!'+s.cell)+'：'+esc(s.value===null?'空缺':s.value)+(s.formula?'；原公式 '+esc(s.formula):'')+'</li>').join('')+'</ul></details>';}
  function chart(rows){
    const available=rows.filter(r=>r.status==='available'&&num(r[metric])).slice().reverse(),[label,unit,digits]=metrics[metric];
    if(!available.length)return '<p class="dh-message">该筛选暂无已收录数值。</p>';
    const max=Math.max(...available.map(r=>r[metric]))||1;
    return '<div class="dh-bars" role="img" aria-label="'+esc(label+'历年对比，单位'+unit)+'">'+available.map(r=>'<div class="dh-bar-row"><span>'+r.year+' '+esc(r.holiday)+'</span><div class="dh-bar-track"><div class="dh-bar" style="width:'+Math.max(1,r[metric]/max*100)+'%"></div></div><strong>'+fmt(r[metric],digits)+' <small>'+unit+'</small></strong></div>').join('')+'</div>';
  }
  function table(rows,detail=false){
    return '<div class="dh-table-scroll"><table><thead><tr><th>年份 / 假期'+(detail?'阶段':'')+'</th><th>统计期间</th><th>天数</th><th>销售额<br>亿元</th><th>购物人次<br>万人次</th><th>每购物人次<br>元</th><th>日均销售额<br>亿元</th>'+(detail?'':'<th>日均销售额同比</th>')+'<th>状态与来源</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.year+' '+esc(r.holiday)+'</td><td>'+esc(r.period)+'</td><td>'+fmt(r.days,0)+'</td><td>'+fmt(r.sales)+'</td><td>'+fmt(r.shoppers)+'</td><td>'+fmt(r.spend,0)+'</td><td>'+fmt(r.daily_sales)+'</td>'+(detail?'':'<td>'+pct(r.daily_yoy)+'</td>')+'<td><span class="dh-status">'+(r.status==='pending'?'待补充':r.quality)+'</span>'+sources(r)+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function render(){
    const rows=filter(data.records,holiday,year),complete=rows.filter(r=>r.status==='available'),latest=complete.slice().sort((a,b)=>b.year-a.year||holidays.indexOf(group(b))-holidays.indexOf(group(a)))[0];
    document.getElementById('dh-summary-period').textContent=latest?latest.year+' '+latest.holiday+' · '+latest.period+' · '+(latest.days||'未记录')+'天':'该筛选暂无完整假期数据';
    document.getElementById('dh-cards').innerHTML=[['购物人次',latest?.shoppers,'万人次',2],['每购物人次金额',latest?.spend,'元',0],['日均销售额',latest?.daily_sales,'亿元',2]].map(([label,v,unit,d])=>'<div><span>'+label+'</span><strong>'+fmt(v,d)+' <small>'+unit+'</small></strong></div>').join('');
    document.getElementById('dh-latest-note').textContent=latest?'日均销售额同比 '+pct(latest.daily_yoy)+'；日均购物人次同比 '+pct(latest.shoppers_daily_yoy)+'；每购物人次金额同比 '+pct(latest.spend_yoy)+'。'+(latest.notes.length?' '+latest.notes.join(' '):''):'';
    document.getElementById('dh-chart-title').textContent=metrics[metric][0]+'历年对比（'+metrics[metric][1]+'）';
    document.getElementById('dh-chart').innerHTML=chart(rows);
    document.getElementById('dh-count').textContent=complete.length+' 条已收录 · '+(rows.length-complete.length)+' 条待补充';
    document.getElementById('dh-table').innerHTML=rows.length?table(rows):'<p class="dh-message">暂无对应假期记录。</p>';
    const details=filter(data.records,holiday,year,'detail');
    document.getElementById('dh-details').hidden=!details.length;document.getElementById('dh-details-table').innerHTML=table(details,true);
    document.getElementById('dh-download').disabled=!rows.length;
  }
  function download(){
    const rows=filter(data.records,holiday,year),keys=['year','holiday','period','days','sales','shoppers','spend','daily_sales','daily_shoppers','daily_yoy','status','quality','sheet'];
    const headers=['年份','假期','统计期间','统计天数','销售额（亿元）','购物人次（万人次）','每购物人次金额（元）','日均销售额（亿元）','日均购物人次（万人次）','日均销售额同比（%）','状态','原表数值类型','来源工作表','原始文件','来源单元格','口径说明'];
    const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const text='\ufeff'+[headers,...rows.map(r=>[...keys.map(k=>r[k]),data.sourceFile,Object.entries(r.source_cells).map(([k,s])=>k+':'+(s.sheet||r.sheet)+'!'+s.cell).join('; '),r.notes.join(' ')])].map(r=>r.map(quote).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='离岛免税-'+holiday+'-'+year+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  fetch('data/dutyfree/holidays.json?v=20261008',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(d=>{
    data=d;
    const years=[...new Set(d.records.filter(r=>r.kind==='holiday').map(r=>r.year))].sort((a,b)=>b-a);
    el.innerHTML='<header class="dh-head"><div><p class="dh-eyebrow">海南离岛免税</p><h2>节假日经营数据</h2><p>比较假期总额、日均表现与购物人次。</p></div><a href="dutyfree-dashboard.html#holidays">免税专题 →</a></header><div class="dh-controls"><label>假期 <select id="dh-holiday">'+['全部',...holidays].map(h=>'<option'+(h===holiday?' selected':'')+'>'+h+'</option>').join('')+'</select></label><label>年份 <select id="dh-year">'+['全部',...years].map(y=>'<option>'+y+'</option>').join('')+'</select></label><label>对比指标 <select id="dh-metric">'+Object.entries(metrics).map(([key,m])=>'<option value="'+key+'">'+m[0]+'</option>').join('')+'</select></label><button id="dh-download">下载当前假期 CSV</button></div><p id="dh-summary-period" class="dh-note"></p><div id="dh-cards" class="dh-cards"></div><p id="dh-latest-note" class="dh-note"></p><h3 id="dh-chart-title"></h3><div id="dh-chart"></div><details class="dh-details dh-history"><summary>假期历史明细 <span id="dh-count"></span></summary><div id="dh-table"></div></details><details id="dh-details" class="dh-details"><summary>逐日与阶段数据</summary><p class="dh-note">首日、前几天、同日历窗口及春运期间存在重叠，不能与完整假期加总。2025元旦第二、三日属于工作日。</p><div id="dh-details-table"></div></details><details class="dh-details"><summary>数据来源与计算口径</summary><p>'+esc(data.sourceFile)+'；版本日期 '+data.sourceVersion+'；本次导入 '+data.importedAt+'。</p><p>'+esc(data.source)+'</p><p>假期天数不同，优先看日均。国庆及中秋国庆在同组展示，保留各年名称和天数；同比沿用原表当年口径。</p><ul>'+data.notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul><p>2026年中秋、国庆原表总额空缺，保留为待补充。原表春节3月日均区域包含假设，未作为实际数据导入。2022年国庆日期待核验，不推定天数或日均。</p><a href="data/dutyfree/holidays.json" download>下载完整来源数据 JSON</a></details>';
    document.getElementById('dh-holiday').onchange=e=>{holiday=e.target.value;render();};document.getElementById('dh-year').onchange=e=>{year=e.target.value;render();};document.getElementById('dh-metric').onchange=e=>{metric=e.target.value;render();};document.getElementById('dh-download').onclick=download;render();
  }).catch(()=>{el.innerHTML='<h2>节假日经营数据</h2><p role="alert">节假日数据暂时无法读取，请刷新重试。</p>';});
})(typeof window==='object'?window:globalThis);
