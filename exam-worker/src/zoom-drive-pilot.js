import {driveIdentity,driveReadToken} from './drive-recordings.js';
import {recordingCatalog,transferRecordingStep,inspectRecordingFile,inspectAttendanceAccess} from './zoom-drive-transfer.js';
import {startAcademicRecording} from './academic-recording-media.js';
import {runAttendanceSync} from './zoom-attendance-sync.js';
const fail=(message,status=400)=>{const error=new Error(message);error.status=status;throw error;};
const norm=v=>String(v||'').normalize('NFKC').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/[\u064B-\u065Fـ]/g,'').replace(/\s+/g,' ').trim();
async function checkedJson(response,prefix){if(!response.ok){await response.body?.cancel();fail(prefix+'_'+response.status,503);}return response.json();}
export async function inspectPilotDrive(env,fetcher=fetch,tokenProvider=driveReadToken){
 const identity=driveIdentity(env);if(!identity.folderId)fail('DRIVE_ROOT_NOT_CONFIGURED',503);
 const token=await tokenProvider(env),headers={Authorization:'Bearer '+token};
 const metadata=async id=>checkedJson(await fetcher('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,driveId,capabilities(canAddChildren)&supportsAllDrives=true',{headers}),'DRIVE_FOLDER_READ');
 const root=await metadata(identity.folderId);if(root.mimeType!=='application/vnd.google-apps.folder')fail('DRIVE_ROOT_NOT_FOLDER');
 const queue=[{id:root.id,depth:0}],seen=new Set(),folders=[];
 while(queue.length){
  const folder=queue.shift();if(seen.has(folder.id))continue;seen.add(folder.id);if(seen.size>20)fail('DRIVE_FOLDER_REVIEW_REQUIRED',409);
  const params=new URLSearchParams({q:`'${folder.id}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,fields:'files(id,name,driveId,capabilities(canAddChildren)),nextPageToken',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
  const data=await checkedJson(await fetcher('https://www.googleapis.com/drive/v3/files?'+params,{headers}),'DRIVE_FOLDER_LIST');
  if(data.nextPageToken)fail('DRIVE_FOLDER_REVIEW_REQUIRED',409);
  for(const child of data.files||[]){folders.push(child);if(folder.depth<3)queue.push({id:child.id,depth:folder.depth+1});}
 }
 const candidates=folders.filter(folder=>norm(folder.name).includes(norm('تدخلات تغيير السلوك')));
 return {connected:true,rootId:root.id,rootName:root.name,integrationEmail:identity.email,isSharedDrive:!!root.driveId,canAddChildren:root.capabilities?.canAddChildren===true,matchingFolders:candidates.map(folder=>({id:folder.id,name:folder.name,isSharedDrive:!!folder.driveId,canAddChildren:folder.capabilities?.canAddChildren===true})),folderCount:folders.length,uploadAuthorization:root.driveId?'shared_drive_writer_required':'google_user_oauth_required'};
}
export async function inspectPilotZoom(env,fetcher=fetch){
 let credentials;try{credentials=JSON.parse(env.ZOOM_PILOT_CREDENTIALS);}catch{fail('ZOOM_NOT_CONNECTED',503);}
 if(credentials.hostEmail!=='rushdacd.sa@gmail.com'||credentials.meetingId!=='88245118262')fail('PILOT_SCOPE_MISMATCH',403);
 const token=await checkedJson(await fetcher('https://zoom.us/oauth/token',{method:'POST',headers:{Authorization:'Basic '+btoa(credentials.clientId+':'+credentials.clientSecret),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'account_credentials',account_id:credentials.accountId})}),'ZOOM_AUTH');
 const params=new URLSearchParams({from:'2026-10-01',to:'2026-10-18',page_size:'100'}),recordings=[];let next='';
 for(let page=0;page<10;page++){
  if(next)params.set('next_page_token',next);
  const data=await checkedJson(await fetcher('https://api.zoom.us/v2/users/'+encodeURIComponent(credentials.hostEmail)+'/recordings?'+params,{headers:{Authorization:'Bearer '+token.access_token}}),'ZOOM_RECORDINGS');
  for(const meeting of data.meetings||[])if(String(meeting.id)===credentials.meetingId)recordings.push({uuid:meeting.uuid,topic:meeting.topic,startTime:meeting.start_time,files:(meeting.recording_files||[]).filter(file=>file.file_type==='MP4'&&file.status==='completed').map(file=>({id:file.id,size:file.file_size,startTime:file.recording_start,endTime:file.recording_end,type:file.recording_type}))});
  next=data.next_page_token||'';if(!next)break;
 }
 if(next)fail('ZOOM_PAGINATION_REVIEW_REQUIRED',409);
 return {connected:true,hostEmail:credentials.hostEmail,meetingId:credentials.meetingId,recordings};
}
export async function handleZoomDrivePilot(request,env,path,ctx={}){
 if(!['/integrations/zoom-drive-pilot/inspect','/integrations/zoom-drive-pilot/catalog','/integrations/zoom-drive-pilot/transfer','/integrations/zoom-drive-pilot/preview','/integrations/zoom-drive-pilot/attendance-access','/integrations/zoom-drive-pilot/attendance-sync'].includes(path))return null;
 if(request.method!=='POST')fail('METHOD_NOT_ALLOWED',405);
 const key=env.RECORDING_PILOT_KEY;if(!key||key.length<40)fail('PILOT_NOT_ENABLED',503);
 const received=request.headers.get('Authorization')||'';
 const digest=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
 const [actual,expected]=await Promise.all([digest(received),digest('Bearer '+key)]);let different=0;for(let i=0;i<actual.length;i++)different|=actual[i]^expected[i];if(different)fail('FORBIDDEN',403);
 if(path.endsWith('/attendance-access')){const b=await request.json();return {data:await inspectAttendanceAccess(env,b.host)};}
 if(path.endsWith('/attendance-sync')){const b=await request.json();return {data:await runAttendanceSync(env,ctx,{host:b.host,preview:b.preview!==false})};}
 if(path.endsWith('/catalog')){const b=await request.json().catch(()=>({})),data=await recordingCatalog(env,b.host);if(b.host==='RushdABAT@gmail.com'&&ctx.firebaseAdminToken){const token=await ctx.firebaseAdminToken(env),p=await checkedJson(await fetch('https://sulukeraacd-default-rtdb.firebaseio.com/professionalPrograms/organizational_behavior.json',{headers:{Authorization:'Bearer '+token}}),'PROFESSIONAL_READ');data.professionalTargets=Object.entries(p?.tracks||{}).map(([track,t])=>({track,title:t.title,units:Object.entries(t.units||{}).map(([unit,u])=>({unit,...Object.fromEntries(Object.entries(u).filter(([k,v])=>k!=='sessions'&&/title|date|time|at|zoom|recording|url|link/i.test(k)&&typeof v!=='object')),sessions:Object.entries(u.sessions||{}).map(([session,s])=>({session,...Object.fromEntries(Object.entries(s).filter(([k,v])=>/title|date|time|at|zoom|recording|url|link|order/i.test(k)&&typeof v!=='object'))}))}))}));data.professionalFiles=[];for(const t of data.professionalTargets)for(const u of t.units)for(const s of u.sessions){const id=s.recordingUrl?.match(/drive\.google\.com\/file\/d\/([\w-]+)/)?.[1];if(id&&data.professionalFiles.length<20){try{data.professionalFiles.push({track:t.track,unit:u.unit,session:s.session,...await inspectRecordingFile(env,id)});}catch(error){data.professionalFiles.push({track:t.track,unit:u.unit,session:s.session,id,error:error.message});}}}}return {data};}
 if(path.endsWith('/preview')){
  const b=await request.json(),row=await env.DB.prepare("SELECT lesson_ids FROM zoom_drive_transfers WHERE source_id=? AND state='complete'").bind(String(b.sourceId||'')).first();if(!row)fail('TRANSFER_NOT_COMPLETE',404);
  const l=await env.DB.prepare('SELECT * FROM course_lessons WHERE id=?').bind(JSON.parse(row.lesson_ids)[0]).first();return {data:await startAcademicRecording(env,l)};
 }
 if(path.endsWith('/transfer')){
  if(Number(request.headers.get('Content-Length')||0)>16384)fail('BODY_TOO_LARGE',413);
  const raw=await request.text();if(raw.length>16384)fail('BODY_TOO_LARGE',413);
  return {data:await transferRecordingStep(env,JSON.parse(raw))};
 }
 const [zoom,drive]=await Promise.allSettled([inspectPilotZoom(env),inspectPilotDrive(env)]);
 const report=value=>value.status==='fulfilled'?value.value:{connected:false,reason:value.reason?.message||'CONNECTION_FAILED'};
 return {data:{zoom:report(zoom),drive:report(drive),transferred:false}};
}
