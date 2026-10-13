import '../../recording-watch-model.js';
import {driveFile,checkedVideo,streamVideo,connection} from './drive-recordings.js';
const programId='organizational_behavior',fail=(message,status=400)=>{const error=new Error(message);error.status=status;throw error;};
const json=async request=>{try{return await request.json();}catch{fail('INVALID_JSON');}};
function role(auth,...roles){if(!roles.includes(auth.profile.role))fail('FORBIDDEN',403);}
async function context(ctx,auth,studentKey){
 const [student,program,enrollment]=await Promise.all([`students/${studentKey}`,`professionalPrograms/${programId}`,`professionalEnrollments/${studentKey}/${programId}`].map(path=>ctx.firebaseRead(path,auth.token)));
 if(!student||!globalThis.SulukeraStudentAccount.isActive(student))fail('STUDENT_NOT_ACTIVE',403);
 const fallback=student.planType==='PROFESSIONAL'||String(student.batch||'').startsWith('PRO-');
 if(!program||enrollment?.status!=='active'&&!(!enrollment&&fallback))fail('PROGRAM_NOT_AVAILABLE',403);
 return {program,enrollment:enrollment||{selectedTracks:{track_1:true}}};
}
function sessionFor(program,enrollment,unitId,sessionKey){
 const match=String(unitId).match(/^(track_\d+)_(unit_\d+)$/);if(!match||!/^session_[1-5]$/.test(sessionKey))fail('INVALID_SESSION');
 const [_,track,unit]=match,definition=program.tracks?.[track]?.units?.[unit];
 if(!(enrollment.selectedTracks?.[track]??track==='track_1')||definition?.status!=='published')fail('SESSION_NOT_AVAILABLE',403);
 const session=definition.sessions?.[sessionKey]||(sessionKey==='session_1'?definition:null);if(!session)fail('SESSION_NOT_FOUND',404);return session;
}
export async function progressFor(env,studentKey,videoKey){const progress=await env.DB.prepare('SELECT * FROM professional_recording_progress WHERE student_key=? AND video_key=?').bind(studentKey,videoKey).first();if(!progress)return {seconds:0,percent:0,lastPosition:0,ranges:[]};return {...globalThis.SulukeraWatch.summary(JSON.parse(progress.ranges_json),progress.duration_seconds),duration:progress.duration_seconds,lastPosition:progress.last_position,updatedAt:progress.updated_at};}
export async function checkpoint(env,studentKey,body,now=Date.now()){
 const position=Number(body.position),sequence=body.sequence,rate=Number(body.rate)||1;
 if(!Number.isFinite(position)||position<0||!Number.isInteger(sequence)||sequence<1||rate<0.25||rate>2)fail('INVALID_CHECKPOINT');
 for(let attempt=0;attempt<5;attempt++){
  const run=await env.DB.prepare('SELECT * FROM professional_recording_runs WHERE id=? AND student_key=?').bind(body.runId,studentKey).first();if(!run||run.expires_at<now)fail('PLAYBACK_EXPIRED',403);
  if(sequence<=run.last_sequence)return progressFor(env,studentKey,run.video_key);
  const progress=await env.DB.prepare('SELECT * FROM professional_recording_progress WHERE student_key=? AND video_key=?').bind(studentKey,run.video_key).first();if(!progress)fail('PROGRESS_NOT_FOUND',404);
  const elapsed=(now-run.last_time)/1000,delta=position-run.last_position,end=Math.min(run.duration_seconds,position),ranges=JSON.parse(progress.ranges_json);
  if(run.playing&&body.visible===true&&!body.seeking&&elapsed>0&&elapsed<=15&&delta>0&&delta<=elapsed*rate+0.4)ranges.push([run.last_position,end]);
  const summary=globalThis.SulukeraWatch.summary(ranges,run.duration_seconds),nonce=crypto.randomUUID(),at=new Date(now).toISOString();
  const results=await env.DB.batch([
   env.DB.prepare(`UPDATE professional_recording_progress SET ranges_json=?,watched_seconds=?,last_position=?,version=version+1,last_nonce=?,updated_at=? WHERE student_key=? AND video_key=? AND version=? AND EXISTS(SELECT 1 FROM professional_recording_runs WHERE id=? AND last_sequence=?)`).bind(JSON.stringify(summary.ranges),summary.seconds,end,nonce,at,studentKey,run.video_key,progress.version,run.id,run.last_sequence),
   env.DB.prepare(`UPDATE professional_recording_runs SET last_sequence=?,last_position=?,last_time=?,playing=? WHERE id=? AND last_sequence=? AND EXISTS(SELECT 1 FROM professional_recording_progress WHERE student_key=? AND video_key=? AND last_nonce=?)`).bind(sequence,end,now,body.playing&&body.visible?1:0,run.id,run.last_sequence,studentKey,run.video_key,nonce)
  ]);
  if(results[0]?.meta?.changes)return progressFor(env,studentKey,run.video_key);
 }
 fail('CHECKPOINT_RETRY',409);
}
export async function handleProfessionalRecordings(request,env,auth,path,ctx){
 if(!path.startsWith('/student/professional-recordings')&&!path.startsWith('/admin/professional-recordings'))return null;
 const admin=path.startsWith('/admin/');role(auth,...(admin?['admin','academic_admin']:['student']));const key=auth.profile.studentKey;
 if(path==='/admin/professional-recordings/connection')return {data:await connection(env)};
 if(path==='/admin/professional-recordings/preview'&&request.method==='POST'){
  const value=await json(request),program=await ctx.firebaseRead('professionalPrograms/'+programId,auth.token),session=sessionFor(program,{selectedTracks:{track_1:true,track_2:true,track_3:true}},value.unitId,value.sessionKey),file=driveFile(session.recordingUrl);if(!file)fail('RECORDING_NOT_CONFIGURED',404);
  const video=await checkedVideo(env,file),id=crypto.randomUUID(),now=Date.now();
  await env.DB.prepare('INSERT INTO professional_recording_runs VALUES (?,?,?,?,?,?,?,?,0,0,?,0)').bind(id,'admin-preview:'+auth.uid,file.id,value.unitId,value.sessionKey,file.resourceKey,video.duration,now+15*60000,now).run();
  return {data:{title:video.name,duration:video.duration,mediaPath:'/professional-recordings/media/'+id}};
 }
 if(path==='/admin/professional-recordings'&&request.method==='GET')return {data:{assignments:(await env.DB.prepare('SELECT * FROM professional_recording_assignments').all()).results||[],progress:(await env.DB.prepare('SELECT student_key,video_key,watched_seconds,duration_seconds,last_position,updated_at FROM professional_recording_progress').all()).results||[]}};
 if(path==='/admin/professional-recordings/assignment'&&request.method==='POST'){
  const value=await json(request);if(!['optional','recorded'].includes(value.mode))fail('INVALID_MODE');const scoped=await context(ctx,auth,value.studentKey);sessionFor(scoped.program,scoped.enrollment,value.unitId,value.sessionKey);
  // Switching mode does not grant or revoke access and does not alter Zoom attendance or grades.
  await env.DB.prepare('INSERT INTO professional_recording_assignments VALUES (?,?,?,?,0,?,?) ON CONFLICT(student_key,unit_id,session_key) DO UPDATE SET mode=excluded.mode,approved=CASE WHEN excluded.mode=professional_recording_assignments.mode THEN professional_recording_assignments.approved ELSE 0 END,updated_at=excluded.updated_at,updated_by=excluded.updated_by').bind(value.studentKey,value.unitId,value.sessionKey,value.mode,new Date().toISOString(),auth.uid).run();return {data:{saved:true}};
 }
 if(path==='/admin/professional-recordings/approve'&&request.method==='POST'){
  const value=await json(request),scoped=await context(ctx,auth,value.studentKey),session=sessionFor(scoped.program,scoped.enrollment,value.unitId,value.sessionKey),file=driveFile(session.recordingUrl),progress=file?await progressFor(env,value.studentKey,file.id):null;
  if(!progress||progress.percent<80)fail('WATCHING_NOT_COMPLETE',409);
  const result=await env.DB.prepare("UPDATE professional_recording_assignments SET approved=1,updated_at=?,updated_by=? WHERE student_key=? AND unit_id=? AND session_key=? AND mode='recorded'").bind(new Date().toISOString(),auth.uid,value.studentKey,value.unitId,value.sessionKey).run();if(!result.meta.changes)fail('COMPENSATION_NOT_ASSIGNED',409);return {data:{saved:true}};
 }
 if(path==='/student/professional-recordings'&&request.method==='GET'){
  await context(ctx,auth,key);return {data:{assignments:(await env.DB.prepare('SELECT * FROM professional_recording_assignments WHERE student_key=?').bind(key).all()).results||[],progress:(await env.DB.prepare('SELECT video_key,watched_seconds,duration_seconds,last_position,updated_at FROM professional_recording_progress WHERE student_key=?').bind(key).all()).results||[]}};
 }
 if(path==='/student/professional-recordings/start'&&request.method==='POST'){
  const value=await json(request),scoped=await context(ctx,auth,key),session=sessionFor(scoped.program,scoped.enrollment,value.unitId,value.sessionKey),file=driveFile(session.recordingUrl);if(!file)fail('RECORDING_NOT_CONFIGURED',404);
  const video=await checkedVideo(env,file),now=Date.now(),id=crypto.randomUUID(),progress=await progressFor(env,key,file.id),position=Math.min(progress.lastPosition||0,video.duration);
  await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO professional_recording_progress VALUES (?,?,?,0,?,0,0,?,?)').bind(key,file.id,'[]',video.duration,'',new Date(now).toISOString()),env.DB.prepare('INSERT INTO professional_recording_runs VALUES (?,?,?,?,?,?,?,?,0,?,?,0)').bind(id,key,file.id,value.unitId,value.sessionKey,file.resourceKey,video.duration,now+4*3600000,position,now)]);
  return {data:{runId:id,mediaPath:'/professional-recordings/media/'+id,duration:video.duration,title:video.name,...progress}};
 }
 if(path==='/student/professional-recordings/checkpoint'&&request.method==='POST'){await context(ctx,auth,key);return {data:await checkpoint(env,key,await json(request))};}
 return null;
}
export async function handleProfessionalRecordingMedia(request,env,path,ctx){
 const match=path.match(/^\/professional-recordings\/media\/([\w-]+)$/);if(!match||!['GET','HEAD'].includes(request.method))return null;
 const run=await env.DB.prepare('SELECT * FROM professional_recording_runs WHERE id=?').bind(match[1]).first();if(!run||run.expires_at<Date.now())fail('PLAYBACK_EXPIRED',403);
 const response=await streamVideo(env,{id:run.video_key,resourceKey:run.resource_key},request.headers.get('Range'));if(!response.ok&&response.status!==206)fail('DRIVE_VIDEO_UNAVAILABLE',503);
 const headers={...ctx.corsHeaders(request),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};for(const key of ['Content-Type','Content-Length','Content-Range','Accept-Ranges'])if(response.headers.has(key))headers[key]=response.headers.get(key);
 return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}
