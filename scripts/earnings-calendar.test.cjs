const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('./earnings-calendar.js');
const days=C.monthDays(2026,7);
assert.equal(days.length,42);assert.equal(days[0],'2026-07-27');assert.equal(days[41],'2026-09-06');
const records=[
 {name:'甲公司',code:'1.SH',sector:'零售',actual:'2026-08-21',expected:'2026-08-20',meeting:'2026-08-25T16:00',meetingEnd:'2026-08-25T17:00'},
 {name:'乙公司',code:'2.SH',sector:'酒店',expected:'2026-08-25'}
];
const events=C.eventsFor(records);
assert.deepEqual(events.map(x=>[x.type,x.date,x.time]),[['report','2026-08-21',''],['meeting','2026-08-25','16:00'],['report','2026-08-25','']]);
assert.equal(events[0].actual,true);assert.equal(events[2].actual,false);
const ics=C.calendar(records,'2026H1');
assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,3);assert.match(ics,/DTSTART;VALUE=DATE:20260821/);assert.match(ics,/DTSTART:20260825T080000Z/);assert.doesNotMatch(ics,/研究交付截止/);
assert.throws(()=>C.validateRecord({meeting:'2026-08-25T17:00',meetingEnd:'2026-08-25T16:00'}));
const pool=C.parseCSV(fs.readFileSync(__dirname+'/../data/商社-标的池与估值跟踪.csv','utf8')),snapshot=JSON.parse(fs.readFileSync(__dirname+'/../data/earnings-snapshot.json','utf8'));
assert.equal(pool.length,32);assert.equal(snapshot.records.length,30);assert.equal(C.eventsFor(snapshot.records).length,30);
console.log('PASS: 42-day calendar grid, report/meeting precedence and ordering, Beijing-time ICS, snapshot coverage');
