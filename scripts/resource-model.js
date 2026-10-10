(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ResourceModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const labels={company:'公司',minutes:'纪要',views:'商社观点',industry:'行业指标'};
  const sectorLabels={travel:'旅游酒店',dutyfree:'免税',gold:'黄金珠宝',dining:'餐饮茶饮',retail:'零售美护',education:'教育人服',commerce:'电商出海',food:'食品饮料',sports:'体育消费',brandservices:'电商与品牌服务'};
  const known={'600754.SH':['锦江','锦江酒店'],'600258.SH':['首旅','首旅酒店','首旅如家'],'1179.HK':['华住','华住集团'],'600763.SH':['通策','通策医疗'],'601888.SH':['中免','中国中免']};
  function normal(v){return String(v||'').toLowerCase().replace(/[\s\-_.·（）()]/g,'');}
  function aliases(c){return Array.from(new Set([c.title,c.code,...(c.aliases||[]),String(c.code||'').split('.')[0],String(c.title||'').replace(/-S$/i,'').replace(/(?:股份有限公司|有限公司|集团|股份|控股)$/,''),...(known[c.code]||[])].filter(Boolean)));}
  function sector(v){return String(v||'').split(/\s+/).map(s=>sectorLabels[s]||s).join(' / ');}
  function text(r){return normal([r.title,r.company,r.code,...(r.aliases||[]),sector(r.sector)].filter(Boolean).join(' '));}
  function search(items,q,kind=''){
    const tokens=String(q||'').trim().split(/\s+/).filter(Boolean);
    const companies=items.filter(r=>r.kind==='company');
    let companyQuery=false;
    const groups=tokens.map(token=>{const n=normal(token),c=companies.find(r=>aliases(r).some(a=>normal(a)===n));if(c)companyQuery=true;return c?aliases(c).map(normal):[n];});
    return items.filter(r=>(!kind||r.kind===kind)&&groups.every(words=>words.some(w=>text(r).includes(w)))).sort((a,b)=>{
      const exactA=tokens.length===1&&a.kind==='company'&&aliases(a).some(t=>normal(t)===normal(q));
      const exactB=tokens.length===1&&b.kind==='company'&&aliases(b).some(t=>normal(t)===normal(q));
      const priority={company:0,minutes:1,views:2,industry:3};
      return Number(exactB)-Number(exactA)||(companyQuery?priority[a.kind]-priority[b.kind]:0)||(b.sortDate||b.date||'').localeCompare(a.sortDate||a.date||'')||a.title.localeCompare(b.title,'zh');
    });
  }
  function companyResources(items,code,kind){const c=items.find(r=>r.kind==='company'&&r.code===code);if(!c)return [];const names=aliases(c).filter(a=>!/^\d+$/.test(a));return items.filter(r=>r.kind===kind&&names.some(a=>text(r).includes(normal(a)))).sort((a,b)=>(b.sortDate||b.date||'').localeCompare(a.sortDate||a.date||''));}
  function safeHref(href){return typeof href==='string'&&/^(?:quotes|research|industry)\.html(?:[?#]|$)/.test(href)?href:'';}
  return {labels,sector,aliases,search,companyResources,safeHref};
});
