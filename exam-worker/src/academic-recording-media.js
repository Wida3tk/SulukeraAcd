import {driveFile,streamVideo} from './drive-recordings.js';
const fail=(message,status)=>{const e=new Error(message);e.status=status;throw e;};
export async function startAcademicRecording(env,lesson){
 const file=driveFile(lesson.recording_url);if(!file)fail('RECORDING_NOT_CONFIGURED',404);
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS academic_recording_tickets (id TEXT PRIMARY KEY,file_id TEXT NOT NULL,resource_key TEXT NOT NULL,lesson_id TEXT NOT NULL,expires_at INTEGER NOT NULL)').run();
 const id=crypto.randomUUID()+'-'+crypto.randomUUID(),now=Date.now();
 await env.DB.batch([env.DB.prepare('DELETE FROM academic_recording_tickets WHERE expires_at<?').bind(now),env.DB.prepare('INSERT INTO academic_recording_tickets VALUES(?,?,?,?,?)').bind(id,file.id,file.resourceKey,lesson.id,now+3*3600000)]);
 return {mediaPath:'/academic-recordings/media/'+id,title:lesson.title};
}
export async function handleAcademicRecordingMedia(request,env,path,corsHeaders){
 const match=path.match(/^\/academic-recordings\/media\/([\w-]{73})$/);if(!match)return null;
 if(!['GET','HEAD'].includes(request.method))fail('METHOD_NOT_ALLOWED',405);
 const ticket=await env.DB.prepare('SELECT * FROM academic_recording_tickets WHERE id=?').bind(match[1]).first();if(!ticket||ticket.expires_at<Date.now())fail('PLAYBACK_EXPIRED',403);
 const response=await streamVideo(env,{id:ticket.file_id,resourceKey:ticket.resource_key},request.headers.get('Range'));if(!response.ok&&response.status!==206){await response.body?.cancel();fail('DRIVE_VIDEO_UNAVAILABLE',503);}
 const headers={...corsHeaders(request),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};for(const key of ['Content-Type','Content-Length','Content-Range','Accept-Ranges'])if(response.headers.has(key))headers[key]=response.headers.get(key);
 return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}
