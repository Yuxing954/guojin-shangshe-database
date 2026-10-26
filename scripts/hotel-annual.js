(function(){
  'use strict';
  let pending,loaded=false;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(x,n=2)=>Number(x).toLocaleString('zh-CN',{maximumFractionDigits:n,minimumFractionDigits:n});
  const colors=['#526ca5','#3f9188','#c79348','#906b9c'];
  function table(headers,rows){return '<div class="hd-table-scroll" tabindex="0"><table class="hd-table board-table"><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
  function stack(d,values,title){
    let svg='<svg viewBox="0 0 640 350" role="img" aria-label="'+esc(title)+'">';
    d.years.forEach((y,i)=>{let x=52;svg+='<text x="0" y="'+(38+i*42)+'">'+y+'</text>';const total=values.reduce((s,a)=>s+a[i],0);values.forEach((a,j)=>{let w=a[i]/total*580;svg+='<g><title>'+y+' '+d.grades[j]+' '+num(a[i])+'%</title><rect x="'+x+'" y="'+(16+i*42)+'" width="'+w+'" height="32" fill="'+colors[j]+'"/><text text-anchor="middle" class="annual-value" x="'+(x+w/2)+'" y="'+(37+i*42)+'">'+num(a[i],1)+'</text></g>';x+=w;});});
    svg+='</svg>';return '<article class="hd-card board-panel"><h3>'+title+'</h3>'+svg+'</article>';
  }
  function draw(d){
    const root=document.getElementById('hotel-annual-content');
    const src=(key,page)=>d.sources[key].url+(page?'#page='+page:'');
    root.innerHTML='<div class="hd-section-head board-section-head"><h2>酒店年度结构</h2><span>2019—2025 · 截至2025年末</span></div><div class="annual-links"><a href="data/hotel-association-annual.csv" download>下载历年CSV</a><a href="data/hotel-association-annual.json" download>下载完整数据</a><a href="data-notes.html#hotel-annual">数据口径</a><a target="_blank" rel="noopener" href="'+src('industry')+'">酒店业报告 ↗</a><a target="_blank" rel="noopener" href="'+src('brand')+'">集团及品牌报告 ↗</a></div>'+
      '<div class="annual-kpis">'+[['酒店数量','37.47','万家'],['客房数量','1,874','万间'],['客房连锁化率','41.80','%'],['门店连锁化率','28.37','%']].map(x=>'<article class="hd-card board-panel"><span>'+x[0]+'</span><strong>'+x[1]+'<small>'+x[2]+'</small></strong><span>2025年 · 披露值</span></article>').join('')+'</div>'+
      '<div class="annual-legend">'+d.grades.map((x,i)=>'<span><i style="background:'+colors[i]+'"></i>'+x+'</span>').join('')+'<span>客房占比（%）</span></div><div class="annual-charts">'+stack(d,d.all_share,'全部酒店 · 档次占比（披露）')+stack(d,d.chain_share,'连锁酒店 · 档次占比（测算）')+'</div>'+
      '<article class="hd-card board-panel"><div class="hd-card-head board-panel-head"><h3>历年核心数据</h3><select id="annual-series" aria-label="选择年度指标组"><option value="core">全国规模与连锁化</option><option value="grades">档次结构与连锁规模</option><option value="sizes">客房规模分组</option><option value="cities">城市等级</option></select></div><div id="annual-history"></div></article>'+
      '<article class="hd-card board-panel"><div class="hd-card-head board-panel-head"><h3>2025年结构与排名</h3><select id="annual-detail" aria-label="选择2025年明细"><option value="grade_latest">酒店档次</option><option value="size_latest">客房规模</option><option value="city_latest">城市等级</option><option value="provinces">31省区市</option><option value="topcities">城市10强</option><option value="groups">集团50强</option><option value="brand_rankings">品牌分类排名</option></select></div><div id="annual-snapshot"></div></article><p class="annual-source">来源：中国饭店协会 · 2026版报告（数据年度2025）</p>';
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
      else{headers=['分类','酒店（家）','客房（间）','酒店占比（%）·测算','客房占比（%）·测算'];const labels=k==='grade_latest'?d.grades:k==='size_latest'?d.size_labels:d.city_labels;rows=d[k].map((r,i)=>{let a=k==='provinces'||k==='topcities'?r:[labels[i],...r];return [a[0],num(a[1],0),num(a[2],0),num(a[1]/374694*100),num(a[2]/18736357*100)];});}
      document.getElementById('annual-snapshot').innerHTML=table(headers,rows);
    }
    document.getElementById('annual-series').onchange=history;document.getElementById('annual-detail').onchange=snapshot;history();snapshot();
  }
  window.HotelAnnual={render:async function(){if(loaded)return;if(!pending)pending=fetch('data/hotel-association-annual.json?v=20261026annual1').then(r=>{if(!r.ok)throw Error(r.status);return r.json();});try{draw(await pending);loaded=true;}catch(e){pending=null;const root=document.getElementById('hotel-annual-content');root.innerHTML='<p role="alert">年度数据读取失败。</p><button id="annual-retry">重试</button>';document.getElementById('annual-retry').onclick=window.HotelAnnual.render;}}};
})();
