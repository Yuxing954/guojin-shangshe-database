'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),U=require('../scripts/site-ui.js'),D=require('../scripts/site-data.js');
test('legacy routes retain query before sector hash',()=>{assert.equal(U.route('sec-hotel','?metric=adr&q=酒店'),'industry.html?metric=adr&q=%E9%85%92%E5%BA%97#hotel');assert.equal(U.route('watch-assistant','?q=x',true),'hotel-weekly-product.html?q=x');assert.equal(U.route('unknown'),'');});
test('default entry opens the client workspace and existing industry bookmarks retain state',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
 const script=fs.readFileSync(path.join(__dirname,'../scripts/index-redirect.js'),'utf8');
 const redirect=(search='',hash='')=>{let target;vm.runInNewContext(script,{SiteUI:U,location:{search,hash,replace:value=>target=value}});return target;};
 assert.equal(redirect(),'workspace.html');
 assert.equal(redirect('?metric=revpar','#sec-hotel'),'industry.html?metric=revpar#hotel');
 assert.equal(redirect('?panelSector=dining'),'industry.html?panelSector=dining');
 assert.equal(redirect('','#hotel'),'industry.html#hotel');
});
test('CSV preserves identifiers, source fields, empty missing values and real negatives; escapes formulas',()=>{const csv=D.encodeCsv([{code:'000001',value:-2,missing:null,source:'a,"b"',text:'=1+1'}]);assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/"000001","-2","","a,""b""","'=1\+1"/);});
test('HTTP failure and timeout reject instead of parsing error bodies',async()=>{const original=global.fetch;try{global.fetch=async()=>({ok:false,status:503});await assert.rejects(U.request('/data'),/503/);global.fetch=(_p,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));await assert.rejects(U.request('/data','json',10),/aborted/);}finally{global.fetch=original;}});

