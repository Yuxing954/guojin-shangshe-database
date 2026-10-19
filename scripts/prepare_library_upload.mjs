import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const [input,baseBlobSha,out]=process.argv.slice(2);
if(!input||!baseBlobSha||!out)throw Error('Usage: node prepare_library_upload.mjs prepared.json baseBlobSha outputDir');
const payload=fs.readFileSync(input),data=JSON.parse(payload),packed=zlib.gzipSync(payload);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const batchId='metadata-'+sha(payload).slice(0,16),prefix='data/research/library-pending/'+batchId;
fs.mkdirSync(out,{recursive:true});
const entries=[],chunks=[];
for(let i=0,start=0;start<packed.length;i++,start+=18000){const b=packed.subarray(start,start+18000),name=`part-${String(i).padStart(3,'0')}.b64`;chunks.push({name,sha256:sha(b)});entries.push({path:prefix+'/'+name,content:b.toString('base64')});}
const manifest={schemaVersion:1,batchId,baseBlobSha,sha256:sha(payload),bytes:payload.length,compressedBytes:packed.length,recordCount:data.records.length,chunks};
entries.push({path:prefix+'/manifest.json',content:JSON.stringify(manifest)});
fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({manifest,entries}));
console.log(JSON.stringify({batchId,chunks:chunks.length,bytes:payload.length,maxRequestCharacters:Math.max(...entries.map(e=>e.content.length))}));
