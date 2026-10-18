import fs from 'node:fs/promises';
import path from 'node:path';
const [mode,file,arg,limit]=process.argv.slice(2);
if(mode==='read')process.stdout.write(await fs.readFile(file,'utf8'));
else if(mode==='chunk'){
 const raw=await fs.readFile(file,'utf8'),start=Number(arg||0),size=Number(limit||8000);
 process.stdout.write(JSON.stringify({data:raw.slice(start,start+size),total:raw.length}));
}
else if(mode==='write'){
 await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,Buffer.from(arg,'base64'));
}else throw new Error('Expected read or write');
