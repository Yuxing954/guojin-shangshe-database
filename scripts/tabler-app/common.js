const cache = new Map();
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const num = (value, digits = 2) => numeric(value) === null ? '—' : numeric(value).toLocaleString('zh-CN', {maximumFractionDigits: digits});
export const numeric = value => value == null || String(value).trim() === '' ? null : Number.isFinite(Number(String(value).replace(/,/g,''))) ? Number(String(value).replace(/,/g,'')) : null;
const paths = {
 home:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 chart:'M4 3v17h17M8 16v-5m5 5V6m5 10V9',
 globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',
 building:'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M3 21h18',
 document:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',
 trend:'M3 20h18M4 15l6-6 4 3 6-8M15 4h5v5',
 search:'M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0M16 16l5 5',
 download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
 arrow:'M5 12h14m-6-6 6 6-6 6',
 external:'M14 3h7v7M21 3l-11 11M10 3H4v17h17v-6',
 calendar:'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14M9 14h1m4 0h1m-6 3h1',
 filter:'M4 5h16l-6 7v7l-4 2v-9z',
 menu:'M4 6h16M4 12h16M4 18h16',
 moon:'M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10',
 sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 1.4 1.4m10 10 1.4 1.4M5.6 18.4 1.4-1.4m10-10 1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 database:'M4 6a8 3 0 1 0 16 0 8 3 0 1 0-16 0M4 6v6a8 3 0 0 0 16 0V6M4 12v6a8 3 0 0 0 16 0v-6',
 book:'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15',
 hotel:'M4 21V5h10v16M14 10h6v11M3 21h18M7 9h4M7 13h4M7 17h4',
 bag:'M5 8h14l1 13H4L5 8ZM9 8V6a3 3 0 0 1 6 0v2',
 dining:'M5 3v6a3 3 0 0 0 6 0V3M8 3v18M18 3v18M18 3c-5 4-4 10 0 10',
 ship:'M4 16l-2-3 10-4 10 4-2 3M7 11V5h10v6M12 5V2M3 20c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0',
 people:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 3a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-4',
 close:'m6 6 12 12M6 18 18 6',
 copy:'M9 9h11v12H9zM5 15H3V3h12v2',
 check:'m5 12 4 4L19 6',
 refresh:'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2'
};
export function icon(name) { return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.document}"/></svg>`; }
export function safeHref(value) {
 if(typeof value!=='string'||!value.trim())return '';
 try {const u = new URL(value, location.href);return ['http:','https:'].includes(u.protocol) && !u.username && !u.password ? u.href : '';} catch {return '';}
}
export async function read(path, type = 'json') {
 const key = type + ':' + path;
 if (!cache.has(key)) cache.set(key, (async () => {const response = await fetch(path, {signal: AbortSignal.timeout(45000)});if (!response.ok) throw new Error(`读取失败 (${response.status})`);return type === 'json' ? response.json() : response.text();})().catch(error=>{cache.delete(key);throw error;}));
 return cache.get(key);
}
export const json = path => read(path);
export const text = path => read(path, 'text');
export function parseCSV(input) {
 const lines=[];let row=[],part='',quoted=false;input=String(input).replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){const c=input[i];if(quoted){if(c==='"'&&input[i+1]==='"'){part+='"';i++;}else if(c==='"')quoted=false;else part+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(part);part='';}else if(c==='\n'){row.push(part.replace(/\r$/,''));lines.push(row);row=[];part='';}else part+=c;}
 if(part||row.length){row.push(part.replace(/\r$/,''));lines.push(row);}const headers=lines.shift()||[];return lines.filter(row=>row.some(Boolean)).map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]??''])));
}
export function csv(rows, headers = [...new Set(rows.flatMap(row => Object.keys(row)))]) {
 const quote = v => {let x = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');if (/^[\s]*[=+@]/.test(x)||/^[\s]*-(?!\d+(?:\.\d+)?\s*$)/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
 return '\uFEFF'+[headers,...rows.map(row=>headers.map(key=>row[key]??''))].map(row=>row.map(quote).join(',')).join('\r\n');
}
export function download(name, content, mime = 'text/csv;charset=utf-8') {const url = URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
export function setHeader({title,pretitle='',actions=''}) {document.getElementById('page-title').textContent=title;document.getElementById('page-pretitle').textContent=pretitle;document.getElementById('page-actions').innerHTML=actions;document.title=title+' · 国金商社数据库';}
export function url(key,value) {const u=new URL(location.href);if(value==null||value==='')u.searchParams.delete(key);else u.searchParams.set(key,value);history.replaceState(null,'',u.pathname+u.search+u.hash);}
export function dialog(title, html) {
 const d=document.createElement('dialog');d.className='research-dialog';d.setAttribute('aria-label',title);d.innerHTML=`<div class="modal-content"><div class="modal-header"><h3 class="modal-title">${esc(title)}</h3><button type="button" class="btn-close" aria-label="关闭"></button></div><div class="modal-body">${html}</div></div>`;document.body.append(d);const previous=document.activeElement;
 d.querySelector('.btn-close').onclick=()=>d.close();d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}};d.onclose=()=>{d.remove();previous?.focus();};d.showModal();return d;
}
export function sourceDialog(title,sources) {
 const list=Array.isArray(sources)?sources:Object.values(sources||{});
 return dialog(title,list.length?`<div class="list-group list-group-flush">${list.map(s=>{if(typeof s==='string')s={name:s};const link=safeHref(s.url||s.href||s.sourceUrl||s.file);return `<div class="list-group-item px-0"><div class="fw-medium mb-2">${esc(s.name||s.title||s.publisher||s.source||'来源记录')}</div>${Object.entries(s).filter(([k,v])=>v!=null&&v!==''&&!['url','href','name','title'].includes(k)).map(([k,v])=>`<div class="small text-secondary text-break mb-1">${esc(({publisher:'发布机构',provider:'转引机构',publishedAt:'发布日期',releaseDate:'发布日期',retrievedAt:'核对时间',quality:'来源状态',note:'口径',pdf_page:'PDF页码',locator:'原文位置',file:'文件',sourceType:'类型'})[k]||k)}：${esc(typeof v==='object'?JSON.stringify(v):v)}</div>`).join('')}${link?`<a href="${esc(link)}" class="btn btn-sm mt-2" target="_blank" rel="noopener">${icon('external')}查看来源</a>`:''}</div>`;}).join('')}</div>`:'<div class="empty"><p class="empty-title">暂无来源记录</p></div>');
}
export function loading(container,label='正在读取数据') {container.innerHTML=`<div class="card"><div class="card-body py-5 text-center"><div class="spinner-border text-primary mb-3" role="status"></div><div class="text-secondary">${esc(label)}</div></div></div>`;}
export function failure(container,error,retry) {container.innerHTML=`<div class="card"><div class="empty"><p class="empty-title">数据暂时无法读取</p><p class="empty-subtitle text-secondary">${esc(error?.message||'请稍后重试')}</p><div class="empty-action"><button type="button" class="btn btn-primary">${icon('refresh')}重试</button></div></div></div>`;container.querySelector('button').onclick=retry;}
export const empty = message => `<div class="empty py-5"><p class="empty-title">${esc(message||'暂无匹配记录')}</p></div>`;
export function options(items,selected) {return items.map(item=>{const [value,label]=Array.isArray(item)?item:[item,item];return `<option value="${esc(value)}"${String(value)===String(selected)?' selected':''}>${esc(label)}</option>`;}).join('');}
export function tabs(items,selected,label='分类') {return `<div class="card mb-3"><div class="card-header"><ul class="nav nav-tabs card-header-tabs" aria-label="${esc(label)}">${items.map(([id,name,href])=>`<li class="nav-item"><a class="nav-link${id===selected?' active':''}" href="${esc(href)}"${id===selected?' aria-current="page"':''}>${esc(name)}</a></li>`).join('')}</ul></div></div>`;}
const chartConfigs=new WeakMap();
const chartObserver=typeof ResizeObserver==='undefined'?null:new ResizeObserver(entries=>{
 for(const {target,contentRect} of entries){const last=chartConfigs.get(target);
 if(last && contentRect.width>0 && Math.abs(Math.max(260,contentRect.width)-last.width)>1)chart(target,last.points,last.config);}
});
export function chart(element,points,config={}) {
 const colors=['var(--tblr-primary)','var(--tblr-azure)','var(--tblr-orange)','var(--tblr-purple)'];
 const series=config.series||[{name:config.label||'',points,color:config.color||colors[0]}];
 const all=series.flatMap(s=>s.points||[]), values=all.map(p=>numeric(p.value)).filter(v=>v!==null);
 if(!values.length){chartConfigs.delete(element);chartObserver?.unobserve(element);element.innerHTML=empty('暂无可绘制数据');return;}
 const W=Math.max(260,Math.round(element.getBoundingClientRect().width)||760),H=W<500?224:270,L=W<500?44:62,R=14,T=18,B=36,pw=W-L-R,ph=H-T-B;
 let lo=Math.min(...values),hi=Math.max(...values);if(hi===lo){lo-=Math.max(1,Math.abs(lo)*.1);hi+=Math.max(1,Math.abs(hi)*.1);}const gap=(hi-lo)*.12;lo-=gap;hi+=gap;
 const periodKeys=[...new Set(series.flatMap(s=>(s.points||[]).map(p=>String(p.period||p.label||p.date||''))))].sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
 const x=key=>L+(periodKeys.indexOf(String(key)))*pw/Math.max(1,periodKeys.length-1),y=v=>T+(hi-v)*ph/(hi-lo),label=p=>String(p.label||p.period||p.date||'');
 let grid='';for(let i=0;i<5;i++){const value=lo+(hi-lo)*i/4,cy=y(value);grid+=`<line x1="${L}" y1="${cy}" x2="${W-R}" y2="${cy}" stroke="var(--tblr-border-color)" stroke-dasharray="3 3"/><text x="${L-10}" y="${cy+4}" text-anchor="end">${esc(num(value,config.precision??1))}</text>`;}
 const intervals=W<500?2:4;
 const ticks=Array.from(new Set(Array.from({length:intervals+1},(_,i)=>Math.round(i*(periodKeys.length-1)/intervals))));
 grid+=ticks.map(i=>`<text x="${x(periodKeys[i])}" y="${H-12}" text-anchor="${i===0?'start':i===periodKeys.length-1?'end':'middle'}">${esc(periodKeys[i].replace(/^(?:19|20)(\d\d)([WQ])/,'$1$2').replace(/^(?:19|20)(\d\d)-(\d{2})$/,(s,y,m)=>y+'M'+Number(m)).replace(/\s*[·|].*/,''))}</text>`).join('');
 const traces=series.map((s,index)=>{let commands=[],on=false;const dots=[];for(const p of s.points||[]){const v=numeric(p.value);if(v===null){on=false;continue;}const cx=x(p.period||p.label||p.date||''),cy=y(v);commands.push(`${on?'L':'M'}${cx},${cy}`);on=true;const desc=`${s.name?s.name+' · ':''}${label(p)}：${num(v,config.precision??2)} ${config.unit||p.unit||''}`;dots.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="${s.color||colors[index%4]}" tabindex="0" role="img" aria-label="${esc(desc)}"><title>${esc(desc)}</title></circle>`);}return `<path d="${commands.join(' ')}" fill="none" stroke="${s.color||colors[index%4]}" stroke-width="2" stroke-linejoin="round"/>${dots.join('')}`;}).join('');
 element.innerHTML=`<div class="data-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(config.label||'历史趋势')}，单位${esc(config.unit||'')}"><g class="chart-grid">${grid}</g>${traces}</svg><div class="chart-readout small text-secondary" aria-live="polite">${esc(config.unit?'单位：'+config.unit:'')}</div></div>${series.length>1?`<div class="d-flex justify-content-center flex-wrap gap-3 small mt-2">${series.map((s,i)=>`<span><span class="legend" style="background:${s.color||colors[i%4]}"></span>${esc(s.name)}</span>`).join('')}</div>`:''}`;
 const svg=element.querySelector('svg'), wrap=element.querySelector('.data-chart'), out=element.querySelector('.chart-readout');
 const tooltip=document.createElement('div');tooltip.className='chart-tooltip';tooltip.hidden=true;wrap.append(tooltip);
 const dots=Array.from(svg.querySelectorAll('circle'));
 const byX=new Map();
 for(const dot of dots){
   const x=Number(dot.getAttribute('cx'));if(!byX.has(x))byX.set(x,[]);byX.get(x).push(dot);
   dot.onfocus=()=>show(x);dot.onblur=hide;
 }
 const ticksX=Array.from(byX.keys()).sort((a,b)=>a-b);
 function show(x){
   const group=byX.get(x);
   tooltip.textContent=group.map(dot=>dot.getAttribute('aria-label')).join('\n');
   tooltip.hidden=false;
   tooltip.style.left=Math.max(0,Math.min(wrap.clientWidth-tooltip.offsetWidth,x/W*wrap.clientWidth+10))+'px';
   tooltip.style.top=Math.max(0,Math.min(svg.clientHeight-tooltip.offsetHeight,Number(group[0].getAttribute('cy'))/H*svg.clientHeight-tooltip.offsetHeight-6))+'px';
   out.textContent=tooltip.textContent;
 }
 function hide(){tooltip.hidden=true;out.textContent=config.unit?'单位：'+config.unit:'';}
 function track(e){const rect=svg.getBoundingClientRect(),px=(e.clientX-rect.left)*W/rect.width;show(ticksX.reduce((a,b)=>Math.abs(b-px)<Math.abs(a-px)?b:a));}
 svg.onpointermove=track;svg.onclick=track;svg.onpointerleave=hide;svg.onkeydown=e=>{if(e.key==='Escape')hide();};
 chartConfigs.set(element,{points,config,width:W});chartObserver?.observe(element);
 return {svg:element.querySelector('svg'),points};
}
export function tableCard({title,columns,rows,footer='',actions='',id=''}) {
 return `<div class="card"${id?` id="${esc(id)}"`:''}><div class="card-header"><h3 class="card-title">${esc(title)}</h3><div class="card-actions">${actions}</div></div><div class="table-responsive"><table class="table table-hover card-table table-vcenter"><thead><tr>${columns.map(c=>`<th${c.numeric?' class="text-end"':''}>${esc(c.label||c.key)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(c=>`<td${c.numeric?' class="text-end text-nowrap"':''}>${c.render?c.render(row[c.key],row):esc(row[c.key]??'—')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${columns.length}" class="text-center text-secondary py-5">暂无匹配记录</td></tr>`}</tbody></table></div>${footer?`<div class="card-footer">${footer}</div>`:''}</div>`;
}
export function metricCard({label,unit,value,frequency,href,period,change,changeLabel,changeUnit='%',changeText,basis,points}){
 const values=(points||[]).map(p=>numeric(p.value)), valid=values.filter(v=>v!==null);
 const lo=Math.min(...valid),hi=Math.max(...valid);
 let path='',pen=false;
 values.forEach((v,i)=>{
   if(v===null){pen=false;return;}
   const x=200*i/Math.max(1,values.length-1),y=hi===lo?16:30-28*(v-lo)/(hi-lo);
   path+=(pen?' L':' M')+x+' '+y;pen=true;
 });
 const tone=change>0?'text-red':change<0?'text-green':'text-secondary';
 return `<div class="card metric-card w-100"><div class="card-body"><div class="d-flex align-items-center">${href?'<a class="subheader text-reset" href="'+esc(href)+'">'+esc(label)+'</a>':'<span class="subheader">'+esc(label)+'</span>'}<span class="ms-auto small text-secondary">${esc(frequency||'')}</span></div><div class="d-flex align-items-baseline gap-2 mt-2"><strong class="h1 mb-0">${esc(value)}</strong><span class="text-secondary small">${esc(unit)}</span></div><div class="small ${tone}">${changeText!=null?esc(changeText):changeLabel?esc(changeLabel)+' '+(numeric(change)===null?'—':(change>0?'+':'')+num(change,1)+esc(changeUnit)):''}</div><div class="metric-period small text-secondary mt-2">${esc([period,basis].filter(Boolean).join(' · ')||'暂无数据')}</div></div>${points?'<div class="px-3 pb-2 desk-spark" aria-hidden="true">'+(valid.length>1?'<svg width="100%" height="100%" viewBox="0 0 200 32" preserveAspectRatio="none"><path fill="none" stroke="currentColor" stroke-width="1.8" vector-effect="non-scaling-stroke" d="'+path+'"/></svg>':'')+'</div>':''}</div>`;
}

export function filterBar(fields,action){
 return '<div class="card mb-3"><div class="card-body py-3"><div class="row g-2 align-items-end">'+fields+'<div class="col-auto ms-lg-auto">'+action+'</div></div></div></div>';
}
export function chartCard(title,subtitle,plot){
 return '<section class="card h-100"><header class="card-header"><div><h3 class="card-title">'+esc(title)+'</h3>'+ (subtitle?'<div class="text-secondary small">'+esc(subtitle)+'</div>':'')+'</div></header><div class="card-body">'+plot+'</div></section>';
}
export const api={filterBar,chartCard,metricCard,esc,num,numeric,icon,json,text,read,parseCSV,csv,download,setHeader,url,dialog,sourceDialog,loading,failure,empty,options,tabs,chart,tableCard,safeHref};
