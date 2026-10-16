(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DailyAnnouncements=api;})(globalThis,function(){'use strict';
function rows(d){return (Array.isArray(d?.companyAnnouncements)?d.companyAnnouncements:[]).filter(r=>r.verified===true&&/^https:\/\//.test(r.url||'')).slice().sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));}
function plain(d){const items=rows(d);return items.length?'【公司重要公告】\n'+items.map(r=>r.company+'（'+r.code+'）｜'+r.title+'\n'+r.summary+'\n'+r.impact+'\n'+r.source+' · 发布 '+r.publishedAt+'\n'+r.url).join('\n\n'):'';}
return {rows,plain};
});
