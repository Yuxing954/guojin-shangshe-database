(function(root){
  'use strict';
  function csv(text){const rows=[];let row=[],v='',quoted=false; text=String(text).replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){v+='"';i++;}else if(c==='"')quoted=false;else v+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(v);v='';}else if(c==='\n'){row.push(v.replace(/\r$/,''));rows.push(row);row=[];v='';}else v+=c;}if(v||row.length){row.push(v.replace(/\r$/,''));rows.push(row);}const headers=rows.shift()||[];return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));}
  function number(v){if(v==null||String(v).trim()==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function link(v){try{if(typeof v==='string'&&v.trim().startsWith('{'))v=JSON.parse(v);v=typeof v==='object'?v.link:v;const u=new URL(v,'https://site.invalid/');return /^https?:$/.test(u.protocol)&&u.hostname!=='site.invalid'?u.href:'';}catch(e){return '';}}
  function period(v){const y=String(v).match(/(20\d\d)/);if(!y)return -1;const q=String(v).match(/Q([1-4])/i);return Number(y[1])*10+(q?Number(q[1]):/H1/i.test(v)?2:/H2|FY|全年/i.test(v)?4:0);}
  const fmt=(v,d=1)=>number(v)==null?'—':number(v).toLocaleString('zh-CN',{maximumFractionDigits:d});
  const U=typeof module==='object'&&module.exports?require('./site-ui.js'):root.SiteUI;
  async function json(path){return U.request(path);}
  async function table(path){return csv(await U.request(path,'text'));}
  function csvCell(value){const v=String(value??'');return '"'+(/^[\s]*[=+@]/.test(v)||/^[\s]*-(?!\d+(?:\.\d+)?\s*$)/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';}
  function encodeCsv(rows,headers=Object.keys(rows[0]||{})){return '\uFEFF'+[headers,...rows.map(row=>headers.map(key=>row[key]??''))].map(row=>row.map(csvCell).join(',')).join('\r\n');}
  function downloadCsv(rows,name,headers){const url=URL.createObjectURL(new Blob([encodeCsv(rows,headers)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function trend(points,label){const clean=points.filter(p=>number(p.value)!=null);if(!clean.length)return '<div class="portal-empty">暂无可绘制的数据</div>';const values=clean.map(p=>number(p.value)),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||1;const xy=clean.map((p,i)=>[50+i*720/Math.max(1,clean.length-1),200-(number(p.value)-lo)*150/span]);const path=xy.map(p=>p.join(',')).join(' ');return '<svg class="portal-chart" viewBox="0 0 820 245" role="img" aria-label="'+esc(label)+'"><title>'+esc(label)+'</title>'+[0,1,2].map(i=>'<line x1="50" y1="'+(50+i*75)+'" x2="770" y2="'+(50+i*75)+'" stroke="#e8eaf1"/><text x="5" y="'+(54+i*75)+'">'+fmt(hi-i*span/2)+'</text>').join('')+'<polyline points="'+path+'" fill="none" stroke="#5158aa" stroke-width="3" stroke-linejoin="round"/>'+xy.map((p,i)=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3" fill="#5158aa"><title>'+esc(clean[i].date)+'：'+fmt(clean[i].value)+'</title></circle>').join('')+'<text x="50" y="232">'+esc(clean[0].date)+'</text><text x="770" y="232" text-anchor="end">'+esc(clean.at(-1).date)+'</text></svg>';}
  const api={csv,number,esc,link,period,fmt,json,table,trend,csvCell,encodeCsv,downloadCsv};if(typeof module==='object'&&module.exports)module.exports=api;else root.SiteData=api;
})(typeof window==='object'?window:{});

