(async function(){
  'use strict';
  const D=SiteData,U=SiteUI,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),size=50;
  let manifest,current,rows=[],filtered=[],headers=[],jsonText='',page=1,generation=0,ready=false;
  $('query').value=params.get('q')||'';
  function catalog(){const query=$('dataset-search').value.trim().toLowerCase(),groups={};manifest.datasets.filter(d=>(d.name+' '+d.category).toLowerCase().includes(query)).forEach(d=>(groups[d.category]??=[]).push(d));$('datasets').innerHTML=Object.entries(groups).map(([category,ds])=>'<h3>'+D.esc(category)+'</h3>'+ds.map(d=>'<button data-dataset="'+D.esc(d.id)+'" aria-pressed="'+String(current?.id===d.id)+'">'+D.esc(d.name)+'</button>').join('')).join('')||'<p class="portal-note">暂无匹配数据集</p>';}
  function render(){
    if(!ready)return;const query=$('query').value.trim().toLowerCase(),field=$('field').value;U.save({dataset:current.id,q:$('query').value.trim(),field});
    if(jsonText){$('json').textContent=jsonText;$('json').hidden=false;$('table').innerHTML='';$('pager').hidden=true;$('count').textContent='结构化 JSON';return;}
    filtered=rows.filter(r=>!query||String(field?r[field]??'':Object.values(r).join(' ')).toLowerCase().includes(query));const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
    $('table').innerHTML=filtered.length?'<table class="portal-table"><thead><tr>'+headers.map(h=>'<th>'+D.esc(h)+'</th>').join('')+'</tr></thead><tbody>'+filtered.slice((page-1)*size,page*size).map(r=>'<tr>'+headers.map(h=>'<td title="'+D.esc(r[h])+'">'+D.esc(r[h])+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<div class="portal-empty">暂无匹配数据</div>';
    $('count').textContent=filtered.length.toLocaleString()+' / '+rows.length.toLocaleString()+' 行 · '+headers.length+' 列';$('page-label').textContent=page+' / '+pages;$('pager').hidden=pages<=1;$('prev').disabled=page<=1;$('next').disabled=page>=pages;$('export').disabled=!filtered.length;
  }
  async function load(ds){
    const request=++generation;current=ds;ready=false;rows=[];filtered=[];headers=[];jsonText='';page=1;
    $('dataset-title').textContent=ds.name;$('format').textContent=ds.file.toLowerCase().endsWith('.json')?'JSON':'CSV';$('metadata').textContent=[ds.category,ds.asOf?'数据截至 '+ds.asOf:'',ds.latestPeriod?'期间 '+ds.latestPeriod:'',ds.file].filter(Boolean).join(' · ');
    $('source').href=encodeURI(ds.file);$('query').disabled=true;$('field').disabled=true;$('export').disabled=true;$('json').hidden=true;$('pager').hidden=true;$('table').innerHTML='<div class="portal-empty">正在读取数据…</div>';$('count').textContent='';$('status').textContent='正在读取 '+ds.name+'…';catalog();
    try{
      const text=await U.request(encodeURI(ds.file),'text',30000);if(request!==generation)return;
      if(ds.file.toLowerCase().endsWith('.json')){jsonText=JSON.stringify(JSON.parse(text),null,2);}else{rows=D.csv(text);headers=Object.keys(rows[0]||{});$('query').disabled=false;$('field').disabled=false;}
      $('field').innerHTML='<option value="">全部字段</option>'+headers.map(h=>'<option>'+D.esc(h)+'</option>').join('');if(headers.includes(params.get('field')))$('field').value=params.get('field');ready=true;$('status').textContent='';render();
    }catch(error){if(request!==generation)return;$('table').innerHTML='<div class="portal-empty">数据暂时无法读取</div>';$('status').textContent='数据暂时无法读取，可重试。';}
  }
  $('datasets').onclick=e=>{const b=e.target.closest('[data-dataset]');if(b){$('query').value='';load(manifest.datasets.find(d=>d.id===b.dataset.dataset));}};
  $('dataset-search').oninput=U.debounce(()=>manifest&&catalog());$('query').oninput=U.debounce(()=>{page=1;render();});$('field').onchange=()=>{page=1;render();};$('reset').onclick=()=>{$('query').value='';$('field').value='';page=1;render();};$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};$('export').onclick=()=>D.downloadCsv(filtered,current.id+'-筛选.csv',headers);$('reload').onclick=()=>current?load(current):init();
  async function init(){try{manifest=await D.json('data-manifest.json');if(!Array.isArray(manifest.datasets)||!manifest.datasets.length)throw Error('Empty manifest');await load(manifest.datasets.find(d=>d.id===params.get('dataset'))||manifest.datasets[0]);}catch(error){$('status').textContent='数据清单暂时无法读取，可重试。';}}
  await init();
})();
