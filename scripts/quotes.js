(async function(){
  'use strict';
  const D=SiteData,M=QuotesModel,K=SinolinkKline,$=id=>document.getElementById(id),esc=D.esc,params=new URLSearchParams(location.search);
  const benchmarks=[{code:'000001.SH',name:'上证指数',index:true},{code:'399006.SZ',name:'创业板指',index:true},{code:'HSI.HI',name:'恒生指数',index:true}];
  const industryIds={'酒店':'hotel','免税':'dutyfree','黄金珠宝':'gold','跨境电商与出海':'overseas','餐饮':'dining','茶饮':'dining'};
  const groupSectors=['酒店','免税','黄金珠宝','跨境电商与出海','餐饮'];
  const storageKey='sinolink.quotes.watchlist.v1',preferencesKey='sinolink.quotes.preferences.v1',cache=new Map();
  let companies=[],quotes={},filtered=[],watch=[],onlyWatch=params.get('group')==='watch',view=params.get('view')==='heat'?'heat':'list',pending=false,timer=null,selected=null;
  let period=['day','week','minute'].includes(params.get('period'))?params.get('period'):'day',chartRequest=0,lastRead='',failed=false,initialized=false,chartData=null,chartSelection=0,research=null,researchFailed=false,noticeTimer=null;
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
  function timeText(q){return q?esc(q.asOf.slice(5,16))+'<small>'+esc(M.state(q))+'</small>':'—<small>暂无报价</small>';}
  function star(c,detail=false){const active=watch.includes(c.code);return '<button class="quotes-watch" data-watch="'+esc(c.code)+'" type="button" aria-label="'+esc((active?'移除自选：':'加入自选：')+c.name)+'" aria-pressed="'+active+'">'+(active?'★':'☆')+'</button>';}
  function renderGroups(){
    const groups=[['all','全部覆盖',companies.length],['watch','我的自选',watch.length],...groupSectors.map(s=>[s,s==='跨境电商与出海'?'跨境电商':s,companies.filter(c=>c.sector===s).length])];
    $('groups').innerHTML=groups.map(([key,label,count])=>'<button type="button" data-group="'+esc(key)+'" aria-pressed="'+(key==='all'?!onlyWatch&&!$('sector').value:key==='watch'?onlyWatch:!onlyWatch&&$('sector').value===key)+'">'+label+'<small>'+count+'</small></button>').join('');
  }
  function renderBenchmarks(){$('benchmarks').innerHTML=benchmarks.map(c=>{const q=quotes[c.code];return '<button class="quotes-benchmark" type="button" data-code="'+c.code+'"><span>'+c.name+'</span><strong>'+price(q,c)+'</strong><span class="quotes-percent '+tone(q?.percent)+'">'+signed(q?.percent,'%')+'</span><small>'+(q?esc(q.asOf.slice(5,16))+' · '+esc(M.state(q)):(pending?'正在取得报价':'暂无报价'))+'</small></button>';}).join('');}
  function render(){
    filtered=M.filter(companies,quotes,filters());const b=M.breadth(filtered,quotes),full=$('columns').value==='full',sort=$('sort').value;
    $('board-title').textContent=onlyWatch?'我的自选':$('sector').value||'全部覆盖';
    $('range-summary').textContent=filtered.length+' 家 · '+b.valid+' 家有报价'+(b.valid?' · '+b.up+'涨 / '+b.down+'跌 / '+b.flat+'平':'')+(b.missing?' · '+b.missing+'家待取得':'')+(b.percentMissing?' · '+b.percentMissing+'只涨跌幅缺失':'');
    $('quote-table').dataset.columns=full?'full':'compact';
    const nameSort=sort.startsWith('name'),percentSort=sort.startsWith('change');
    $('table-head').innerHTML='<tr><th><span aria-label="自选">☆</span></th><th aria-sort="'+(nameSort?(sort==='name'?'ascending':'descending'):'none')+'"><button type="button" class="quotes-sort" data-sort="name" aria-pressed="'+nameSort+'">公司 '+(nameSort?(sort==='name'?'↑':'↓'):'↕')+'</button></th><th>最新价</th><th aria-sort="'+(percentSort?(sort==='change-asc'?'ascending':'descending'):'none')+'"><button type="button" class="quotes-sort" data-sort="percent" aria-pressed="'+percentSort+'">涨跌幅 '+(percentSort?(sort==='change-asc'?'↑':'↓'):'↕')+'</button></th>'+(full?['涨跌额','开盘','最高','最低'].map(t=>'<th>'+t+'</th>').join(''):'')+'<th>报价时间</th></tr>';
    const focused=document.activeElement,focusCode=focused?.dataset.code,focusWatch=focused?.dataset.watch,scroll=$('table-scroll').scrollTop;
    $('rows').innerHTML=filtered.map(c=>{const q=quotes[c.code],info=meta(c);return '<tr data-selected="'+(selected?.code===c.code)+'"><td>'+star(c)+'</td><td><button class="quotes-name" data-code="'+esc(c.code)+'" type="button" aria-pressed="'+(selected?.code===c.code)+'">'+esc(c.name)+'</button><small class="quotes-symbol">'+esc(c.code)+' · '+info.label+'<span>'+esc(c.sector)+'</span></small></td><td><span class="quotes-price">'+price(q,c)+'<small>'+info.currency+'</small></span></td><td class="quotes-percent '+tone(q?.percent)+'">'+signed(q?.percent,'%')+'</td>'+(full?'<td class="'+tone(q?.change)+'">'+signed(q?.change,'',precision(c))+'</td>'+[q?.open,q?.high,q?.low].map(v=>'<td>'+fmt(v,precision(c))+'</td>').join(''):'')+'<td class="quotes-time" data-failed="'+!!q?.failed+'">'+timeText(q)+'</td></tr>';}).join('')||'<tr><td colspan="'+(full?9:5)+'" class="quotes-empty">'+(onlyWatch&&!watch.length?'暂无自选公司':'暂无匹配公司')+'</td></tr>';
    $('table-scroll').scrollTop=scroll;
    if(focusCode||focusWatch){const buttons=[...$('rows').querySelectorAll('button')],target=buttons.find(button=>focusWatch?button.dataset.watch===focusWatch:button.dataset.code===focusCode);target?.focus({preventScroll:true});}
    $('heatmap').innerHTML=filtered.map(c=>{const q=quotes[c.code],pct=q?.percent,alpha=Number.isFinite(pct)?.06+Math.min(Math.abs(pct),10)*.025:0,bg=Number.isFinite(pct)?(pct>0?'rgba(190,76,92,':pct<0?'rgba(40,127,112,':'rgba(125,134,150,')+alpha+')':'#f1f2f6';return '<button class="quotes-heat-tile" style="background:'+bg+'" data-code="'+esc(c.code)+'" data-selected="'+(selected?.code===c.code)+'" type="button"><strong>'+esc(c.name)+(watch.includes(c.code)?' ★':'')+'</strong><span class="'+tone(pct)+'">'+signed(pct,'%')+'</span><small>'+infoLabel(c)+' · '+price(q,c)+'<br>'+(q?esc(q.asOf.slice(5,16))+' · '+esc(M.state(q)):'暂无报价')+'</small></button>';}).join('')||'<p class="quotes-empty">暂无匹配公司</p>';
    $('list-view').hidden=view!=='list';$('heat-view').hidden=view!=='heat';$('views').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
    $('list-note').textContent='共 '+filtered.length+' 家';
    renderGroups();renderBenchmarks();saveUrl();if(selected){renderOverview();detailNavigation();}
  }
  function infoLabel(c){return meta(c).label+' / '+meta(c).currency;}
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
  function quoteRequest(codes){return new Promise((resolve,reject)=>{
    const mapping=codes.map(code=>[code,K.quoteCode(code)]).filter(([,q])=>/^(?:sh\d{6}|sz\d{6}|hk(?:\d{5}|HSI)|us[A-Z][A-Z0-9.-]*)$/.test(q)),tag=document.createElement('script');
    mapping.forEach(([,q])=>{try{delete window['v_'+q];}catch(e){window['v_'+q]=undefined;}});
    let done=false;const cleanup=()=>{clearTimeout(timeout);tag.onload=tag.onerror=null;tag.remove();mapping.forEach(([,q])=>{try{delete window['v_'+q];}catch(e){}});};
    const timeout=setTimeout(()=>{if(done)return;done=true;cleanup();reject(Error('timeout'));},10000);
    tag.charset='gbk';tag.src='https://qt.gtimg.cn/q='+mapping.map(([,q])=>q).join(',')+'&_='+Date.now();
    tag.onload=()=>{if(done)return;done=true;const retrievedAt=new Date().toISOString(),result={};mapping.forEach(([code,q])=>{const parsed=M.parse(window['v_'+q],code,retrievedAt);if(parsed)result[code]=parsed;});cleanup();resolve(result);};
    tag.onerror=()=>{if(done)return;done=true;cleanup();reject(Error('network'));};document.head.appendChild(tag);
  });}
  
  function connection(){const automatic=$('auto-refresh').checked&&!document.hidden;$('status').dataset.error=String(failed);$('status').textContent=failed?'腾讯行情读取失败 · 保留上次报价':'腾讯行情 · 最近读取 '+lastRead+'（北京时间） · '+(automatic?'每15秒刷新':'自动刷新已暂停');}
  async function refresh(){
    if(pending||!companies.length)return;pending=true;$('refresh').disabled=true;$('refresh').textContent='读取中…';if(!lastRead)$('status').textContent='正在同步腾讯报价…';renderBenchmarks();
    const codes=companies.concat(benchmarks).map(c=>c.code);
    try{const incoming=await quoteRequest(codes);codes.forEach(code=>{if(incoming[code])quotes[code]=incoming[code];else if(quotes[code])quotes[code].failed=true;});failed=Object.keys(incoming).length<codes.length;if(Object.keys(incoming).length)lastRead=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());}
    catch(e){failed=true;Object.values(quotes).forEach(q=>q.failed=true);}
    finally{pending=false;$('refresh').disabled=false;$('refresh').textContent='刷新报价';connection();render();if(selected&&(period==='minute'||!chartData)&&quotes[selected.code]&&!quotes[selected.code].failed)loadChart();}
  }
  function automatic(){clearInterval(timer);timer=null;if($('auto-refresh').checked&&!document.hidden&&companies.length)timer=setInterval(refresh,15000);if(lastRead||failed)connection();}
  function detailNavigation(){
    const i=filtered.findIndex(c=>c.code===selected?.code);$('detail-position').textContent=i<0?(selected?.index?'市场指数':'不在当前筛选范围'):(i+1)+' / '+filtered.length+' · 当前分组';$('previous-company').disabled=i<=0;$('next-company').disabled=i<0||i>=filtered.length-1;
  }
  function renderOverview(){
    const q=quotes[selected.code],info=meta(selected);$('quote-overview').innerHTML='<div class="quotes-large-price">'+price(q,selected)+'<small>'+(selected.index?'点':info.currency)+'</small></div><p class="quotes-large-change '+tone(q?.percent)+'">'+signed(q?.change,'',precision(selected))+' / '+signed(q?.percent,'%')+'</p><p class="quotes-quote-note">'+(q?esc(q.asOf)+' · '+info.timeLabel+'<br>'+esc(M.state(q))+' · 腾讯报价可能延迟':'暂无已取得的有效报价')+'</p><div class="quotes-ohlc">'+[['前收',q?.previousClose],['开盘',q?.open],['最高',q?.high],['最低',q?.low]].map(([label,value])=>'<div><span>'+label+'</span><strong>'+fmt(value,precision(selected))+'</strong></div>').join('')+'</div>';
    $('provider-link').href='https://gu.qq.com/'+(q?.providerCode||K.quoteCode(selected.code));$('company-link').hidden=!!selected.index;$('company-link').href='companies.html?company='+encodeURIComponent(selected.code);
    $('industry-link').hidden=!industryIds[selected.sector];$('industry-link').href='industry.html#'+(industryIds[selected.sector]||'hotel');
    const active=watch.includes(selected.code);$('detail-watch').hidden=!!selected.index;$('detail-watch').textContent=active?'★ 已自选':'☆ 自选';$('detail-watch').setAttribute('aria-pressed',String(active));$('detail-watch').setAttribute('aria-label',(active?'移除自选：':'加入自选：')+selected.name);
    $('research-link').hidden=!!selected.index;$('research-link').href='research.html?kind=views&q='+encodeURIComponent(M.researchKeyword(selected));renderRelated();
  }
  function renderRelated(){
    if(!selected)return;if(selected.index){$('related-research').innerHTML='<p class="quotes-context">市场指数。选择公司查看相关研究。</p>';return;}
    if(researchFailed){$('related-research').innerHTML='<p class="quotes-context">已收录研究暂未读取，可进入研究中心查询。</p>';return;}
    if(!research){$('related-research').innerHTML='<p class="quotes-context">正在读取已收录研究…</p>';return;}
    const rows=M.relatedResearch(research.dbs,selected);$('related-research').innerHTML=rows.map(row=>'<a class="quotes-related-item" href="research.html?kind='+encodeURIComponent(['views','all_views','minutes'].includes(row.kind)?row.kind:'views')+'&q='+encodeURIComponent(M.researchKeyword(selected))+'&record='+encodeURIComponent(row.title)+'"><small>'+esc(row.published.slice(0,10))+' · 已收录研究</small>'+esc(row.title)+'</a>').join('')||'<p class="quotes-context">近期已收录内容中暂无该公司相关研究。</p>';
  }
  function jsonp(url){return new Promise((resolve,reject)=>{const name='__quotes_chart_'+Date.now()+'_'+Math.floor(Math.random()*1e6),s=document.createElement('script');let done=false;const cleanup=()=>{clearTimeout(timeout);s.onload=s.onerror=null;s.remove();try{delete window[name];}catch(e){}};const timeout=setTimeout(()=>{if(done)return;done=true;cleanup();reject(Error('走势请求超时，请重试。'));},12000);s.charset='gbk';s.src=url+'&_var='+name+'&r='+Date.now();s.onload=()=>{if(done)return;done=true;const data=window[name];cleanup();if(data?.data)resolve(data);else reject(Error('来源暂未返回该证券的走势。'));};s.onerror=()=>{if(done)return;done=true;cleanup();reject(Error('走势连接失败，请重试。'));};document.head.appendChild(s);});}
  
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
    const end=dateLabel(rows.at(-1)[0]).slice(0,10);$('chart-status').textContent=(minute?'最近交易日分时 · '+end:chartData.adjustment+(period==='day'?'日K':'周K')+' · '+rows.length+' 条')+' · '+(selected.index?'点':meta(selected).currency);
    $('chart-detail').textContent=dateLabel(rows[0][0])+' — '+dateLabel(rows.at(-1)[0])+(period!=='minute'&&chartData.adjustment==='源数据'?' · 来源未标明复权方式':'')+(quotes[selected.code]&&quotes[selected.code].asOf.slice(0,10)!==end?' · 走势与报价日期不同':'');
  }
  async function loadChart(force=false){
    if(!selected)return;const request=++chartRequest,company=selected,mode=period,qc=quotes[company.code]?.providerCode||K.quoteCode(company.code),minute=mode==='minute',key=company.code+'|'+mode+'|'+qc,previous=cache.get(key);
    $('periods').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.period===mode)));$('chart-window').disabled=mode!=='day';$('show-ma').disabled=minute;
    if(!force&&previous&&Date.now()-previous.loadedAt<(minute?14000:300000)){chartData=previous;paintChart();return;}
    $('chart-status').textContent='正在读取腾讯走势…';chartData=null;$('chart').innerHTML='';$('chart-readout').textContent='';$('chart-detail').textContent='';
    const url=minute?'https://proxy.finance.qq.com/ifzqgtimg/appstock/app/minute/query?code='+encodeURIComponent(qc):'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param='+encodeURIComponent(qc+','+mode+',,,'+(mode==='day'?150:100)+(company.index?'':',qfq'));
    try{const data=await jsonp(url),rows=minute?M.intraday(K.normalize(data,'m1'),company.code):M.candles(K.normalize(data,mode));if(rows.length<2)throw Error('来源暂未返回足够的有效走势数据。');const result={code:company.code,period:mode,rows:minute?rows:rows.slice(mode==='day'?-150:-80),adjustment:M.adjustment(data,qc,mode,company.index),loadedAt:Date.now()};cache.set(key,result);if(request!==chartRequest||selected?.code!==company.code)return;chartData=result;paintChart();}
    catch(e){if(request!==chartRequest||selected?.code!==company.code)return;$('chart-status').textContent='';$('chart').innerHTML='<div class="quotes-chart-empty">'+esc(e.message)+'<br>可切换周期或点击“刷新走势”。</div>';}
  }
  function selectCompany(code,scrollDetail=false){
    const c=companies.concat(benchmarks).find(c=>c.code===code);if(!c)return;selected=c;chartData=null;$('quote-title').textContent=c.name;$('quote-subtitle').textContent=c.code+' · '+infoLabel(c)+(c.sector?' · '+c.sector:'');
    $('quote-detail').hidden=false;$('detail-empty').hidden=true;render();preferences();loadChart();
    if(scrollDetail&&matchMedia('(max-width:1000px)').matches)$('quote-detail').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function moveCompany(delta,focus=false){
    const index=filtered.findIndex(c=>c.code===selected?.code),next=filtered[index+delta];if(index<0||!next)return;selectCompany(next.code);
    const button=[...$('rows').querySelectorAll('[data-code]')].find(b=>b.dataset.code===next.code);button?.scrollIntoView({block:'nearest'});if(focus)button?.focus({preventScroll:true});
  }
  $('rows').onclick=e=>{const favorite=e.target.closest('[data-watch]');if(favorite){toggleWatch(favorite.dataset.watch);return;}const button=e.target.closest('[data-code]');if(button)selectCompany(button.dataset.code,true);};
  $('heatmap').onclick=$('benchmarks').onclick=e=>{const button=e.target.closest('[data-code]');if(button)selectCompany(button.dataset.code,true);};
  $('rows').onkeydown=e=>{if(!e.target.matches('[data-code]')||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(selected?.code!==e.target.dataset.code)selectCompany(e.target.dataset.code);moveCompany(e.key==='ArrowUp'?-1:1,true);};
  $('table-head').onclick=e=>{const b=e.target.closest('[data-sort]');if(!b)return;$('sort').value=b.dataset.sort==='name'?($('sort').value==='name'?'name-desc':'name'):($('sort').value==='change-desc'?'change-asc':'change-desc');applyFilters();};
  $('groups').onclick=e=>{const b=e.target.closest('[data-group]');if(!b)return;onlyWatch=b.dataset.group==='watch';$('sector').value=['all','watch'].includes(b.dataset.group)?'':b.dataset.group;applyFilters();};
  $('views').onclick=e=>{const b=e.target.closest('[data-view]');if(b){view=b.dataset.view;render();}};
  $('search').oninput=applyFilters;for(const id of ['market','sector','sort'])$(id).onchange=applyFilters;
  $('reset').onclick=()=>{onlyWatch=false;for(const id of ['search','market','sector'])$(id).value='';$('sort').value='change-desc';applyFilters();};
  $('columns').onchange=()=>{render();preferences();};$('refresh').onclick=refresh;$('auto-refresh').onchange=automatic;$('detail-watch').onclick=()=>toggleWatch(selected.code);
  $('previous-company').onclick=()=>moveCompany(-1);$('next-company').onclick=()=>moveCompany(1);$('back-list').onclick=()=>{$('board-title').scrollIntoView({behavior:'smooth',block:'start'});[...$('rows').querySelectorAll('[data-code]')].find(b=>b.dataset.code===selected?.code)?.focus({preventScroll:true});};
  $('periods').onclick=e=>{const b=e.target.closest('[data-period]');if(b){period=b.dataset.period;saveUrl();loadChart();}};$('chart-retry').onclick=()=>loadChart(true);$('chart-window').onchange=$('show-ma').onchange=()=>{paintChart();preferences();};
  let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(paintChart,150);});
  document.addEventListener('visibilitychange',()=>{automatic();if(!document.hidden&&$('auto-refresh').checked)refresh();});addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(resizeTimer);});
  try{
    const manifest=await D.json('data-manifest.json'),dataset=manifest.datasets.find(d=>d.id==='valuation');
    companies=(await D.table(dataset.file)).map(r=>({code:r['证券代码'],name:r['公司名称'],sector:r['子行业']})).filter(c=>c.code&&c.name);
    watch=M.watchlist(stored(storageKey,[]),companies);$('sector').innerHTML='<option value="">全部行业</option>'+[...new Set(companies.map(c=>c.sector))].map(s=>'<option>'+esc(s)+'</option>').join('');
    const pref=stored(preferencesKey,{});$('columns').value=pref?.columns==='full'?'full':'compact';$('chart-window').value=['20','60','120'].includes(pref?.window)?pref.window:'60';$('show-ma').checked=pref?.ma!==false;
    for(const id of ['search','market','sector','sort']){const val=params.get(id==='search'?'q':id);if(val!=null)$(id).value=val;}if(!$('sort').value)$('sort').value='change-desc';
    $('content').hidden=false;render();D.json('data/research/recent.json').then(data=>{research=data;renderRelated();}).catch(()=>{researchFailed=true;renderRelated();});
    await refresh();automatic();initialized=true;const code=params.get('symbol')||pref?.selected;if(companies.concat(benchmarks).some(c=>c.code===code))selectCompany(code);else ensureSelection();saveUrl();
  }catch(e){$('status').dataset.error='true';$('status').innerHTML='覆盖公司目录暂时无法读取。<button class="portal-button" type="button" id="retry">重新加载</button>';$('retry').onclick=()=>location.reload();}
})();
