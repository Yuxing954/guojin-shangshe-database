(function(){
  'use strict';
  const T=RegionalRetailTiers,M=RegionalRetail,C=RegionalRetailCharts,D=SiteData,$=id=>document.getElementById(id),esc=D.esc,F=M.finite;
  let data,registry,snapshot=[],detail=[];
  const num=(v,d=1)=>F(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const pct=v=>F(v)?(v>0?'+':'')+num(v)+'%':'—',signed=v=>F(v)?(v>0?'+':'')+num(v):'—',color=v=>F(v)&&v!==0?v>0?'regional-pos':'regional-neg':'';
  const basisName=b=>b==='ytd'?'年初累计':b==='month'?'当月':'1—2月合并';
  function marked(row,field,value){return value+(row.provenance?.[field]?.derived?' <small class="regional-derived" title="'+esc(M.valueLabel(row,field))+'">测算</small>':'');}
  function links(row){return M.sourceIds(row).map(id=>{const s=data.sources.find(x=>x.id===id),url=s&&D.link(s.url);return url?'<a target="_blank" rel="noopener" href="'+esc(url)+'" title="'+esc((s.publisher||s.provider||'')+' · '+(s.releaseDate||'发布日期未返回'))+'">'+(['provider','secondary'].includes(s.quality)?'Choice':s.quality==='official-repost'?'转载':'原文')+' ↗</a>':'';}).join(' ');}
  function syncPeriod(preferred){const ps=M.periods(data,$('tier-basis').value);$('tier-period').innerHTML=ps.slice().reverse().map(p=>'<option value="'+p+'"'+(p===preferred?' selected':'')+'>'+M.periodLabel(p)+'</option>').join('');if(!ps.includes(preferred))$('tier-period').value=T.broadPeriod(data,registry,$('tier-basis').value);}
  function renderTrend(){
    const metric=$('tier-metric').value,cohort=$('tier-cohort').value,frequency=$('tier-frequency').value;
    const series=T.trend(data,registry,$('tier-period').value,$('tier-basis').value,metric,cohort,Number($('tier-years').value),frequency);
    C.draw($('tier-trend'),series,{frequency});$('tier-legend').innerHTML='';
    const last=series[0]?.points.at(-1)?.period||'—';$('tier-trend-sample').textContent=(frequency==='quarterly'?'季度末':'月度')+' · 趋势至 '+M.periodLabel(last)+' · '+(cohort==='fixed'?'固定所选期城市，样本不完整时断线':'逐期样本变动；悬停或点选查看城市数');
  }
  function renderDetail(){
    const group=$('tier-group').value,q=$('tier-search').value.trim(),missing=$('tier-show-missing').checked;
    detail=T.cityRows(data,registry,$('tier-period').value,$('tier-basis').value).filter(r=>r.group>=1&&r.group<=5&&(!group||r.group===Number(group))&&(!q||r.name.includes(q)||r.parent?.includes(q))&&(missing||F(r.yoy)||F(r.amount))).sort((a,b)=>a.group-b.group||Number(F(b.yoy))-Number(F(a.yoy))||(F(a.yoy)&&F(b.yoy)?b.yoy-a.yoy:0)||a.name.localeCompare(b.name,'zh-CN'));
    $('tier-detail-count').textContent=detail.filter(r=>F(r.yoy)).length+'城有同比 / '+detail.length+'城显示';
    $('tier-detail').innerHTML=detail.length?detail.map(r=>'<tr><td><button data-region-id="'+esc(r.id)+'">'+esc(r.name)+'</button></td><td>'+esc(registry.groups.find(g=>g.id===r.group)?.label+' / '+r.originalTier)+'</td><td>'+marked(r,'amount',num(r.amount,2))+'</td><td class="'+color(r.yoy)+'">'+(r.disputed.yoy?'待核验':marked(r,'yoy',num(r.yoy)))+'</td><td>'+signed(r.change)+'</td><td>'+links(r)+'</td></tr>').join(''):'<tr><td colspan="6" class="regional-empty site-empty">所选期间暂无匹配城市数据</td></tr>';
    SiteUI.save({tierGroup:group,tierSearch:q,tierMissing:missing?'1':null});
  }
  function render(){
    if(!data||!registry)return;const period=$('tier-period').value,basis=$('tier-basis').value,metric=$('tier-metric').value;
    snapshot=T.snapshot(data,registry,period,basis);const n=snapshot.reduce((sum,s)=>sum+s.n,0);
    $('tier-title').textContent=M.periodLabel(period)+' · '+basisName(basis);$('tier-coverage').textContent=n+'城有同比'+(snapshot.some(s=>s.estimatedN)?' · 含推算'+snapshot.reduce((sum,s)=>sum+s.estimatedN,0)+'城':'')+' · '+(metric==='average'?'等权平均':'可比基数加权，测算');
    $('tier-cards').innerHTML=snapshot.map((s,i)=>{const validN=metric==='average'?s.n:s.weightedN;return '<article class="tier-card site-kpi" style="--tier-color:'+C.colors[i]+'"><h3>'+esc(s.label)+'</h3><strong class="'+color(s[metric])+'">'+pct(s[metric])+'</strong><p>'+validN+'城样本'+(validN<3?' · 样本偏少':'')+'</p><small>正增长 '+(F(s.positiveShare)?num(s.positiveShare)+'%':'—')+'</small></article>';}).join('');
    $('tier-summary-table').innerHTML=snapshot.map(s=>'<tr><td>'+esc(s.label)+'</td><td>'+s.n+'</td><td class="'+color(s.average)+'">'+num(s.average)+'</td><td>'+num(s.median)+'</td><td>'+num(s.q25)+' / '+num(s.q75)+'</td><td>'+num(s.weighted)+' <small>('+s.weightedN+'城)</small></td><td>'+num(s.positiveShare)+'</td><td>'+signed(s.pairedChange)+' <small>('+s.pairedN+'城)</small></td></tr>').join('');
    C.control($('tier-distribution'));$('tier-distribution').innerHTML=snapshot.map(s=>'<div class="tier-distribution-row"><span>'+esc(s.label)+'</span><div class="tier-distribution-track" aria-label="'+esc(s.label+'：'+s.negative+'负、'+s.flat+'平、'+s.positive+'正')+'">'+[['负增长',s.negative,'#71a398'],['持平',s.flat,'#c2c7d2'],['正增长',s.positive,'#b98287']].map(([label,count,c])=>count?'<i style="width:'+count/Math.max(1,s.n)*100+'%;background:'+c+'" title="'+label+' '+count+'城">'+count+'</i>':'').join('')+'</div><b>'+s.negative+' / '+s.flat+' / '+s.positive+'</b></div>').join('');
    const ranked=snapshot.filter(s=>s.n>=3).sort((a,b)=>b.average-a.average),divergence=snapshot.filter(s=>s.n>=3&&Math.abs(s.average-s.median)>=3).map(s=>{const lowest=s.rows.filter(r=>F(r.yoy)).sort((a,b)=>a.yoy-b.yoy)[0];return s.label+'均值'+pct(s.average)+'、中位数'+pct(s.median)+'，最低为'+lowest.name+pct(lowest.yoy)+'。';}).join('');
    $('tier-insights').textContent=(ranked.length>=2?'已取得样本中，'+ranked[0].label+'等权同比最高（'+pct(ranked[0].average)+'），'+ranked.at(-1).label+'最低（'+pct(ranked.at(-1).average)+'）。':'当前分线样本偏少。')+divergence+'分线统计仅覆盖已有城市。';
    $('tier-status').textContent='';renderTrend();renderDetail();
    SiteUI.save({tierPeriod:period,tierBasis:basis,tierMetric:metric,tierCohort:$('tier-cohort').value,tierFrequency:$('tier-frequency').value,tierYears:$('tier-years').value});
  }
  async function load(original,provided){
    data=original;$('tier-status').textContent='正在读取城市分级…';$('tier-retry').hidden=true;$('tier-body').hidden=true;
    try{registry=provided||await D.json('data/regional-retail/city-tiers.json');if(!registry.groups?.length||!registry.cities?.length)throw Error('分级为空');const p=new URLSearchParams(location.search);
      $('tier-basis').value=['ytd','month'].includes(p.get('tierBasis'))?p.get('tierBasis'):'ytd';$('tier-metric').value=p.get('tierMetric')==='weighted'?'weighted':'average';$('tier-cohort').value=p.get('tierCohort')==='available'?'available':'fixed';$('tier-frequency').value=p.get('tierFrequency')==='monthly'||(!p.has('tierFrequency')&&$('tier-basis').value==='month')?'monthly':'quarterly';$('tier-years').value=['1','3','5'].includes(p.get('tierYears'))?p.get('tierYears'):'3';$('tier-group').value=['1','2','3','4','5'].includes(p.get('tierGroup'))?p.get('tierGroup'):'';$('tier-search').value=p.get('tierSearch')||'';$('tier-show-missing').checked=p.get('tierMissing')==='1';
      syncPeriod(p.get('tierPeriod')||T.broadPeriod(data,registry,$('tier-basis').value));$('tier-body').hidden=false;render();
    }catch(e){registry=null;$('tier-status').textContent='城市分级读取失败：'+e.message;$('tier-retry').hidden=false;}
    return original;
  }
  window.RegionalTierDashboard={load,redraw:()=>{if(registry)renderTrend();}};
  $('tier-basis').onchange=()=>{if($('tier-basis').value!=='ytd')$('tier-frequency').value='monthly';syncPeriod($('tier-period').value);render();};
  for(const id of ['tier-period','tier-metric','tier-cohort','tier-frequency','tier-years'])$(id).onchange=render;
  $('tier-group').onchange=renderDetail;$('tier-search').oninput=SiteUI.debounce(renderDetail);$('tier-show-missing').onchange=renderDetail;$('tier-retry').onclick=()=>load(data);
  $('tier-latest').onclick=()=>{syncPeriod(M.periods(data,$('tier-basis').value).at(-1));render();};$('tier-broadest').onclick=()=>{syncPeriod(T.broadPeriod(data,registry,$('tier-basis').value));render();};
  $('tier-summary-csv').onclick=()=>D.downloadCsv(snapshot.map(s=>({层级:s.label,分级版本:registry.version,统计期:M.periodLabel($('tier-period').value),统计口径:M.resolved($('tier-period').value,$('tier-basis').value).basis,等权平均同比百分比:s.average,同比中位数百分比:s.median,下四分位百分比:s.q25,上四分位百分比:s.q75,有效城市数:s.n,含累计推算同比城市数:s.estimatedN,已跟踪城市数:s.tracked,分级名单城市数:s.universe,可比基数加权同比百分比测算:s.weighted,加权城市数:s.weightedN,正增长城市数:s.positive,持平城市数:s.flat,负增长城市数:s.negative,正增长占比百分比:s.positiveShare,同城市配对增速变化百分点:s.pairedChange,配对城市数:s.pairedN,城市清单:s.rows.filter(r=>F(r.yoy)).map(r=>r.name).join('、'),口径说明:'同期已取得样本，来源详见城市明细导出'})),'分线社零-'+$('tier-period').value+'.csv');
  $('tier-detail-csv').onclick=()=>{const names=new Set(detail.map(r=>r.name));D.downloadCsv(T.csv(data,registry,$('tier-period').value,$('tier-basis').value).filter(r=>names.has(r.城市)),'分线城市明细-'+$('tier-period').value+'.csv');};
})();

