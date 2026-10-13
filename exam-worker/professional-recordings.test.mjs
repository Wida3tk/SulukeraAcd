import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import '../student-account-policy.js';
import '../professional-recording-policy.js';
import {checkpoint,handleProfessionalRecordings} from './src/professional-recordings.js';
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('./professional-recordings.sql',import.meta.url),'utf8'));
 const DB={prepare(query){let args=[];return {bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},runSync(){return {meta:{changes:sql.prepare(query).run(...args).changes}};},async run(){return this.runSync();}};},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(s.runSync());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const now=100000;
 function seed(student,run,position=0){sql.prepare('INSERT OR IGNORE INTO professional_recording_progress VALUES(?,?,?,?,?,?,?,?,?)').run(student,'video','[]',0,100,0,0,'','');sql.prepare('INSERT INTO professional_recording_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(run,student,'video','track_1_unit_1','session_1','',100,now+100000,0,position,now,1);}
 return {sql,env:{DB},now,seed};
}
const report=(runId,sequence,position,extra={})=>({runId,sequence,position,rate:1,playing:true,visible:true,seeking:false,...extra});
test('five simultaneous trainees keep isolated progress',async()=>{const f=fixture();for(let i=0;i<5;i++)f.seed('student'+i,'run'+i);await Promise.all(Array.from({length:5},(_,i)=>checkpoint(f.env,'student'+i,report('run'+i,1,i+1),f.now+5000)));for(let i=0;i<5;i++)assert.equal(f.sql.prepare('SELECT watched_seconds FROM professional_recording_progress WHERE student_key=?').get('student'+i).watched_seconds,i+1);});
test('two tabs merge unique ranges without overwriting or double credit',async()=>{const f=fixture();f.seed('student','a');f.seed('student','b',4);await Promise.all([checkpoint(f.env,'student',report('a',1,5),f.now+5000),checkpoint(f.env,'student',report('b',1,9),f.now+5000)]);assert.equal(f.sql.prepare('SELECT watched_seconds FROM professional_recording_progress').get().watched_seconds,9);});
test('seek, background, pause, replay and ownership checks',async()=>{const f=fixture();f.seed('student','a');let p=await checkpoint(f.env,'student',report('a',1,5),f.now+5000);assert.equal(p.seconds,5);p=await checkpoint(f.env,'student',report('a',2,80,{seeking:true}),f.now+10000);assert.equal(p.seconds,5);p=await checkpoint(f.env,'student',report('a',3,85,{visible:false}),f.now+15000);assert.equal(p.seconds,5);p=await checkpoint(f.env,'student',report('a',4,90,{playing:false}),f.now+20000);assert.equal(p.seconds,5);p=await checkpoint(f.env,'student',report('a',4,99),f.now+25000);assert.equal(p.seconds,5);await assert.rejects(checkpoint(f.env,'other',report('a',5,91),f.now+25000),/PLAYBACK_EXPIRED/);});
test('recorded assignment and approval preserve attendance and enrollment',async()=>{
 const f=fixture(),records={students:{student:{status:'active',planType:'PROFESSIONAL'}},professionalEnrollments:{student:{organizational_behavior:{status:'active',selectedTracks:{track_1:true}}}},professionalPrograms:{organizational_behavior:{tracks:{track_1:{units:{unit_1:{status:'published',sessions:{session_1:{recordingUrl:'https://drive.google.com/file/d/video/view'}}}}}}}}};
 const before=JSON.stringify(records),ctx={firebaseRead:async path=>path.split('/').reduce((a,k)=>a?.[k],records)},auth={uid:'admin',token:'token',profile:{role:'admin'}};
 const body={studentKey:'student',unitId:'track_1_unit_1',sessionKey:'session_1',mode:'recorded'};
 const req=()=>new Request('https://test',{method:'POST',body:JSON.stringify(body)});
 await handleProfessionalRecordings(req(),f.env,auth,'/admin/professional-recordings/assignment',ctx);
 await assert.rejects(handleProfessionalRecordings(req(),f.env,auth,'/admin/professional-recordings/approve',ctx),/WATCHING_NOT_COMPLETE/);
 f.seed('student','a');f.sql.prepare('UPDATE professional_recording_progress SET ranges_json=?,watched_seconds=80').run('[[0,80]]');
 await handleProfessionalRecordings(req(),f.env,auth,'/admin/professional-recordings/approve',ctx);
 assert.equal(f.sql.prepare('SELECT approved FROM professional_recording_assignments').get().approved,1);assert.equal(JSON.stringify(records),before);
 const own=await handleProfessionalRecordings(new Request('https://test'),f.env,{token:'token',profile:{role:'student',studentKey:'student'}},'/student/professional-recordings',ctx);assert.equal(own.data.assignments.length,1);
 await assert.rejects(handleProfessionalRecordings(req(),f.env,{profile:{role:'student'}},'/admin/professional-recordings/assignment',ctx),/FORBIDDEN/);
});
test('live attendance takes priority; optional watching never becomes required',()=>{const policy=globalThis.SulukeraRecordingPolicy;assert.equal(policy.status({},null,{percent:100}).mode,'optional');assert.equal(policy.status({attendancePercent:90},{mode:'recorded',approved:1},{percent:100}).mode,'live');assert.equal(policy.status({}, {mode:'recorded',approved:0},{percent:80}).approved,false);});
test('real-player setup is optional, scoped to folder, and admin preview gives no student credit',async()=>{
 const f=fixture(),keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']),pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----';
 f.env.DRIVE_SERVICE_ACCOUNT=JSON.stringify({client_email:'fixture@example.invalid',private_key:pem});f.env.DRIVE_RECORDING_FOLDER_ID='folder';
 const program={tracks:{track_1:{units:{unit_1:{status:'published',sessions:{session_1:{recordingUrl:'https://drive.google.com/file/d/video/view'}}}}}}},ctx={firebaseRead:async path=>path.startsWith('professionalPrograms/')?program:path.startsWith('students/')?{planType:'PROFESSIONAL'}:{status:'active',selectedTracks:{track_1:true}}},originalFetch=globalThis.fetch;
 globalThis.fetch=async url=>String(url).includes('oauth2.googleapis.com')?Response.json({access_token:'fixture-token',expires_in:3600}):Response.json({id:'video',mimeType:'video/mp4',name:'fixture video',parents:['folder'],videoMediaMetadata:{durationMillis:100000},capabilities:{canDownload:true}});
 const request=()=>new Request('https://test',{method:'POST',body:JSON.stringify({unitId:'track_1_unit_1',sessionKey:'session_1'})});
 try{
 const preview=await handleProfessionalRecordings(request(),f.env,{uid:'admin',token:'token',profile:{role:'admin'}},'/admin/professional-recordings/preview',ctx);assert.equal(preview.data.duration,100);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM professional_recording_progress').get().n,0);
 const start=await handleProfessionalRecordings(request(),f.env,{uid:'student',token:'token',profile:{role:'student',studentKey:'student'}},'/student/professional-recordings/start',ctx);assert.equal(start.data.duration,100);assert.equal(start.data.seconds,0);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM professional_recording_assignments').get().n,0);assert.ok(!JSON.stringify(start).includes('fixture-token'));
 }finally{globalThis.fetch=originalFetch;}
});
test('public metadata alone does not claim a recording connection; nested listed videos are accepted',async()=>{
 const {checkedVideo,connection}=await import('./src/drive-recordings.js'),originalFetch=globalThis.fetch,env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({client_email:'fixture@example.invalid'}),DRIVE_RECORDING_FOLDER_ID:'empty-folder'};
 globalThis.fetch=async url=>String(url).includes('/files?')?Response.json({files:[]}):Response.json({id:'empty-folder',name:'empty',mimeType:'application/vnd.google-apps.folder'});
 try{assert.equal((await connection(env)).ready,false);
 env.DRIVE_RECORDING_FOLDER_ID='nested-folder';globalThis.fetch=async url=>{const u=new URL(url);if(u.pathname.endsWith('/files'))return Response.json({files:u.searchParams.get('q').includes('nested-folder')?[{id:'child',mimeType:'application/vnd.google-apps.folder'}]:[{id:'nested-video',mimeType:'video/mp4'}]});return Response.json({id:'nested-video',name:'video',mimeType:'video/mp4',parents:[],videoMediaMetadata:{durationMillis:100000}});};
 assert.equal((await checkedVideo(env,{id:'nested-video'})).duration,100);await assert.rejects(checkedVideo(env,{id:'outside-video'}),/DRIVE_FOLDER_MISMATCH/);
 }finally{globalThis.fetch=originalFetch;}
});
