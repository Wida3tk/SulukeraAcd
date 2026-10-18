import {transferAccount} from './zoom-drive-transfer.js';
import '../../academic-policy.js';
import '../../student-account-policy.js';
import '../../productivity-ledger.js';
const HOSTS=['rushdacd.sa@gmail.com','rushdacd1@gmail.com','RushdABAT@gmail.com'],PROGRAM='organizational_behavior',ACTOR='automatic-zoom-attendance';
const FIXED={'88245118262':'course_07','87930048061':'course_14'};
const fail=message=>{throw Error(message);};
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/[\u064B-\u065Fـ]/g,'').replace(/\s+/g,' ').trim();
export const zoomUuidPath=v=>v.startsWith('/')||v.includes('//')?encodeURIComponent(encodeURIComponent(v)):encodeURIComponent(v);
export function attendanceMinutes(intervals,start,end){const sorted=intervals.map(([a,b])=>[Math.max(Date.parse(a),start),Math.min(Date.parse(b),end)]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a).sort((a,b)=>a[0]-b[0]),merged=[];for(const pair of sorted){const last=merged.at(-1);if(last&&pair[0]<=last[1])last[1]=Math.max(last[1],pair[1]);else merged.push(pair);}return merged.reduce((n,[a,b])=>n+(b-a)/60000,0);}
export function matchAttendance(participant,students){
 const email=norm(participant.user_email||participant.email),name=norm(participant.name),byEmail=email?students.filter(s=>[s.email,s.emailAddress].some(v=>v&&norm(v)===email)):[];
 if(byEmail.length)return byEmail.length===1?byEmail[0].key:null;
 const byId=students.filter(s=>s.id&&new RegExp('(^|[^a-z0-9])'+String(s.id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z0-9])','i').test(name));if(byId.length)return byId.length===1?byId[0].key:null;
 const byName=name.length>=6?students.filter(s=>[s.name,[s.firstName,s.midName,s.lastName].filter(Boolean).join(' ')].some(v=>v&&norm(v)===name)):[];return byName.length===1?byName[0].key:null;
}
export async function attendanceSchema(env){await env.DB.exec(`CREATE TABLE IF NOT EXISTS zoom_attendance_reports(id TEXT PRIMARY KEY,host TEXT NOT NULL,uuid TEXT NOT NULL,meeting_id TEXT NOT NULL,topic TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,participants_json TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'fetched',result_json TEXT NOT NULL DEFAULT '{}',updated_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS zoom_attendance_state(id TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE IF NOT EXISTS zoom_attendance_aliases(host TEXT NOT NULL,scope_key TEXT NOT NULL,zoom_name TEXT NOT NULL,student_key TEXT NOT NULL,approved_by TEXT NOT NULL,approved_at TEXT NOT NULL,PRIMARY KEY(host,scope_key,zoom_name));`);}
async function zoomToken(env,host){const c=JSON.parse(transferAccount(env,host).ZOOM_PILOT_CREDENTIALS),r=await fetch('https://zoom.us/oauth/token',{method:'POST',headers:{Authorization:'Basic '+btoa(c.clientId+':'+c.clientSecret),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'account_credentials',account_id:c.accountId})});if(!r.ok)fail('ZOOM_AUTH_'+r.status);return (await r.json()).access_token;}
async function api(token,path){const r=await fetch('https://api.zoom.us/v2/'+path,{headers:{Authorization:'Bearer '+token}});if(!r.ok){await r.body?.cancel();fail('ZOOM_REPORT_'+r.status);}return r.json();}
async function fb(env,ctx,path,options={}){const token=await ctx.firebaseAdminToken(env),r=await fetch('https://sulukeraacd-default-rtdb.firebaseio.com/'+path+'.json',{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}});if(!r.ok&&r.status!==412){await r.body?.cancel();fail('ATTENDANCE_FIREBASE_'+r.status);}return r;}
async function read(env,ctx,path){return (await fb(env,ctx,path)).json();}
export async function discoverAttendance(env,host){
 if(!HOSTS.includes(host))fail('ACCOUNT_NOT_ENABLED');await attendanceSchema(env);const token=await zoomToken(env,host),to=new Date().toISOString().slice(0,10),from=new Date(Date.now()-14*86400000).toISOString().slice(0,10),meetings=[];let next='';
 for(let page=0;page<5;page++){const q=new URLSearchParams({from,to,page_size:'100'});if(next)q.set('next_page_token',next);const d=await api(token,'report/users/'+encodeURIComponent(host)+'/meetings?'+q);meetings.push(...d.meetings||[]);next=d.next_page_token||'';if(!next)break;}if(next)fail('MEETING_REPORT_PAGINATION');
 let stored=0;for(const m of meetings){if(String(m.id)==='82789191279')continue;const end=Date.parse(m.end_time);if(!Number.isFinite(end)||Date.now()-end<30*60000)continue;const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(host+'|'+m.uuid)))).map(b=>b.toString(16).padStart(2,'0')).join('');if(await env.DB.prepare('SELECT id FROM zoom_attendance_reports WHERE id=?').bind(id).first())continue;
  // Fetch one new report per pass; bounded requests keep synchronization isolated.
  const instance=zoomUuidPath(m.uuid),details=await api(token,'report/meetings/'+instance),rows=[];let pageToken='',total=null;
  for(let page=0;page<8;page++){const q=new URLSearchParams({page_size:'300'});if(pageToken)q.set('next_page_token',pageToken);const d=await api(token,'report/meetings/'+instance+'/participants?'+q);rows.push(...d.participants||[]);total=d.total_records??total;pageToken=d.next_page_token||'';if(!pageToken)break;}if(pageToken||total!==null&&rows.length!==Number(total))fail('INCOMPLETE_PARTICIPANT_REPORT');
  const start=Date.parse(details.start_time),finish=Date.parse(details.end_time);if(!Number.isFinite(start)||!Number.isFinite(finish)||finish<=start||finish-start>86400000||String(details.id)!==String(m.id))fail('INVALID_REPORT_PERIOD');
  const participants=rows.map(p=>({name:p.name||'',email:p.user_email||'',join_time:p.join_time||'',leave_time:p.leave_time||''}));
  await env.DB.prepare('INSERT OR IGNORE INTO zoom_attendance_reports(id,host,uuid,meeting_id,topic,starts_at,ends_at,participants_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,host,m.uuid,String(m.id),m.topic||'',new Date(start).toISOString(),new Date(finish).toISOString(),JSON.stringify(participants),new Date().toISOString()).run();stored++;break;
 }return {host,stored};
}
function meetingId(url){try{return new URL(url).pathname.match(/\/j\/(\d+)/)?.[1]||'';}catch{return '';}}
export function attendanceTargets(report,lessons,subjects,program){
 const date=report.starts_at.slice(0,10),academic=lessons.filter(l=>l.status==='published'&&l.opens_at.slice(0,10)===date&&(meetingId(l.zoom_url)===report.meeting_id||FIXED[report.meeting_id]&&subjects[l.subject_key]?.courseKey===FIXED[report.meeting_id]));
 const professional=[];for(const [track,t] of Object.entries(program?.tracks||{}))for(const [unit,u] of Object.entries(t.units||{}))if(u.status==='published')for(const [session,s] of Object.entries(u.sessions||{}))if((s.scheduledDate||s.scheduledAt?.slice(0,10))===date&&meetingId(s.zoomUrl)===report.meeting_id)professional.push({track,unit,session,unitId:track+'_'+unit,definition:u});
 if(academic.length&&professional.length||professional.length>1)return {ambiguous:true,academic:[],professional:[]};return {academic,professional,ambiguous:false};
}
async function productivity(env,ctx,lecturer,report,source){if(!lecturer)return 'unassigned';const meeting={start:report.starts_at,end:report.ends_at,source:'zoom_meeting_summary'},item=SulukeraProductivity.meetingRecord(lecturer,meeting,{...source,sourceHash:'zoom-api-'+report.id,approvedBy:ACTOR,approvedAt:new Date().toISOString()}),base=item.path.slice(0,item.path.lastIndexOf('/')),records=await read(env,ctx,base)||{};
 const prior=Object.values(records).some(r=>Math.abs(Date.parse(r.startsAt)-Date.parse(report.starts_at))<120000&&Math.abs(Date.parse(r.endsAt)-Date.parse(report.ends_at))<120000);if(prior)return 'already_recorded';const response=await fb(env,ctx,item.path,{headers:{'X-Firebase-ETag':'true'}}),current=await response.json();if(current)return 'already_recorded';const saved=await fb(env,ctx,item.path,{method:'PUT',headers:{'If-Match':response.headers.get('ETag')},body:JSON.stringify(item.record)});return saved.status===412?'already_recorded':'recorded';}
