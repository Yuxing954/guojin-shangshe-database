(async function(){
  'use strict';
  const D=SiteData,R=ResourceModel,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),size=20;
  let pool=[],financials=[],filtered=[],manifest,sort='name',direction=1,page=1,initial=true,financialPromise,resourcePromise,detailRequest=0;
  function finance(){if(!financialPromise)financialPromise=D.table(manifest.datasets.find(d=>d.id==='financials').file).then(rows=>{financials=rows;return rows;}).catch(e=>{financialPromise=null;throw e;});return financialPromise;}
  function resources(){if(!resourcePromise)resourcePromise=D.json('data/research/resource-index.json').catch(e=>{resourcePromise=null;throw e;});return resourcePromise;}
  function initialFilters(){if(!initial)return;initial=false;const sector=params.get('sector')||'',options=[...$('sector').options].map(o=>o.value),wanted=sector.split(',').filter(s=>options.includes(s));if(wanted.length>1){const option=document.createElement('option');option.value=wanted.join(',');option.textContent=wanted.join(' / ');$('sector').append(option);}if(wanted.length)$('sector').value=wanted.join(',');$('search').value=params.get('q')||'';if(params.get('company'))open(params.get('company'));}
  function render(){
    initialFilters();const kw=$('search').value.trim().toLowerCase(),sector=$('sector').value;
    filtered=pool.filter(r=>(!sector||sector.split(',').includes(r['子行业']))&&(!kw||Object.values(r).join(' ').toLowerCase().includes(kw)));
    const fields={name:'公司名称',pe:'PE(TTM)',cap:'市值折CNY(亿元)'};
    filtered.sort((a,b)=>{const k=fields[sort];return direction*(sort==='name'?a[k].localeCompare(b[k],'zh'):((D.number(a[k])??-Infinity)-(D.number(b[k])??-Infinity)));});
    const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
    $('companies').innerHTML=filtered.slice((page-1)*size,page*size).map(r=>'<tr><td><button class="portal-company-name" data-code="'+D.esc(r['证券代码'])+'">'+D.esc(r['公司名称'])+'<small>'+D.esc(r['证券代码'])+'</small></button></td><td>'+D.esc(r['子行业'])+'</td><td>'+D.esc(r['市场'])+'</td><td>'+D.fmt(r['现价(元)'],2)+'</td><td>'+D.fmt(r['市值折CNY(亿元)'],2)+'</td><td>'+D.fmt(r['PE(TTM)'],2)+'</td><td>'+D.fmt(r.PB,2)+'</td><td>'+D.esc((r['数据日期']||'').slice(0,10))+'</td></tr>').join('')||'<tr><td colspan="8">当前筛选没有公司</td></tr>';
    $('page-label').textContent=page+' / '+pages+' · '+filtered.length+' 家';$('prev').disabled=page<=1;$('next').disabled=page>=pages;
  }
  function financialHtml(data){return '<div class="portal-panel-head"><h2>历史财务</h2><span class="portal-note">收入 / 净利单位：亿元 · 口径见报告期与来源</span></div><div class="portal-table-scroll"><table class="portal-table"><thead><tr><th>报告期</th><th>收入</th><th>收入同比 %</th><th>归母净利</th><th>归母同比 %</th><th>来源</th></tr></thead><tbody>'+data.map(r=>'<tr><td>'+D.esc(r['财报期'])+'</td>'+['营业收入(亿元)','营收同比(%)','归母净利润(亿元)','归母同比(%)'].map(k=>'<td>'+D.fmt(r[k],2)+'</td>').join('')+'<td>'+D.esc(r['来源'])+'</td></tr>').join('')+'</tbody></table></div>'+(!data.length?'<p class="portal-empty">暂无已收录财务数据</p>':'');}
  function resourceHtml(data,c){
    const column=(kind,title)=>{const rows=R.companyResources(data.items,c['证券代码'],kind).slice(0,3);return '<div><h3>'+title+'</h3>'+(rows.length?'<ul class="company-resource-list">'+rows.map(r=>'<li><a href="'+D.esc(R.safeHref(r.href))+'">'+D.esc(r.title)+'</a><small>'+D.esc(r.date||'日期待核对')+'</small></li>').join('')+'</ul>':'<p class="portal-note">暂无已收录资料</p>')+'</div>';};
    return '<h2>公司资料</h2><div class="company-resources">'+column('minutes','最新纪要')+column('views','近期观点')+'</div><div class="company-resource-links"><a href="search.html?q='+encodeURIComponent(c['证券代码'])+'">全部公司资料 →</a><a href="quotes.html?symbol='+encodeURIComponent(c['证券代码'])+'">查看行情 →</a></div>';
  }
  async function open(code){
    const c=pool.find(r=>r['证券代码']===code);if(!c)return;
    const request=++detailRequest;$('company-title').textContent=c['公司名称'];$('company-sub').textContent=c['证券代码']+' · '+c['子行业']+' · '+c['市场'];
    $('detail').innerHTML='<div class="portal-grid">'+[['PE / TTM',D.fmt(c['PE(TTM)'],2)],['PB',D.fmt(c.PB,2)]].map(x=>'<div class="portal-stat"><span>'+D.esc(x[0])+'</span><strong>'+D.esc(x[1])+'</strong></div>').join('')+'</div><div class="portal-panel" id="company-resources"><h2>公司资料</h2><p class="portal-note">正在读取资料目录…</p></div><details class="portal-panel"><summary>研究逻辑</summary><p class="portal-prose">'+D.esc(c['核心逻辑']||'暂无已收录内容')+'</p></details><p class="portal-note">估值及价格截至 '+D.esc((c['数据日期']||'').slice(0,10))+' · 市值统一使用源表折 CNY 字段</p><details class="portal-panel" id="company-financial-details"><summary>历史财务</summary><div id="company-financials"><p class="portal-note">展开后读取财务资料</p></div></details>';
    if(!$('company-dialog').open)$('company-dialog').showModal();
    let financeLoading=false,financeReady=false;
    $('company-financial-details').ontoggle=async event=>{
      if(!event.target.open||financeLoading||financeReady)return;
      financeLoading=true;$('company-financials').innerHTML='<p class="portal-note">正在读取财务资料…</p>';
      try{const rows=await finance();if(request!==detailRequest||!$('company-dialog').open)return;const data=rows.filter(r=>r['公司名称']===c['公司名称']).sort((a,b)=>D.period(b['财报期'])-D.period(a['财报期']));$('company-financials').innerHTML=financialHtml(data);financeReady=true;}catch(e){if(request===detailRequest&&$('company-dialog').open)$('company-financials').innerHTML='<p class="portal-note">财务资料暂时无法读取，再次展开可重试。</p>';}finally{financeLoading=false;}
    };
    try{const data=await resources();if(request!==detailRequest||!$('company-dialog').open)return;$('company-resources').innerHTML=resourceHtml(data,c);}catch(e){if(request!==detailRequest||!$('company-dialog').open)return;$('company-resources').innerHTML='<p class="portal-note">资料目录暂时无法读取。</p><a href="research.html?kind=minutes&scope=archived&q='+encodeURIComponent(c['公司名称'])+'">查看公司纪要 →</a>';}
  }
  $('companies').onclick=e=>{const b=e.target.closest('[data-code]');if(b)open(b.dataset.code);};$('close-company').onclick=()=>{detailRequest++;$('company-dialog').close();};$('search').oninput=()=>{page=1;render();};$('sector').onchange=()=>{page=1;render();};$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};
  document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort?-direction:1;sort=b.dataset.sort;render();});
  try{
    manifest=await D.json('data-manifest.json');pool=await D.table(manifest.datasets.find(d=>d.id==='valuation').file);
    $('sector').innerHTML='<option value="">全部行业</option>'+[...new Set(pool.map(r=>r['子行业']))].map(s=>'<option>'+D.esc(s)+'</option>').join('');
    $('stats').innerHTML=[['覆盖公司',pool.length+' 家'],['覆盖行业',new Set(pool.map(r=>r['子行业'])).size+' 个'],['财务资料','按需查看'],['价格 / 估值截至',pool.map(r=>(r['数据日期']||'').slice(0,10)).sort().at(-1)||'—']].map(x=>'<div class="portal-stat"><span>'+D.esc(x[0])+'</span><strong>'+D.esc(x[1])+'</strong><small>仓库已收录数据</small></div>').join('');
    $('valuation-source').href=manifest.datasets.find(d=>d.id==='valuation').file;$('financial-source').href=manifest.datasets.find(d=>d.id==='financials').file;$('status').textContent='';$('content').hidden=false;render();
  }catch(e){$('status').innerHTML='公司数据暂时无法读取。<button class="portal-button" onclick="location.reload()">重试</button>';}
})();
