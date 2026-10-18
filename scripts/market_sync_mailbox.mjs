import {atomic,hash} from './market_sync_core.mjs';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
export function mailboxTransport(stateDir,emit=message=>console.log(JSON.stringify(message)),timeoutMs=90000){
 return async requests=>{
  const requestFile=path.join(stateDir,'outbox',hash(JSON.stringify(requests))+'-'+crypto.randomUUID()+'.json'),responseFile=requestFile+'.response';
  await atomic(requestFile,{requests});emit({type:'rpc',requestFile,responseFile});
  const deadline=Date.now()+timeoutMs;
  for(;;){try{await fs.access(responseFile);break;}catch(e){if(e.code!=='ENOENT')throw e;}if(Date.now()>deadline)throw new Error('Connector response timeout; checkpoint retained');await new Promise(resolve=>setTimeout(resolve,100));}
  const response=JSON.parse(await fs.readFile(responseFile,'utf8'));await fs.unlink(responseFile);
  if(!Array.isArray(response.results)||response.results.length!==requests.length)throw new Error('Connector response count mismatch');
  return response.results;
 };
}
