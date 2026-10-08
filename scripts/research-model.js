(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ResearchModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const sectors=[
    ['travel','旅游酒店',/旅游|文旅|酒店|\bOTA\b|携程|同程|首旅|锦江|华住|宋城|天目湖|景区/i],
    ['dutyfree','免税',/免税|中免|海旅|海汽/],
    ['gold','黄金珠宝',/黄金(?!周)|珠宝|老铺|老凤祥|周大福|周大生|潮宏基|曼卡龙/],
    ['dining','餐饮茶饮',/餐饮|茶饮|海底捞|小菜园|蜜雪|古茗|奈雪|瑞幸|百胜|九毛九|东来顺/],
    ['retail','零售美护',/零售|商贸|美护|美妆|医美|化妆品|开市客|泡泡玛特|毛戈平|若羽臣|珀莱雅|华熙|爱美客|贝泰妮/],
    ['education','教育人服',/教育|人服|人力资源|招聘|培训|中公|科锐|外服|行动教育|东方教育|新东方|好未来/],
    ['commerce','电商出海',/电商|出海|跨境|亚马逊|阿里|拼多多|京东|焦点科技|吉宏|安克|赛维|华凯|东方甄选/],
    ['food','食品饮料',/食品饮料|白酒|啤酒|乳业|乳制品|茅台|五粮液|汾酒|伊利|蒙牛|农夫山泉|东鹏饮料|调味品/]
  ];
  function format(r){if(r.kind!=='minutes')return 'view';if(/未转写|会议音频/.test(r.state)||/\.(mp3|m4a|wav|aac)(?:；|$)/i.test(r.file))return 'audio';return r.state?'document':'text';}
  const labels={view:'商社观点',audio:'会议音频',document:'文档附件',text:'纪要摘要'};
  function sectorIds(r){if(r.library?.sectors)return r.library.sectors;const text=[r.sector,r.company,r.title].join(' ');return sectors.filter(s=>s[2].test(text)).map(s=>s[0]);}
  function preview(r){const normal=s=>s.replace(/[\s#【】\[\]⚡🔥📌]/gu,'');const title=normal(r.title||'');return String(r.content||'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&normal(s)!==title&&!/^(联系人|联系方式|联系电话|免责声明)[：:]/.test(s)).join(' ').slice(0,240);}
  function lowerDate(today,days){const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-Number(days)+1);return d.toISOString().slice(0,10);}
  function matches(r,f){const kw=(f.q||'').trim().toLowerCase();return r.kind===f.kind&&(!kw||[r.title,r.content,r.company,r.sector].join(' ').toLowerCase().includes(kw))&&(!f.sector||sectorIds(r).includes(f.sector))&&(!f.format||format(r)===f.format)&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to);}
  function topic(r){return (String(r.url||'').match(/\/topic\/(\d+)/)||[])[1]||'';}
  function href(r){const q=new URLSearchParams({kind:r.kind||'views'});const id=topic(r);if(id)q.set('topic',id);else {q.set('q',r.title||'');q.set('record',r.title||'');}if(r.file)q.set('file',r.file);return 'research.html?'+q;}
  return {sectors,format,labels,sectorIds,preview,lowerDate,matches,topic,href};
});
