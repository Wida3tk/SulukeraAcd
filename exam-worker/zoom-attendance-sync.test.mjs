import test from 'node:test';import assert from 'node:assert/strict';
import {attendanceMinutes,matchAttendance,attendanceTargets,zoomUuidPath,attendanceSchema,applyAttendanceReport,attendanceEligibleStudents,approvedAttendanceIdentity,approveAttendanceAlias} from './src/zoom-attendance-sync.js';
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
test('shared meeting roster separates Q2/Q3 and approved identities survive course changes without accepting conflicts',()=>{
 const root={students:{q2:{name:'مريم محمد عمر',accountStatus:'active',planType:'QBA'},q3:{name:'منى سالم عمر',accountStatus:'active',planType:'QBA'}},subjects:{s2:{courseKey:'course_09'},s3:{courseKey:'course_09'}},enrollments:{a:{studentKey:'q2',subjectKey:'s2'},b:{studentKey:'q3',subjectKey:'s3'}}},lessons=[{id:'l2',subject_key:'s2'},{id:'l3',subject_key:'s3'}];
 assert.deepEqual(attendanceEligibleStudents('l3',root,lessons).map(s=>s.key),['q3']);
 assert.deepEqual(attendanceEligibleStudents('l2',root,lessons).map(s=>s.key),['q2']);
 assert.deepEqual(attendanceEligibleStudents('missing',root,lessons),[]);
 const roster=attendanceEligibleStudents('l2',root,lessons),aliases=[{scope_key:'old',zoom_name:'maryam',student_key:'q2'}];
 assert.equal(approvedAttendanceIdentity(aliases,'s2','Maryam',roster),'q2');
 assert.equal(approvedAttendanceIdentity(aliases,'s3','Maryam',attendanceEligibleStudents('l3',root,lessons)),null);
 assert.equal(approvedAttendanceIdentity([...aliases,{scope_key:'another',zoom_name:'maryam',student_key:'q3'}],'s2','Maryam',roster),null);
 assert.equal(matchAttendance({name:'‏مريم محمد عمر 🌸'},roster),'q2');
 assert.equal(matchAttendance({name:'مريم عمر'},roster),null,'partial names still require human confirmation');
});
test('alias approval accepts enrolled Q2 student in Q2 scope and rejects wrong cohort without writing an alias',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE course_lessons(id TEXT,subject_key TEXT);');
 const DB={exec:async q=>sql.exec(q),prepare(q){const build=args=>({bind:(...a)=>build(a),first:async()=>sql.prepare(q).get(...args)||null,all:async()=>({results:sql.prepare(q).all(...args)}),run:async()=>({meta:{changes:sql.prepare(q).run(...args).changes}})});return build([]);}};
 const env={DB};await attendanceSchema(env);sql.exec("INSERT INTO course_lessons VALUES('l2','s2'),('l3','s3');");
 sql.prepare('INSERT INTO zoom_attendance_reports VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('r','host','uuid','123','Shared','start','end',JSON.stringify([{name:'Name'}]),'partial',JSON.stringify({targets:['l3','l2']}),'now');
 const root={students:{q2:{accountStatus:'active',planType:'QBA'}},subjects:{s2:{courseKey:'course_09'},s3:{courseKey:'course_09'}},enrollments:{e:{studentKey:'q2',subjectKey:'s2'}},packages:{}};
 const original=globalThis.fetch;globalThis.fetch=async url=>{const path=new URL(url).pathname.slice(1,-5).split('/');return Response.json(path.reduce((v,k)=>v?.[k],root)||null);};
 try{
  const ctx={firebaseAdminToken:async()=> 'token'},body={reportId:'r',scopeKey:'l3',studentKey:'q2',zoomName:'Name'};
  await assert.rejects(approveAttendanceAlias(env,ctx,body,'admin'),/STUDENT_NOT_ENROLLED/);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM zoom_attendance_aliases').get().n,0);
  assert.equal((await approveAttendanceAlias(env,ctx,{...body,scopeKey:'l2'},'admin')).saved,true);
  assert.equal(sql.prepare('SELECT scope_key FROM zoom_attendance_aliases').get().scope_key,'s2');
 }finally{globalThis.fetch=original;sql.close();}
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
