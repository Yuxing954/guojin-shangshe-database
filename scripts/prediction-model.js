(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PredictionModel=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const dataTypes=[{label:'央行利率',scope:'利率决策、调整次数'},{label:'宏观数据',scope:'通胀、增长、就业'},{label:'数字货币',scope:'数字资产价格条件'},{label:'大宗商品',scope:'原油、黄金等价格条件'},{label:'金融资产',scope:'股票、汇率等市场条件'},{label:'选举政治',scope:'选举结果、席位与胜差'},{label:'地缘事件',scope:'冲突、停火与外交事件'},{label:'其他事件',scope:'其他事件条件'}];
  function dataType(markets){
    const text=markets.map(m=>[m.eventTitle,m.eventTitleZh,m.question,m.questionZh].join(' ')).join(' ');
    if(/\b(fed|federal reserve|bank of canada|ecb|bank of england|boj|interest rate|rate hike|rate cut)\b|美联储|央行|加息|降息|利率决[策议]/i.test(text))return dataTypes[0];
    if(/\b(bitcoin|ethereum|crypto|solana|btc|eth|xrp)\b|比特币|以太坊|数字货币/i.test(text))return dataTypes[2];
    if(/\b(wti|brent|crude|oil|gold|silver|copper|natural gas)\b|原油|黄金|白银|天然气/i.test(text))return dataTypes[3];
    if(/\b(election|electoral|president|presidential|senate|house|balance of power|prime minister)\b|选举|总统|参议院|众议院|国会|议席/i.test(text))return dataTypes[5];
    if(/\b(ceasefire|war|invasion|military|peace|iran|ukraine|israel)\b|停火|战争|军事|冲突|伊朗|乌克兰/i.test(text))return dataTypes[6];
    if(/\b(cpi|gdp|inflation|unemployment|payroll|recession|retail sales|pmi)\b|通胀|失业|非农|经济增长|衰退|零售额/i.test(text))return dataTypes[1];
    if(markets.every(m=>m.category==='金融市场'))return dataTypes[4];
    return dataTypes[7];
  }
  function measurement(group){
    const text=group.markets.map(m=>[m.eventTitle,m.eventTitleZh,m.question,m.questionZh].join(' ')).join(' '),kind=group.dataType.label;
    if(kind==='央行利率')return /how many|number of|\d+ Fed rate hike|加息数量|加息次数|降息次数/i.test(text)?'调整次数概率':'利率调整概率';
    if(['数字货币','大宗商品','金融资产'].includes(kind))return /\bhit\b|\breach\b|触及/i.test(text)?'期间触及价格概率':/\babove\b|\bbelow\b|高于|低于/i.test(text)?'指定时点价格概率':'资产条件概率';
    if(kind==='选举政治')return /margin|win.*by|胜差/i.test(text)?'选举胜差概率':'选举结果概率';
    if(kind==='地缘事件')return /continues through|持续时间|持续至/i.test(text)?'持续至日期概率':'事件发生概率';
    if(kind==='宏观数据')return '经济指标条件概率';
    return '事件条件概率';
  }
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
  function groups(markets,{query='',category='',now=Date.now(),wholeEvents=false,sort='volume'}={}){
    const queryText=query.trim().toLowerCase(),map=new Map();
    for(const m of markets){if(!wholeEvents&&queryText&&![m.questionZh,m.question].join(' ').toLowerCase().includes(queryText))continue;
      const end=Date.parse(m.endDate);if(Number.isFinite(end)&&end<now)continue;
      const key=m.category+':'+(m.eventId||m.id);if(!map.has(key))map.set(key,[]);map.get(key).push(m);
    }
    return [...map.entries()].filter(([,items])=>!wholeEvents||!queryText||items.some(m=>[m.questionZh,m.question,m.eventTitle,m.eventTitleZh,m.optionLabel,m.optionLabelZh].join(' ').toLowerCase().includes(queryText))).map(([id,items])=>({id,dataType:dataType(items),markets:items.slice().sort((a,b)=>(affirmative(b)?.probability??-1)-(affirmative(a)?.probability??-1)),title:items[0].eventTitleZh||items[0].eventTitle||title(items),category:items[0].category,volume:items.reduce((n,m)=>n+(finite(m.volume24h)?m.volume24h:0),0),endDate:items.map(m=>m.endDate).filter(Boolean).sort()[0],complete:items.every(m=>m.eventComplete===true)})).filter(g=>!category||g.category===category||g.dataType.label===category).sort((a,b)=>sort==='deadline'?Date.parse(a.endDate)-Date.parse(b.endDate)||b.volume-a.volume:b.volume-a.volume);
  }
  function optionLabel(group,market){if(market.optionLabelZh)return market.optionLabelZh;const q=market.questionZh||market.question;if(group.markets.length>1&&/^美联储\d{4}年\d+月利率决策$/.test(group.title))return q.replace(/^美联储是否会在\d{4}年\d+月会议后/,'').replace(/[？?]$/,'');return market.optionLabelZh||q;}
  return {groups,affirmative,title,optionLabel,dataTypes,dataType,measurement};
});




