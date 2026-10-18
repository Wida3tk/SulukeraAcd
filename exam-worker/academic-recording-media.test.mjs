import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {startAcademicRecording,handleAcademicRecordingMedia} from './src/academic-recording-media.js';
test('private recording tickets expire; starts neither expose file credentials nor write grades',async()=>{
 const db=new DatabaseSync(':memory:'),queries=[];
 const DB={prepare(query){queries.push(query);const build=args=>({bind:(...values)=>build(values),run:async()=>({meta:{changes:db.prepare(query).run(...args).changes}}),first:async()=>db.prepare(query).get(...args)});return build([]);},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
 const env={DB},result=await startAcademicRecording(env,{id:'lesson',recording_url:'https://drive.google.com/file/d/fileid/view',title:'محاضرة'});
 assert.match(result.mediaPath,/\/academic-recordings\/media\/[\w-]{73}$/);assert(!JSON.stringify(result).includes('fileid'));
 db.prepare('UPDATE academic_recording_tickets SET expires_at=0').run();
 await assert.rejects(()=>handleAcademicRecordingMedia(new Request('https://test'+result.mediaPath),env,result.mediaPath,()=>({})),/PLAYBACK_EXPIRED/);
 assert(queries.every(q=>!q.includes('grades')&&!q.includes('attendance')));
 assert.equal(await handleAcademicRecordingMedia(new Request('https://test/other'),env,'/other',()=>({})),null);
 await assert.rejects(()=>startAcademicRecording(env,{recording_url:'https://other.example/video'}),/NOT_CONFIGURED/);
});
