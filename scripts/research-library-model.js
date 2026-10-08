(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ResearchLibrary=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const states={awaiting_file:'待获取原文件',awaiting_text:'原件已入库，文字待整理',extracted:'PDF已提取',transcript_draft:'转写待核对',reviewed:'已核对文字'};
  function hasStoredOriginal(r){return r?.storage?.provider==='onedrive'&&r.storage.status==='uploaded'&&/^[a-f0-9]{64}$/i.test(r.sha256||'')&&r.storage.verifiedSha256===r.sha256;}
  function storageLink(r){if(!hasStoredOriginal(r)||!r.storage.permissionsReviewed||!['clients','public'].includes(r.storage.audience))return '';try{const u=new URL(r.storage.openUrl);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='1drv.ms'||u.hostname==='onedrive.live.com'||u.hostname.endsWith('.sharepoint.com'))&&!/[?&](?:token|sig|signature|download)=/i.test(u.search)?u.href:'';}catch(e){return '';}}
  function duration(seconds){if(!Number.isFinite(seconds)||seconds<=0)return '';const mins=Math.floor(seconds/60);return mins+'分'+Math.floor(seconds%60)+'秒';}
  function bytes(value){if(!Number.isFinite(value)||value<0)return '';return (value/1024/1024).toFixed(1)+' MB';}
  function entry(r){return {kind:'minutes',id:r.id,title:r.name,file:r.name,published:r.published,date:r.date,content:r.processing?.summary||'',url:r.sourceUrl,sector:'',company:'',author:r.sourceName,state:r.format==='audio'?'会议音频，未转写':'附件索引，正文未提取',library:r};}
  function matches(r,f){const q=(f.q||'').trim().toLowerCase();return (!f.sector||r.sectors?.includes(f.sector))&&(!f.format||r.format===f.format)&&(!f.state||r.processing?.status===f.state)&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!q||[r.name,r.processing?.summary,r.processing?.searchText].filter(Boolean).join(' ').toLowerCase().includes(q));}
  function briefMatches(r,f){const q=(f.q||'').trim().toLowerCase();return r.status==='reviewed'&&(!f.sector||r.sector===f.sector)&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!q||[r.title,r.conclusion,r.boundary,...(r.watch||[]),...(r.evidence||[]).map(x=>x.text)].join(' ').toLowerCase().includes(q));}
  function topicHref(s){const q=new URLSearchParams({kind:s.kind||'views',topic:s.topicId});return 'research.html?'+q;}
  function safeLocalPath(path){return typeof path==='string'&&/^data\/research\/processed\/[A-Za-z0-9_-]+\.json$/.test(path);}
  return {states,duration,bytes,entry,matches,briefMatches,topicHref,safeLocalPath,hasStoredOriginal,storageLink};
});
