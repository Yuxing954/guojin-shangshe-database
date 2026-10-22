(function(){
 'use strict';
 const M=KoreaDutyfree,D=SiteData,$=id=>document.getElementById(id),esc=D.esc,root=$('view-korea');
 const metrics=[{field:'salesUsd',id:'sales',label:'销售额',unit:'亿美元',scale:1e8,precision:3},{field:'shoppers',id:'shoppers',label:'购物人次',unit:'万人次',scale:1e4,precision:2},{field:'spendUsd',id:'spend',label:'客单价',unit:'美元/人次',scale:1,precision:0}];
 let data,rows,pending;
 const state={scope:'total',range:'12',mode:'combo'};
 function fmt(n,d=1){return M.finite(n)?n.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
 function pct(v){return M.finite(v)?(v>0?'+':'')+fmt(v,1)+'%':'—';}
 function selected(){return M.series(rows,state.scope,state.range);}
 function stamp(){if(root.classList.contains('on'))$('asof').textContent=data?'韩国月度截至 '+data.dataAsOf:'韩国月度数据读取中…';}
 function render(){
  if(!data)return;const view=selected(),latest=view.at(-1);
  $('kr-period').textContent=(latest?.period||'暂无数据')+' · '+M.scopes[state.scope]+' · 核对 '+data.updatedAt;
  for(const m of metrics){
   const val=latest?.[m.field];
   $('kr-'+m.id).textContent=fmt(M.finite(val)?val/m.scale:null,m.precision);
   const change=latest?.[m.field+'Yoy'];$('kr-'+m.id+'-yoy').textContent='同比测算 '+pct(change);$('kr-'+m.id+'-yoy').className=change>0?'up':change<0?'down':'';
   const title=m.label+(state.mode==='combo'?'与同比':state.mode==='change'?'同比':'走势');$('kr-'+m.id+'-title').textContent=title;
   SiteCharts.drawPaired($('kr-'+m.id+'-chart'),view.map((r,x)=>({period:r.period.slice(2),x,value:M.finite(r[m.field])?r[m.field]/m.scale:null,change:r[m.field+'Yoy']??null})),{name:m.label,mode:state.mode,unit:m.unit,precision:m.precision,changeUnit:'%',changePrecision:1,gap:1.5,trimEmpty:false,changeLabel:'同比测算'});
  }
  $('kr-table').innerHTML='<thead><tr>'+['月份','销售额（亿美元）','金额同比测算','购物人次（万）','人次同比测算','客单价（美元/人次）','客单价同比测算'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+view.slice().reverse().map(r=>'<tr><td>'+esc(r.period)+'</td>'+metrics.map(m=>'<td class="num">'+fmt(M.finite(r[m.field])?r[m.field]/m.scale:null,m.precision)+'</td><td class="num">'+pct(r[m.field+'Yoy'])+'</td>').join('')+'</tr>').join('')+'</tbody>';
  root.dataset.status='ready';$('kr-status').textContent='';$('kr-retry').hidden=true;if(root.classList.contains('on'))$('rows-note').textContent='韩国月度 '+data.periodCount+' 期 · 三类顾客 '+data.count+' 条';stamp();
 }
 function source(){
  if(!data)return;
  $('srcbox').innerHTML='<h3>韩国免税数据来源</h3><div class="row"><b>原始机构</b><span>韩国免税店协会</span></div><div class="row"><b>数据期间</b><span>'+esc(data.coverageStart+'—'+data.dataAsOf)+'</span></div><div class="row"><b>核对日期</b><span>'+esc(data.updatedAt)+'</span></div><div class="row"><b>精度</b><span>部分原始回执含缩略值；同比和客单价为测算，独立发布日期未取得</span></div>'+data.sources.map(s=>'<p>'+esc(s.name)+' · <a href="'+esc(s.url)+'" target="_blank" rel="noopener">来源 ↗</a></p>').join('')+'<p><a href="data-notes.html#dutyfree" target="_blank" rel="noopener">完整来源与口径 ↗</a></p><div class="closebtn"><button class="srcbtn" id="kr-close-source">关闭</button></div>';
  $('srcmodal').showModal();$('kr-close-source').onclick=()=>$('srcmodal').close();
 }
 async function load(){
  if(pending)return pending;if(data){render();return;}root.dataset.status='loading';$('kr-status').textContent='正在读取韩国免税数据…';$('kr-retry').hidden=true;stamp();
  pending=(async()=>{try{
   const response=await fetch('data/dutyfree/korea.json',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);
   const next=await response.json(),derived=M.derive(next);if(next.currency!=='USD'||next.count!==derived.length||!derived.length)throw Error('数据校验失败');
   data=next;rows=derived;render();
  }catch(e){root.dataset.status='error';$('kr-status').textContent='韩国免税数据读取失败，请重试。';$('kr-retry').hidden=false;if(root.classList.contains('on'))$('asof').textContent='韩国免税数据读取失败';}finally{pending=null;}})();return pending;
 }
 function activate(){if(root.classList.contains('on'))load();}
 for(const [id,key]of [['kr-scope','scope'],['kr-range','range'],['kr-mode','mode']])$(id).onchange=e=>{state[key]=e.target.value;render();};
 root.querySelectorAll('[data-chart-labels]').forEach(input=>input.onchange=render);
 $('kr-source').onclick=source;$('kr-retry').onclick=load;
 $('kr-export').onclick=()=>{if(rows)D.downloadCsv(M.exports(selected()),'韩国免税_'+M.scopes[state.scope]+'_'+state.range+'.csv');};
 $('kr-export-all').onclick=()=>{if(rows)D.downloadCsv(M.exports(rows),'韩国免税_全部顾客分类.csv');};
 document.addEventListener('dutyfree:viewchange',activate);addEventListener('dutyfree:viewchange',activate);addEventListener('hashchange',activate);
 addEventListener('DOMContentLoaded',activate,{once:true});activate();
})();
