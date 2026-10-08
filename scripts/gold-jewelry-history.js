(function(root){
  'use strict';
  const M=root.GoldJewelryModel,D=root.SiteData,$=id=>document.getElementById(id),esc=D.esc;
  function chart(rows,label){
    if(!rows.length)return '<p class="gold-subtle">暂无符合口径的历史观测。</p>';
    const dates=rows.map(r=>Date.parse(r.quoteDate)),prices=rows.map(r=>r.price),minDate=Math.min(...dates),maxDate=Math.max(...dates),min=Math.min(...prices),max=Math.max(...prices),pad=Math.max((max-min)*.12,1),lo=min-pad,hi=max+pad;
    const x=i=>55+(dates[i]-minDate)/Math.max(maxDate-minDate,86400000)*730,y=v=>25+(hi-v)/(hi-lo)*180;
    // Points show observations only. Missing dates have no synthetic prices or interpolated lines.
    return '<svg viewBox="0 0 840 260" role="img" aria-label="'+esc(label)+'"><title>'+esc(label)+'</title>'+[lo,(lo+hi)/2,hi].map(v=>'<line x1="55" x2="800" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#e3e4e8"/><text x="3" y="'+(y(v)+4)+'" font-size="12" fill="#657080">'+v.toFixed(1)+'</text>').join('')+rows.map((r,i)=>'<circle cx="'+x(i)+'" cy="'+y(r.price)+'" r="4" fill="#a78238"><title>'+esc(r.quoteDate+' · '+r.price+' '+r.unit)+'</title></circle>').join('')+'<text x="55" y="240" font-size="12">'+esc(rows[0].quoteDate)+'</text><text x="700" y="240" font-size="12">'+esc(rows.at(-1).quoteDate)+'</text></svg><p class="gold-meta">'+rows.length+' 个观测 · '+esc(label)+' · 鼠标移至数据点查看日期及价格；缺日不补值。</p>';
  }
  function download(name,csv){const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  root.GoldJewelryHistory={init(data){
    const sources=Object.fromEntries(data.sources.map(s=>[s.id,s])),brands=Object.fromEntries(data.brands.map(s=>[s.id,s.name])),groups=new Map();
    for(const q of data.quotes){const s=sources[q.sourceId],key=JSON.stringify([q.brandId,s.provider,q.market,q.currency,q.unit,q.product,q.priceBasis,q.purity,q.includesLabor,q.includesTax,q.verification]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);}
    const series=[...groups.values()].map(rows=>({rows:rows.sort((a,b)=>a.quoteDate.localeCompare(b.quoteDate)),label:brands[rows[0].brandId]+' · '+sources[rows[0].sourceId].provider+' · '+(rows[0].verification==='verified_primary'?'官方指导价':'第三方待复核')+' · 纯度'+(rows[0].purity??'未披露')}));
    $('gold-series').innerHTML=series.map((s,i)=>'<option value="'+i+'">'+esc(s.label)+'</option>').join('');
    const renderBrand=()=>{const s=series[Number($('gold-series').value)];$('gold-brand-chart').innerHTML=s?chart(s.rows,s.label):'';};$('gold-series').onchange=renderBrand;renderBrand();
    const renderBenchmark=()=>{$('gold-benchmark-chart').innerHTML=chart(M.benchmarkSeries(data.benchmarks,$('gold-benchmark-type').value),'Au99.99 · '+($('gold-benchmark-type').value==='close'?'收盘价':'加权平均价')+' · 元/克');};$('gold-benchmark-type').onchange=renderBenchmark;renderBenchmark();
    $('gold-benchmark-export').onclick=()=>download('黄金珠宝-上金所.csv',M.tableCsv(['交易日期','合约','口径','价格','单位','来源URL'],data.benchmarks.map(r=>[r.quoteDate,r.instrument,r.priceType,r.price,r.unit,sources[r.sourceId].url])));
    D.json('data/gold-jewelry/company-operations.json').then(ops=>{
      const errors=M.validateOperations(ops);if(errors.length)throw new Error(errors.join('; '));
      const companies=Object.fromEntries(ops.companies.map(c=>[c.id,c.name])),ss=Object.fromEntries(ops.sources.map(s=>[s.id,s]));let visible=[];
      $('gold-operation-company').innerHTML='<option value="">全部公司</option>'+ops.companies.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');
      $('gold-operation-metric').innerHTML='<option value="">全部指标</option>'+Object.entries(M.operationLabels).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('');
      const render=()=>{visible=ops.records.filter(r=>(!$('gold-operation-company').value||r.companyId===$('gold-operation-company').value)&&(!$('gold-operation-metric').value||r.metric===$('gold-operation-metric').value)).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd));$('gold-operations-count').textContent=visible.length+' 条已核验经营指标；缺失字段未补0。';$('gold-operations').innerHTML=visible.map(r=>{const s=ss[r.sourceId];return '<tr><td>'+esc(companies[r.companyId])+'</td><td>'+esc(r.fiscalLabel)+'<br><small>'+esc(r.periodStart+' 至 '+r.periodEnd)+'</small></td><td>'+esc(M.operationLabels[r.metric])+'</td><td>'+r.value.toLocaleString('zh-CN')+' '+esc(r.unit)+'</td><td>'+esc(r.region+' · '+r.channel)+'<br><small>'+esc(r.scope)+'</small></td><td><a href="'+esc(D.link(s.url))+'#page='+r.pdfPage+'" target="_blank" rel="noopener noreferrer">'+esc(s.name)+' · PDF第'+r.pdfPage+'页 ↗</a><br><small>'+esc('披露日 '+s.publishedAt+' · '+r.note)+'</small></td></tr>';}).join('')||'<tr><td colspan="6">该条件下暂无已核验数据。</td></tr>';$('gold-operation-export').disabled=!visible.length;};
      $('gold-operation-company').onchange=render;$('gold-operation-metric').onchange=render;render();
      $('gold-operation-export').onclick=()=>download('黄金珠宝-公司经营.csv',M.tableCsv(['公司','财年标签','期间起','期间止','期间类型','指标','数值','单位','地区','渠道','合并范围/产品口径','来源URL','PDF页码','披露日'],visible.map(r=>[companies[r.companyId],r.fiscalLabel,r.periodStart,r.periodEnd,r.periodType,M.operationLabels[r.metric],r.value,r.unit,r.region,r.channel,r.scope,ss[r.sourceId].url,r.pdfPage,ss[r.sourceId].publishedAt])));
    }).catch(e=>{$('gold-operations-count').textContent='经营数据未能加载：'+e.message;});
    D.json('data/gold-jewelry/verification.json').then(audit=>{$('gold-primary-audit').innerHTML=audit.brandChecks.map(r=>'<tr><td>'+esc(brands[r.brandId])+'</td><td>第三方转录一致</td><td>'+esc(r.note)+'</td><td><a href="'+esc(D.link(r.attemptedPrimaryUrl))+'" target="_blank" rel="noopener noreferrer">尝试来源 ↗</a></td></tr>').join('');}).catch(()=>{$('gold-primary-audit').textContent='核验明细暂未读到。';});
  }};
})(globalThis);
