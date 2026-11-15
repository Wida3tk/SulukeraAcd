import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {startAcademicRecording,handleAcademicRecordingMedia,ensureAcademicRecordingSchema,checkpointAcademicRecording} from './src/academic-recording-media.js';
function database(){
 const db=new DatabaseSync(':memory:');
 const DB={prepare(query){const build=args=>({bind:(...values)=>build(values),run:async()=>({meta:{changes:db.prepare(query).run(...args).changes}}),first:async()=>db.prepare(query).get(...args)});return build([]);},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
 return {db,DB};
}
test('private recording tickets expire; starts neither expose file credentials nor write grades',async()=>{
 const {db,DB}=database(),queries=[],original=DB.prepare;DB.prepare=query=>{queries.push(query);return original(query);};
 const env={DB},result=await startAcademicRecording(env,{id:'lesson',recording_url:'https://drive.google.com/file/d/fileid/view',title:'محاضرة'});
 assert.match(result.mediaPath,/\/academic-recordings\/media\/[\w-]{73}$/);assert(!JSON.stringify(result).includes('fileid'));
 db.prepare('UPDATE academic_recording_tickets SET expires_at=0').run();
 await assert.rejects(()=>handleAcademicRecordingMedia(new Request('https://test'+result.mediaPath),env,result.mediaPath,()=>({})),/PLAYBACK_EXPIRED/);
 assert(queries.every(q=>!q.includes('grades')&&!q.includes('attendance')));
 assert.equal(await handleAcademicRecordingMedia(new Request('https://test/other'),env,'/other',()=>({})),null);
 await assert.rejects(()=>startAcademicRecording(env,{recording_url:'https://other.example/video'}),/NOT_CONFIGURED/);
});
test('watch progress counts only unique visible continuous playback',async()=>{
 const {db,DB}=database(),env={DB};await ensureAcademicRecordingSchema(env);
 db.prepare("INSERT INTO academic_recording_progress VALUES (?,?,?,?,?,0,0,0,'',?)").run('student','lesson','file','[]',100,'now');
 db.prepare('INSERT INTO academic_recording_runs VALUES (?,?,?,?,?,?,?,0,?,?,0)').run('run','student','lesson','file','',100,999999,0,1000);
 await checkpointAcademicRecording(env,'student',{runId:'run',sequence:1,position:0,playing:true,visible:true,seeking:false,rate:1},1000);
 let progress=await checkpointAcademicRecording(env,'student',{runId:'run',sequence:2,position:10,playing:true,visible:true,seeking:false,rate:1},11000);
 assert.equal(progress.percent,10);
 progress=await checkpointAcademicRecording(env,'student',{runId:'run',sequence:3,position:60,playing:true,visible:true,seeking:true,rate:1},12000);
 assert.equal(progress.percent,10);
 progress=await checkpointAcademicRecording(env,'student',{runId:'run',sequence:4,position:61,playing:true,visible:false,seeking:false,rate:1},13000);
 assert.equal(progress.percent,10);
});
