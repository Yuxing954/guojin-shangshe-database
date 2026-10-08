(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ResearchLibrary=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const states={awaiting_file:'待获取原文件',awaiting_text:'原件已入库，文字待整理',summary_draft:'摘要待审阅',needs_review:'关键口径待核对',extracted:'PDF已提取',transcript_draft:'转写待核对',reviewed:'已核对文字'};
  states.original_only='原件已登记';
  function hasStoredOriginal(r){const s=r?.storage;if(s?.provider!=='onedrive'||s.status!=='uploaded')return false;return r.sha256?/^[a-f0-9]{64}$/i.test(r.sha256)&&s.verifiedSha256===r.sha256:s.metadataVerified===true&&s.verificationMethod==='provider_metadata_version'&&/^[a-f0-9]{64}$/i.test(s.cloudVersion||'');}
  function storageLink(r){if(!hasStoredOriginal(r)||!r.storage.permissionsReviewed||r.storage.downloadAllowed===false||!['clients','public'].includes(r.storage.audience))return '';if(r.storage.expiresAt&&(!Number.isFinite(Date.parse(r.storage.expiresAt))||Date.parse(r.storage.expiresAt)<=Date.now()))return '';try{const u=new URL(r.storage.openUrl);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='1drv.ms'||u.hostname==='onedrive.live.com'||u.hostname.endsWith('.sharepoint.com'))&&!/[?&](?:token|sig|signature|download)=/i.test(u.search)?u.href:'';}catch(e){return '';}}
  function duration(seconds){if(!Number.isFinite(seconds)||seconds<=0)return '';const mins=Math.floor(seconds/60);return mins+'分'+Math.floor(seconds%60)+'秒';}
  function bytes(value){if(!Number.isFinite(value)||value<0)return '';return value<1048576?Math.max(1,Math.round(value/1024))+' KB':(value/1024/1024).toFixed(1)+' MB';}
  function entry(r){return {kind:'minutes',id:r.id,title:r.name,file:r.name,published:r.dateStatus==='needs_review'?'':r.published,sortDate:r.sortDate||r.published,date:r.date,content:r.processing?.summary||'',url:r.sourceUrl,sector:'',company:r.company||'',author:r.sourceName,state:r.format==='audio'?'会议音频，未转写':r.processing?.textAvailable?'文字摘要':'附件索引，正文未提取',library:r};}
  function mergeEntries(entries,assets,topic){
    const replaced=new Set(),remaining=[];
    for(const old of entries.filter(r=>r.kind==='minutes')){
      const names=String(old.file).split('；');
      const matches=assets.filter(a=>names.includes(a.file)&&(a.library.sourceType==='onedrive_document'||(a.library.sourceTopics||[topic(a)]).includes(topic(old))));
      if(matches.length){
        replaced.add(old);
        matches.forEach(a=>{a.legacyTitles=Array.from(new Set([...(a.legacyTitles||[]),old.title]));});
        names.filter(name=>!matches.some(a=>a.file===name)).forEach(name=>remaining.push({...old,title:name,file:name}));
      }
    }
    return entries.filter(r=>!replaced.has(r)).concat(remaining,assets);
  }
  function matches(r,f){const q=(f.q||'').trim().toLowerCase();return (f.scope!=='archived'||hasStoredOriginal(r))&&(!(f.from||f.to)||!!r.date&&r.dateStatus!=='needs_review')&&(!f.sector||r.sectors?.includes(f.sector))&&(!f.format||r.format===f.format)&&(!f.state||r.processing?.status===f.state)&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!q||[r.name,r.company,r.documentType,r.processing?.summary,r.processing?.searchText].filter(Boolean).join(' ').toLowerCase().includes(q));}
  function briefMatches(r,f){const q=(f.q||'').trim().toLowerCase();return r.status==='reviewed'&&(!f.sector||r.sector===f.sector)&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!q||[r.title,r.conclusion,r.boundary,...(r.watch||[]),...(r.evidence||[]).map(x=>x.text)].join(' ').toLowerCase().includes(q));}
  function topicHref(s){const q=new URLSearchParams({kind:s.kind||'views',topic:s.topicId});return 'research.html?'+q;}
  function safeLocalPath(path){return typeof path==='string'&&/^data\/research\/processed\/[A-Za-z0-9_-]+\.json$/.test(path);}
  return {states,duration,bytes,entry,mergeEntries,matches,briefMatches,topicHref,safeLocalPath,hasStoredOriginal,storageLink};
});

