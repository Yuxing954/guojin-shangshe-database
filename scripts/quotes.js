(async function(){
  'use strict';
  const D=SiteData,M=QuotesModel,K=SinolinkKline,$=id=>document.getElementById(id),esc=D.esc,params=new URLSearchParams(location.search);
  const benchmarks=[{code:'000001.SH',name:'上证指数',index:true},{code:'399006.SZ',name:'创业板指',index:true},{code:'HSI.HI',name:'恒生指数',index:true}];
  const industryIds={'酒店':'hotel','免税':'dutyfree','黄金珠宝':'gold','跨境电商与出海':'overseas','餐饮':'dining','茶饮':'dining'};
  const groupSectors=['酒店','免税','黄金珠宝','跨境电商与出海','餐饮'];
  const storageKey='sinolink.quotes.watchlist.v1',preferencesKey='sinolink.quotes.preferences.v1',cache=new Map();
  let companies=[],quotes={},filtered=[],watch=[],onlyWatch=params.get('group')==='watch',view=params.get('view')==='heat'?'heat':'list',pending=false,selected=null;
  let period=['day','week','minute'].includes(params.get('period'))?params.get('period'):'day',chartRequest=0,lastRead='',failed=false,initialized=false,chartData=null,chartSelection=0,pageActive=true,chartPending=new Map(),chartNextAt=new Map(),chartCancels=new Set(),noticeTimer=null,benchmarkBuilt=false,miniCache=new Map(),miniPending=new Set();
  const tone=v=>Number.isFinite(v)?v>0?'quotes-up':v<0?'quotes-down':'quotes-flat':'quotes-flat';
  const fmt=(v,n=2)=>v==null?'—':Number(v).toLocaleString('zh-CN',{minimumFractionDigits:n,maximumFractionDigits:n}),signed=(v,suffix='',n=2)=>v==null?'—':(v>0?'+':'')+fmt(v,n)+suffix;
  const meta=c=>M.markets[M.market(c.code)],precision=c=>!c.index&&M.market(c.code)==='HK'?3:2,price=(q,c)=>fmt(q?.price,precision(c));
  function stored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch(e){return fallback;}}
  function notice(text){clearTimeout(noticeTimer);$('preference-status').textContent=text;$('preference-status').hidden=false;noticeTimer=setTimeout(()=>$('preference-status').hidden=true,4500);}
  function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(e){notice('浏览器未能保存设置，本次操作仍有效。');return false;}}
  function preferences(){persist(preferencesKey,{columns:$('columns').value,window:$('chart-window').value,ma:$('show-ma').checked,selected:selected?.code});}
  function filters(){return {q:$('search').value,market:$('market').value,sector:$('sector').value,sort:$('sort').value,onlyWatch,watchlist:watch};}
  function saveUrl(){
    const f=filters(),p=new URLSearchParams();for(const key of ['q','market','sector'])if(f[key])p.set(key,f[key]);if(f.sort!=='change-desc')p.set('sort',f.sort);
    if(onlyWatch)p.set('group','watch');if(view!=='list')p.set('view',view);if(selected)p.set('symbol',selected.code);else if(!initialized&&params.get('symbol'))p.set('symbol',params.get('symbol'));
    if(period!=='day')p.set('period',period);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));
  }
  function timeText(q){return q?esc(q.asOf.slice(5))+(q.failed?'<small>读取失败</small>':''):'—<small>暂无报价</small>';}
  function heatStyle(pct){const valid=Number.isFinite(pct),strength=valid?Math.min(Math.abs(pct),5):0;return {background:!valid?'#eef0f4':pct===0?'#f2f3f6':'hsl('+(pct>0?'354 58%':'164 47%')+' '+(96-strength*(pct>0?10:12))+'%)',color:strength>=4?'#fff':pct>0?'#8d2332':pct<0?'#145d49':'#627084'};}
  function paintHeat(tile,q,c){const style=heatStyle(q?.percent);tile.style.background=style.background;tile.style.color=style.color;tile.title=c.name+' · '+c.code+' · '+infoLabel(c)+' · '+price(q,c)+(q?' · '+q.asOf:' · 暂无报价');}
  function star(c,detail=false){const active=watch.includes(c.code);return '<button class="quotes-watch" data-watch="'+esc(c.code)+'" type="button" aria-label="'+esc((active?'移除自选：':'加入自选：')+c.name)+'" aria-pressed="'+active+'">'+(active?'★':'☆')+'</button>';}
  function renderGroups(){
    const groups=[['all','全部覆盖',companies.length],['watch','我的自选',watch.length],...groupSectors.map(s=>[s,s==='跨境电商与出海'?'跨境电商':s,companies.filter(c=>c.sector===s).length])];
    $('groups').innerHTML=groups.map(([key,label,count])=>'<button type="button" data-group="'+esc(key)+'" aria-pressed="'+(key==='all'?!onlyWatch&&!$('sector').value:key==='watch'?onlyWatch:!onlyWatch&&$('sector').value===key)+'">'+label+'<small>'+count+'</small></button>').join('');
  }
  function renderBenchmarks(){if(benchmarkBuilt){updateBenchmarks();return;}benchmarkBuilt=true;$('benchmarks').innerHTML=benchmarks.map(c=>{const q=quotes[c.code];return '<button class="quotes-benchmark" type="button" data-code="'+c.code+'"><span>'+c.name+'</span><strong>'+price(q,c)+'</strong><span class="quotes-percent '+tone(q?.percent)+'">'+signed(q?.percent,'%')+'</span><small>'+(q?esc(q.asOf.slice(5)):(pending?'正在取得报价':'暂无报价'))+'</small><span class="quotes-mini" data-mini="'+c.code+'">日K加载中…</span></button>';}).join('');}
  function render(){
    filtered=M.filter(companies,quotes,filters());const b=M.breadth(filtered,quotes),full=$('columns').value==='full',sort=$('sort').value;
    $('board-title').textContent=onlyWatch?'我的自选':$('sector').value||'全部覆盖';
    $('range-summary').textContent=filtered.length+' 家 · '+b.valid+' 家有报价'+(b.valid?' · '+b.up+'涨 / '+b.down+'跌 / '+b.flat+'平':'')+(b.missing?' · '+b.missing+'家待取得':'')+(b.percentMissing?' · '+b.percentMissing+'只涨跌幅缺失':'');
    $('quote-table').dataset.columns=full?'full':'compact';
    const nameSort=sort.startsWith('name'),percentSort=sort.startsWith('change');
    $('table-head').innerHTML='<tr><th><span aria-label="自选">☆</span></th><th aria-sort="'+(nameSort?(sort==='name'?'ascending':'descending'):'none')+'"><button type="button" class="quotes-sort" data-sort="name" aria-pressed="'+nameSort+'">公司 '+(nameSort?(sort==='name'?'↑':'↓'):'↕')+'</button></th><th>最新价</th><th aria-sort="'+(percentSort?(sort==='change-asc'?'ascending':'descending'):'none')+'"><button type="button" class="quotes-sort" data-sort="percent" aria-pressed="'+percentSort+'">涨跌幅 '+(percentSort?(sort==='change-asc'?'↑':'↓'):'↕')+'</button></th>'+(full?['涨跌额','开盘','最高','最低'].map(t=>'<th>'+t+'</th>').join(''):'')+'<th>报价时间</th></tr>';
    const focused=document.activeElement,focusCode=focused?.dataset.code,focusWatch=focused?.dataset.watch,scroll=$('table-scroll').scrollTop;
    $('rows').innerHTML=filtered.map(c=>{const q=quotes[c.code],info=meta(c);return '<tr data-company="'+esc(c.code)+'" data-selected="'+(selected?.code===c.code)+'"><td>'+star(c)+'</td><td><button class="quotes-name" data-code="'+esc(c.code)+'" type="button" aria-pressed="'+(selected?.code===c.code)+'">'+esc(c.name)+'</button><small class="quotes-symbol" title="'+esc(info.label+' · '+c.sector)+'">'+esc(c.code)+'</small><span class="quotes-row-periods">'+['minute','day','week'].map(p=>'<button type="button" data-row-period="'+p+'">'+({minute:'分时',day:'日K',week:'周K'}[p])+'</button>').join('')+'</span></td><td><span class="quotes-price">'+price(q,c)+'<small>'+info.currency+'</small></span></td><td class="quotes-percent '+tone(q?.percent)+'">'+signed(q?.percent,'%')+'</td>'+(full?'<td class="'+tone(q?.change)+'">'+signed(q?.change,'',precision(c))+'</td>'+[q?.open,q?.high,q?.low].map(v=>'<td>'+fmt(v,precision(c))+'</td>').join(''):'')+'<td class="quotes-time" data-failed="'+!!q?.failed+'">'+timeText(q)+'</td></tr>';}).join('')||'<tr><td colspan="'+(full?9:5)+'" class="quotes-empty">'+(onlyWatch&&!watch.length?'还没有自选公司。点击列表中的 ☆，加入你关注的公司。':'没有符合条件的公司，请调整或重置筛选。')+'</td></tr>';
    $('table-scroll').scrollTop=scroll;
    if(focusCode||focusWatch){const buttons=[...$('rows').querySelectorAll('button')],target=buttons.find(button=>focusWatch?button.dataset.watch===focusWatch:button.dataset.code===focusCode);target?.focus({preventScroll:true});}
    $('heatmap').innerHTML=filtered.map(c=>{const q=quotes[c.code],pct=q?.percent,style=heatStyle(pct);return '<button class="quotes-heat-tile" style="background:'+style.background+';color:'+style.color+'" data-code="'+esc(c.code)+'" data-selected="'+(selected?.code===c.code)+'" type="button" title="'+esc(c.name+' · '+c.code+' · '+infoLabel(c)+' · '+price(q,c)+(q?' · '+q.asOf:' · 暂无报价'))+'"><strong>'+esc(c.name)+(watch.includes(c.code)?' ★':'')+'</strong><span>'+signed(pct,'%')+'</span><small>'+price(q,c)+' '+meta(c).currency+'</small></button>';}).join('')||'<p class="quotes-empty">当前分组没有公司，请调整筛选或先添加自选。</p>';
    $('workspace').dataset.view=view;
    $('table-tools').hidden=view==='heat';
    $('list-view').hidden=view!=='list';$('heat-view').hidden=view!=='heat';$('views').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
    $('list-note').textContent=(onlyWatch?'自选仅保存在当前浏览器。 ':'')+(view==='heat'?'共 '+filtered.length+' 家 · 点击色块查看走势':'共 '+filtered.length+' 家 · 点击整行查看走势');
    renderGroups();renderBenchmarks();saveUrl();if(selected){renderOverview();detailNavigation();}
  }
  function updateBenchmarks(){
    for(const el of $('benchmarks').querySelectorAll('[data-code]')){const c=benchmarks.find(c=>c.code===el.dataset.code),q=quotes[c.code];el.querySelector('strong').textContent=price(q,c);const pct=el.querySelector('.quotes-percent');pct.textContent=signed(q?.percent,'%');pct.className='quotes-percent '+tone(q?.percent);el.querySelector('small').textContent=q?q.asOf.slice(5):'暂无报价';}
  }
  function updateQuotes(){
    // Keep row identity, order, focus, scroll, company controls and charts intact.
    const full=$('columns').value==='full';
    for(const row of $('rows').querySelectorAll('tr[data-company]')){const c=companies.find(c=>c.code===row.dataset.company),q=quotes[c.code],td=row.children;if(!c)continue;
      td[2].innerHTML='<span class="quotes-price">'+price(q,c)+'<small>'+meta(c).currency+'</small></span>';td[3].textContent=signed(q?.percent,'%');td[3].className='quotes-percent '+tone(q?.percent);
      if(full){td[4].textContent=signed(q?.change,'',precision(c));td[4].className=tone(q?.change);[q?.open,q?.high,q?.low].forEach((v,i)=>td[i+5].textContent=fmt(v,precision(c)));}
      const time=td[full?8:4];time.innerHTML=timeText(q);time.dataset.failed=String(!!q?.failed);
    }
    for(const tile of $('heatmap').querySelectorAll('[data-code]')){const c=companies.find(c=>c.code===tile.dataset.code),q=quotes[c.code];tile.querySelector('span').textContent=signed(q?.percent,'%');tile.querySelector('small').textContent=price(q,c)+' '+meta(c).currency;paintHeat(tile,q,c);}
    const b=M.breadth(filtered,quotes);$('range-summary').textContent=filtered.length+' 家 · '+b.valid+' 家有报价 · '+b.up+'涨 / '+b.down+'跌 / '+b.flat+'平';updateBenchmarks();if(selected)renderOverview();
  }
  function miniSvg(rows,name){const w=160,h=44,lo=Math.min(...rows.map(r=>+r[4])),hi=Math.max(...rows.map(r=>+r[3])),y=v=>3+(hi-v)/(hi-lo||1)*38,step=w/rows.length;
    return '<svg viewBox="0 0 160 44" role="img" aria-label="'+esc(name+'最近20条日K')+'">'+rows.map((r,i)=>{const x=(i+.5)*step,color=+r[2]>=+r[1]?'#be4c5c':'#287f70';return '<line x1="'+x+'" x2="'+x+'" y1="'+y(+r[3])+'" y2="'+y(+r[4])+'" stroke="'+color+'"/><rect x="'+(x-step*.25)+'" y="'+Math.min(y(+r[1]),y(+r[2]))+'" width="'+step*.5+'" height="'+Math.max(1,Math.abs(y(+r[1])-y(+r[2])))+'" fill="'+color+'"/>';}).join('')+'</svg><span>日K · '+esc(rows.at(-1)[0])+'</span>';
  }
  function loadMiniCharts(){if(!moduleActive())return;for(const c of benchmarks){const old=miniCache.get(c.code);if(old&&Date.now()-old.at<300000||miniPending.has(c.code))continue;miniPending.add(c.code);jsonp(K.chartUrl(c.code,'day',null,60,true)).then(data=>{if(!moduleActive())return;const rows=M.candles(K.normalize(data,'day',K.quoteCode(c.code))).slice(-20),el=$('benchmarks').querySelector('[data-mini="'+c.code+'"]');if(!el)return;if(rows.length<2){el.textContent='日K暂无有效数据';return;}el.innerHTML=miniSvg(rows,c.name);miniCache.set(c.code,{at:Date.now()});}).catch(()=>{const el=$('benchmarks').querySelector('[data-mini="'+c.code+'"]');if(el)el.textContent='日K暂未取得';}).finally(()=>miniPending.delete(c.code));}}
  function infoLabel(c){return c.index?meta(c).label+'指数':meta(c).label+' / '+meta(c).currency;}
  function ensureSelection(){
    if(selected&&filtered.some(c=>c.code===selected.code))return;
    if(filtered.length)selectCompany(filtered[0].code,false);
    else{selected=null;chartRequest++;chartData=null;$('quote-detail').hidden=true;$('detail-empty').hidden=false;render();}
  }
  function applyFilters(){render();ensureSelection();}
  function toggleWatch(code){
    const c=companies.find(c=>c.code===code);if(!c)return;const added=!watch.includes(code);watch=added?watch.concat(code):watch.filter(value=>value!==code);
    const saved=persist(storageKey,watch);if(saved)notice((added?'已加入自选：':'已移除自选：')+c.name);applyFilters();
  }
  function quoteRequest(codes,signal){return new Promise((resolve,reject)=>{
    const mapping=codes.map(code=>[code,K.quoteCode(code)]).filter(([,q])=>/^(?:sh\d{6}|sz\d{6}|hk(?:\d{5}|HSI)|us[A-Z][A-Z0-9.-]*)$/.test(q)),tag=document.createElement('script');
    mapping.forEach(([,q])=>{try{delete window['v_'+q];}catch(e){window['v_'+q]=undefined;}});
    let done=false;const abort=()=>{if(done)return;done=true;cleanup();reject(new DOMException('Cancelled','AbortError'));};
    const cleanup=()=>{signal?.removeEventListener('abort',abort);clearTimeout(timeout);tag.onload=tag.onerror=null;tag.remove();mapping.forEach(([,q])=>{try{delete window['v_'+q];}catch(e){}});};
    const timeout=setTimeout(()=>{if(done)return;done=true;cleanup();reject(Error('timeout'));},10000);
    tag.charset='gbk';tag.src='https://qt.gtimg.cn/q='+mapping.map(([,q])=>q).join(',')+'&_='+Date.now();
    tag.onload=()=>{if(done)return;done=true;const retrievedAt=new Date().toISOString(),result={};mapping.forEach(([code,q])=>{const parsed=M.parse(window['v_'+q],code,retrievedAt);if(parsed)result[code]=parsed;});cleanup();resolve(result);};
    tag.onerror=()=>{if(done)return;done=true;cleanup();reject(Error('network'));};if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});document.head.appendChild(tag);
  });}
  
  const moduleActive=()=>pageActive&&!document.hidden&&document.body.dataset.siteSection==='quotes'&&!$('content').hidden&&companies.length>0;
  function connection(){
    const active=moduleActive();
    $('status').dataset.error=String(failed);
    const text='腾讯行情 · '+(active?'自动更新':'自动更新已暂停')+' · 报价时间见各证券'+(failed?' · 连接暂不可用':'' );
    if($('status').textContent!==text)$('status').textContent=text;
  }
  async function refresh(signal){
    if(pending||!moduleActive())return false;pending=true;$('refresh').disabled=true;$('refresh').textContent='读取中…';
    const codes=companies.concat(benchmarks).map(c=>c.code);let ok=false;
    try{const incoming=await quoteRequest(codes,signal);if(signal.aborted||!moduleActive())return false;codes.forEach(code=>{if(incoming[code])quotes[code]=M.accept(quotes[code],incoming[code]);else if(quotes[code])quotes[code].failed=true;});failed=Object.keys(incoming).length<codes.length;ok=!failed;if(Object.keys(incoming).length)lastRead=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());}
    catch(e){if(signal.aborted)return false;failed=true;Object.values(quotes).forEach(q=>q.failed=true);}
    finally{pending=false;$('refresh').disabled=false;$('refresh').textContent='刷新报价';if(!signal.aborted&&moduleActive()){connection();updateQuotes();if(selected&&(period==='minute'||!chartData)&&quotes[selected.code]&&!quotes[selected.code].failed)loadChart();}}
    return ok;
  }
  const poller=QuotesPoller.create({request:refresh,isActive:moduleActive,onTick:connection});
  function automatic(){poller.sync();connection();loadMiniCharts();}
  function pauseRequests(){poller.pause();chartRequest++;chartCancels.forEach(cancel=>cancel());}
  function detailNavigation(){
    const i=filtered.findIndex(c=>c.code===selected?.code);$('detail-position').textContent=i<0?(selected?.index?'市场指数':'不在当前筛选范围'):(i+1)+' / '+filtered.length+' · 当前分组';$('previous-company').disabled=i<=0;$('next-company').disabled=i<0||i>=filtered.length-1;
  }
  function renderOverview(){
    const q=quotes[selected.code],info=meta(selected);$('quote-overview').innerHTML='<div class="quotes-large-price">'+price(q,selected)+'<small>'+(selected.index?'':info.currency)+'</small></div><p class="quotes-large-change '+tone(q?.percent)+'">'+signed(q?.change,'',precision(selected))+' / '+signed(q?.percent,'%')+'</p><p class="quotes-quote-note">'+(q?esc(q.asOf)+' · '+info.timeLabel:'暂无已取得的有效报价')+'</p><div class="quotes-ohlc">'+[['前收',q?.previousClose],['开盘',q?.open],['最高',q?.high],['最低',q?.low]].map(([label,value])=>'<div><span>'+label+'</span><strong>'+fmt(value,precision(selected))+'</strong></div>').join('')+'</div>';
    $('provider-link').href='https://gu.qq.com/'+(q?.providerCode||K.quoteCode(selected.code));$('company-link').hidden=!!selected.index;$('company-link').href='companies.html?company='+encodeURIComponent(selected.code);
    $('industry-link').hidden=!industryIds[selected.sector];$('industry-link').href='industry.html#'+(industryIds[selected.sector]||'hotel');
    const active=watch.includes(selected.code);$('detail-watch').hidden=!!selected.index;$('detail-watch').textContent=active?'★ 已自选':'☆ 自选';$('detail-watch').setAttribute('aria-pressed',String(active));$('detail-watch').setAttribute('aria-label',(active?'移除自选：':'加入自选：')+selected.name);
  }
  function jsonp(url){return new Promise((resolve,reject)=>{const name='__quotes_chart_'+Date.now()+'_'+Math.floor(Math.random()*1e6),s=document.createElement('script');let done=false;const cancel=()=>{if(done)return;done=true;cleanup();reject(new DOMException('Cancelled','AbortError'));};const cleanup=()=>{chartCancels.delete(cancel);clearTimeout(timeout);s.onload=s.onerror=null;s.remove();try{delete window[name];}catch(e){}};const timeout=setTimeout(()=>{if(done)return;done=true;cleanup();reject(Error('走势请求超时，请重试。'));},12000);s.charset='gbk';s.src=url+'&_var='+name+'&r='+Date.now();s.onload=()=>{if(done)return;done=true;const data=window[name];cleanup();if(data?.data)resolve(data);else reject(Error('来源暂未返回该证券的走势。'));};s.onerror=()=>{if(done)return;done=true;cleanup();reject(Error('走势连接失败，请重试。'));};chartCancels.add(cancel);document.head.appendChild(s);});}
  
  function dateLabel(raw){const s=String(raw);return /^\d{12}$/.test(s)?s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+' '+s.slice(8,10)+':'+s.slice(10,12):s;}
  function chartRows(){const rows=chartData.rows;if(period!=='day')return rows;return rows.slice(-Number($('chart-window').value));}
  function draw(rows,isMinute,company,adjustment){
    const q=quotes[company.code],sameDate=q&&q.asOf.slice(0,10)===dateLabel(rows.at(-1)[0]).slice(0,10),baseline=isMinute&&sameDate?q.previousClose:null;
    const ma=isMinute||!$('show-ma').checked?[]:[5,20].map(window=>({window,values:M.movingAverage(chartData.rows,window).slice(-rows.length)}));
    const values=isMinute?rows.map(row=>Number(row[2])):rows.flatMap(row=>[Number(row[3]),Number(row[4])]);ma.forEach(line=>values.push(...line.values.filter(Number.isFinite)));if(baseline)values.push(baseline);
    const compact=$('chart').clientWidth<600,canvasWidth=compact?600:910,canvasHeight=compact?350:300,low=Math.min(...values),high=Math.max(...values),pad=(high-low||Math.max(1,high*.01))*.12,lo=low-pad,hi=high+pad,w=compact?490:800,h=compact?255:220,left=compact?80:70,right=left+w,top=18,y=v=>top+h-(v-lo)/(hi-lo)*h;
    const x=(row,i)=>isMinute?left+K.sessionAxis(company.code,row).minute/K.sessionAxis(company.code,row).total*w:left+(i+.5)*w/rows.length;
    const grid=[0,1,2,3].map(i=>{const value=hi-(hi-lo)*i/3;return '<line x1="'+left+'" y1="'+y(value)+'" x2="'+right+'" y2="'+y(value)+'" stroke="#eceef4"/><text x="'+(left-12)+'" y="'+(y(value)+4)+'" text-anchor="end">'+fmt(value,precision(company))+'</text>';}).join('');
    let marks;
    if(isMinute){marks=(baseline?'<line x1="'+left+'" x2="'+right+'" y1="'+y(baseline)+'" y2="'+y(baseline)+'" stroke="#b2b7c4" stroke-dasharray="4 4"/>':'')+'<polyline points="'+rows.map((row,i)=>x(row,i)+','+y(Number(row[2]))).join(' ')+'" fill="none" stroke="#6268b9" stroke-width="2.2" stroke-linejoin="round"/>';}
    else{const width=Math.max(1,w/rows.length*.62);marks=rows.map((row,i)=>{const open=Number(row[1]),close=Number(row[2]),color=close>=open?'#b94c5c':'#287f70';return '<g><title>'+esc(dateLabel(row[0])+' 开 '+fmt(open,3)+' 收 '+fmt(close,3)+' 高 '+fmt(row[3],3)+' 低 '+fmt(row[4],3))+'</title><line x1="'+x(row,i)+'" x2="'+x(row,i)+'" y1="'+y(Number(row[3]))+'" y2="'+y(Number(row[4]))+'" stroke="'+color+'"/><rect x="'+(x(row,i)-width/2)+'" y="'+Math.min(y(open),y(close))+'" width="'+width+'" height="'+Math.max(1,Math.abs(y(open)-y(close)))+'" fill="'+color+'"/></g>';}).join('');}
    const averages=ma.map(line=>'<polyline points="'+line.values.map((v,i)=>Number.isFinite(v)?x(rows[i],i)+','+y(v):null).filter(Boolean).join(' ')+'" fill="none" stroke="'+(line.window===5?'#b89540':'#8b74b7')+'" stroke-width="1.8"/>').join('');
    const ticks=(compact?[0,rows.length-1]:[0,Math.floor((rows.length-1)/2),rows.length-1]).map(i=>'<text x="'+(i===0?left:i===rows.length-1?right:left+w/2)+'" y="'+(canvasHeight-20)+'" text-anchor="'+(i===0?'start':i===rows.length-1?'end':'middle')+'">'+esc(isMinute?String(rows[i][0]).slice(8,10)+':'+String(rows[i][0]).slice(10,12):rows[i][0])+'</text>').join('');
    chartData.x=rows.map(x);chartData.y=rows.map(row=>y(Number(row[2])));chartData.ma=ma;chartData.canvasWidth=canvasWidth;chartData.top=top;chartData.bottom=top+h;chartData.right=right;
    return '<svg class="quotes-chart'+(compact?' quotes-chart-compact':'')+'" viewBox="0 0 '+canvasWidth+' '+canvasHeight+'" role="img" tabindex="0" aria-describedby="chart-readout" aria-label="'+esc(company.name+' '+(isMinute?'分时走势':adjustment+'K线')+'，价格单位'+(company.index?'点':meta(company).currency)+'。左右方向键查看历史点位')+'"><title>'+esc(company.name+'：'+dateLabel(rows[0][0])+' 至 '+dateLabel(rows.at(-1)[0]))+'</title>'+grid+marks+averages+ticks+'<g id="chart-cursor" pointer-events="none"><line stroke="#acb0c5" stroke-dasharray="3 3"/><circle r="4" fill="#6268b9" stroke="#fff" stroke-width="2"/></g></svg>';
  }
  function inspectPoint(index){
    if(!chartData)return;const rows=chartRows(),row=rows[Math.max(0,Math.min(rows.length-1,index))];chartSelection=Math.max(0,Math.min(rows.length-1,index));
    const digits=precision(selected),minute=period==='minute',values=minute?[['价格',row[2]]]:[['开',row[1]],['收',row[2]],['高',row[3]],['低',row[4]]];
    $('chart-readout').innerHTML='<strong>'+esc(dateLabel(row[0]))+'</strong> · '+values.map(([label,value])=>label+' '+fmt(value,digits)).join(' / ')+(chartData.ma.length?'<br>'+chartData.ma.map(line=>'<span class="quotes-ma'+line.window+'">MA'+line.window+' '+fmt(line.values[chartSelection],digits)+'</span>').join(' · '):'');
    const cursor=$('chart-cursor');if(cursor){const x=chartData.x[chartSelection],y=chartData.y[chartSelection],line=cursor.querySelector('line'),circle=cursor.querySelector('circle');Object.entries({x1:x,x2:x,y1:chartData.top,y2:chartData.bottom}).forEach(([k,v])=>line.setAttribute(k,v));circle.setAttribute('cx',x);circle.setAttribute('cy',y);}
  }
  function paintChart(){
    if(!chartData||!selected||chartData.code!==selected.code||chartData.period!==period)return;
    const rows=chartRows(),minute=period==='minute';$('chart').innerHTML=draw(rows,minute,selected,chartData.adjustment);inspectPoint(rows.length-1);
    const svg=$('chart').querySelector('svg');svg.onpointermove=e=>{const rect=svg.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*chartData.canvasWidth;let closest=0;chartData.x.forEach((v,i)=>{if(Math.abs(v-x)<Math.abs(chartData.x[closest]-x))closest=i;});inspectPoint(closest);};
    svg.onpointerleave=()=>inspectPoint(rows.length-1);svg.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();inspectPoint(chartSelection+(e.key==='ArrowLeft'?-1:1));}};
    const end=dateLabel(rows.at(-1)[0]).slice(0,10);$('chart-status').textContent=(minute?'最近交易日分时 · '+end:chartData.adjustment+(period==='day'?'日K':'周K')+' · '+rows.length+' 条')+(selected.index?'':' · '+meta(selected).currency);
    $('chart-detail').textContent=dateLabel(rows[0][0])+' — '+dateLabel(rows.at(-1)[0])+(period!=='minute'&&chartData.adjustment==='源数据'?' · 来源未标明复权方式':'')+(quotes[selected.code]&&quotes[selected.code].asOf.slice(0,10)!==end?' · 走势与报价日期不同':'');
  }
  async function loadChart(force=false){
    if(!selected||!moduleActive())return;const request=++chartRequest,company=selected,mode=period,minute=mode==='minute';let qc,url;
    try{qc=K.chartCode(company.code,quotes[company.code]?.providerCode);url=K.chartUrl(company.code,mode,quotes[company.code]?.providerCode,mode==='day'?150:100,company.index);}catch(e){$('chart-status').textContent=e.message;chartData=null;$('chart').innerHTML='';return;}
    const key=company.code+'|'+mode+'|'+qc,previous=cache.get(key);
    $('periods').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.period===mode)));$('chart-window').disabled=mode!=='day';$('show-ma').disabled=minute;
    if(!force&&previous&&Date.now()-previous.loadedAt<(minute?15000:300000)){if(chartData!==previous){chartData=previous;paintChart();}return;}
    if(!chartPending.has(key)&&Date.now()<(chartNextAt.get(key)||0)){if(previous){chartData=previous;paintChart();}else $('chart-status').textContent='走势请求间隔至少15秒，请稍后重试。';return;}
    $('chart-status').textContent='正在读取腾讯走势…';if(chartData?.code!==company.code||chartData?.period!==mode){chartData=null;$('chart').innerHTML='';$('chart-readout').textContent='';$('chart-detail').textContent='';}
    try{let flight=chartPending.get(key);if(!flight){chartNextAt.set(key,Date.now()+15000);flight=jsonp(url).finally(()=>chartPending.delete(key));chartPending.set(key,flight);}const data=await flight,rows=minute?M.intraday(K.normalize(data,'m1',qc),company.code):M.candles(K.normalize(data,mode,qc));if(rows.length<2)throw Error('来源暂未返回足够的有效走势数据。');const result={code:company.code,period:mode,rows:minute?rows:rows.slice(mode==='day'?-150:-80),adjustment:M.adjustment(data,qc,mode,company.index),loadedAt:Date.now()};cache.set(key,result);if(!moduleActive()||request!==chartRequest||selected?.code!==company.code)return;chartData=result;paintChart();}
    catch(e){if(!moduleActive()||request!==chartRequest||selected?.code!==company.code)return;$('chart-status').textContent='';$('chart').innerHTML='<div class="quotes-chart-empty">'+esc(e.message)+'<br>可切换周期或点击“刷新走势”。</div>';}
  }
  function selectCompany(code,scrollDetail=false){
    const c=companies.concat(benchmarks).find(c=>c.code===code);if(!c)return;selected=c;chartData=null;$('quote-title').textContent=c.name;$('quote-subtitle').textContent=c.code+' · '+infoLabel(c)+(c.sector?' · '+c.sector:'');
    $('quote-detail').hidden=false;$('detail-empty').hidden=true;render();preferences();loadChart();
    if(scrollDetail&&(view==='heat'||matchMedia('(max-width:1000px)').matches))$('quote-detail').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function moveCompany(delta,focus=false){
    const index=filtered.findIndex(c=>c.code===selected?.code),next=filtered[index+delta];if(index<0||!next)return;selectCompany(next.code);
    const button=[...$('rows').querySelectorAll('[data-code]')].find(b=>b.dataset.code===next.code);button?.scrollIntoView({block:'nearest'});if(focus)button?.focus({preventScroll:true});
  }
  $('rows').onclick=e=>{const favorite=e.target.closest('[data-watch]');if(favorite){toggleWatch(favorite.dataset.watch);return;}const row=e.target.closest('tr[data-company]');if(row){const choice=e.target.closest('[data-row-period]');if(choice)period=choice.dataset.rowPeriod;selectCompany(row.dataset.company,true);}};
  $('heatmap').onclick=$('benchmarks').onclick=e=>{const button=e.target.closest('[data-code]');if(button)selectCompany(button.dataset.code,true);};
  $('rows').onkeydown=e=>{if(!e.target.matches('[data-code]')||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(selected?.code!==e.target.dataset.code)selectCompany(e.target.dataset.code);moveCompany(e.key==='ArrowUp'?-1:1,true);};
  $('table-head').onclick=e=>{const b=e.target.closest('[data-sort]');if(!b)return;$('sort').value=b.dataset.sort==='name'?($('sort').value==='name'?'name-desc':'name'):($('sort').value==='change-desc'?'change-asc':'change-desc');applyFilters();};
  $('groups').onclick=e=>{const b=e.target.closest('[data-group]');if(!b)return;onlyWatch=b.dataset.group==='watch';$('sector').value=['all','watch'].includes(b.dataset.group)?'':b.dataset.group;applyFilters();};
  $('views').onclick=e=>{const b=e.target.closest('[data-view]');if(b){view=b.dataset.view;render();}};
  $('search').oninput=applyFilters;for(const id of ['market','sector','sort'])$(id).onchange=applyFilters;
  $('reset').onclick=()=>{onlyWatch=false;for(const id of ['search','market','sector'])$(id).value='';$('sort').value='change-desc';applyFilters();};
  $('columns').onchange=()=>{render();preferences();};$('refresh').onclick=()=>poller.check();$('detail-watch').onclick=()=>toggleWatch(selected.code);
  $('previous-company').onclick=()=>moveCompany(-1);$('next-company').onclick=()=>moveCompany(1);$('back-list').onclick=()=>{$('board-title').scrollIntoView({behavior:'smooth',block:'start'});[...$('rows').querySelectorAll('[data-code]')].find(b=>b.dataset.code===selected?.code)?.focus({preventScroll:true});};
  $('periods').onclick=e=>{const b=e.target.closest('[data-period]');if(b){period=b.dataset.period;saveUrl();loadChart();}};$('chart-retry').onclick=()=>loadChart(true);$('chart-window').onchange=$('show-ma').onchange=()=>{paintChart();preferences();};
  let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(paintChart,150);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseRequests();else{automatic();if(selected&&!chartData)loadChart();}});addEventListener('pagehide',()=>{pageActive=false;pauseRequests();poller.stop();clearTimeout(resizeTimer);});addEventListener('pageshow',()=>{pageActive=true;poller.resume();loadMiniCharts();if(selected&&!chartData)loadChart();});
  try{
    const manifest=await D.json('data-manifest.json'),dataset=manifest.datasets.find(d=>d.id==='valuation');
    companies=(await D.table(dataset.file)).map(r=>({code:r['证券代码'],name:r['公司名称'],sector:r['子行业']})).filter(c=>c.code&&c.name);
    watch=M.watchlist(stored(storageKey,[]),companies);$('sector').innerHTML='<option value="">全部行业</option>'+[...new Set(companies.map(c=>c.sector))].map(s=>'<option>'+esc(s)+'</option>').join('');
    const pref=stored(preferencesKey,{});$('columns').value=pref?.columns==='full'?'full':'compact';$('chart-window').value=['20','60','120'].includes(pref?.window)?pref.window:'60';$('show-ma').checked=pref?.ma!==false;
    for(const id of ['search','market','sector','sort']){const val=params.get(id==='search'?'q':id);if(val!=null)$(id).value=val;}if(!$('sort').value)$('sort').value='change-desc';
    $('content').hidden=false;render();
    initialized=true;const code=params.get('symbol')||pref?.selected;if(companies.concat(benchmarks).some(c=>c.code===code))selectCompany(code);else ensureSelection();saveUrl();await poller.check();automatic();
  }catch(e){$('status').dataset.error='true';$('status').innerHTML='覆盖公司目录暂时无法读取。<button class="portal-button" type="button" id="retry">重新加载</button>';$('retry').onclick=()=>location.reload();}
})();
