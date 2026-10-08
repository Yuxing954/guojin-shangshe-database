(async function(){
  'use strict';
  const M=GoldJewelryModel,$=id=>document.getElementById(id),D=SiteData;
  const esc=D.esc,fmt=x=>M.numeric(x)?x.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—';
  const labels={primary:'原始披露',provider:'平台转引',legacy:'历史整理',derived:'计算值',pending_primary:'第三方转引·待复核',verified_primary:'原始来源已核验'};
  let data,sourceMap={},brandMap={},visible=[],sector=null,industrySources={};
  function link(s){const url=D.link(s?.url);return url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(s.name||'来源')+' ↗</a>':esc(s?.name||'来源待补');}
  function renderQuotes(){
    visible=data.quotes.filter(q=>(!$('gold-brand').value||q.brandId===$('gold-brand').value)&&(!$('gold-date').value||q.quoteDate===$('gold-date').value)&&(!$('gold-quality').value||q.verification===$('gold-quality').value)).sort((a,b)=>b.quoteDate.localeCompare(a.quoteDate)||a.brandId.localeCompare(b.brandId));
    $('gold-row-count').textContent=visible.length+' 条 · 日期以来源报价日为准 · 未披露城市、工费、纯度保持为空';
    $('gold-quotes').innerHTML=visible.map(q=>{const s=sourceMap[q.sourceId],spread=M.spread(q,data.benchmarks);return '<tr><td>'+esc(brandMap[q.brandId])+'</td><td>'+esc(q.quoteDate)+'</td><td>'+fmt(q.price)+'</td><td>'+esc(q.unit)+'<br><small>'+esc(q.product+' / '+q.priceBasis+'；'+(q.city||'城市未披露'))+'</small></td><td>'+fmt(spread.value)+'<br><small>'+esc(spread.reason)+'</small></td><td>'+link(s)+'<br><span class="gold-quality">'+esc(labels[q.verification])+'</span></td></tr>';}).join('')||'<tr><td colspan="6" class="gold-empty">该筛选条件下暂无已收录数据。</td></tr>';
    $('gold-export').disabled=!visible.length;
  }
  function renderIndustry(){
    const m=sector?.metrics.find(x=>x.id===$('gold-metric').value);if(!m)return;
    $('gold-metric-note').textContent=[m.scope,m.frequency,m.unit,m.scopeNote].filter(Boolean).join(' · ');
    $('gold-industry').innerHTML=(m.points||[]).slice().sort((a,b)=>b.endDate.localeCompare(a.endDate)).slice(0,24).map(p=>'<tr><td>'+esc(p.periodLabel||p.endDate)+'</td><td>'+fmt(p.value)+' '+esc(m.unit)+'</td><td>'+fmt(p.change)+(M.numeric(p.change)?' '+esc(m.changeUnit||'%'):'')+'</td><td>'+esc(p.basis||'未记录')+'</td><td>'+link(industrySources[p.sourceId])+'<br>'+esc(labels[p.quality]||p.quality||'待核对')+'</td></tr>').join('')||'<tr><td colspan="5" class="gold-empty">暂无已收录数据。</td></tr>';
  }
  try{
    data=await D.json('data/gold-jewelry/observations.json');const errors=M.validate(data);if(errors.length)throw new Error(errors.join('; '));
    sourceMap=Object.fromEntries(data.sources.map(s=>[s.id,s]));brandMap=Object.fromEntries(data.brands.map(b=>[b.id,b.name]));
    $('gold-brand').innerHTML+=[...data.brands].map(b=>'<option value="'+esc(b.id)+'">'+esc(b.name)+'</option>').join('');
    $('gold-date').innerHTML+=[...new Set(data.quotes.map(q=>q.quoteDate))].sort().reverse().map(d=>'<option>'+esc(d)+'</option>').join('');
    const latestDate=data.quotes.map(q=>q.quoteDate).sort().at(-1),latestBenchmark=[...data.benchmarks].sort((a,b)=>a.quoteDate.localeCompare(b.quoteDate)).at(-1);
    $('gold-kpis').innerHTML=[['本批品牌数',new Set(data.quotes.map(q=>q.brandId)).size,'报价日 '+(latestDate||'未收录')],['已收录基准价',latestBenchmark?fmt(latestBenchmark.price)+' 元/克':'—','Au99.99收盘 · '+(latestBenchmark?.quoteDate||'未收录')],['品牌原始来源已核验',data.quotes.filter(q=>q.verification==='verified_primary').length,'网页转录已核对不等于品牌来源已核验'],['实时妙想连接','未验证','行业数据复用仓库既有归档']].map(([title,v,note])=>'<div class="gold-kpi"><span>'+esc(title)+'</span><strong>'+esc(v)+'</strong><span class="gold-meta">'+esc(note)+'</span></div>').join('');
    $('gold-benchmarks').innerHTML=[...data.benchmarks].sort((a,b)=>b.quoteDate.localeCompare(a.quoteDate)).map(b=>'<tr><td>'+esc(b.quoteDate)+'</td><td>'+esc(b.instrument)+'</td><td>'+esc(b.priceType)+'</td><td>'+fmt(b.price)+' '+esc(b.unit)+'</td><td>'+link(sourceMap[b.sourceId])+'</td></tr>').join('');
    $('gold-checked').textContent='本批核对日期 '+data.checkedAt+'。核对时间不代表全部上游数据已更新。原始网页字节尚未归档。';
    $('gold-gaps').innerHTML=data.gaps.map(g=>'<p class="gold-subtle">'+esc(g)+'</p>').join('');
    $('gold-sources').innerHTML=data.sources.map(s=>'<div class="gold-source">'+link(s)+'<p class="gold-meta">'+esc(s.kind+' · 采集日 '+s.capturedDate+' · 采集方式 '+s.captureMethod)+'</p><p>'+esc(s.note)+'</p></div>').join('');
    for(const id of ['gold-brand','gold-date','gold-quality'])$(id).addEventListener('change',renderQuotes);
    $('gold-export').onclick=()=>{const rows=visible.map(q=>({...q,brandName:brandMap[q.brandId],sourceName:sourceMap[q.sourceId]?.name,sourceUrl:sourceMap[q.sourceId]?.url,capturedDate:sourceMap[q.sourceId]?.capturedDate}));const url=URL.createObjectURL(new Blob([M.csv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='黄金珠宝-品牌报价-'+data.checkedAt+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    renderQuotes();$('gold-status').textContent='';$('gold-body').hidden=false;
    const results=await Promise.allSettled([D.json(data.reuse.industry),D.json(data.reuse.companyManifest).then(manifest=>{const file=manifest.datasets.find(x=>x.id==='valuation')?.file;if(!file)throw new Error('公司目录不存在');return D.table(file);})]);
    if(results[0].status==='fulfilled'){
      const snapshot=results[0].value;sector=snapshot.sectors.find(s=>s.id==='gold');industrySources=Object.fromEntries(snapshot.sources.map(s=>[s.id,s]));
      if(sector){$('gold-company-all').href=sector.companySector?'companies.html?sector='+encodeURIComponent(sector.companySector):'companies.html';$('gold-research-all').href=sector.researchSector?'research.html?sector='+encodeURIComponent(sector.researchSector):'research.html';$('gold-metric').innerHTML=sector.metrics.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.label)+'</option>').join('');$('gold-metric').onchange=renderIndustry;renderIndustry();}
      else $('gold-metric-note').textContent='现有行业快照没有黄金珠宝板块，未构造替代数据。';
    }else $('gold-metric-note').textContent='现有行业快照暂未读到。品牌报价模块仍可使用，请返回行业页核对。';
    if(results[1].status==='fulfilled'){
      const pool=results[1].value.filter(c=>/黄金|珠宝/.test(c['子行业']||''));
      $('gold-companies').innerHTML=pool.map(c=>'<a href="companies.html?sector='+encodeURIComponent(c['子行业'])+'&company='+encodeURIComponent(c['证券代码'])+'">'+esc(c['公司名称'])+' →</a>').join('')||'<p class="gold-subtle">公司目录尚无黄金珠宝匹配项。</p>';
    }else $('gold-companies').textContent='公司目录暂未读到，请使用上方原站公司入口。';
  }catch(error){$('gold-body').hidden=true;$('gold-status').textContent='黄金珠宝模块未能加载：'+error.message+'。未以空值或模拟数据替代。';}
})();
