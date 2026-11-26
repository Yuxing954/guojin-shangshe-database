const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');

const [directory, date] = process.argv.slice(2);
if (!directory || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error('Usage: node scan_library_metadata.cjs batch-directory YYYY-MM-DD');
}
const day = new Date(date + 'T00:00:00+08:00');
const windowStart = new Date(day.getTime() - 2 * 86400000);
const end = day.getTime() + 86400000;
const startText = new Date(windowStart.getTime() + 8 * 3600000).toISOString().slice(0, 10) + 'T00:00:00+08:00';
fs.mkdirSync(directory, { recursive: true });
const atomic = (name, data) => {
  const file = path.join(directory, name);
  fs.writeFileSync(file + '.tmp', JSON.stringify(data));
  fs.renameSync(file + '.tmp', file);
};
const topics = new Map();
let cursor = null, pages = 0, topicsScanned = 0, boundary = false, latest = null;
const metadataKeys = ['file_id', 'name', 'size', 'create_time', 'download_count', 'duration', 'hash', 'source', 'mime_type', 'mime'];
while (!boundary) {
  const name = 'page-' + (pages + 1) + '.json';
  const file = path.join(directory, name);
  let page;
  if (fs.existsSync(file)) {
    page = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (page.cursor !== cursor || page.windowStart !== startText) throw new Error('Saved page does not match scan window or cursor');
  } else {
    const args = ['group', '+topics', '--group-id', '88888142214212', '--limit', '30', '--json'];
    if (cursor) args.push('--end-time', cursor);
    let raw;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        raw = cp.execFileSync('C:/Users/daiyu/AppData/Roaming/npm/node_modules/zsxq-cli/node_modules/@zsxq/cli-win32-x64/bin/zsxq-cli.exe', args, {encoding:'utf8', timeout:45000, maxBuffer:8e6, windowsHide:true});
        break;
      } catch (e) { if (attempt === 1) throw e; }
    }
    const result = JSON.parse(raw);
    if (!result.success || !Array.isArray(result.topics_brief) || !result.topics_brief.length) throw new Error('Invalid topic page');
    page = {cursor, windowStart:startText, has_more:result.has_more, next_end_time:result.next_end_time,
      topics:result.topics_brief.map(t => ({topic_id:t.topic_id,create_time:t.create_time,title:t.title,
        files:(t.files || []).map(f => Object.fromEntries(metadataKeys.filter(key => f[key] != null).map(key => [key,f[key]])))}))};
    atomic(name,page);
  }
  pages++;
  topicsScanned += page.topics.length;
  for (const topic of page.topics) {
    const stamp=Date.parse(topic.create_time);
    if (!topic.topic_id || !Number.isFinite(stamp)) throw new Error('Topic metadata incomplete');
    if (stamp < windowStart.getTime()) boundary=true;
    else if (stamp < end) {
      if (!latest || stamp > Date.parse(latest)) latest=topic.create_time;
      topics.set(String(topic.topic_id),topic);
    }
  }
  if (!boundary) {
    if (!page.has_more || !page.next_end_time || page.next_end_time === cursor) throw new Error('Incomplete window; cursor stopped');
    cursor=page.next_end_time;
  }
}
const files = new Map();
let attachments = 0;
for (const t of topics.values()) {
  for (const f of t.files) {
    if (!f.file_id || !f.name || !Number.isFinite(Date.parse(f.create_time)) || !Number.isSafeInteger(f.size) || f.size < 0) throw new Error('Required file metadata missing');
    const id=String(f.file_id);
    if (!files.has(id)) files.set(id,[]);
    files.get(id).push({topicId:String(t.topic_id),topicCreatedAt:t.create_time,topicTitle:t.title,...f});
    attachments++;
  }
}
const scan={windowStart:startText, windowEndDate:date, observedAt:new Date().toISOString(),latest,pages,topicsScanned,topics:topics.size,attachments,unique:files.size,boundaryReachedBeforeWindow:true,files:[...files]};
atomic('scan.json',scan);
console.log(JSON.stringify({...scan,files:undefined}));
