(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CoverageDirectory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function market(code){return /\.HK$|^HSI\.HI$/i.test(code)?'HK':/\.(OO|O|N)$/i.test(code)?'US':'CN';}
  function directory(data){if(!Array.isArray(data?.companies)||!data.companies.length)throw Error('Invalid coverage directory');const seen=new Set();return data.companies.map(c=>{if(!c||!/^[0-9]{6}\.(SH|SZ|BJ)$|^[0-9]{4,5}\.HK$|^[A-Z][A-Z0-9-]*\.(OO|O|N)$/.test(c.code)||typeof c.name!=='string'||!c.name.trim()||typeof c.sector!=='string'||!c.sector.trim()||seen.has(c.code))throw Error('Invalid or duplicate coverage identity');seen.add(c.code);return {...c,aliases:Array.isArray(c.aliases)?c.aliases.filter(a=>typeof a==='string'):[]};});}
  return {market,directory};
});

