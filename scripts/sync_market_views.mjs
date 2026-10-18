import {MarketSync,atomic,hash} from './market_sync_core.mjs';
import path from 'node:path';
import {createInterface} from 'node:readline';
const args=process.argv.slice(2),stateIndex=args.indexOf('--state');const stateDir=path.resolve(stateIndex>=0?args[stateIndex+1]:'.market-sync-state');
if(!args.includes('--bridge'))throw new Error('Run with --bridge; GitHub must use the connected GitHub tools.');
const lines=createInterface({input:process.stdin,crlfDelay:Infinity})[Symbol.asyncIterator]();
const transport=async requests=>{
 const requestFile=path.join(stateDir,'outbox',hash(JSON.stringify(requests))+'.json');
 await atomic(requestFile,{requests});
 console.log(JSON.stringify({type:'rpc',requestFile}));
 let timer;const next=await Promise.race([lines.next(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Connector bridge response timeout after 90 seconds; checkpoint retained')),90000);})]).finally(()=>clearTimeout(timer));if(next.done)throw new Error('Connector bridge disconnected; checkpoint retained');
 const response=JSON.parse(next.value);if(!Array.isArray(response.results)||response.results.length!==requests.length)throw new Error('Connector response count mismatch');
 return response.results;
};
const sync=new MarketSync({stateDir,transport});
console.log(JSON.stringify({type:'result',...(await sync.run())}));
process.stdin.destroy();
