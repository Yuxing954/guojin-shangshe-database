(function(){
  'use strict';
  const $=id=>document.getElementById(id),esc=SiteData.esc,M=DiningModel;
  const params=new URLSearchParams(location.hash.slice(1)),phone=matchMedia('(max-width:760px)');
  let data,view=params.get('view')==='history'?'history':'overview';
  function state(){return {category:$('category').value,year:$('year').value,holidays:$('holidays').checked};}
  function tone(r){return !r?'missing':r.value!==null?r.value>=100?'positive':'negative':/预计|测算/.test(r.raw)?'estimate':'qualitative';}
  function metric(b){return b.metric.replace('原表同店口径','同店');}
  function periodLabel(r){return r.periodLabel.replace('（原图合并）','');}
  function save(){const p=new URLSearchParams({...state(),period:$('period').value,view,historyBrand:$('history-brand').value});history.replaceState(null,'','#'+p);}
  function applyView(){
    const mobile=phone.matches,history=mobile&&view==='history';
    $('detail-title').textContent=mobile?'历史数据':'月度经营全表';
    $('mobile-views').hidden=!mobile;$('kpis').hidden=history;$('detail-panel').hidden=mobile&&!history;
    $('matrix-wrap').hidden=mobile;$('mobile-history').hidden=!mobile;$('mobile-history-controls').hidden=!mobile;
    $('period-filter').hidden=history;
    $('mobile-views').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  }
  function historyTable(){
    const f=M.filtered(data,state()),b=f.brands.find(b=>b.id===$('history-brand').value)||f.brands[0];if(!b)return;
    $('history-metric').textContent=metric(b)+' · 同比恢复率（%）';
    $('history-table').innerHTML='<thead><tr><th scope="col">期间</th><th scope="col">'+esc(b.name)+'</th></tr></thead><tbody>'+f.rows.map(p=>{
      const r=M.cell(data,b.id,p.index),covered=r?f.rows.filter(x=>x.index>=r.startRow&&x.index<=r.endRow):[];
      return '<tr class="'+(p.kind==='holiday'?'holiday':'')+'"><th scope="row">'+esc(p.label)+'</th>'+(!r?'<td class="missing">—</td>':covered[0].index!==p.index?'':'<td rowspan="'+covered.length+'" class="'+tone(r)+'" title="'+esc(periodLabel(r))+'">'+esc(r.raw)+'</td>')+'</tr>';
    }).join('')+'</tbody>';
  }
  function render(){
    const f=M.filtered(data,state()),row=data.periods.findIndex(p=>p.id===$('period').value);
    $('kpis').innerHTML=f.brands.map(b=>{const r=M.cell(data,b.id,row);return '<article class="dining-kpi '+tone(r)+'"><div class="dining-kpi-head"><h2>'+esc(b.name)+'</h2><span>'+esc(b.category)+'</span></div><div class="dining-kpi-value">'+esc(r?.raw||'—')+'</div><div class="dining-kpi-metric">'+esc(metric(b))+'</div></article>';}).join('');
    $('matrix').innerHTML='<thead><tr><th scope="col">期间</th>'+f.brands.map(b=>'<th scope="col">'+esc(b.name)+'<small>'+esc(metric(b))+'</small></th>').join('')+'</tr></thead><tbody>'+f.rows.map(p=>'<tr class="'+(p.kind==='holiday'?'holiday':'')+'"><th scope="row">'+esc(p.label)+'</th>'+f.brands.map(b=>{const r=M.cell(data,b.id,p.index);if(!r)return '<td class="missing">—</td>';const covered=f.rows.filter(x=>x.index>=r.startRow&&x.index<=r.endRow);if(covered[0].index!==p.index)return '';return '<td rowspan="'+covered.length+'" class="'+tone(r)+'" title="'+esc(periodLabel(r))+'">'+esc(r.raw)+'</td>';}).join('')+'</tr>').join('')+'</tbody>';
    const selected=$('history-brand').value||params.get('historyBrand');
    $('history-brand').innerHTML=f.brands.map(b=>'<option value="'+b.id+'">'+esc(b.name)+'</option>').join('');
    if(f.brands.some(b=>b.id===selected))$('history-brand').value=selected;
    historyTable();applyView();save();
  }
  async function load(){
    $('load-error').hidden=true;$('retry').hidden=true;$('dashboard').hidden=true;$('export').disabled=true;$('asof').textContent='正在读取餐饮数据…';
    try{
      data=await SiteData.json('data/dining/observations.json');
      $('asof').textContent='截至 '+data.latestPeriod+' · '+data.brands.length+'个品牌';
      $('period').innerHTML=data.periods.slice().reverse().map(p=>'<option value="'+p.id+'">'+esc(p.label)+'</option>').join('');
      if(data.periods.some(p=>p.id===params.get('period')))$('period').value=params.get('period');
      for(const id of ['category','year'])if([...$(id).options].some(o=>o.value===params.get(id)))$(id).value=params.get(id);
      if(params.get('holidays')==='false')$('holidays').checked=false;
      $('dashboard').hidden=false;render();$('export').disabled=false;
    }catch(e){$('load-error').textContent='餐饮数据读取失败，请重试。';$('load-error').hidden=false;$('retry').hidden=false;$('asof').textContent='读取失败';}
  }
  for(const id of ['period','category','year','holidays'])$(id).onchange=render;
  $('history-brand').onchange=()=>{historyTable();save();};
  $('mobile-views').onclick=e=>{const b=e.target.closest('[data-view]');if(b){view=b.dataset.view;applyView();save();}};
  phone.addEventListener('change',()=>{if(data)applyView();});
  $('export').onclick=()=>{const rows=M.csvRows(data,state()).filter(r=>!phone.matches||view!=='history'||r['品牌']===data.brands.find(b=>b.id===$('history-brand').value)?.name);SiteData.downloadCsv(rows,'餐饮经营跟踪.csv');};
  $('retry').onclick=load;load();
})();
