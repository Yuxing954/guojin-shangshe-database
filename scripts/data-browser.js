(async function(){
  'use strict';
  const D=SiteData,U=SiteUI,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),size=50;
  let manifest,current,rows=[],filtered=[],headers=[],jsonText='',page=Math.max(1,Number(params.get("page"))||1),generation=0,ready=false;
  let sortKey=params.get('sort')||'',sortDirection=params.get('order')==='desc'?'desc':'asc';
  $('query').value=params.get('q')||'';
  function catalog(){const query=$('dataset-search').value.trim().toLowerCase(),groups={};manifest.datasets.filter(d=>(d.name+' '+d.category).toLowerCase().includes(query)).forEach(d=>(groups[d.category]??=[]).push(d));$('datasets').innerHTML=Object.entries(groups).map(([category,ds])=>'<h3>'+D.esc(category)+'</h3>'+ds.map(d=>'<button data-dataset="'+D.esc(d.id)+'" aria-pressed="'+String(current?.id===d.id)+'">'+D.esc(d.name)+'</button>').join('')).join('')||'<p class="portal-note">暂无匹配数据集</p>';}
  function render(){
    if(!ready)return;const query=$('query').value.trim().toLowerCase(),field=$('field').value;U.save({dataset:current.id,q:$('query').value.trim(),field,page:page>1?page:'',sort:sortKey,order:sortDirection});
    if(jsonText){$('json').textContent=jsonText;$('json').hidden=false;$('table').innerHTML='';$('pager').hidden=true;$('count').textContent='结构化 JSON';return;}
    filtered=rows.filter(r=>!query||String(field?r[field]??'':Object.values(r).join(' ')).toLowerCase().includes(query));if(headers.includes(sortKey))filtered.sort((a,b)=>{const x=a[sortKey],y=b[sortKey],n=ResearchWorkspaceModel.numeric(x)&&ResearchWorkspaceModel.numeric(y)?Number(x)-Number(y):String(x??"").localeCompare(String(y??""),"zh");return sortDirection==="desc"?-n:n;});const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
    $('table').innerHTML=filtered.length?'<table class="portal-table"><thead><tr>'+headers.map(h=>'<th aria-sort="'+(h===sortKey?(sortDirection==='desc'?'descending':'ascending'):'none')+'"><button data-sort="'+D.esc(h)+'">'+D.esc(h)+'</button></th>').join('')+'</tr></thead><tbody>'+filtered.slice((page-1)*size,page*size).map(r=>'<tr>'+headers.map(h=>'<td title="'+D.esc(r[h])+'">'+D.esc(r[h])+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<div class="portal-empty">暂无匹配数据</div>';
    $('count').textContent=filtered.length.toLocaleString()+' / '+rows.length.toLocaleString()+' 行 · '+headers.length+' 列';$('page-label').textContent=page+' / '+pages;$('pager').hidden=pages<=1;$('prev').disabled=page<=1;$('next').disabled=page>=pages;$('export').disabled=!filtered.length;
  }
  async function load(ds){
    const restore=!current,request=++generation;current=ds;ready=false;rows=[];filtered=[];headers=[];jsonText='';page=restore?Math.max(1,Number(params.get('page'))||1):1;
    $('dataset-title').textContent=ds.name;$('format').textContent=ds.file.toLowerCase().endsWith('.json')?'JSON':'CSV';$('metadata').textContent=[ds.category,ds.asOf?'数据截至 '+ds.asOf:'',ds.latestPeriod?'期间 '+ds.latestPeriod:'',ds.file].filter(Boolean).join(' · ');
    $('source').href=encodeURI(ds.file);$('query').disabled=true;$('field').disabled=true;$('export').disabled=true;$('json').hidden=true;$('pager').hidden=true;$('table').innerHTML='<div class="portal-empty">正在读取数据…</div>';$('count').textContent='';$('status').textContent='正在读取 '+ds.name+'…';catalog();
    try{
      const text=await U.request(encodeURI(ds.file),'text',30000);if(request!==generation)return;
      if(ds.file.toLowerCase().endsWith('.json')){jsonText=JSON.stringify(JSON.parse(text),null,2);}else{rows=D.csv(text);headers=Object.keys(rows[0]||{});$('query').disabled=false;$('field').disabled=false;}
      $('field').innerHTML='<option value="">全部字段</option>'+headers.map(h=>'<option>'+D.esc(h)+'</option>').join('');if(headers.includes(params.get('field')))$('field').value=params.get('field');ready=true;$('status').textContent='';render();
    }catch(error){if(request!==generation)return;$('table').innerHTML='<div class="portal-empty">数据暂时无法读取</div>';$('status').textContent='数据暂时无法读取，可重试。';}
  }
  $('table').onclick=e=>{const b=e.target.closest('[data-sort]');if(b){sortDirection=sortKey===b.dataset.sort&&sortDirection==='asc'?'desc':'asc';sortKey=b.dataset.sort;page=1;render();}};
  const copyButton=document.createElement('button');copyButton.textContent='复制当前筛选';copyButton.type='button';$('export').before(copyButton);copyButton.onclick=()=>{if(!ready||jsonText)return ResearchWorkspace.notify('当前数据为结构化JSON，请下载原始文件');const data=ResearchWorkspaceModel.clipboard(headers,filtered.map(r=>headers.map(h=>r[h])),headers.map((h,i)=>/代码|code|symbol/i.test(h)?i:-1));ResearchWorkspace.copy(data.text,data.html);};
  $('datasets').onclick=e=>{const b=e.target.closest('[data-dataset]');if(b){$('query').value='';load(manifest.datasets.find(d=>d.id===b.dataset.dataset));}};
  $('dataset-search').oninput=U.debounce(()=>manifest&&catalog());$('query').oninput=U.debounce(()=>{page=1;render();});$('field').onchange=()=>{page=1;render();};$('reset').onclick=()=>{$('query').value='';$('field').value='';page=1;render();};$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};$('export').onclick=()=>D.downloadCsv(filtered,current.id+'-筛选.csv',headers);$('reload').onclick=()=>current?load(current):init();
  async function init(){try{manifest=await D.json('data-manifest.json');if(!Array.isArray(manifest.datasets)||!manifest.datasets.length)throw Error('Empty manifest');await load(manifest.datasets.find(d=>d.id===params.get('dataset'))||manifest.datasets[0]);}catch(error){$('status').textContent='数据清单暂时无法读取，可重试。';}}
  await init();
})();

