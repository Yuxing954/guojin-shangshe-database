(function(){
 'use strict';
 const $=id=>document.getElementById(id),fmt=(v,d=0)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—',pct=(v,d=2)=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(d)+'%':'—';
 const metrics={posts:{name:'新增招聘帖数',unit:'万个',factor:10000},salary:{name:'招聘年均薪资',unit:'万元/年',factor:10000}};
 let data,selected=[],active='posts';const images={};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function chart(key,rows){
  const m=metrics[key],mode=$('mode').value,labels=$('labels').value,d=Number($('digits').value),value=mode!=='change',change=mode!=='value';
  const W=Math.max(1100,rows.length*64+180),H=610,L=90,R=90,T=148,B=492,pw=W-L-R,n=rows.length;
  const xs=i=>L+pw*(i+.5)/n,scale=values=>{const min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1,lo=min<0?min-span*.12:0,hi=max+span*.15,raw=(hi-lo)/4,power=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].find(v=>v*power>=raw)*power;return {min:Math.floor(lo/step)*step,max:Math.ceil(hi/step)*step,step};};
  const vd=scale(rows.map(r=>r[key]/m.factor)),cd=scale(rows.map(r=>r[key+'_yoy']));
  const y=(v,s)=>B-(v-s.min)/(s.max-s.min)*(B-T),blue='#225e87',gold='#a27328',ink='#20354a',gray='#66768a';
  const text=(x,yy,t,size=15,color=ink,anchor='start',extra='')=>'<text x="'+x+'" y="'+yy+'" fill="'+color+'" font-size="'+size+'" text-anchor="'+anchor+'" '+extra+'>'+esc(t)+'</text>';
  let s='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+m.name+'趋势" style="font-family:Microsoft YaHei,Arial,sans-serif;background:white"><title>'+m.name+'，'+rows[0].month+'至'+rows.at(-1).month+'</title><rect width="100%" height="100%" fill="white"/><rect x="36" y="32" width="5" height="32" rx="2" fill="'+blue+'"/>';
  s+=text(56,57,m.name+(mode==='change'?'同比增速':''),26,ink,'start','font-weight="700"')+text(W-36,53,'企业招聘',15,gray,'end');
  s+=text(56,87,'全国  ·  '+rows[0].month+'—'+rows.at(-1).month+'  ·  月度',14,gray);
  if(value)s+='<rect x="'+L+'" y="112" width="16" height="10" rx="2" fill="#b8cedd"/>'+text(L+24,123,m.name+'（'+m.unit+'）',14,gray);
  if(change){const lx=value?L+300:L;s+='<path d="M'+lx+' 117h22" stroke="'+(value?gold:blue)+'" stroke-width="3"/>'+text(lx+30,123,'同比（%）'+(value?' · 右轴':''),14,gray);}
  const primary=value?vd:cd;
  for(let v=primary.min;v<=primary.max+1e-8;v+=primary.step){const yy=y(v,primary);s+='<path d="M'+L+' '+yy+'H'+(W-R)+'" stroke="#e8edf1"/>'+text(L-14,yy+5,fmt(v,Number.isInteger(primary.step)?0:1),14,gray,'end');}
  if(value&&change)for(let v=cd.min;v<=cd.max+1e-8;v+=cd.step)s+=text(W-R+14,y(v,cd)+5,fmt(v,Number.isInteger(cd.step)?0:1),14,gray);
  if(change){const zero=y(0,cd);s+='<path d="M'+L+' '+zero+'H'+(W-R)+'" stroke="#bcc8d2" stroke-dasharray="5 5"/>';}
  rows.forEach((r,i)=>{const x=xs(i),v=r[key]/m.factor,c=r[key+'_yoy'];if(value){const yy=y(v,vd),z=y(0,vd),bw=Math.min(32,pw/n*.5);s+='<rect class="recruitment-value-bar" x="'+(x-bw/2)+'" y="'+Math.min(yy,z)+'" width="'+bw+'" height="'+Math.abs(z-yy)+'" rx="3" fill="#b8cedd"><title>'+r.month+'：'+fmt(r[key],2)+'</title></rect>';}
   s+=text(x,B+29,r.month.slice(2).replace('-','/'),13,gray,'middle');
  });
  if(change){s+='<path class="recruitment-change-line" d="'+rows.map((r,i)=>(i?'L':'M')+xs(i)+','+y(r[key+'_yoy'],cd)).join(' ')+'" fill="none" stroke="'+(value?gold:blue)+'" stroke-width="3" stroke-linejoin="round"/>';rows.forEach((r,i)=>{s+='<circle cx="'+xs(i)+'" cy="'+y(r[key+'_yoy'],cd)+'" r="4" fill="white" stroke="'+(value?gold:blue)+'" stroke-width="2"><title>'+r.month+' 同比 '+pct(r[key+'_yoy'],d)+'</title></circle>';});}
  const occupied=[];
  function mark(i,yy,label,color,kind){const x=xs(i),width=label.length*8+8;let pos=yy-13;const nearby=occupied.filter(b=>Math.abs(b.x-x)<(b.w+width)/2);for(let attempt=0;attempt<8&&nearby.some(b=>Math.abs(b.y-pos)<21);attempt++)pos=yy+(attempt%2?-(25+attempt*12):(25+attempt*12));pos=Math.max(T+13,Math.min(B-8,pos));occupied.push({x,y:pos,w:width});s+=text(x,pos,label,15,color,'middle','class="recruitment-label '+kind+'" font-weight="600" stroke="white" stroke-width="4" paint-order="stroke"');}
  rows.forEach((r,i)=>{const last=i===n-1;if(change&&(['change','both'].includes(labels)||labels==='latest'&&last))mark(i,y(r[key+'_yoy'],cd),pct(r[key+'_yoy'],d),value?gold:blue,'change-label');if(value&&(['value','both'].includes(labels)||labels==='latest'&&last))mark(i,y(r[key]/m.factor,vd),fmt(r[key]/m.factor,d),blue,'value-label');});
  s+='<path d="M36 552H'+(W-36)+'" stroke="#e8edf1"/>'+text(36,581,'来源：通联 Datayes  |  周度合并月度',13,gray)+text(W-36,581,key==='posts'?'按周度日期归月求和 · 同比受每月周数差异影响':'月内周值算术平均 · 年薪口径',13,gray,'end')+'</svg>';return s;
 }
 function render(){
  if(!data)return;const rows=data.rows.filter(r=>$('year').value==='all'||r.month.startsWith($('year').value));selected=$('range').value==='all'?rows:rows.slice(-Number($('range').value));
  const last=rows.at(-1);$('kpis').innerHTML=last?[['新增招聘帖数',fmt(last.posts)+' 个',pct(last.posts_yoy)],['招聘年均薪资',fmt(last.salary,2)+' 元/年',pct(last.salary_yoy)]].map(([name,v,g])=>'<article><span>'+name+' · '+last.month+'</span><strong>'+v+'</strong><span>同比 '+g+'</span></article>').join(''):'';
  $('matrix').innerHTML='<thead><tr><th>月份</th><th>新增招聘帖数（个）</th><th>同比</th><th>招聘年均薪资（元/年）</th><th>同比</th><th>周数（本期 / 基期）</th></tr></thead><tbody>'+[...rows].reverse().map(r=>'<tr><td>'+r.month+'</td><td>'+fmt(r.posts)+'</td><td>'+pct(r.posts_yoy)+'</td><td>'+fmt(r.salary,2)+'</td><td>'+pct(r.salary_yoy)+'</td><td>'+r.weeks+' / '+r.prior_weeks+'</td></tr>').join('')+'</tbody>';
  for(const key of Object.keys(metrics)){images[key]=chart(key,selected);$(key+'-chart').innerHTML=images[key];}
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function save(key){
  const status=$('export-status');status.textContent='正在生成高清图片…';
  let url;
  try{const svg=images[key],image=new Image();url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const canvas=document.createElement('canvas');canvas.width=image.naturalWidth*2;canvas.height=image.naturalHeight*2;canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('export');download(blob,metrics[key].name+'_'+selected[0].month+'_'+selected.at(-1).month+'.png');status.textContent='高清 PNG 已生成';}catch(e){status.textContent='图片生成失败，请重试或使用截图视图。';}finally{if(url)URL.revokeObjectURL(url);}
 }
 document.addEventListener('click',e=>{const preview=e.target.closest('[data-preview]'),png=e.target.closest('[data-png]');if(preview){active=preview.dataset.preview;$('shot-chart').innerHTML=images[active];$('shot-title').textContent=metrics[active].name;$('shot').style.maxHeight=Math.max(260,(window.parent===window?innerHeight:window.parent.innerHeight)-40)+'px';$('shot').showModal();if(window.frameElement)window.frameElement.scrollIntoView({block:'start'});}if(png)save(png.dataset.png);});
 $('shot-close').onclick=()=>$('shot').close();$('shot-save').onclick=()=>save(active);
 async function load(){
  $('load-error').hidden=true;$('retry').hidden=true;
  try{data=await SiteData.json('data/recruitment/observations.json');if(!Array.isArray(data.rows)||!data.rows.length)throw Error('empty');$('dashboard').hidden=false;$('asof').textContent='全国 · '+data.rows[0].month+'—'+data.rows.at(-1).month+' · 周度合并月度 · 通联 Datayes';render();}
  catch(e){$('asof').textContent='招聘数据读取失败';$('load-error').textContent='数据暂时无法读取，请重试。';$('load-error').hidden=false;$('retry').hidden=false;}
 }
 for(const id of ['year','mode','labels','digits','range'])$(id).onchange=render;
 $('retry').onclick=load;load();
})();
