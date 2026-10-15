(function(root){
  'use strict';
  const M=typeof module==='object'&&module.exports?require('./macro-model.js'):root.MacroModel;
  const ids=['cn-gdp-quarter','cn-retail','cn-cpi'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>M.finite(v)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:4}).format(v):'—';
  function validate(feed){
    if(feed?.version!==1||!feed.series)throw Error('预测数据格式错误');
    for(const [id,s] of Object.entries(feed.series)){
      if(!ids.includes(id)||s.unit!=='%'||s.frequency!==(id==='cn-gdp-quarter'?'quarterly':'monthly')||!Array.isArray(s.observations)||!M.safeUrl(s.sourceUrl).startsWith('https://choicew2z.eastmoney.com/'))throw Error('预测口径错误');
      const seen=new Set();
      for(const r of s.observations){
        if(!(s.frequency==='quarterly'?/^\d{4}-Q[1-4]$/:/^\d{4}-(0[1-9]|1[0-2])$/).test(r.period)||seen.has(r.period)||!M.finite(r.value))throw Error('预测期间错误');
        seen.add(r.period);
      }
    }
    return feed;
  }
  function lookup(feed,id,period){return feed?.series?.[id]?.observations.find(r=>r.period===period)||null;}
  function actual(spec,row){
    if(!row)return null;
    if(spec.id==='cn-retail')return spec.kind==='rate'&&spec.unit==='%'?row.value:M.finite(row.officialYoy)?row.officialYoy:null;
    return spec.kind==='rate'&&spec.unit==='%'?row.value:null;
  }
  function difference(feed,spec,row){
    const f=lookup(feed,spec.id,row?.period),value=actual(spec,row);
    return f?.comparisonAllowed===true&&M.finite(value)?Number((value-f.value).toFixed(10)):null;
  }
  function card(feed,spec,row){
    if(!ids.includes(spec.id))return '';
    const f=lookup(feed,spec.id,row?.period),delta=difference(feed,spec,row);
    return '<span class="macro-expectation-reading">Choice 预测 '+number(f?.value)+'%'+(M.finite(delta)?' · 实际−预测 '+(delta>0?'+':'')+number(delta)+' 个百分点':'')+'</span>';
  }
  function history(feed,spec,data){
    const series=feed?.series?.[spec.id];if(!series)return '';
    const actuals=new Map(M.rows(data).map(r=>[r.period,r]));
    return '<details class="macro-forecast-history board-detail"><summary>预测明细 · '+series.observations.length+'期</summary><div class="portal-table-scroll"><table class="portal-table board-table"><thead><tr><th>数据期间</th><th>Choice 预测（%）</th><th>实际同比（%）</th><th>实际−预测（百分点）</th><th>预测发布日期</th><th>来源</th></tr></thead><tbody>'+series.observations.slice().reverse().map(f=>{const row=actuals.get(f.period);return '<tr><td>'+esc(f.period)+'</td><td>'+number(f.value)+'</td><td>'+number(actual(spec,row))+'</td><td>'+number(difference(feed,spec,row))+'</td><td>'+esc(f.forecastDate||'未提供')+'</td><td><a href="'+esc(M.safeUrl(series.sourceUrl))+'" target="_blank" rel="noopener">Choice ↗</a></td></tr>';}).join('')+'</tbody></table></div><a href="data-notes.html#macro">口径与来源 ↗</a></details>';
  }
  function overview(feed,catalog,snapshot,country){
    if(country!=='CN'||!feed)return '';
    return '<section class="macro-forecast-overview board-panel" aria-label="后续期间预测"><div class="board-panel-head"><h3>预期数据 · 后续期间</h3><a href="data-notes.html#macro">Choice · 来源 ↗</a></div><div class="portal-table-scroll"><table class="portal-table board-table"><thead><tr><th>指标</th><th>数据期间</th><th>预测（%）</th><th>口径</th><th>预测发布日期</th></tr></thead><tbody>'+ids.map(id=>{const spec=catalog.series.find(s=>s.id===id),last=M.rows(snapshot.series[id]).at(-1),series=feed.series[id],next=series?.observations.filter(r=>!last||r.period>last.period).slice().sort((a,b)=>a.period.localeCompare(b.period))[0];if(!spec||!next)return '';return '<tr><td>'+esc(spec.name)+'</td><td>'+esc(next.period)+'</td><td>'+number(next.value)+'</td><td>'+esc(series.basis)+'</td><td>'+esc(next.forecastDate||'未提供')+'</td></tr>';}).join('')+'</tbody></table></div></section>';
  }
  function csv(feed,spec,data){
    const series=feed?.series?.[spec.id],rows=new Map(M.rows(data).map(r=>[r.period,r]));
    const header=['指标','数据期间','实际同比%','Choice预测%','实际减预测_百分点','预测发布日期','预测获取时间','预测来源','统计口径','公布前版本已核验'];
    const periods=[...new Set([...rows.keys(),...(series?.observations||[]).map(r=>r.period)])].sort();
    return '\uFEFF'+[header,...periods.map(period=>{const row=rows.get(period),f=lookup(feed,spec.id,period);return [spec.name,period,actual(spec,row),f?.value,difference(feed,spec,row),f?.forecastDate,series?.fetchedAt,series?.sourceUrl,series?.basis,series?.vintageVerified?'是':'否'];})].map(r=>r.map(M.csvCell).join(',')).join('\r\n');
  }
  const api={ids,validate,lookup,actual,difference,card,history,overview,csv};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MacroExpectations=api;
})(typeof window==='object'?window:globalThis);
