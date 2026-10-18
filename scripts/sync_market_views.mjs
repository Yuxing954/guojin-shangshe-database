import {MarketSync} from './market_sync_core.mjs';
import {mailboxTransport} from './market_sync_mailbox.mjs';
import path from 'node:path';
const args=process.argv.slice(2),stateIndex=args.indexOf('--state');const stateDir=path.resolve(stateIndex>=0?args[stateIndex+1]:'.market-sync-state');
if(!args.includes('--bridge'))throw new Error('Run with --bridge; GitHub must use the connected GitHub tools.');
const transport=mailboxTransport(stateDir);
const sync=new MarketSync({stateDir,transport});
console.log(JSON.stringify({type:'result',...(await sync.run())}));
