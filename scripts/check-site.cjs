'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'..');
const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html'));
let inline=0,scripts=0;
for(const file of fs.readdirSync(__dirname).filter(f=>f.endsWith('.js'))){new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'),{filename:file});scripts++;}
for(const file of pages){
  const html=fs.readFileSync(path.join(root,file),'utf8');assert.ok(!/^<<<<<<<|^=======|^>>>>>>>/m.test(html),file+' merge conflict');
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/\bsrc\s*=/i.test(match[1])&&match[2].trim()&&!/type=["']application\//i.test(match[1])){new vm.Script(match[2],{filename:file});inline++;}}
  if(file==='companies.html')continue; // Retired entry is an immediate compatibility redirect.
  const head=html.slice(0,html.indexOf('</head>')),styles=[...head.matchAll(/<link\b[^>]*href="(scripts\/[^"?]+\.css)[^"\s]*"/g)].map(m=>m[1]);
  assert.equal(styles.at(-1),'scripts/site-polish.css',file+' adapter ordering');assert.equal(styles.filter(s=>s==='scripts/site.css').length,1,file+' shared base');assert.ok(head.indexOf('scripts/site-ui.js')<head.indexOf('scripts/site-shell.js'),file+' dependency ordering');
  for(const match of head.matchAll(/(?:src|href)="(scripts\/[^"?]+)[^"\s]*"/g))assert.ok(fs.existsSync(path.join(root,match[1])),file+' missing '+match[1]);
}
console.log('PASS: '+pages.length+' entrypoints, '+scripts+' scripts, '+inline+' inline scripts; shared asset order and local assets');
