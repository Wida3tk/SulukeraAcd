import test from 'node:test';import assert from 'node:assert/strict';
import {attendanceMinutes,matchAttendance,attendanceTargets,zoomUuidPath,attendanceSchema,applyAttendanceReport} from './src/zoom-attendance-sync.js';
import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
test('reconnects and simultaneous devices count unique clipped minutes, not the sum',()=>{
 const start=Date.parse('2026-10-11T15:00Z'),end=start+120*60000;
 assert.equal(attendanceMinutes([['2026-10-11T14:50Z','2026-10-11T15:40Z'],['2026-10-11T15:20Z','2026-10-11T16:00Z']],start,end),60);
 assert.equal(attendanceMinutes([['bad','bad']],start,end),0);
});
test('identity matching rejects fuzzy and duplicate names and prefers unique email',()=>{
 const students=[{key:'a',email:'a@example.com',name:'مريم محمد عمر',id:'SUL-079'},{key:'b',name:'مريم محمد عمر'}];
 assert.equal(matchAttendance({name:'مريم محمد عمر'},students),null);assert.equal(matchAttendance({name:'مريم عمر'},students),null);
 assert.equal(matchAttendance({email:'A@EXAMPLE.COM',name:'different'},students),'a');assert.equal(matchAttendance({name:'SUL-079 مريم'},students),'a');
});
test('academic mapping is date plus meeting ID; copied professional dates are ambiguous',()=>{
 const report={starts_at:'2026-10-05T15:00Z',meeting_id:'123'},lessons=[{id:'one',subject_key:'subject',status:'published',opens_at:'2026-10-05T17:30Z',zoom_url:'https://zoom.us/j/123'}];
 assert.equal(attendanceTargets(report,lessons,{},null).academic[0].id,'one');assert.equal(attendanceTargets({...report,meeting_id:'456'},lessons,{},null).academic.length,0);
 const unit={status:'published',sessions:{session_3:{scheduledDate:'2026-10-05',zoomUrl:'https://zoom.us/j/123'}}};
 assert.equal(attendanceTargets(report,[],{},{tracks:{track_1:{units:{unit_1:unit,unit_2:unit}}}}).ambiguous,true);
 assert.equal(zoomUuidPath('/a//b'),'%252Fa%252F%252Fb');
});
test('live importer supports dry run, protects explicit zero and manual imports, queues only attendance and is idempotent',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('./coursework.sql',import.meta.url),'utf8'));sql.exec(readFileSync(new URL('./coursework_sync_triggers.sql',import.meta.url),'utf8'));sql.exec('CREATE TABLE zoom_drive_transfers(meeting_uuid TEXT,lesson_ids TEXT);');
 const DB={exec:async q=>sql.exec(q),prepare(q){const build=args=>({bind:(...a)=>build(a),first:async()=>sql.prepare(q).get(...args)||null,all:async()=>({results:sql.prepare(q).all(...args)}),run:async()=>({meta:{changes:sql.prepare(q).run(...args).changes}})});return build([]);},batch:async a=>Promise.all(a.map(s=>s.run()))};const env={DB};await attendanceSchema(env);
 sql.prepare('INSERT INTO course_lessons VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('lesson','subject',1,'Test','2026-10-11T17:30Z','2026-10-17T17:30Z','[]','published','https://zoom.us/j/123','','',120,'now');
 const records={students:{a:{name:'Student One',email:'a@example.com',planType:'QBA',accountStatus:'active'}},subjects:{subject:{courseKey:'course_07'}},enrollments:{one:{subjectKey:'subject',studentKey:'a'}},packages:{},grades:{},professionalEnrollments:{},professionalProgress:{}};
 const report={id:'report',uuid:'instance',host:'rushdacd.sa@gmail.com',meeting_id:'123',starts_at:'2026-10-11T15:00Z',ends_at:'2026-10-11T17:00Z',participants_json:JSON.stringify([{name:'different',email:'a@example.com',join_time:'2026-10-11T15:00Z',leave_time:'2026-10-11T16:00Z'}])},original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{assert.equal(options.method||'GET','GET');const p=new URL(url).pathname.slice(1,-5);return Response.json(records[p]||null);};
 try{
  const ctx={firebaseAdminToken:async()=> 'token'};const preview=await applyAttendanceReport(env,ctx,report,true);assert.equal(preview.applied,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM course_attendance').get().n,0);
  records.grades={manual:{studentKey:'a',subjectKey:'subject',w1_attend:0,w1_attendEntered:true}};
  assert.equal((await applyAttendanceReport(env,ctx,report)).protected,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM course_attendance').get().n,0);
  records.grades={};assert.equal((await applyAttendanceReport(env,ctx,report)).applied,1);assert.equal(sql.prepare('SELECT percent FROM course_attendance').get().percent,50);
  const pending=sql.prepare('SELECT * FROM coursework_sync').get();assert.equal(pending.state,'pending');assert.match(pending.error,/attendance-policy/);
  assert.equal((await applyAttendanceReport(env,ctx,report)).protected,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM course_attendance').get().n,1);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM homework_attempts').get().n,0);assert.equal(sql.prepare('SELECT COUNT(*) n FROM academic_discussions').get().n,0);
 }finally{globalThis.fetch=original;sql.close();}
});
