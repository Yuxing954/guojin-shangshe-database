(function(){
  'use strict';
  let pending,loaded=false;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(x,n=2)=>Number(x).toLocaleString('zh-CN',{maximumFractionDigits:n,minimumFractionDigits:n});
  const colors=['#5158aa','#8a9dd0','#4b87a2','#b5c6df'];
  function table(headers,rows){return '<div class="hd-table-scroll" tabindex="0"><table class="hd-table board-table"><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
  function stack(d,values,title){
    let svg='<svg viewBox="0 0 640 350" role="img" aria-label="'+esc(title)+'">';
    d.years.forEach((y,i)=>{let x=52;svg+='<text x="0" y="'+(38+i*42)+'">'+y+'</text>';const total=values.reduce((s,a)=>s+a[i],0);values.forEach((a,j)=>{let w=total>0?a[i]/total*580:0;svg+='<g><title>'+y+' '+d.grades[j]+' '+num(a[i])+'%</title><rect x="'+x+'" y="'+(16+i*42)+'" width="'+w+'" height="32" fill="'+colors[j]+'"/><text text-anchor="middle" class="annual-value" x="'+(x+w/2)+'" y="'+(37+i*42)+'">'+num(a[i],1)+'</text></g>';x+=w;});});
    svg+='</svg>';return '<article class="hd-card board-panel"><div class="hd-card-head board-panel-head"><h2>'+title+'</h2></div><div class="hd-chart board-chart annual-chart">'+svg+'</div></article>';
  }
  function draw(d){
    const root=document.getElementById('hotel-annual-content');
    const src=(key,page)=>d.sources[key].url+(page?'#page='+page:'');
    const latest=d.years.length-1, year=d.years[latest];
    const summary=[['酒店数量',d.hotels_wan[latest],'万家'],['客房数量',d.rooms_wan[latest],'万间'],['客房连锁化率',d.chain_rate[latest],'%'],['门店连锁化率',d.chain_store_rate[latest],'%']];
    root.innerHTML='<div class="annual-top"><div><h2>饭店协会</h2><p>中国饭店协会 · '+esc(d.years[0])+'—'+esc(year)+'年</p></div><div class="annual-links"><a href="data/hotel-association-annual.csv" download>下载数据</a><a href="data-notes.html#hotel-annual" target="_blank" rel="noopener">数据口径 ↗</a><a target="_blank" rel="noopener" href="'+src('industry')+'">行业报告 ↗</a><a target="_blank" rel="noopener" href="'+src('brand')+'">品牌报告 ↗</a></div></div>'+
      '<div class="hd-kpis board-kpis annual-kpis">'+summary.map(x=>'<article class="board-stat hd-stat"><div class="hd-stat-label">'+esc(x[0])+' · '+esc(year)+'年</div><div class="hd-stat-value">'+num(x[1],2)+'<small>'+esc(x[2])+'</small></div></article>').join('')+'</div>'+
      '<div class="annual-section"><div class="annual-section-heading"><h2>市场规模与连锁化</h2><span>年度趋势</span></div><div id="annual-market" class="annual-charts"></div></div>'+
      '<div class="annual-section"><div class="annual-section-heading"><h2>档次结构</h2><span>客房占比 · %</span></div><div class="annual-legend">'+d.grades.map((x,i)=>'<span><i style="background:'+colors[i]+'"></i>'+esc(x)+'</span>').join('')+'</div><div class="annual-charts annual-stacks">'+stack(d,d.all_share,'全部酒店 · 档次占比（披露）')+stack(d,d.chain_share,'连锁酒店 · 档次占比（测算）')+'</div><div id="annual-grades" class="annual-charts"></div></div>'+
      '<div class="annual-section"><div class="annual-section-heading"><h2>规模与城市结构</h2><span>客房口径</span></div><div id="annual-structure" class="annual-charts"></div></div>'+
      '<div class="annual-section"><div class="annual-section-heading"><h2>年度数据与排名</h2><span>'+esc(year)+'年截面</span></div><article class="hd-card board-panel"><div class="hd-card-head board-panel-head"><h2>历年核心数据</h2><select id="annual-series" aria-label="选择年度指标组"><option value="core">全国规模与连锁化</option><option value="grades">档次结构与连锁规模</option><option value="sizes">客房规模分组</option><option value="cities">城市等级</option></select></div><div id="annual-history"></div></article>'+
      '<article class="hd-card board-panel"><div class="hd-card-head board-panel-head"><h2>'+esc(year)+'年结构与排名</h2><select id="annual-detail" aria-label="选择年度明细"><option value="grade_latest">酒店档次</option><option value="size_latest">客房规模</option><option value="city_latest">城市等级</option><option value="provinces">31省区市</option><option value="topcities">城市10强</option><option value="groups">集团50强</option><option value="brand_rankings">品牌分类排名</option></select></div><div id="annual-snapshot"></div></article></div><p class="hd-footer annual-source">来源：中国饭店协会 · '+esc(year)+'年数据</p>';
    if(d.asOf&&window.SiteUI)SiteUI.asOf(document.getElementById('asof'),d.asOf,[]);
    function history(){let rows=[],kind=document.getElementById('annual-series').value;
      const add=(name,a,unit,derived=false)=>rows.push([name+'（'+unit+'）'+(derived?' · 测算':''),...a.map(x=>num(x,unit==='间'||unit==='家'?0:2))]);
      if(kind==='core'){
        [['hotels_wan','酒店数量','万家'],['rooms_wan','客房数量','万间'],['rooms_growth','客房同比','%'],['chain_rate','客房连锁化率','%'],['chain_store_rate','门店连锁化率','%']].forEach(x=>add(x[1],d[x[0]],x[2]));
        add('连锁酒店',d.years.map((_,i)=>d.chain_hotels.reduce((s,a)=>s+a[i],0)),'家',true);add('连锁客房',d.chain_total,'间',true);
      }else{
        let labels=kind==='grades'?d.grades:kind==='sizes'?d.size_labels:d.city_labels;
        let metrics=kind==='grades'?[['all_share','全部客房占比','%'],['chain_share','连锁客房占比','%'],['grade_chain_rate','客房连锁化率','%'],['chain_hotels','连锁酒店','家'],['chain_rooms','连锁客房','间']]:kind==='sizes'?[['size_share','客房占比','%'],['size_chain_rate','客房连锁化率','%']]:[['city_share','客房占比','%'],['city_chain_rate','客房连锁化率','%']];
        metrics.forEach(m=>labels.forEach((label,i)=>add(label+' · '+m[1],d[m[0]][i],m[2],m[0]==='chain_share')));
      }
      document.getElementById('annual-history').innerHTML=table(['指标',...d.years],rows);
    }
    function snapshot(){let k=document.getElementById('annual-detail').value,rows,headers;
      if(k==='groups'){headers=['排名','集团','总部','客房（间）','酒店（家）','PDF页'];rows=d[k].map(r=>r.map((v,i)=>i===3||i===4?num(v,0):v));}
      else if(k==='brand_rankings'){headers=['分类','排名','品牌','集团','客房（间）','酒店（家）','PDF页'];rows=d[k].map(r=>r.map((v,i)=>i===4||i===5?num(v,0):v));}
      else{headers=['分类','酒店（家）','客房（间）','酒店占比（%）·测算','客房占比（%）·测算'];const labels=k==='grade_latest'?d.grades:k==='size_latest'?d.size_labels:d.city_labels;rows=d[k].map((r,i)=>{let a=k==='provinces'||k==='topcities'?r:[labels[i],...r];return [a[0],num(a[1],0),num(a[2],0),num(a[1]/d.grade_latest.reduce((s,r)=>s+r[0],0)*100),num(a[2]/d.grade_latest.reduce((s,r)=>s+r[1],0)*100)];});}
      document.getElementById('annual-snapshot').innerHTML=table(headers,rows);
    }
    const chainHotels=d.years.map((_,i)=>d.chain_hotels.reduce((sum,a)=>sum+a[i],0)/10000);
    const configurations=[
      ['酒店数量','万家',['全部酒店（披露）','连锁酒店（测算）'],[d.hotels_wan,chainHotels],'industry',10],
      ['客房数量','万间',['全部客房（披露）','连锁客房（测算）'],[d.rooms_wan,d.chain_total.map(x=>x/10000)],'industry',10],
      ['客房数量同比 · 披露','%',['客房同比'],[d.rooms_growth],'industry',10],
      ['全国连锁化率 · 披露','%',['客房口径','门店口径'],[d.chain_rate,d.chain_store_rate],'industry',19],
      ['分档次连锁客房数量','万间',d.grades,d.chain_rooms.map(a=>a.map(x=>x/10000)),'brand',20],
      ['分档次连锁酒店数量','万家',d.grades,d.chain_hotels.map(a=>a.map(x=>x/10000)),'brand',20],
      ['分档次客房连锁化率','%',d.grades,d.grade_chain_rate,'industry',21],
      ['酒店规模结构 · 客房占比','%',d.size_labels,d.size_share,'industry',12],
      ['分规模客房连锁化率','%',d.size_labels,d.size_chain_rate,'industry',23],
      ['城市等级结构 · 客房占比','%',d.city_labels,d.city_share,'industry',13],
      ['分城市等级客房连锁化率','%',d.city_labels,d.city_chain_rate,'industry',25]
    ];
    [['annual-market',0,4],['annual-grades',4,7],['annual-structure',7,11]].forEach(([id,from,to])=>{
      document.getElementById(id).innerHTML=configurations.map((c,i)=>i>=from&&i<to?'<article class="hd-card board-panel" data-chart-values-default data-chart-label-menu><div class="hd-card-head board-panel-head"><h2>'+esc(c[0])+'</h2><a target="_blank" rel="noopener" href="'+src(c[4],c[5])+'">来源 ↗</a></div><div class="hd-chart board-chart" id="annual-trend-'+i+'"></div></article>':'').join('');
    });
    configurations.forEach((c,i)=>SiteCharts.drawPaired(document.getElementById('annual-trend-'+i),d.years.map((y,k)=>({period:String(y),values:c[2].map((label,j)=>({name:label,value:c[3][j][k]}))})),{name:c[0],unit:c[1],mode:'value',valueStyle:'line',precision:2,legend:'series',valueLabels:false}));
    document.getElementById('annual-series').onchange=history;document.getElementById('annual-detail').onchange=snapshot;history();snapshot();
  }
  window.HotelAnnual={render:async function(){if(loaded)return;if(!pending)pending=fetch('data/hotel-association-annual.json?v=20261026annual1').then(r=>{if(!r.ok)throw Error(r.status);return r.json();});try{draw(await pending);loaded=true;}catch(e){pending=null;const root=document.getElementById('hotel-annual-content');root.innerHTML='<p role="alert">饭店协会数据读取失败。</p><button id="annual-retry">重试</button>';document.getElementById('annual-retry').onclick=window.HotelAnnual.render;}}};
})();

