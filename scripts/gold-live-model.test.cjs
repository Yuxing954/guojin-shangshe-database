const test=require('node:test'),assert=require('node:assert/strict'),M=require('./gold-live-model.js'),Q=require('./quotes-model.js');
test('captured international quote uses previous close and source timestamp',()=>{
 const q=M.parse('4206.11,0.28,4206.11,4206.46,4217.06,4184.71,10:53:00,4194.39,4194.28,0,0,0,2026-10-12,伦敦金（现货黄金）');
 assert.equal(q.price,4206.11);assert.equal(q.asOf,'2026-10-12T10:53:00+08:00');assert.ok(Math.abs(q.percent-0.279)<0.001);
 assert.throws(()=>M.parse(''));assert.throws(()=>M.parse(undefined));
});
test('invalid and older observations cannot replace a valid quote',()=>{
 const old={price:900,asOf:'2026-10-12T10:00:00+08:00'};
 assert.equal(M.accept(old,{price:901,asOf:'2026-10-12T09:59:00+08:00'}),old);
 assert.throws(()=>M.accept(old,{price:0,asOf:old.asOf}));
 assert.throws(()=>M.accept(old,{price:901,asOf:'missing'}));
});
test('merged industry filters cover all original sectors without dropping identities',()=>{
 const fs=require('node:fs'),directory=Q.directory(JSON.parse(fs.readFileSync('data/coverage-companies.json','utf8')));
 const all=Object.keys(Q.sectorGroups).flatMap(sector=>Q.filter(directory,{}, {sector}));
 assert.equal(new Set(all.map(c=>c.code)).size,directory.length);assert.equal(all.length,directory.length);
 assert.ok(Q.filter(directory,{}, {sector:'餐饮茶饮'}).some(c=>c.sector==='茶饮'));
 assert.ok(Q.filter(directory,{}, {sector:'酒店旅游'}).some(c=>c.sector==='OTA'));
});
