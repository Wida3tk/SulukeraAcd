import test from 'node:test';import assert from 'node:assert/strict';
import {safeMeeting,validateLessonBindings,transferRecordingStep,transferAccount,inspectAttendanceAccess} from './src/zoom-drive-transfer.js';
test('attendance permissions preflight is read-only and exposes no participants or tokens',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push([url,options.method||'GET']);if(url==='https://zoom.us/oauth/token')return Response.json({access_token:'private-token'});return Response.json({code:4711,message:'private details',participants:[{name:'private student'}]},{status:400});};
 try{const r=await inspectAttendanceAccess({ZOOM_ACCOUNT_RUSHDACD1:JSON.stringify({hostEmail:'rushdacd1@gmail.com',clientId:'id',clientSecret:'secret',accountId:'account'})},'rushdacd1@gmail.com');assert.equal(r.participants.code,4711);assert.equal(r.meetings.allowed,false);assert(!JSON.stringify(r).includes('private'));assert(calls.slice(1).every(([,method])=>method==='GET'));}finally{globalThis.fetch=original;}
});
test('separate Zoom connections preserve the first account and reject unknown or mismatched hosts',()=>{
 const env={ZOOM_PILOT_CREDENTIALS:JSON.stringify({hostEmail:'rushdacd.sa@gmail.com',clientSecret:'first'}),ZOOM_ACCOUNT_RUSHDACD1:JSON.stringify({hostEmail:'rushdacd1@gmail.com',clientSecret:'second'}),ZOOM_ACCOUNT_RUSHDABAT:JSON.stringify({hostEmail:'RushdABAT@gmail.com',clientSecret:'third'})};
 const second=transferAccount(env,'rushdacd1@gmail.com');assert.equal(JSON.parse(second.ZOOM_PILOT_CREDENTIALS).clientSecret,'second');assert.equal(JSON.parse(env.ZOOM_PILOT_CREDENTIALS).clientSecret,'first');assert.equal(transferAccount(env).RECORDING_TRANSFER_HOST,'rushdacd.sa@gmail.com');
 assert.throws(()=>transferAccount(env,'other@example.com'),/ACCOUNT_NOT_ENABLED/);
 assert.equal(JSON.parse(transferAccount(env,'RushdABAT@gmail.com').ZOOM_PILOT_CREDENTIALS).clientSecret,'third');
 assert.throws(()=>transferAccount({...env,ZOOM_ACCOUNT_RUSHDACD1:env.ZOOM_PILOT_CREDENTIALS},'rushdacd1@gmail.com'),/ACCOUNT_SCOPE_MISMATCH/);
});
test('catalog never exposes Zoom download URLs or nonvideo files',()=>{
 const m=safeMeeting({id:123,uuid:'instance',recording_files:[{id:'mp4',status:'completed',file_type:'MP4',download_url:'private',file_size:100},{id:'chat',status:'completed',file_type:'TXT'}]});
 assert.equal(m.meetingId,'123');assert.equal(m.files.length,1);assert(!JSON.stringify(m).includes('private'));
});
test('a completed job cannot be resumed through another account, even before any external request',async()=>{
 const row={source_id:'source',meeting_uuid:'instance',folder_id:'folder',lesson_ids:'["lesson"]',state:'complete'};
 const DB={prepare(query){return {run:async()=>({meta:{changes:0}}),bind(){return {first:async()=>query.includes('SELECT host_email')?{host_email:'rushdacd.sa@gmail.com'}:row};}};}};
 const env={DB,ZOOM_ACCOUNT_RUSHDACD1:JSON.stringify({hostEmail:'rushdacd1@gmail.com'})};
 await assert.rejects(()=>transferRecordingStep(env,{host:'rushdacd1@gmail.com',sourceId:'source',uuid:'instance',folderId:'folder',lessonIds:['lesson']}),/TRANSFER_ACCOUNT_CONFLICT/);
});
test('resumed transfer trusts Drive offset, buffers only requested range, and releases lease without writing marks',async()=>{
 const queries=[],row={source_id:'source',meeting_uuid:'instance',folder_id:'folder',lesson_ids:'["lesson"]',expected_size:100,drive_id:'existing-drive-id',session_url:'https://www.googleapis.com/upload/session',uploaded:0,state:'pending'};
 const DB={prepare(query){queries.push(query);return {bind(){return {first:async()=>row,run:async()=>({meta:{changes:1}})};},run:async()=>({meta:{changes:0}})};}};
 const env={DB,DRIVE_RECORDING_FOLDER_ID:'1-BRS05bBFJhX8GlW9o3ECxZaJ2UnFi-N',DRIVE_UPLOAD_OAUTH:JSON.stringify({rootId:'1-BRS05bBFJhX8GlW9o3ECxZaJ2UnFi-N',client_id:'client',client_secret:'secret',refresh_token:'refresh'}),ZOOM_PILOT_CREDENTIALS:JSON.stringify({hostEmail:'rushdacd.sa@gmail.com',clientId:'client',clientSecret:'secret',accountId:'account'})};
 const original=globalThis.fetch;let uploads=0;
 globalThis.fetch=async(url,options)=>{
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'drive-token'});
  if(url==='https://zoom.us/oauth/token')return Response.json({access_token:'zoom-token'});
  if(url.startsWith('https://api.zoom.us/')){assert(url.includes('/meetings/instance/recordings'));return Response.json({uuid:'instance',id:123,recording_files:[{id:'source',file_type:'MP4',status:'completed',file_size:100,download_url:'https://zoom.us/download'}]});}
  if(url==='https://zoom.us/download'){assert.equal(options.headers.Range,'bytes=50-99');return new Response(new Uint8Array(50),{status:206,headers:{'Content-Range':'bytes 50-99/100'}});}
  if(url===row.session_url){if(options.headers['Content-Range']==='bytes */100')return new Response(null,{status:308,headers:{Range:'bytes=0-49'}});uploads++;assert.equal(options.body.byteLength,50);assert.equal(options.headers['Content-Range'],'bytes 50-99/100');return new Response(null,{status:308,headers:{Range:'bytes=0-99'}});}
  throw Error('Unexpected external request');
 };
 try{const result=await transferRecordingStep(env,{sourceId:'source',uuid:'instance',folderId:'folder',lessonIds:['lesson']});assert.equal(result.uploaded,100);assert.equal(uploads,1);assert(queries.some(q=>q.includes('lock_until=0')));assert(queries.every(q=>!q.includes('grades')&&!q.includes('attendance')&&!q.includes('UPDATE course_lessons')));}finally{globalThis.fetch=original;}
});
test('binding requires exact lecture date and same course for shared cohorts',()=>{
 const rows=[{id:'a',opens_at:'2026-10-04T17:30:00Z',title:'المحاضرة 1 — تدخلات تغيير السلوك'},{id:'b',opens_at:'2026-10-04T17:30:00Z',title:'المحاضرة 1 — تدخلات تغيير السلوك'}];
 assert.doesNotThrow(()=>validateLessonBindings(rows,['a','b'],'2026-10-04'));
 assert.throws(()=>validateLessonBindings(rows,['a','b'],'2026-10-11'),/DATE_MISMATCH/);
 assert.throws(()=>validateLessonBindings(rows,['a','a'],'2026-10-04'),/IDS_REQUIRED/);
 assert.throws(()=>validateLessonBindings([...rows.slice(0,1),{...rows[1],title:'مقرر مختلف'}],['a','b'],'2026-10-04'),/COURSE_MISMATCH/);
 const rescheduled=rows.map(row=>({...row,zoom_url:'https://us06web.zoom.us/j/123'}));
 assert.doesNotThrow(()=>validateLessonBindings(rescheduled,['a','b'],'2026-10-14',{meetingId:'123',reason:'Owner explicitly confirmed first lecture on October 14.'}));
 assert.throws(()=>validateLessonBindings(rescheduled,['a','b'],'2026-10-14',{meetingId:'456',reason:'Owner explicitly confirmed first lecture on October 14.'}),/DATE_MISMATCH/);
});
