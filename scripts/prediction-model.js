(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PredictionModel=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  function affirmative(m){return m.outcomes?.find(o=>o.name==='Yes'||o.nameZh==='是')||null;}
  function title(markets){const first=markets[0],q=first.questionZh||first.question;
    if(markets.length===1)return q;
    const meeting=q.match(/(\d{4}年\d+月)会议/);if(meeting&&markets.every(m=>/美联储/.test(m.questionZh||'')))return '美联储'+meeting[1]+'利率决策';
    if(markets.every(m=>/比特币/.test(m.questionZh||'')))return '比特币价格 · '+(q.match(/\d+月\d+日|\d+月/)?.[0]||'相关预测');
    if(markets.every(m=>/美国.*伊朗/.test(m.questionZh||'')))return '美国与伊朗停火进展';
    if(markets.every(m=>/国会格局/.test(m.questionZh||'')))return '2026年美国国会格局';
    if(markets.every(m=>/众议院/.test(m.questionZh||'')))return '2026年美国众议院控制权';
    return q+' · 相关合约';
  }
  function groups(markets,{query='',category='',now=Date.now()}={}){
    const queryText=query.trim().toLowerCase(),map=new Map();
    for(const m of markets){if(category&&m.category!==category)continue;if(queryText&&![m.questionZh,m.question].join(' ').toLowerCase().includes(queryText))continue;
      const end=Date.parse(m.endDate);if(Number.isFinite(end)&&end<now)continue;
      const key=m.category+':'+(m.eventId||m.id);if(!map.has(key))map.set(key,[]);map.get(key).push(m);
    }
    return [...map.entries()].map(([id,items])=>({id,markets:items.slice().sort((a,b)=>(affirmative(b)?.probability??-1)-(affirmative(a)?.probability??-1)),title:title(items),category:items[0].category,volume:items.reduce((n,m)=>n+(finite(m.volume24h)?m.volume24h:0),0)})).sort((a,b)=>['经济与利率','政治与地缘','金融市场'].indexOf(a.category)-['经济与利率','政治与地缘','金融市场'].indexOf(b.category)||b.volume-a.volume);
  }
  function optionLabel(group,market){const q=market.questionZh||market.question;if(group.markets.length>1&&/^美联储\d{4}年\d+月利率决策$/.test(group.title))return q.replace(/^美联储是否会在\d{4}年\d+月会议后/,'').replace(/[？?]$/,'');return q;}
  return {groups,affirmative,title,optionLabel};
});
