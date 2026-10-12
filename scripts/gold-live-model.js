(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GoldLiveModel=api;})(typeof window==='object'?window:{},function(){
  'use strict';
  function valid(q){return Number.isFinite(q?.price)&&q.price>0&&Number.isFinite(Date.parse(q.asOf));}
  function accept(previous,incoming){if(!valid(incoming))throw Error('Invalid gold quote');return previous&&Date.parse(incoming.asOf)<Date.parse(previous.asOf)?previous:incoming;}
  function parse(raw){if(typeof raw!=='string')throw Error('Missing gold quote');const f=raw.split(','),price=Number(f[0]),previous=Number(f[7]);const q={price,percent:previous>0?(price/previous-1)*100:null,asOf:f[12]+'T'+f[6]+'+08:00',source:'腾讯行情转引',url:'https://gu.qq.com/'};if(!valid(q))throw Error('Invalid gold quote');return q;}
  return {valid,accept,parse};
});
