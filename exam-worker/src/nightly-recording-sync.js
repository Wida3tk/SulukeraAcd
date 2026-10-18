import {recordingCatalog,transferRecordingStep,verifyDirectRecordingAccess} from './zoom-drive-transfer.js';
const HOSTS=['rushdacd.sa@gmail.com','rushdacd1@gmail.com','RushdABAT@gmail.com'];
const COURSES={
 '88245118262':['course_07','1A4UvkeSse2FY00tK0uO4ysHuGGkNucTS','rushdacd.sa@gmail.com'],
 '85761104229':['course_08','1Vl5Jw8Aipmjowcym1nDpyXYTGJ3GCzc8','rushdacd.sa@gmail.com'],
 '87401037383':['course_09','1LwVmxiHzc9C69mDo_OByZSP7mx2L7CCe','rushdacd1@gmail.com'],
 '86843545960':['course_13','1dfCbFzAgFbSG9YCWbL4627c7oaGu6OQd','rushdacd1@gmail.com'],
 '87930048061':['course_14','1S-rIe5Gk8witgjh3E0_ky-bFEz9E-npa','RushdABAT@gmail.com'],
 '85196341732':['course_15','1AOOoZNYHYhUO4umUGFBq0toNLSJNfrtp','rushdacd.sa@gmail.com']
};
export const nightlySaudiDate=now=>new Date(now+3*3600000).toISOString().slice(0,10);
export async function nightlyRecordingSchema(env){await env.DB.exec(`CREATE TABLE IF NOT EXISTS nightly_recording_runs(day TEXT PRIMARY KEY,state TEXT NOT NULL,result_json TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS nightly_recording_jobs(source_id TEXT PRIMARY KEY,manifest_json TEXT NOT NULL,topic TEXT NOT NULL,state TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',attempts INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS nightly_recording_lock(id TEXT PRIMARY KEY,expires INTEGER NOT NULL);`);}
function zoomId(url){try{return new URL(url).pathname.match(/\/j\/(\d+)/)?.[1]||'';}catch{return '';}}
export function planNightlyRecording(host,meeting,file,lessons,program,reviewed=[]){
 const date=file.start.slice(0,10),base={host,sourceId:file.id,uuid:meeting.uuid,date,courseName:meeting.topic};
 if(meeting.meetingId==='82789191279')return {state:'excluded',reason:'GRADUATION_EXCLUDED'};
 const course=COURSES[meeting.meetingId];if(course){if(course[2]!==host)return {state:'review',reason:'RECORDING_ACCOUNT_MISMATCH'};
  const targets=lessons.filter(l=>l.subject_key?.endsWith('_'+course[0])&&l.status==='published'&&l.opens_at.slice(0,10)===date&&(zoomId(l.zoom_url)===meeting.meetingId||['course_07','course_14'].includes(course[0])));
  if(!targets.length)return {state:'review',reason:'NO_EXACT_LECTURE_MATCH'};
  if(new Set(targets.map(t=>t.subject_key)).size!==targets.length)return {state:'review',reason:'AMBIGUOUS_LECTURE_DATE'};
  if(targets.some(l=>l.recording_url))return {state:'retained',reason:'EXISTING_RECORDING_PRESERVED'};
  for(const r of reviewed)for(const id of JSON.parse(r.lesson_ids)){const prior=lessons.find(l=>l.id===id);if(!prior)continue;for(const l of targets)if(l.subject_key===prior.subject_key&&date>r.source_date){const weeks=(Date.parse(date)-Date.parse(r.source_date))/604800000;if(!Number.isInteger(weeks)||l.week-prior.week!==weeks)return {state:'review',reason:'REVIEWED_SCHEDULE_DIFFERS'};}}
  return {state:'queued',manifest:{...base,folderId:course[1],lessonIds:targets.map(l=>l.id),courseName:targets[0].title.replace(/^المحاضرة\s+\d+\s*[—-]\s*/,'')}};
 }
 if(host==='RushdABAT@gmail.com'&&meeting.meetingId==='86410858243'){
  const targets=[];for(const [track,t] of Object.entries(program?.tracks||{}))for(const [unit,u] of Object.entries(t.units||{}))if(u.status==='published')for(const [session,s] of Object.entries(u.sessions||{}))if((s.scheduledDate||s.scheduledAt?.slice(0,10))===date&&zoomId(s.zoomUrl)===meeting.meetingId)targets.push({track,unit,session,s,u});
  // Existing professional links are retained, including when stale later-unit dates repeat them.
  if(targets.some(t=>t.s.recordingUrl))return {state:'retained',reason:'EXISTING_PROFESSIONAL_RECORDING_PRESERVED'};
  if(targets.length!==1)return {state:'review',reason:targets.length?'AMBIGUOUS_PROFESSIONAL_SESSION':'NO_EXACT_PROFESSIONAL_SESSION'};
  const t=targets[0];return {state:'queued',manifest:{...base,folderId:'1ru6Mp64WYQebSXQQbnaNW8oMVqveG8Cw',lessonIds:[`pro:${t.track}:${t.unit}:${t.session}`],courseName:t.u.title+' — '+t.s.title}};
 }
 return {state:'review',reason:'MEETING_NOT_CONFIGURED'};
}
export function chooseRecordingFile(files){const types=['shared_screen_with_speaker_view(CC)','shared_screen_with_speaker_view','shared_screen','active_speaker'];for(const type of types){const found=files.filter(f=>f.type===type);if(found.length===1)return found[0];if(found.length>1)return null;}return files.length===1?files[0]:null;}
async function professionalProgram(env,ctx){const token=await ctx.firebaseAdminToken(env),r=await fetch('https://sulukeraacd-default-rtdb.firebaseio.com/professionalPrograms/organizational_behavior.json',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('PROFESSIONAL_RECORDING_CONFIG_'+r.status);return r.json();}
export async function discoverNightlyRecordings(env,ctx,{now=Date.now(),preview=false,catalogReader=recordingCatalog,programReader=professionalProgram}={}){
 await nightlyRecordingSchema(env);const day=nightlySaudiDate(now),existing=await env.DB.prepare('SELECT state FROM nightly_recording_runs WHERE day=?').bind(day).first();if(!preview&&existing)return {alreadyScanned:true,day};
 if(!preview){const claimed=await env.DB.prepare("INSERT OR IGNORE INTO nightly_recording_runs VALUES(?,'running','{}',?)").bind(day,new Date(now).toISOString()).run();if(!claimed.meta.changes)return {alreadyScanned:true,day};}
 const summary={day,preview,queued:0,retained:0,complete:0,review:0,excluded:0,accounts:[]};
 const lessons=(await env.DB.prepare('SELECT * FROM course_lessons').all()).results;
 // Review metadata may not exist on a new installation; inspect sqlite catalog first.
 const hasReviews=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='zoom_drive_mapping_reviews'").first(),reviewed=hasReviews?(await env.DB.prepare('SELECT r.source_date,t.lesson_ids FROM zoom_drive_mapping_reviews r JOIN zoom_drive_transfers t ON t.source_id=r.source_id').all()).results:[];
 for(const host of HOSTS){try{const catalog=await catalogReader(env,host),program=host==='RushdABAT@gmail.com'?await programReader(env,ctx):null;if(preview){const probe=catalog.recordings.find(m=>m.meetingId!=='82789191279'&&m.files.length);if(probe)await verifyDirectRecordingAccess(env,host,probe.uuid,probe.files[0].id);}for(const m of catalog.recordings){if(m.meetingId==='82789191279'){summary.excluded++;continue;}const file=chooseRecordingFile(m.files);if(!file){if(m.files.length)summary.review++;continue;}
    const transferred=await env.DB.prepare('SELECT state FROM zoom_drive_transfers WHERE source_id=?').bind(file.id).first();if(transferred?.state==='complete'){summary.complete++;continue;}
    const plan=planNightlyRecording(host,m,file,lessons,program,reviewed);summary[plan.state]++;
    if(!preview)await env.DB.prepare('INSERT INTO nightly_recording_jobs(source_id,manifest_json,topic,state,reason,attempts,updated_at) VALUES(?,?,?,?,?,0,?) ON CONFLICT(source_id) DO UPDATE SET manifest_json=excluded.manifest_json,topic=excluded.topic,state=CASE WHEN nightly_recording_jobs.state IN (\'complete\',\'uploading\') THEN nightly_recording_jobs.state ELSE excluded.state END,reason=excluded.reason,attempts=CASE WHEN nightly_recording_jobs.state=\'uploading\' THEN nightly_recording_jobs.attempts ELSE 0 END,updated_at=excluded.updated_at').bind(file.id,JSON.stringify(plan.manifest||{host,sourceId:file.id,uuid:m.uuid,date:file.start.slice(0,10)}),m.topic,plan.state,plan.reason||'',new Date(now).toISOString()).run();
   }summary.accounts.push({host,ok:true,recordings:catalog.recordings.length});}catch(error){summary.accounts.push({host,ok:false,reason:error.message});}}
 if(!preview)await env.DB.prepare('UPDATE nightly_recording_runs SET state=?,result_json=?,updated_at=? WHERE day=?').bind(summary.accounts.every(a=>a.ok)?'complete':'review',JSON.stringify(summary),new Date().toISOString(),day).run();return summary;
}
export async function processNightlyRecordingQueue(env,ctx,transfer=transferRecordingStep){
 await nightlyRecordingSchema(env);const job=await env.DB.prepare("SELECT * FROM nightly_recording_jobs WHERE state IN ('queued','uploading') AND attempts<5 ORDER BY updated_at LIMIT 1").first();if(!job)return {idle:true};
 const now=Date.now(),lease=now+180000,locked=await env.DB.prepare("INSERT INTO nightly_recording_lock VALUES('queue',?) ON CONFLICT(id) DO UPDATE SET expires=excluded.expires WHERE nightly_recording_lock.expires<?").bind(lease,now).run();if(!locked.meta.changes)return {busy:true};
 try{let result;for(let n=0;n<2;n++){result=await transfer(env,JSON.parse(job.manifest_json),ctx);if(result.state==='complete')break;}await env.DB.prepare('UPDATE nightly_recording_jobs SET state=?,reason=\'\',updated_at=? WHERE source_id=?').bind(result.state==='complete'?'complete':'uploading',new Date().toISOString(),job.source_id).run();return {sourceId:job.source_id,...result};}
 catch(error){await env.DB.prepare("UPDATE nightly_recording_jobs SET attempts=attempts+1,reason=?,state=CASE WHEN attempts+1>=5 THEN 'review' ELSE state END,updated_at=? WHERE source_id=?").bind(error.message,new Date().toISOString(),job.source_id).run();return {sourceId:job.source_id,retry:true,reason:error.message};}
 finally{await env.DB.prepare("UPDATE nightly_recording_lock SET expires=0 WHERE id='queue' AND expires=?").bind(lease).run();}
}
