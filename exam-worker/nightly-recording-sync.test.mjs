import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {nightlySaudiDate,planNightlyRecording,chooseRecordingFile,discoverNightlyRecordings,nightlyRecordingSchema,processNightlyRecordingQueue} from './src/nightly-recording-sync.js';
import {validateProfessionalSession,publishProfessionalRecording,professionalRecordingKey} from './src/recording-professional-target.js';
const lesson={id:'off_course_07_lesson_1',subject_key:'off_course_07',status:'published',opens_at:'2026-10-04T17:30Z',week:1,title:'المحاضرة 1 — تدخلات تغيير السلوك',recording_url:'',zoom_url:''},meeting={uuid:'instance',meetingId:'88245118262',topic:'interventions'},file={id:'file',start:'2026-10-04T15:00Z',type:'shared_screen_with_speaker_view'};
test('23:00 Saudi is UTC 20:00; mapping is exact, existing links and excluded project remain intact',()=>{
 assert.equal(new Date('2026-10-18T20:00Z').toLocaleString('en-GB',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit'}),'23:00');assert.equal(nightlySaudiDate(Date.parse('2026-10-18T22:00Z')),'2026-10-19');
 assert.equal(planNightlyRecording('rushdacd.sa@gmail.com',meeting,file,[lesson],null).state,'queued');
 assert.equal(planNightlyRecording('rushdacd.sa@gmail.com',meeting,file,[{...lesson,recording_url:'existing'}],null).state,'retained');
 assert.equal(planNightlyRecording('rushdacd1@gmail.com',meeting,file,[lesson],null).state,'review');
 assert.equal(planNightlyRecording('RushdABAT@gmail.com',{meetingId:'82789191279'},file,[],null).state,'excluded');
 assert.equal(chooseRecordingFile([file,{...file,id:'second'}]),null);
});
test('previously reviewed rescheduling does not cause the next recording to bind to a wrong lecture number',()=>{
 const prior={...lesson,id:'one',subject_key:'off_course_08',week:1},future={...prior,id:'three',week:3,opens_at:'2026-10-21T17:30Z',zoom_url:'https://zoom.us/j/85761104229'};
 assert.equal(planNightlyRecording('rushdacd.sa@gmail.com',{...meeting,meetingId:'85761104229'},{...file,start:'2026-10-21T15:00Z'},[prior,future],null,[{source_date:'2026-10-14',lesson_ids:'["one"]'}]).reason,'REVIEWED_SCHEDULE_DIFFERS');
});

test('corrected Reem sequence maps October 21 to lecture two in both cohorts',()=>{
 const prior={...lesson,id:'one',subject_key:'q2_course_08',week:1,opens_at:'2026-10-14T17:30Z',recording_url:'existing'};
 const second={...prior,id:'two',week:2,opens_at:'2026-10-21T17:30Z',recording_url:'',zoom_url:'https://zoom.us/j/85761104229'};
 const other={...second,id:'q3two',subject_key:'q3_course_08'};
 const plan=planNightlyRecording('rushdacd.sa@gmail.com',{...meeting,meetingId:'85761104229'},{...file,start:'2026-10-21T15:00Z'},[prior,second,other],null,[{source_date:'2026-10-14',lesson_ids:'["one"]'}]);
 assert.equal(plan.state,'queued');assert.deepEqual(plan.manifest.lessonIds,['two','q3two']);
 assert.equal(planNightlyRecording('rushdacd.sa@gmail.com',{...meeting,meetingId:'85761104229'},{...file,start:'2026-10-28T15:00Z'},[prior,second,other],null).reason,'NO_EXACT_LECTURE_MATCH');
});
test('professional matching preserves old links, refuses ambiguous units and validates date/meeting',()=>{
 const session={scheduledDate:'2026-10-04',zoomUrl:'https://zoom.us/j/86410858243',title:'one'},unit={status:'published',title:'fundamentals',sessions:{session_1:session}},program={tracks:{track_1:{units:{unit_1:unit}}}},m={...meeting,meetingId:'86410858243'};
 assert.equal(planNightlyRecording('RushdABAT@gmail.com',m,file,[],program).manifest.lessonIds[0],'pro:track_1:unit_1:session_1');
 program.tracks.track_1.units.unit_2=unit;assert.equal(planNightlyRecording('RushdABAT@gmail.com',m,file,[],program).reason,'AMBIGUOUS_PROFESSIONAL_SESSION');
 session.recordingUrl='existing';assert.equal(planNightlyRecording('RushdABAT@gmail.com',m,file,[],program).state,'retained');
 assert.throws(()=>validateProfessionalSession(unit,session,'2026-10-05','86410858243'),/DATE_MISMATCH/);assert.throws(()=>professionalRecordingKey('pro:../../:unit_1:session_1'),/INVALID/);
});
test('professional publication conditionally writes only recordingUrl; never progress or attendance',async()=>{
 const original=globalThis.fetch,calls=[];let value=null;
 globalThis.fetch=async(url,options)=>{calls.push({url,options});assert(url.endsWith('/tracks/track_1/units/unit_1/sessions/session_1/recordingUrl.json'));if(options.method==='PUT'){assert.equal(options.headers['If-Match'],'etag');value=JSON.parse(options.body);}return Response.json(value,{headers:{ETag:'etag'}});};
 try{await publishProfessionalRecording({}, {firebaseAdminToken:async()=> 'private'},'pro:track_1:unit_1:session_1','https://drive.google.com/file/d/video/view','');assert.equal(calls.filter(c=>c.options.method==='PUT').length,1);await publishProfessionalRecording({}, {firebaseAdminToken:async()=> 'private'},'pro:track_1:unit_1:session_1',value,'');assert.equal(calls.filter(c=>c.options.method==='PUT').length,1);}finally{globalThis.fetch=original;}
});
function fixture(){const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE course_lessons(id TEXT);CREATE TABLE zoom_drive_transfers(source_id TEXT,state TEXT);');const DB={exec:async q=>sql.exec(q),prepare(q){const build=args=>({bind:(...a)=>build(a),first:async()=>sql.prepare(q).get(...args)||null,all:async()=>({results:sql.prepare(q).all(...args)}),run:async()=>({meta:{changes:sql.prepare(q).run(...args).changes}})});return build([]);}};return {sql,env:{DB}};}
test('account discovery scans once per day and an idle continuation never calls Zoom',async()=>{
 const {sql,env}=fixture();let scans=0;const options={now:Date.parse('2026-10-18T20:00Z'),catalogReader:async()=>{scans++;return {recordings:[]};},programReader:async()=>null};
 await discoverNightlyRecordings(env,{},options);assert.equal(scans,3);assert.equal((await discoverNightlyRecordings(env,{},options)).alreadyScanned,true);assert.equal(scans,3);
 assert.equal((await processNightlyRecordingQueue(env,{},()=>{throw Error('should not transfer');})).idle,true);sql.close();
});
test('queued file resumes without discovery and becomes complete; bounded failures are reviewable',async()=>{
 const {sql,env}=fixture();await nightlyRecordingSchema(env);sql.prepare('INSERT INTO nightly_recording_jobs VALUES(?,?,?,?,?,?,?)').run('file','{}','test','queued','',0,'now');let chunks=0;
 const result=await processNightlyRecordingQueue(env,{},async()=>({state:++chunks===2?'complete':'uploading'}));assert.equal(result.state,'complete');assert.equal(chunks,2);assert.equal(sql.prepare('SELECT state FROM nightly_recording_jobs').get().state,'complete');sql.close();
});
