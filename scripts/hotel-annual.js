(function(){
'use strict';
let pending,loaded=false,data;
const state={tab:'overview',year:null,window:'all',ranking:'groups',category:'',query:''};
const tabs=[['overview','规模与连锁化'],['grades','档次结构'],['sizes','客房规模'],['cities','城市结构'],['rankings','集团与品牌']];
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(x,n=2)=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('zh-CN',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
const sum=(arrays,i)=>arrays.every(a=>Number.isFinite(a[i]))?arrays.reduce((s,a)=>s+a[i],0):null;
const scaled=(a,n)=>a.map(v=>Number.isFinite(v)?v/n:null);
function table(headers,rows){return '<div class="hd-table-scroll" tabindex="0" aria-label="年度数据明细"><table class="hd-table board-table"><thead><tr>'+headers.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map((x,i)=>'<'+(i?'td':'th scope="row"')+'>'+esc(x)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function configs(){
 const d=data,chainHotels=d.years.map((_,i)=>{const v=sum(d.chain_hotels,i);return v===null?null:v/10000;});
 const c=(title,unit,names,arrays)=>({title,unit,names,arrays});
 if(state.tab==='overview')return [
  c('酒店数量','万家',['全部酒店','连锁酒店 · 测算'],[d.hotels_wan,chainHotels]),
  c('客房数量','万间',['全部客房','连锁客房 · 测算'],[d.rooms_wan,scaled(d.chain_total,10000)]),
  c('全国连锁化率','%',['客房口径','门店口径'],[d.chain_rate,d.chain_store_rate]),
  c('客房数量同比','%',['客房同比'],[d.rooms_growth])];
 if(state.tab==='grades')return [
  c('分档次客房连锁化率','%',d.grades,d.grade_chain_rate),
  c('分档次连锁客房数量','万间',d.grades,d.chain_rooms.map(a=>scaled(a,10000))),
  c('分档次连锁酒店数量','万家',d.grades,d.chain_hotels.map(a=>scaled(a,10000)))];
 const size=state.tab==='sizes',names=size?d.size_labels:d.city_labels;
 return [c(size?'客房规模结构':'城市等级结构','%',names,size?d.size_share:d.city_share),c(size?'分规模客房连锁化率':'分城市客房连锁化率','%',names,size?d.size_chain_rate:d.city_chain_rate)];
}
function profile(i){
 const d=data,size=state.tab==='sizes',grade=state.tab==='grades',labels=grade?d.grades:size?d.size_labels:d.city_labels;
 const shares=grade?d.all_share:size?d.size_share:d.city_share,rates=grade?d.grade_chain_rate:size?d.size_chain_rate:d.city_chain_rate;
 const bar=(v,color)=>'<span class="annual-bar"><i style="width:'+ (Number.isFinite(v)?Math.min(100,Math.max(0,v)):0)+'%;background:'+color+'"></i></span><b>'+num(v,1)+'%</b>';
 $('annual-profile').innerHTML='<div class="annual-panel-heading"><h2>'+state.year+'年结构</h2><span>客房口径 · %</span></div><div class="annual-profile-head"><span>分类</span><span>客房占比</span><span>客房连锁化率</span>'+(grade?'<span>连锁内客房占比 · 测算</span>':'')+'</div>'+labels.map((name,j)=>'<div class="annual-profile-row"><strong>'+esc(name)+'</strong><div aria-label="'+esc(name)+'客房占比">'+bar(shares[j][i],'#adcee5')+'</div><div aria-label="'+esc(name)+'客房连锁化率">'+bar(rates[j][i],'#2167a0')+'</div>'+(grade?'<div class="annual-chain-share">'+num(d.chain_share[j][i],1)+'%</div>':'')+'</div>').join('');
 $('annual-profile').classList.toggle('has-chain-share',grade);
}
function history(indices){
 const d=data,rows=[],add=(name,a,unit,derived=false)=>rows.push([name+'（'+unit+'）'+(derived?' · 测算':''),...indices.map(i=>num(a[i],['家','间'].includes(unit)?0:2))]);
 if(state.tab==='overview'){
 [['酒店数量',d.hotels_wan,'万家'],['客房数量',d.rooms_wan,'万间'],['客房同比',d.rooms_growth,'%'],['客房连锁化率',d.chain_rate,'%'],['门店连锁化率',d.chain_store_rate,'%'],['连锁酒店',d.years.map((_,i)=>sum(d.chain_hotels,i)),'家',true],['连锁客房',d.chain_total,'间',true]].forEach(a=>add(...a));
 }else{
 const grade=state.tab==='grades',size=state.tab==='sizes',labels=grade?d.grades:size?d.size_labels:d.city_labels;
 const metrics=grade?[['all_share','全部客房占比','%'],['chain_share','连锁内客房占比','%'],['grade_chain_rate','客房连锁化率','%'],['chain_hotels','连锁酒店','家'],['chain_rooms','连锁客房','间']]:size?[['size_share','客房占比','%'],['size_chain_rate','客房连锁化率','%']]:[['city_share','客房占比','%'],['city_chain_rate','客房连锁化率','%']];
 metrics.forEach(m=>labels.forEach((name,j)=>add(name+' · '+m[1],d[m[0]][j],m[2],m[0]==='chain_share')));
 }
 $('annual-history').innerHTML=table(['指标',...indices.map(i=>data.years[i]+'年')],rows);
 // Exact latest-year counts remain available alongside rounded historical series.
 const latest=state.year===d.years.at(-1)&&state.tab!=='overview';
 $('annual-exact').hidden=!latest;
 if(latest){const grade=state.tab==='grades',size=state.tab==='sizes',names=grade?d.grades:size?d.size_labels:d.city_labels,rows=d[grade?'grade_latest':size?'size_latest':'city_latest'];$('annual-exact-table').innerHTML=table(['分类','酒店（家）','客房（间）'],rows.map((r,j)=>[names[j],num(r[0],0),num(r[1],0)]));}
}
function ranking(){
 const d=data,key=state.ranking,brand=key==='brand_rankings';
 $('annual-brand-label').hidden=!brand;
 const categories=[...new Set(d.brand_rankings.map(r=>r[0]))];
 $('annual-brand').innerHTML='<option value="">全部分类</option>'+categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
 $('annual-brand').value=state.category;
 let rows=d[key].filter(r=>(!brand||!state.category||r[0]===state.category)&&(!state.query||r.some(v=>String(v).toLowerCase().includes(state.query.toLowerCase())))),headers;
 if(key==='groups'){headers=['排名','集团','总部','客房（间）','酒店（家）','PDF页'];rows=rows.map(r=>r.map((v,i)=>i===3||i===4?num(v,0):v));}
 else if(brand){headers=['分类','排名','品牌','集团','客房（间）','酒店（家）','PDF页'];rows=rows.map(r=>r.map((v,i)=>i===4||i===5?num(v,0):v));}
 else{headers=['地区','酒店（家）','客房（间）','客房占比（%）· 测算'];const total=sum(d.grade_latest.map(r=>[r[1]]),0);rows=rows.map(r=>[r[0],num(r[1],0),num(r[2],0),num(total>0?r[2]/total*100:null)]);}
 $('annual-ranking-count').textContent=rows.length+'条';
 $('annual-snapshot').innerHTML=rows.length?table(headers,rows):'<p class="annual-empty" role="status">没有匹配的记录</p>';
}
function refresh(){
 const d=data,i=d.years.indexOf(state.year),ranks=state.tab==='rankings';
 $('annual-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.annualTab===state.tab)));
 $('annual-year-label').hidden=ranks;$('annual-window-label').hidden=ranks;
 $('annual-rank-period').hidden=!ranks;$('annual-kpis').hidden=ranks||state.tab!=='overview';$('annual-analysis').hidden=ranks;$('annual-ranking').hidden=!ranks;
 if(ranks){ranking();return;}
 const items=[['酒店数量',d.hotels_wan,'万家',false],['客房数量',d.rooms_wan,'万间',false],['客房连锁化率',d.chain_rate,'%',true],['门店连锁化率',d.chain_store_rate,'%',true]];
 $('annual-kpis').innerHTML=items.map(([name,a,unit,rate])=>{
 const previous=a[i-1],delta=i>0&&Number.isFinite(a[i])&&Number.isFinite(previous)?a[i]-previous:null;
 const change=delta===null?'—':(delta>0?'+':'')+num(delta,2)+' '+(rate?'pct':unit);
 return '<article class="board-stat hd-stat"><div class="hd-stat-label">'+esc(name)+' · '+state.year+'年</div><div class="hd-stat-value">'+num(a[i])+'<small>'+unit+'</small></div><div class="annual-change">较上年 <span>'+change+'</span></div></article>';
 }).join('');
 const indices=d.years.map((_,j)=>j).filter(j=>j<=i).slice(state.window==='all'?0:-Number(state.window));
 $('annual-range').textContent=d.years[indices[0]]+'—'+state.year+'年';
 $('annual-profile').hidden=state.tab==='overview';if(state.tab!=='overview')profile(i);
 const list=configs();$('annual-charts').classList.toggle('annual-odd',list.length%2===1);
 for(let j=0;j<4;j++){
 const card=$('annual-card-'+j),c=list[j];card.hidden=!c;if(!c)continue;
 $('annual-title-'+j).textContent=c.title;
 $('annual-unit-'+j).textContent=c.unit;
 SiteCharts.drawPaired($('annual-trend-'+j),indices.map(k=>({period:String(d.years[k]),values:c.names.map((name,n)=>({name,value:c.arrays[n][k]}))})),{name:c.title,unit:c.unit,mode:'value',valueStyle:'line',precision:2,legend:'series',valueLabels:true});
 }
 history(indices);
}
function draw(d){
 data=d;state.year=d.years.at(-1);
 const sourceLinks=Object.values(d.sources).map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+' ↗</a>').join('');
 $('hotel-annual-content').innerHTML='<nav id="annual-tabs" class="annual-tabs" aria-label="饭店协会数据分类">'+tabs.map(([key,label])=>'<button type="button" data-annual-tab="'+key+'" aria-pressed="'+(key===state.tab)+'">'+label+'</button>').join('')+'</nav>'+
 '<div class="annual-top"><label id="annual-year-label">数据年份<select id="annual-year">'+d.years.slice().reverse().map(y=>'<option>'+y+'</option>').join('')+'</select></label><label id="annual-window-label">趋势范围<select id="annual-window"><option value="all">全部年份</option><option value="5">近5年</option><option value="3">近3年</option></select></label><span class="annual-scope">中国大陆 · 15间客房及以上</span><span id="annual-rank-period" hidden>'+d.years.at(-1)+'年 · 最新排名</span><div class="annual-links"><a href="data/hotel-association-annual.csv" download>下载数据</a><details id="annual-sources"><summary>数据与来源</summary><div class="annual-source-menu"><a href="data-notes.html#hotel-annual" target="_blank" rel="noopener">数据说明 ↗</a>'+sourceLinks+'</div></details></div></div>'+
 '<div id="annual-kpis" class="hd-kpis board-kpis annual-kpis"></div><div id="annual-analysis">'+
 '<section id="annual-profile" class="hd-card board-panel annual-profile" hidden></section>'+
 '<div class="annual-trend-heading"><h2>年度趋势</h2><span id="annual-range"></span></div>'+
 '<div id="annual-charts" class="annual-charts">'+[0,1,2,3].map(j=>'<article id="annual-card-'+j+'" class="hd-card board-panel" data-chart-values-default data-chart-label-menu><div class="hd-card-head board-panel-head"><h2 id="annual-title-'+j+'"></h2><span id="annual-unit-'+j+'" class="annual-unit"></span></div><div class="hd-chart board-chart" id="annual-trend-'+j+'"></div></article>').join('')+'</div>'+
 '<details class="hd-card annual-history"><summary>历史数据</summary><div id="annual-history"></div><section id="annual-exact" hidden><h3>'+d.years.at(-1)+'年数量明细</h3><div id="annual-exact-table"></div></section></details></div>'+
 '<section id="annual-ranking" class="hd-card board-panel" hidden><div class="annual-ranking-controls"><label>榜单<select id="annual-detail"><option value="groups">集团50强</option><option value="brand_rankings">品牌分类排名</option><option value="provinces">31省区市</option><option value="topcities">城市10强</option></select></label><label id="annual-brand-label" hidden>品牌分类<select id="annual-brand"></select></label><input id="annual-search" type="search" placeholder="搜索名称、集团或地区" aria-label="搜索排名"><span id="annual-ranking-count" role="status"></span></div><div id="annual-snapshot"></div></section>';
 $('annual-tabs').onclick=e=>{const b=e.target.closest('[data-annual-tab]');if(!b)return;state.tab=b.dataset.annualTab;refresh();};
 $('annual-year').onchange=e=>{state.year=Number(e.target.value);refresh();};
 $('annual-window').onchange=e=>{state.window=e.target.value;refresh();};
 $('annual-detail').onchange=e=>{state.ranking=e.target.value;state.category='';ranking();};
 $('annual-brand').onchange=e=>{state.category=e.target.value;ranking();};
 $('annual-search').oninput=e=>{state.query=e.target.value.trim();ranking();};
 $('annual-sources').addEventListener('keydown',e=>{if(e.key==='Escape'){$('annual-sources').open=false;$('annual-sources').querySelector('summary').focus();}});
 if(d.asOf&&window.SiteUI)SiteUI.asOf($('asof'),d.asOf,[]);
 refresh();
}
window.HotelAnnual={render:async function(){
 if(loaded)return;
 if(!pending)pending=fetch('data/hotel-association-annual.json?v=20261026annual1').then(r=>{if(!r.ok)throw Error(r.status);return r.json();});
 try{draw(await pending);loaded=true;}catch(e){pending=null;$('hotel-annual-content').innerHTML='<p role="alert">饭店协会数据读取失败。</p><button id="annual-retry" type="button">重试</button>';$('annual-retry').onclick=window.HotelAnnual.render;}
}};
})();