export async function applyAttendanceReport(env,ctx,report,dryRun=false){
 const [students,subjects,enrollments,packages,grades,program,proEnrollments,proProgress]=await Promise.all(['students','subjects','enrollments','packages','grades','professionalPrograms/'+PROGRAM,'professionalEnrollments','professionalProgress'].map(p=>read(env,ctx,p)));
 const lessons=(await env.DB.prepare('SELECT * FROM course_lessons').all()).results,targets=attendanceTargets(report,lessons,subjects||{},program),result={applied:0,protected:0,unmatched:[],targets:[],productivity:[]};
 const mapped=await env.DB.prepare('SELECT lesson_ids FROM zoom_drive_transfers WHERE meeting_uuid=?').bind(report.uuid).first();if(mapped){const ids=JSON.parse(mapped.lesson_ids);targets.academic=lessons.filter(l=>ids.includes(l.id)&&l.status==='published');targets.professional=[];targets.ambiguous=false;}
 if(targets.ambiguous||!targets.academic.length&&!targets.professional.length)return {...result,state:'review',reason:targets.ambiguous?'AMBIGUOUS_MEETING_TARGET':'NO_EXACT_LECTURE_MATCH'};
 const participants=JSON.parse(report.participants_json),start=Date.parse(report.starts_at),end=Date.parse(report.ends_at),duration=(end-start)/60000,aliases=(await env.DB.prepare('SELECT * FROM zoom_attendance_aliases WHERE host=?').bind(report.host).all()).results,matchedAll=new Set();
 const academicRoster=Object.entries(students||{}).filter(([key,s])=>SulukeraStudentAccount.isActive(s)&&targets.academic.some(t=>Object.values(enrollments||{}).some(e=>e.studentKey===key&&e.subjectKey===t.subject_key)&&SulukeraAcademicPolicy.subjectAllowed(s,subjects?.[t.subject_key],packages||{}))).map(([key,s])=>({...s,key}));
 for(const target of [...targets.academic,...targets.professional]){
  const professional=!!target.unitId,eligible=Object.entries(students||{}).filter(([key,s])=>SulukeraStudentAccount.isActive(s)&&(professional?proEnrollments?.[key]?.[PROGRAM]?.status==='active'&&SulukeraStudentAccount.isActive(proEnrollments[key][PROGRAM])&&(proEnrollments[key][PROGRAM].selectedTracks?.[target.track]??target.track==='track_1'):Object.values(enrollments||{}).some(e=>e.studentKey===key&&e.subjectKey===target.subject_key)&&SulukeraAcademicPolicy.subjectAllowed(s,subjects?.[target.subject_key],packages||{}))).map(([key,s])=>({...s,key}));
  const scopeKey=professional?target.track:target.subject_key;
  const grouped=new Map();for(const p of participants){if(norm(p.email)===norm(report.host)){matchedAll.add(p.name);continue;}const alias=aliases.find(a=>a.scope_key===scopeKey&&a.zoom_name===norm(p.name));if(alias&&alias.student_key===''){matchedAll.add(p.name);continue;}const key=alias&&eligible.some(s=>s.key===alias.student_key)?alias.student_key:matchAttendance(p,professional?eligible:academicRoster);if(!key){if(!result.unmatched.some(u=>u.name===p.name&&u.email===p.email))result.unmatched.push({name:p.name,email:p.email});continue;}matchedAll.add(p.name);if(!eligible.some(s=>s.key===key))continue;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push([p.join_time,p.leave_time]);}
  result.targets.push(professional?target.unitId+'/'+target.session:target.id);const sourceHash='zoom-api-'+report.id;
  // Only positively identified attendance is automatic. No fabricated absences.
  for(const [key,intervals] of grouped){const minutes=attendanceMinutes(intervals,start,end);if(minutes<=0)continue;const percent=Math.min(100,Math.round(minutes/duration*10000)/100);
   if(professional){
    const snapshot=proProgress?.[key]?.[PROGRAM]?.units?.[target.unitId]?.sessions?.[target.session];if(snapshot?.attendancePercent!=null){result.protected++;continue;}
    if(result.applied>=10){result.continuation=true;break;}
    if(dryRun){result.applied++;continue;}
    const path=`professionalProgress/${key}/${PROGRAM}/units/${target.unitId}`,response=await fb(env,ctx,path,{headers:{'X-Firebase-ETag':'true'}}),unit=await response.json()||{},previous=unit.sessions?.[target.session]||{};
    if(previous.attendancePercent!==undefined&&previous.attendancePercent!==null){result.protected++;continue;}
    const record={...previous,attendancePercent:percent,attendanceMinutes:Math.round(minutes*100)/100,meetingDurationMinutes:duration,attendanceStatus:percent>=80?'complete':percent>=50?'partial':'incomplete',attended:percent>=80,present:percent>=50,attendanceImportedAt:new Date().toISOString(),attendanceSourceHash:sourceHash};
    const sessions={...unit.sessions,[target.session]:record},values=Object.values(sessions).filter(s=>s.attendancePercent!=null).map(s=>Number(s.attendancePercent));
    const saved=await fb(env,ctx,path,{method:'PUT',headers:{'If-Match':response.headers.get('ETag')},body:JSON.stringify({...unit,sessions,attendancePercent:Math.round(values.reduce((a,b)=>a+b,0)/5),attendanceUpdatedAt:new Date().toISOString()})});if(saved.status===412){result.protected++;continue;}result.applied++;
   }else{
    const existing=await env.DB.prepare('SELECT percent FROM course_attendance WHERE lesson_id=? AND student_key=?').bind(target.id,key).first(),g=Object.values(grades||{}).filter(g=>g.studentKey===key&&g.subjectKey===target.subject_key).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0];
    if(existing||g?.[`w${target.week}_attendEntered`]===true&&g?.[`w${target.week}_attendProvisional`]!==true){result.protected++;continue;}
    if(dryRun){result.applied++;continue;}
    const at=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO attendance_meeting_imports VALUES(?,?,?,?,?,?,?)').bind(target.id,sourceHash,report.starts_at,report.ends_at,duration,ACTOR,at),env.DB.prepare('INSERT OR IGNORE INTO course_attendance VALUES(?,?,?,?,?,?)').bind(target.id,key,percent,sourceHash,ACTOR,at),env.DB.prepare("UPDATE coursework_sync SET error='attendance-policy-20261011:automatic-zoom' WHERE lesson_id=? AND student_key=? AND state='pending'").bind(target.id,key)]);result.applied++;
   }
  }
  result.productivity.push(dryRun?'preview':await productivity(env,ctx,professional?target.definition.lecturerUserId:subjects?.[target.subject_key]?.lecturerUserId,report,professional?{programId:PROGRAM,unitId:target.unitId,sessionKey:target.session}:{subjectKey:target.subject_key,lessonId:target.id}));
 }
 result.unmatched=result.unmatched.filter(p=>!matchedAll.has(p.name));return {...result,state:result.continuation?'fetched':result.unmatched.length?'partial':'complete'};
}
export async function approveAttendanceAlias(env,ctx,b,actor){
 if(b.ignore!==true&&!/^[\w-]+$/.test(b.studentKey||''))fail('INVALID_STUDENT_KEY');
 const report=await env.DB.prepare('SELECT * FROM zoom_attendance_reports WHERE id=?').bind(String(b.reportId||'')).first();if(!report)fail('REPORT_NOT_FOUND');const targets=JSON.parse(report.result_json).targets||[];
 if(!targets.includes(b.scopeKey)||!JSON.parse(report.participants_json).some(p=>p.name===b.zoomName))fail('ALIAS_SCOPE_INVALID');
 const aliasScope=b.scopeKey.includes('/')?b.scopeKey.split('_unit_')[0]:(await env.DB.prepare('SELECT subject_key FROM course_lessons WHERE id=?').bind(b.scopeKey).first())?.subject_key;if(!aliasScope)fail('ALIAS_SCOPE_INVALID');
 if(!b.ignore){const s=await read(env,ctx,'students/'+String(b.studentKey||'').replace(/[.#$\[\]/]/g,'_'));if(!s||!SulukeraStudentAccount.isActive(s))fail('STUDENT_NOT_ACTIVE');
  if(b.scopeKey.includes('/')){const track=b.scopeKey.split('_unit_')[0],e=await read(env,ctx,'professionalEnrollments/'+b.studentKey+'/'+PROGRAM);if(e?.status!=='active'||!SulukeraStudentAccount.isActive(e)||!(e.selectedTracks?.[track]??track==='track_1'))fail('STUDENT_NOT_ENROLLED');}
  else {const lesson=await env.DB.prepare('SELECT subject_key FROM course_lessons WHERE id=?').bind(b.scopeKey).first(),[subjects,enrollments,packages]=await Promise.all(['subjects','enrollments','packages'].map(p=>read(env,ctx,p)));if(!lesson||!Object.values(enrollments||{}).some(e=>e.studentKey===b.studentKey&&e.subjectKey===lesson.subject_key)||!SulukeraAcademicPolicy.subjectAllowed(s,subjects?.[lesson.subject_key],packages||{}))fail('STUDENT_NOT_ENROLLED');}
 }
 await env.DB.prepare('INSERT INTO zoom_attendance_aliases VALUES(?,?,?,?,?,?) ON CONFLICT(host,scope_key,zoom_name) DO UPDATE SET student_key=excluded.student_key,approved_by=excluded.approved_by,approved_at=excluded.approved_at').bind(report.host,aliasScope,norm(b.zoomName),b.ignore?'':b.studentKey,actor,new Date().toISOString()).run();
 await env.DB.prepare("UPDATE zoom_attendance_reports SET state='fetched' WHERE id=?").bind(report.id).run();return {saved:true};
}
export async function runAttendanceSync(env,ctx,options={}){
 await attendanceSchema(env);const slot=Math.floor(Date.now()/60000),lease=slot+5,locked=await env.DB.prepare("INSERT INTO zoom_attendance_state VALUES('lease',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE CAST(zoom_attendance_state.value AS INTEGER)<?").bind(String(lease),slot).run();if(!locked.meta.changes)return {busy:true};
 try{
  let discovered=null;if(options.host||slot%10===0){const host=options.host||HOSTS[Math.floor(slot/10)%3];discovered=await discoverAttendance(env,host);}
  const report=await env.DB.prepare("SELECT * FROM zoom_attendance_reports WHERE state='fetched' AND (? IS NULL OR host=?) ORDER BY starts_at LIMIT 1").bind(options.host||null,options.host||null).first();if(!report)return {discovered,processed:0};
  let result;try{result=await applyAttendanceReport(env,ctx,report,options.preview===true);}catch(error){result={state:'review',reason:error.message};}
  await env.DB.prepare('UPDATE zoom_attendance_reports SET state=?,result_json=?,updated_at=? WHERE id=?').bind(options.preview?'fetched':result.state,JSON.stringify(result),new Date().toISOString(),report.id).run();return {discovered,processed:1,id:report.id,preview:options.preview===true,...result};
 }finally{await env.DB.prepare("UPDATE zoom_attendance_state SET value='0' WHERE id='lease' AND value=?").bind(String(lease)).run();}
}
