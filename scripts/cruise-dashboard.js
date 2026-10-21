(function(){
  'use strict';
  const $=id=>document.getElementById(id),esc=SiteData.esc;
  const metrics=[['passengers','客运量','万人','passengersYoY','%'],['sailings','发船量','艘次','sailingsYoY','%'],['load','平均载客率（床位）','%','loadYoYPp','百分点']];
  let data,rows=[];
  const fmt=(v,d=2)=>v==null?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:d});
  const delta=(v,u)=>v==null?'同比 —':'同比 '+(v>0?'+':'')+fmt(v)+u;
  function filtered(){return data.records.filter(r=>$('year').value==='all'||r.period.startsWith($('year').value));}
  function render(){
    rows=filtered();const scope=$('scope').value,latest=rows.at(-1),v=latest[scope],label=scope==='monthly'?'当月':'年初累计';
    $('asof').textContent=latest.period+' · '+label+' · 重庆邮轮中心 / 重庆航运交易所 · 转引';
    $('kpis').innerHTML=metrics.map(([k,n,u,c,cu])=>'<article class="cruise-kpi"><h2>'+n+'</h2><strong>'+fmt(v[k],k==='passengers'?4:2)+'<small>'+u+'</small></strong><p>'+delta(v[c],cu)+'</p></article>').join('');
    if(!$('charts').children.length)$('charts').innerHTML=metrics.map(([k,n])=>'<article class="cruise-panel" data-chart-dual-labels><h2>'+n+'</h2><div class="cruise-chart" id="chart-'+k+'"></div></article>').join('');
    for(const [k,n,u,c,cu] of metrics){
      const chartRows=rows.map(r=>({period:r.period,value:r[scope][k],change:r[scope][c]}));
      SiteCharts.drawPaired($('chart-'+k),chartRows,{name:n,unit:u,mode:'combo',valueStyle:'bar',changeUnit:cu,precision:1,changePrecision:1});
    }
    const byId=new Map(data.sources.map(s=>[s.id,s]));
    $('monthly-table').innerHTML='<thead><tr>'+['月份',label+'客运量（万人）','同比（%）',label+'发船量（艘次）','同比（%）','载客率（%）','同比（百分点）','其中非跨夜（艘次）','其中非跨夜（万人）','状态 / 来源'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+[...rows].reverse().map(r=>{const a=r[scope];return '<tr data-period="'+r.period+'"><td>'+r.period+'</td>'+['passengers','passengersYoY','sailings','sailingsYoY','load','loadYoYPp','nonOvernightSailings','nonOvernightPassengers'].map(k=>'<td'+(a[k]==null?' class="missing"':'')+'>'+fmt(a[k],k==='passengers'?4:2)+'</td>').join('')+'<td>'+(r.notes.length?'<a class="flag" href="data-notes.html#tourism">'+(r.status==='待核验'?'待核验':'含待核验项')+'</a>':'')+r.sourceIds.map((id,i)=>{const s=byId.get(id);return '<a href="'+esc(s.url)+'" target="_blank" rel="noopener" title="'+esc(s.quality+' · '+s.publisher+(s.publishedAt?' · 发布 '+s.publishedAt:''))+'">'+(i?'补充'+i:'转引')+'</a>';}).join('')+'</td></tr>';}).join('')+'</tbody>';
  }
  function download(){const scope=$('scope').value,fields=Object.keys(data.units),byId=new Map(data.sources.map(s=>[s.id,s]));const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[['月份','口径',...fields.map(k=>k+' ('+data.units[k]+')'),'状态','来源','字段来源','备注'],...rows.map(r=>[r.period,scope,...fields.map(k=>r[scope][k]),r.status,r.sourceIds.map(id=>byId.get(id).url).join(' | '),JSON.stringify(r.fieldSources),r.notes.join(' | ')])].map(r=>r.map(quote).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='三峡游轮_'+$('year').value+'_'+scope+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function load(){
    $('load-error').hidden=true;
    try{data=await SiteData.json('data/tourism/three-gorges-cruises.json');if(!data.records?.length)throw Error('empty');$('dashboard').hidden=false;render();$('export').disabled=false;}
    catch(e){$('dashboard').hidden=true;$('export').disabled=true;$('asof').textContent='月度运行数据';$('load-error').hidden=false;$('load-error').textContent='数据暂时无法读取，请重试。';const b=document.createElement('button');b.textContent='重试';b.onclick=load;$('load-error').append(b);}
  }
  for(const id of ['year','scope'])$(id).onchange=render;
  $('export').onclick=download;
  let resize;addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>{if(data&&!$('dashboard').hidden)render();},150);});
  load();
})();
