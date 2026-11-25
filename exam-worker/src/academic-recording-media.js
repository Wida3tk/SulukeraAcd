import {continuousPlaybackRange} from './recording-playback-policy.js';
import '../../recording-watch-model.js';
import {driveFile,checkedVideo,streamVideo} from './drive-recordings.js';
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
export async function ensureAcademicRecordingSchema(env){
 for(const sql of [
  'CREATE TABLE IF NOT EXISTS academic_recording_tickets (id TEXT PRIMARY KEY,file_id TEXT NOT NULL,resource_key TEXT NOT NULL,lesson_id TEXT NOT NULL,expires_at INTEGER NOT NULL)',
  "CREATE TABLE IF NOT EXISTS academic_recording_progress (student_key TEXT NOT NULL,lesson_id TEXT NOT NULL,file_id TEXT NOT NULL,ranges_json TEXT NOT NULL DEFAULT '[]',duration_seconds REAL NOT NULL,watched_seconds REAL NOT NULL DEFAULT 0,last_position REAL NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 0,last_nonce TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,PRIMARY KEY(student_key,lesson_id))",
  'CREATE TABLE IF NOT EXISTS academic_recording_runs (id TEXT PRIMARY KEY,student_key TEXT NOT NULL,lesson_id TEXT NOT NULL,file_id TEXT NOT NULL,resource_key TEXT NOT NULL,duration_seconds REAL NOT NULL,expires_at INTEGER NOT NULL,last_sequence INTEGER NOT NULL DEFAULT 0,last_position REAL NOT NULL DEFAULT 0,last_time INTEGER NOT NULL,playing INTEGER NOT NULL DEFAULT 0)'
 ])await env.DB.prepare(sql).bind().run();
}
export async function academicRecordingProgress(env,studentKey,lessonId){
 await ensureAcademicRecordingSchema(env);const row=await env.DB.prepare('SELECT * FROM academic_recording_progress WHERE student_key=? AND lesson_id=?').bind(studentKey,lessonId).first();
 if(!row)return {seconds:0,percent:0,lastPosition:0,ranges:[]};
 return {...globalThis.SulukeraWatch.summary(JSON.parse(row.ranges_json),row.duration_seconds),duration:row.duration_seconds,lastPosition:row.last_position,updatedAt:row.updated_at};
}
export async function startAcademicRecording(env,lesson,studentKey=null){
 const file=driveFile(lesson.recording_url);if(!file)fail('RECORDING_NOT_CONFIGURED',404);await ensureAcademicRecordingSchema(env);
 const now=Date.now(),id=crypto.randomUUID()+'-'+crypto.randomUUID(),expires=now+3*3600000;
 if(!studentKey){await env.DB.batch([env.DB.prepare('DELETE FROM academic_recording_tickets WHERE expires_at<?').bind(now),env.DB.prepare('INSERT INTO academic_recording_tickets VALUES(?,?,?,?,?)').bind(id,file.id,file.resourceKey,lesson.id,expires)]);return {mediaPath:'/academic-recordings/media/'+id,title:lesson.title};}
 const video=await checkedVideo(env,file),prior=await env.DB.prepare('SELECT * FROM academic_recording_progress WHERE student_key=? AND lesson_id=?').bind(studentKey,lesson.id).first();
 if(prior&&prior.file_id!==file.id)fail('RECORDING_CHANGED_REVIEW_REQUIRED',409);
 const position=Math.min(Number(prior?.last_position)||0,video.duration),at=new Date(now).toISOString();
 await env.DB.batch([
  env.DB.prepare('DELETE FROM academic_recording_tickets WHERE expires_at<?').bind(now),
  env.DB.prepare('INSERT INTO academic_recording_tickets VALUES(?,?,?,?,?)').bind(id,file.id,file.resourceKey,lesson.id,expires),
  env.DB.prepare("INSERT OR IGNORE INTO academic_recording_progress VALUES (?,?,?,?,?,0,0,0,'',?)").bind(studentKey,lesson.id,file.id,'[]',video.duration,at),
  env.DB.prepare('INSERT INTO academic_recording_runs VALUES (?,?,?,?,?,?,?,0,?,?,0)').bind(id,studentKey,lesson.id,file.id,file.resourceKey,video.duration,expires,position,now)
 ]);
 return {runId:id,mediaPath:'/academic-recordings/media/'+id,duration:video.duration,title:lesson.title,...await academicRecordingProgress(env,studentKey,lesson.id)};
}
export async function checkpointAcademicRecording(env,studentKey,body,now=Date.now()){
 const position=Number(body.position),sequence=Number(body.sequence),rate=Number(body.rate)||1;
 if(!Number.isFinite(position)||position<0||!Number.isInteger(sequence)||sequence<1||rate<.25||rate>2)fail('INVALID_CHECKPOINT');
 for(let attempt=0;attempt<5;attempt++){
  const run=await env.DB.prepare('SELECT * FROM academic_recording_runs WHERE id=? AND student_key=?').bind(String(body.runId||''),studentKey).first();if(!run||run.expires_at<now)fail('PLAYBACK_EXPIRED',403);
  if(sequence<=run.last_sequence)return academicRecordingProgress(env,studentKey,run.lesson_id);
  const progress=await env.DB.prepare('SELECT * FROM academic_recording_progress WHERE student_key=? AND lesson_id=?').bind(studentKey,run.lesson_id).first();if(!progress)fail('PROGRESS_NOT_FOUND',404);
  const end=Math.min(run.duration_seconds,position),ranges=JSON.parse(progress.ranges_json);
  const watched=continuousPlaybackRange(run,body,now);if(watched)ranges.push(watched);
  const summary=globalThis.SulukeraWatch.summary(ranges,run.duration_seconds),nonce=crypto.randomUUID(),at=new Date(now).toISOString();
  const results=await env.DB.batch([
   env.DB.prepare('UPDATE academic_recording_progress SET ranges_json=?,watched_seconds=?,last_position=?,version=version+1,last_nonce=?,updated_at=? WHERE student_key=? AND lesson_id=? AND version=? AND EXISTS(SELECT 1 FROM academic_recording_runs WHERE id=? AND last_sequence=?)').bind(JSON.stringify(summary.ranges),summary.seconds,end,nonce,at,studentKey,run.lesson_id,progress.version,run.id,run.last_sequence),
   env.DB.prepare('UPDATE academic_recording_runs SET last_sequence=?,last_position=?,last_time=?,playing=? WHERE id=? AND last_sequence=? AND EXISTS(SELECT 1 FROM academic_recording_progress WHERE student_key=? AND lesson_id=? AND last_nonce=?)').bind(sequence,end,now,body.playing?1:0,run.id,run.last_sequence,studentKey,run.lesson_id,nonce)
  ]);
  if(results[0]?.meta?.changes)return {...await academicRecordingProgress(env,studentKey,run.lesson_id),lessonId:run.lesson_id};
 }
 fail('CHECKPOINT_RETRY',409);
}
export async function handleAcademicRecordingMedia(request,env,path,corsHeaders){
 const match=path.match(/^\/academic-recordings\/media\/([\w-]{73})$/);if(!match)return null;
 if(!['GET','HEAD'].includes(request.method))fail('METHOD_NOT_ALLOWED',405);await ensureAcademicRecordingSchema(env);
 const ticket=await env.DB.prepare('SELECT * FROM academic_recording_tickets WHERE id=?').bind(match[1]).first();if(!ticket||ticket.expires_at<Date.now())fail('PLAYBACK_EXPIRED',403);
 const response=await streamVideo(env,{id:ticket.file_id,resourceKey:ticket.resource_key},request.headers.get('Range'));if(!response.ok&&response.status!==206){await response.body?.cancel();fail('DRIVE_VIDEO_UNAVAILABLE',503);}
 const headers={...corsHeaders(request),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};for(const key of ['Content-Type','Content-Length','Content-Range','Accept-Ranges'])if(response.headers.has(key))headers[key]=response.headers.get(key);
 return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}
