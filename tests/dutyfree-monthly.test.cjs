const test=require('node:test'),assert=require('node:assert/strict'),M=require('../scripts/dutyfree-monthly-model.js');
test('missing growth uses the previous calendar year, not the preceding row',()=>{
 const rows=M.derive([{period_id:'2025-07',shopping_sales_cny_100m:'20'},{period_id:'2026-06',shopping_sales_cny_100m:'99'},{period_id:'2026-07',shopping_sales_cny_100m:'25'}]);
 assert.equal(+rows[2].sales_yoy_pct,25);assert.equal(rows[2].sales_yoy_pct_method,'calculated');assert.match(rows[2].sales_yoy_pct_note,/2025-07/);assert.equal(rows[1].sales_yoy_pct,'');
});
test('reported zero stays zero; real zero current value yields -100%; missing and zero base stay unavailable',()=>{
 const rows=M.derive([{period_id:'2025-07',shopping_sales_cny_100m:'20',shoppers_10k:'0'},{period_id:'2026-07',shopping_sales_cny_100m:'0',shoppers_10k:'12',items_yoy_pct:'0'}]);
 assert.equal(+rows[1].sales_yoy_pct,-100);assert.equal(rows[1].shoppers_yoy_pct,'');assert.equal(rows[1].items_yoy_pct,'0');assert.equal(rows[1].items_yoy_pct_method,'reported');assert.match(rows[1].shoppers_yoy_pct_note,/基期为0/);
});
test('original inputs are untouched, duplicate months reject, launch-month baseline remains explicit',()=>{
 const input=[{period_id:'2011-04',shopping_sales_cny_100m:'1'},{period_id:'2012-04',shopping_sales_cny_100m:'2'}],before=JSON.stringify(input);
 const result=M.derive(input);assert.equal(JSON.stringify(input),before);assert.match(result[1].sales_yoy_pct_note,/非完整经营月/);
 assert.throws(()=>M.derive([{period_id:'2025-01'},{period_id:'2025-01'}]),/重复月份/);
});
