(function(){
  'use strict';
  const $=id=>document.getElementById(id),esc=SiteData.esc,M=DiningModel;let data;
  const params=new URLSearchParams(location.hash.slice(1));
  function state(){return {category:$('category').value,year:$('year').value,holidays:$('holidays').checked};}
  function tone(r){return !r?'missing':r.value!==null?r.value>=100?'positive':'negative':/预计/.test(r.raw)?'estimate':'qualitative';}
  function detail(r,b){if(!r)return '';const labels=[r.periodTag,r.metric&&r.metric!==b.metric?r.metric:null,r.sourcePeriodLabel?'原图合并期间':null].filter(Boolean);return labels.length?'<small>'+esc(labels.join(' · '))+'</small>':'';}
  function save(){const p=new URLSearchParams(state());history.replaceState(null,'','#'+p);}
  function render(){const s=state(),f=M.filtered(data,s);
    $('matrix').innerHTML='<thead><tr><th scope="col">期间</th>'+f.brands.map(b=>'<th scope="col">'+esc(b.name)+'<small>'+esc(b.metric.replace('原表同店口径','同店'))+'</small></th>').join('')+'</tr></thead><tbody>'+f.rows.map((p,pos)=>'<tr class="'+(p.kind==='holiday'?'holiday':'')+'"><th scope="row">'+esc(p.label)+'</th>'+f.brands.map(b=>{const r=M.cell(data,b.id,p.index);if(!r)return '<td class="missing">—</td>';const covered=f.rows.filter(x=>x.index>=r.startRow&&x.index<=r.endRow);if(covered[0].index!==p.index)return '';return '<td rowspan="'+covered.length+'" class="'+tone(r)+'" title="'+esc((r.sourcePeriodLabel||r.periodLabel).replace('（原图合并）',''))+'"><span>'+esc(r.raw)+'</span>'+detail(r,b)+'</td>';}).join('')+'</tr>').join('')+'</tbody>';save();}
  async function load(){ $('load-error').hidden=true;$('retry').hidden=true;$('dashboard').hidden=true;$('export').disabled=true;$('asof').textContent='正在读取餐饮数据…';try {data=await SiteData.json('data/dining/observations.json?v=20261113');SiteUI.asOf($('asof'),data.latestPeriod,[data.brands.length+'个品牌']);for(const id of ['category','year']){if([...$(id).options].some(o=>o.value===params.get(id)))$(id).value=params.get(id);}if(params.get('holidays')==='false')$('holidays').checked=false;$('dashboard').hidden=false;render();$('export').disabled=false;}catch(e){$('load-error').textContent='餐饮数据读取失败，请重试。';$('load-error').hidden=false;$('retry').hidden=false;$('asof').textContent='读取失败';}}
  for(const id of ['category','year','holidays'])$(id).onchange=render;$('export').onclick=()=>SiteData.downloadCsv(M.csvRows(data,state()),'餐饮经营跟踪.csv');$('retry').onclick=load;load();
})();

