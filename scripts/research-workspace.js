(function(){
 'use strict';
 const U=window.SiteUI,M=window.ResearchWorkspaceModel;if(!U||!M||window.ResearchWorkspace)return;
 const file=location.pathname.split('/').pop(),entry=U.registry[file];if(entry?.kind!=='page')return;
 const storageKey='gj-research-views-v1',initial=M.presentation(new URLSearchParams(location.search).get('ws')),chartStates=initial.charts||{};
 let density=initial.density||'standard',sync=!!initial.sync,toastTimer,scheduled=false,dialog,toolbar;
 const esc=M.escape,charts=new WeakMap(),tables=new WeakMap(),restoredCharts=new Set();
 function notify(text){let el=document.getElementById('workspace-feedback');if(!el){el=document.createElement('div');el.id='workspace-feedback';el.className='site-workspace-feedback';el.setAttribute('role','status');document.body.append(el);}el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4000);}
 async function copy(text,html){try{if(html&&window.ClipboardItem&&navigator.clipboard?.write){await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);}else await navigator.clipboard.writeText(text);notify('已复制');return true;}catch{notify('复制未完成，请允许剪贴板访问或使用下载');return false;}}
 function download(body,name,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function presentation(){return {v:1,density,sync,charts:chartStates};}
 function publicHref(value=location.href){const href=M.publicURL(value,location.href,U.registry);if(!href)return '';const u=new URL(href,location.href);u.searchParams.set('ws',JSON.stringify(presentation()));return u.href;}
 function effectiveHref(){if(file==='industry.html'){const frame=[...document.querySelectorAll('.industry-panel:not([hidden]) iframe')][0];try{if(frame?.contentWindow?.ResearchWorkspace)return frame.contentWindow.ResearchWorkspace.href();}catch{}}return publicHref();}
 function savePresentation(){const u=new URL(location.href);u.searchParams.set('ws',JSON.stringify(presentation()));history.replaceState(history.state,'',u);}
 function stored(){try{const data=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(data)?data.filter(v=>v?.name&&M.publicURL(v.href,location.href,U.registry)).slice(0,50):[];}catch{return [];}}
 function writeViews(views){try{localStorage.setItem(storageKey,JSON.stringify(views));return true;}catch{notify('本设备保存不可用，请复制视图链接');return false;}}
 function viewDialog(){
  const views=stored();dialog.querySelector('[data-view-list]').innerHTML=views.length?views.map((v,i)=>'<li><a href="'+esc(M.publicURL(v.href,location.href,U.registry))+'">'+esc(v.name)+'</a><button type="button" data-delete-view="'+i+'" aria-label="删除视图 '+esc(v.name)+'">删除</button></li>').join(''):'<li>尚未保存视图</li>';
  dialog.querySelector('[data-view-name]').value=entry.title;dialog.showModal();
 }
 function init(){
  const main=document.querySelector('.site-main,body>main,body>.wrap');if(!main||document.querySelector('.site-workspace'))return;
  document.body.dataset.density=density;
  if(window.parent===window||new URLSearchParams(location.search).get('embed')!=='1'){
   toolbar=document.createElement('section');toolbar.className='site-workspace';toolbar.setAttribute('aria-label','研究视图工具');
   toolbar.innerHTML='<div class="site-workspace-actions"><button type="button" data-workspace="views">保存 / 打开视图</button><button type="button" data-workspace="share">复制当前视图链接</button><label>密度<select aria-label="工作区密度" data-workspace="density"><option value="standard">标准</option><option value="compact">紧凑</option></select></label><label><input type="checkbox" data-workspace="sync">关联图表联动</label></div><details class="site-context-wrap"><summary>当前筛选</summary><div class="site-context" aria-label="当前筛选条件"></div></details>';
   const header=main.querySelector(':scope > header,:scope > .portal-header,:scope > .hd-header');if(header)header.after(toolbar);else main.prepend(toolbar);toolbar.querySelector('select').value=density;toolbar.querySelector('[data-workspace=sync]').checked=sync;const media=matchMedia('(min-width:761px)'),conditions=toolbar.querySelector('.site-context-wrap');conditions.open=media.matches;media.addEventListener('change',e=>conditions.open=e.matches);
   toolbar.querySelector('[data-workspace=views]').onclick=viewDialog;toolbar.querySelector('[data-workspace=share]').onclick=()=>copy(effectiveHref());
   toolbar.querySelector('select').onchange=e=>{density=e.target.value;document.body.dataset.density=density;savePresentation();propagate();};
   toolbar.querySelector('[data-workspace=sync]').onchange=e=>{sync=e.target.checked;savePresentation();propagate();};
   dialog=document.createElement('dialog');dialog.className='portal-dialog site-views-dialog';dialog.setAttribute('aria-label','保存与打开研究视图');
   dialog.innerHTML='<div class="site-dialog-head"><h2>研究视图</h2><button type="button" data-close>关闭</button></div><p class="portal-note">仅在本设备保存配置；数据随更新变化，不是历史快照。</p><form><label>视图名称<input data-view-name maxlength="60" required></label><button type="submit" class="site-button--primary">保存当前视图</button></form><ul data-view-list></ul><h3>常用研究场景</h3><ul>'+M.presets.map(p=>'<li><a href="'+esc(p.href)+'">'+esc(p.name)+'</a></li>').join('')+'</ul>';
   document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>toolbar.querySelector('[data-workspace=views]').focus());
   dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const name=dialog.querySelector('input').value.trim();if(!name)return;const values=stored(),href=effectiveHref(),old=values.findIndex(v=>v.name===name),v={name,href};if(old>=0)values[old]=v;else values.unshift(v);if(writeViews(values.slice(0,50))){dialog.close();notify('已保存到本设备');}};
   dialog.onclick=e=>{const b=e.target.closest('[data-delete-view]');if(!b)return;const values=stored();values.splice(Number(b.dataset.deleteView),1);if(writeViews(values)){dialog.close();viewDialog();}};
  }
  updateContext();scan();new MutationObserver(queue).observe(main,{childList:true,subtree:true});document.addEventListener('load',e=>{if(e.target.tagName==='IFRAME'){propagate();queue();}},true);
  document.addEventListener('change',e=>{if(e.target.matches('[data-chart-labels],[data-value-kind]')){const scope=e.target.closest('article,.board-panel,.portal-panel,.hd-tier-trend');scope?.querySelectorAll('[data-research-chart]').forEach(host=>{const key=chartKey(host,host._researchChart?.options||{}),field=e.target.dataset.valueKind==='change'?'change':'labels';chartStates[key]={...(chartStates[key]||{}),[field]:e.target.checked};});savePresentation();}queue();setTimeout(updateContext,0);});document.addEventListener('input',U.debounce(updateContext,250));document.addEventListener('click',()=>setTimeout(updateContext,0));addEventListener('hashchange',updateContext);
  // Source dialogs retain their native content and model; close restores the trigger and scroll position.
  let trigger;document.addEventListener('click',e=>{if(e.target.closest('dialog'))return;trigger=e.target.closest('button,a');},true);
  document.querySelectorAll('dialog:not(.site-views-dialog)').forEach(d=>{d.addEventListener('close',()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true});});});
  addEventListener('pagehide',()=>{try{sessionStorage.setItem('gj-scroll:'+location.pathname+location.search+location.hash,String(scrollY));}catch{}});
  if(performance.getEntriesByType('navigation')[0]?.type==='back_forward'){try{const y=Number(sessionStorage.getItem('gj-scroll:'+location.pathname+location.search+location.hash));if(y)setTimeout(()=>scrollTo(0,y),500);}catch{}}
 }
 const names={q:'搜索',company:'公司',country:'国家',indicator:'指标',metric:'指标',kind:'样本',frequency:'频率',from:'起始',to:'截至',quarter:'截至',period:'期间',region:'地区',category:'档次',operation:'经营模式',currency:'币种',peers:'对比公司',peerRegion:'对比地区',peerMetric:'对比指标',display:'显示',date:'日期',sector:'板块',format:'资料类型'};
 function updateContext(){if(!toolbar)return;const host=toolbar.querySelector('.site-context'),p=new URLSearchParams(location.search),items=[];for(const [k,label] of Object.entries(names)){const value=p.get(k);if(!value)continue;const select=[...document.querySelectorAll('select')].find(s=>s.value===value&&!s.closest('.site-workspace'));const aliases={jinjiang:'锦江酒店',hworld:'华住集团',btg:'首旅酒店',atour:'亚朵集团',marriott:'万豪',hilton:'希尔顿',hyatt:'凯悦',ihg:'洲际',CN:'中国',US:'美国',CNY:'人民币',USD:'美元',value:'数值',change:'同比',revpar:'RevPAR',adr:'ADR',occ:'OCC',all:'全部指标'};items.push([k,label,select?.selectedOptions[0]?.textContent||value.split(',').map(v=>aliases[v]||v).join('、')]);}const html=items.map(([k,label,value])=>'<button type="button" class="site-button site-context-chip" data-remove="'+esc(k)+'" aria-label="移除'+label+'筛选">'+esc(label+'：'+value)+' ×</button>').join('');if(host.innerHTML!==html)host.innerHTML=html;host.closest('details').hidden=!items.length;const caption=host.closest('details').querySelector('summary'),text='当前筛选 · '+items.length+' 项';if(caption.textContent!==text)caption.textContent=text;host.onclick=e=>{const b=e.target.closest('[data-remove]');if(!b)return;const u=new URL(location.href);u.searchParams.delete(b.dataset.remove);u.searchParams.delete('page');location.href=u.href;};}
 function propagate(){document.querySelectorAll('iframe').forEach(frame=>{try{frame.contentWindow?.ResearchWorkspace?.setPreferences({density,sync});}catch{}});}
 function setPreferences(p){density=p.density==='compact'?'compact':'standard';sync=!!p.sync;document.body.dataset.density=density;}
 function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;scan();updateContext();});}
 function visible(el){return !!el.getClientRects().length&&!el.closest('[hidden]');}
 function tableData(table){
  const originalHeaders=[...table.querySelectorAll('thead tr:last-child th,thead tr:last-child td')].map(c=>c.textContent.trim());
  const cells=[...table.querySelectorAll('tbody tr')].map(r=>[...r.cells].map(cell=>{const c=cell.cloneNode(true),notes=[...c.querySelectorAll('small')].map(n=>n.textContent.trim()).filter(Boolean);c.querySelectorAll('small,.oh-source').forEach(n=>n.remove());return {value:c.textContent.trim(),note:notes.join(' · ')};}));
  const headers=[],columns=[];originalHeaders.forEach((name,i)=>{columns.push({index:i,part:'value'});headers.push(name);if(cells.some(r=>r[i]?.note)){columns.push({index:i,part:'note'});headers.push(name+' / 补充');}});
  return {headers,rows:cells.map(row=>columns.map(c=>row[c.index]?.[c.part]??'')),textColumns:headers.map((h,i)=>/代码|code|symbol/i.test(h)?i:-1).filter(i=>i>=0)};
 }

 function scan(){
  const linked=document.querySelectorAll('[data-research-chart]');let hasGroup=[...linked].some(h=>h._researchChart?.options.syncGroup);if(file==='industry.html')for(const f of document.querySelectorAll('.industry-panel:not([hidden]) iframe')){try{hasGroup||=[...f.contentDocument.querySelectorAll('[data-research-chart]')].some(h=>h._researchChart?.options.syncGroup);}catch{}}if(toolbar)toolbar.querySelector('[data-workspace=sync]').closest('label').hidden=!hasGroup;
  document.querySelectorAll('.site-workspace button,.site-chart-tools button,.site-table-tools button,.site-views-dialog button,.site-chart-dialog button,.site-chart-export').forEach(b=>b.classList.add('site-button'));
  document.querySelectorAll('.site-table-tools').forEach(tool=>{if(tool._table&&!tool._table.isConnected)tool.remove();});
  document.querySelectorAll('[data-research-chart]').forEach(host=>{if(host._researchChart)enhanceChart(host,host._researchChart.rows,host._researchChart.options);});
  document.querySelectorAll('main table,.site-main table').forEach(table=>{
   if(tables.has(table)||table.closest('[data-workspace-table],.product-sheet,[data-product-page]')||!table.querySelector('thead')||!table.querySelector('tbody tr'))return;
   const tools=document.createElement('div');tools.className='site-table-tools';tools._table=table;const b=document.createElement('button');b.type='button';b.className='site-button';b.textContent='复制本页表格';b.onclick=()=>{const d=tableData(table),payload=M.clipboard(d.headers,d.rows,d.textColumns);copy(payload.text,payload.html);};tools.append(b);table.parentElement.classList.contains('site-table-scroll')?table.parentElement.before(tools):table.before(tools);tables.set(table,tools);
   table.addEventListener('click',e=>{if(e.target.closest('a,button,input,select'))return;const row=e.target.closest('tbody tr');if(row){table.querySelectorAll('[aria-selected]').forEach(r=>r.removeAttribute('aria-selected'));row.setAttribute('aria-selected','true');}});
  });
  document.querySelectorAll('svg[data-chart-ready]').forEach(svg=>{if(svg.closest('[data-research-chart]')||svg.dataset.workspaceExport)return;svg.dataset.workspaceExport='true';const b=document.createElement('button');b.type='button';b.className='site-chart-export';b.textContent='导出图表 PNG';b.onclick=()=>exportPNG(svg,{name:svg.getAttribute('aria-label')||entry.title,source:'来源与口径：见本页来源入口'},[]).catch(e=>notify(e.message));(svg.closest('.site-chart-scroll')||svg).after(b);});
 }
 function chartKey(host,opt){return (host.id||opt.name||'chart').slice(0,150);}
 function enhanceChart(host,rows,opt){
  const svg=host.querySelector('svg');if(!svg||charts.get(host)?.svg===svg)return;
  const key=chartKey(host,opt),saved=chartStates[key]||{},tools=document.createElement('div');tools.className='site-chart-tools';tools.setAttribute('aria-label',(opt.name||'图表')+'研究操作');
  tools.innerHTML='<button type="button" data-action="table" aria-pressed="'+!!saved.table+'">图表 / 明细</button><button type="button" data-action="copy">复制图中数据</button><button type="button" data-action="csv">导出图中数据</button><button type="button" data-action="png">导出图表 PNG</button><button type="button" data-action="full">放大</button>';
  const frame=document.createElement('div');frame.className='site-table-scroll';frame.dataset.workspaceTable='true';frame.hidden=!saved.table;
  const d=M.chartTable(rows,opt),payload=M.clipboard(d.headers,d.rows,d.textColumns);frame.innerHTML=payload.html+'<p class="portal-note">图中当前系列与期间 · 保留输入精度 · 缺失留空</p>';
  host.append(tools,frame);charts.set(host,{svg});
  if(!restoredCharts.has(key)){restoredCharts.add(key);const scope=host.closest('article,.board-panel,.portal-panel,.hd-tier-trend');for(const [selector,field] of [['[data-chart-labels],[data-value-kind="value"]','labels'],['[data-value-kind="change"]','change']]){const input=scope?.querySelector(selector);if(input&&typeof saved[field]==='boolean'&&input.checked!==saved[field]){input.checked=saved[field];setTimeout(()=>input.isConnected&&input.dispatchEvent(new Event('change',{bubbles:true})),0);}}}
  if(saved.table)svg.hidden=true;
  tools.onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
   if(a==='table'){frame.hidden=!frame.hidden;svg.hidden=!frame.hidden;b.setAttribute('aria-pressed',String(!frame.hidden));chartStates[key]={...(chartStates[key]||{}),table:!frame.hidden};savePresentation();}
   if(a==='copy')await copy(payload.text,payload.html);
   if(a==='csv'){download(M.csv(d.headers,d.rows),filename(opt,rows)+'.csv','text/csv;charset=utf-8');notify('已导出图中当前系列与期间');}
   if(a==='png'){b.disabled=true;try{await exportPNG(svg,opt,rows);}catch(e){notify(e.message);}finally{b.disabled=false;}}
   if(a==='full'){const panel=document.createElement('dialog');panel.className='portal-dialog site-chart-dialog';panel.setAttribute('aria-label',opt.name||'图表');panel.innerHTML='<div class="site-dialog-head"><h2>'+esc(opt.name||'图表')+'</h2><button>关闭</button></div>';const clone=svg.cloneNode(true);clone.hidden=false;clone.removeAttribute('data-chart-ready');clone.dataset.chartStatic='true';clone.querySelectorAll('.site-chart-guide,.site-legacy-markers').forEach(n=>n.remove());panel.append(clone);document.body.append(panel);panel.querySelector('button').onclick=()=>panel.close();panel.addEventListener('close',()=>{panel.remove();b.focus();});panel.showModal();}
  };
 }
 function filename(opt,rows){return ((opt.name||entry.title)+'_'+(rows[0]?.period||'当前')+'_'+(rows.at(-1)?.period||'视图')).replace(/[<>:"/\\|?*]/g,'_').slice(0,150);}
 async function exportPNG(svg,opt,rows){
  const clone=svg.cloneNode(true),original=[svg,...svg.querySelectorAll('*')],cloned=[clone,...clone.querySelectorAll('*')];
  const properties=['fill','stroke','stroke-width','stroke-dasharray','font-size','font-family','font-weight','text-anchor','opacity','visibility'];
  original.forEach((node,i)=>{const style=getComputedStyle(node);for(const p of properties)cloned[i].style.setProperty(p,style.getPropertyValue(p));});
  clone.hidden=false;clone.style.display='block';clone.querySelectorAll('.site-chart-guide,.site-legacy-markers').forEach(n=>n.remove());clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const box=svg.viewBox.baseVal,w=1200,h=Math.round(w*(box.height||340)/(box.width||900)),scale=2;clone.setAttribute('width',w);clone.setAttribute('height',h);
  const image=new Image(),url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('图表图片生成失败，请重试'));image.src=url;});
   const canvas=document.createElement('canvas'),measure=document.createElement('canvas').getContext('2d');
   const lines=(text,font)=>{measure.font=font;const out=[];let line='';for(const c of String(text)){if(measure.measureText(line+c).width>w-64){out.push(line);line='';}line+=c;}out.push(line);return out;};
   const title=lines(opt.name||entry.title,'bold 25px sans-serif'),subtitle=lines([opt.unit?'单位：'+opt.unit:'',rows.length?'数据期间：'+rows[0].period+' — '+rows.at(-1).period:'',opt.basis||''].filter(Boolean).join(' · '),'16px sans-serif'),source=lines('来源：'+(opt.source||'见当前视图来源入口；来源未随图表数据提供'),'15px sans-serif');
   const series=rows.reduce((a,r)=>(r.values||[]).length>a.length?r.values:a,[]),legend=series.map(v=>({name:v.name,color:opt.seriesColors?.[v.id||v.name]||U.seriesColor(v.id||v.name||opt.name)}));
   let lx=32,ly=0;measure.font='16px sans-serif';for(const v of legend){const width=measure.measureText(v.name).width+60;if(lx+width>w-32){lx=32;ly+=28;}v.x=lx;v.y=ly;lx+=width;}
   const top=32+title.length*30+12+subtitle.length*24+20,legendY=top+h+24,sourceY=legendY+(legend.length?ly+32:0)+10,total=sourceY+source.length*23+32;
   canvas.width=w*scale;canvas.height=total*scale;const c=canvas.getContext('2d');c.scale(scale,scale);c.fillStyle='#fff';c.fillRect(0,0,w,total);c.fillStyle=U.colors[0];c.font='bold 25px sans-serif';title.forEach((t,i)=>c.fillText(t,32,32+i*30));c.fillStyle='#526170';c.font='16px sans-serif';subtitle.forEach((t,i)=>c.fillText(t,32,32+title.length*30+12+i*24));c.drawImage(image,0,top,w,h);
   for(const v of legend){c.strokeStyle=v.color;c.lineWidth=3;c.beginPath();c.moveTo(v.x,legendY+v.y-5);c.lineTo(v.x+24,legendY+v.y-5);c.stroke();c.fillStyle='#26384b';c.fillText(v.name,v.x+32,legendY+v.y);}
   c.font='15px sans-serif';c.fillStyle='#526170';source.forEach((t,i)=>c.fillText(t,32,sourceY+i*23));const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('图表图片生成失败');download(blob,filename(opt,rows)+'.png','image/png');notify('已导出图表 PNG');
  }finally{URL.revokeObjectURL(url);}

 }
 function wrap(c,text,x,y,max,line){let row='';for(const char of String(text)){if(c.measureText(row+char).width>max){c.fillText(row,x,y);row='';y+=line;}row+=char;}c.fillText(row,x,y);}
 window.ResearchWorkspace={href:publicHref,notify,copy,download,enhanceChart,setPreferences,get sync(){return sync;},preserve(u){const old=new URLSearchParams(location.search).get('ws');if(old)u.searchParams.set('ws',old);return u;}};
 document.addEventListener('research:chart',e=>enhanceChart(e.detail.host,e.detail.rows,e.detail.options));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
