(function(){
  'use strict';
  // Preserve incoming links from the older dashboard and its companion pages.
  const legacyHashes=new Set(['coverage-live','sec-f','sec-hotel','sec-taxfree','sec-gold','sec-overseas','sec-dining','consumer-focus','watch-assistant','sec-u','sec-m','sec-mkt','sec-r']);
  function redirectLegacyHash(){if(!legacyHashes.has(location.hash.slice(1)))return false;location.replace(({ 'coverage-live':'quotes.html', 'sec-hotel':'industry.html#hotel','sec-taxfree':'industry.html#dutyfree','sec-gold':'industry.html#gold','sec-overseas':'industry.html#overseas','sec-dining':'industry.html#dining','sec-f':'quotes.html','consumer-focus':'quotes.html','sec-u':'quotes.html','sec-m':'research.html','sec-r':'research.html','sec-mkt':'research.html'}[location.hash.slice(1)]||'database.html'+location.hash)+location.search);return true;}
  if(redirectLegacyHash())return;
  addEventListener('hashchange',redirectLegacyHash);
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeLink(value,fallback){try{const u=new URL(value,location.href);return (u.protocol==='http:'||u.protocol==='https:')?u.href:fallback;}catch(e){return fallback;}}
  const number=(value,precision=1)=>value==null?'—':Number(value).toLocaleString('zh-CN',{maximumFractionDigits:precision});
  const change=v=>v==null?'待补充':(v>0?'+':'')+number(v,1)+'%';
  const cls=v=>v>0?'up':v<0?'down':'';
  function freshness(date,days){if(!date)return {label:'日期待补充',fresh:false};const ms=Date.parse(date+'T00:00:00+08:00');if(!Number.isFinite(ms))return {label:'日期待核实',fresh:false};return Date.now()-ms>days*86400000?{label:'待更新',fresh:false}:{label:'已收录',fresh:true};}
  function render(data){
    if(!Array.isArray(data.industries)||!Array.isArray(data.focus)||!Array.isArray(data.research))throw Error('摘要格式无效');
    $('focus-list').innerHTML=data.focus.slice(0,3).map((item,i)=>'<article class="focus-card"><div class="focus-top"><span class="focus-sector">'+esc(item.sector)+'</span><span>0'+(i+1)+'</span></div><h3>'+esc(item.title)+'</h3><p>'+esc(item.summary)+'</p><div class="focus-bottom"><span>数据截至 '+esc(item.asOf)+'</span><a href="'+esc(safeLink(item.href,'industry.html'))+'">查看依据 ↗</a></div></article>').join('')||'<div class="empty">研究重点待补充</div>';
    $('industry-list').innerHTML=data.industries.slice(0,5).map(item=>{const status=item.asOf?freshness(item.asOf,item.freshnessDays||45):{fresh:false,label:'待补齐'};return '<article class="industry-card"><div class="industry-top"><h3>'+esc(item.name)+'</h3><span class="freshness '+(status.fresh?'fresh':'')+'">'+status.label+'</span></div><p class="metric-name">'+esc(item.metric)+'</p><div class="metric-value">'+(item.value==null?'待补齐':number(item.value,item.precision??1)+'<small>'+esc(item.unit)+'</small>')+'</div><div class="comparison '+cls(item.change)+'">'+(item.value==null?'—':esc(item.changeLabel||'同比')+' '+change(item.change))+'</div><div class="data-date">'+esc(item.period)+(item.asOf&&!String(item.period).includes(item.asOf)?' · '+esc(item.asOf):'')+'</div><div class="industry-bottom"><a href="'+esc(safeLink(item.href,'industry.html'))+'">查看趋势 ↗</a><details><summary>来源</summary><div class="source-pop">'+esc(item.source)+'<a href="'+esc(safeLink(item.sourceFile,'database.html'))+'" target="_blank" rel="noopener">查看数据表 ↗</a></div></details></div></article>';}).join('');
    const status=freshness(data.researchAsOf,10);
    $('research-status').innerHTML='<span>最新内容：'+esc(data.researchAsOf||'待补充')+'</span>'+(!status.fresh?'<span class="freshness">内容待更新</span>':'');
    $('research-list').innerHTML=data.research.slice(0,5).map(item=>'<article class="research-row"><time class="research-date" datetime="'+esc(item.date)+'">'+esc(item.date)+'</time><div><a class="research-title" href="'+esc(ResearchModel.href({kind:item.kind,title:item.title,url:item.href}))+'">'+esc(item.title)+' <span aria-hidden="true">↗</span></a><div class="research-meta">'+esc(item.author||'研究文库')+'</div></div><span class="research-type '+(item.kind==='minutes'?'minutes':'')+'">'+esc(item.label)+'</span></article>').join('')||'<div class="empty">暂无已收录研究内容，<a href="research.html">进入研究文库</a></div>';
    $('generated-at').textContent='摘要生成：'+String(data.generatedAt||'—').replace('T',' ').slice(0,16)+'（北京时间）';
    $('load-state').hidden=true;$('home-content').hidden=false;
  }
  async function load(){
    $('load-state').hidden=false;$('load-state').textContent='正在读取研究摘要…';
    try{const r=await fetch('data/home-snapshot.json',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);render(await r.json());}
    catch(e){$('load-state').innerHTML='研究摘要暂时无法读取。<a class="text-link" href="database.html">进入完整数据库 ↗</a><button type="button" id="retry">重新加载</button>';$('retry').onclick=load;}
  }
  $('today').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'}).format(new Date());
  load();
})();
