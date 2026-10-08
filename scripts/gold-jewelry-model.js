(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GoldJewelryModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const numeric=x=>typeof x==='number'&&Number.isFinite(x);
  function validDate(x){if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===x;}
  function quoteKey(q){return ['brandId','market','city','currency','unit','product','priceBasis','purity','includesLabor','includesTax','quoteDate','quoteTime','sourceId'].map(k=>JSON.stringify(q[k]??null)).join('|');}
  function validate(data){
    const errors=[],sourceIds=new Set((data.sources||[]).map(s=>s.id)),brandIds=new Set((data.brands||[]).map(b=>b.id)),ids=new Set(),keys=new Set();
    if(sourceIds.size!==(data.sources||[]).length||sourceIds.has(undefined))errors.push('来源id缺失或重复');
    if(brandIds.size!==(data.brands||[]).length||brandIds.has(undefined))errors.push('品牌id缺失或重复');
    if(data.schemaVersion!==1)errors.push('不支持的schemaVersion');
    if(!validDate(data.checkedAt))errors.push('checkedAt必须是有效日期');
    for(const [type,q] of [...(data.quotes||[]).map(q=>['quote',q]),...(data.benchmarks||[]).map(q=>['benchmark',q])]){
      if(!q.id||ids.has(q.id))errors.push('缺失或重复id: '+q.id);ids.add(q.id);
      if(!validDate(q.quoteDate)||q.quoteDate>data.checkedAt)errors.push('报价日期无效或晚于核对日期: '+q.id);
      if(!numeric(q.price)||q.price<=0)errors.push('价格必须为正数，空值不能转0: '+q.id);
      if(!sourceIds.has(q.sourceId))errors.push('缺少来源: '+q.id);
      if(['verified_primary','primary'].includes(q.verification)&&data.sources.find(s=>s.id===q.sourceId)?.kind!=='primary')errors.push('转引源不能升级为原始披露: '+q.id);
      if(!q.currency||!q.unit||!q.market)errors.push('缺少币种/单位/市场: '+q.id);
      if(q.purity!==null&&(!numeric(q.purity)||q.purity<=0||q.purity>1))errors.push('纯度必须为0—1或null: '+q.id);
      if(type==='quote'){
        if(!brandIds.has(q.brandId))errors.push('未知品牌: '+q.id);
        if(!q.product||!q.priceBasis)errors.push('缺少产品/计价方式: '+q.id);
        const key=quoteKey(q);if(keys.has(key))errors.push('同来源同口径重复报价: '+q.id);keys.add(key);
        if(!['pending_primary','verified_primary'].includes(q.verification))errors.push('未知品牌核验状态: '+q.id);
        for(const field of ['includesLabor','includesTax'])if(q[field]!==null&&typeof q[field]!=='boolean')errors.push('工费/税状态必须为布尔值或null: '+q.id);
      }else{
        if(!q.instrument||!q.priceType||q.verification!=='primary')errors.push('基准缺少合约/价格类型或原始来源核验: '+q.id);
        const key=['instrument','priceType','market','currency','unit','quoteDate','quoteTime','sourceId'].map(k=>JSON.stringify(q[k]??null)).join('|');
        if(keys.has(key))errors.push('同来源同口径重复基准: '+q.id);keys.add(key);
      }
    }
    return errors;
  }
  function spread(q,benchmarks){
    const candidates=benchmarks.filter(b=>b.quoteDate===q.quoteDate&&b.instrument==='Au99.99'&&b.priceType==='close'&&b.currency===q.currency&&b.unit===q.unit&&b.market===q.market);
    if(!candidates.length)return {value:null,ratio:null,reason:'缺少同日、同市场、同单位收盘基准'};
    if(candidates.length!==1)return {value:null,ratio:null,reason:'同日基准存在多条来源，需先处理冲突'};
    const b=candidates[0];
    if(q.verification!=='verified_primary'||b.verification!=='primary')return {value:null,ratio:null,reason:'品牌牌价尚未通过原始来源复核'};
    if(q.priceBasis!=='posted_per_gram')return {value:null,ratio:null,reason:'一口价/回收价/其他报价不得并入按克牌价比较'};
    if(q.includesLabor===null||q.includesTax===null||q.purity===null||q.purity!==b.purity)return {value:null,ratio:null,reason:'纯度、工费或税口径未核清'};
    if(!numeric(q.price)||!numeric(b.price)||b.price<=0)return {value:null,ratio:null,reason:'价格缺失或无效'};
    return {value:q.price-b.price,ratio:(q.price/b.price-1)*100,benchmarkId:b.id,reason:'同日收盘参考差，报价时刻未必同步；不是成交价差或毛利率'};
  }
  function csv(rows){
    const headers=['品牌','报价日期','报价时刻','市场','城市','品类','计价方式','纯度','含工费','含税','币种','单位','挂牌价','核验状态','来源','来源URL','采集日期'];
    const safe=x=>{let s=String(x??'');if(typeof x==='string'&&/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    return '\uFEFF'+[headers,...rows.map(q=>[q.brandName,q.quoteDate,q.quoteTime,q.market,q.city,q.product,q.priceBasis,q.purity,q.includesLabor,q.includesTax,q.currency,q.unit,q.price,q.verification,q.sourceName,q.sourceUrl,q.capturedDate])].map(r=>r.map(safe).join(',')).join('\r\n');
  }
  return {numeric,validDate,quoteKey,validate,spread,csv};
});
