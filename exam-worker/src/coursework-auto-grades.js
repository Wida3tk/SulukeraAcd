import {isCurrent,attendanceGrade} from './coursework.js';
import '../../student-account-policy.js';
import '../../academic-policy.js';
const base='https://sulukeraacd-default-rtdb.firebaseio.com';
export const ATTENDANCE_FOLLOWUP='يرجى مشاهدة المحاضرة بشكل مسجل وحل واجب الحضور المسجل ليتم احتساب درجة الحضور، بعد اعتماد المحاضر وإكمال الواجب الأساسي.';
const recorded=(g,w,f)=>{const value=g[w]?.[f]??g[w+'_'+f],flag=g[w+'_'+f+'Entered']??g[w]?.[f+'Entered'];return flag!==false&&value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&(flag===true||Number(value)>0);};
export function automaticCourseworkFields(l,g={},sources={},now=Date.now()){
 if(l.status!=='published'||now<Date.parse(l.opens_at))return {};
 const w='w'+l.week,out={},best=sources.best,attendance=sources.attendance,max=Number(l.attendance_max)||3;
 const hwRecorded=recorded(g,w,'hw'),attRecorded=recorded(g,w,'attend');
 if(best?.score!=null&&(!hwRecorded||(g[w+'_hwAutoMissed']===true&&Number(g[w+'_hw'])===0))){out[w+'_hw']=best.score;out[w+'_hwEntered']=true;out[w+'_hwAutoMissed']=false;out[w+'_hwNote']='';}
 else if(!hwRecorded&&now>Date.parse(l.closes_at)){out[w+'_hw']=0;out[w+'_hwEntered']=true;out[w+'_hwAutoMissed']=true;out[w+'_hwNote']='لم يتم تسليم الواجب';}
 else if(now<=Date.parse(l.closes_at)&&g[w+'_hwAutoMissed']===true&&Number(g[w+'_hw'])===0){out[w+'_hw']=null;out[w+'_hwEntered']=false;out[w+'_hwAutoMissed']=false;out[w+'_hwNote']='';}
 if(!attRecorded||((attendance||(best?.score!=null&&sources.reflection?.score!=null))&&g[w+'_attendProvisional']===true&&Number(g[w+'_attend'])===0)){
  let score=attendance?attendanceGrade(attendance.percent,max,String(l.opens_at).slice(0,10)>='2026-10-04'):0;
  if(best?.score!=null&&sources.reflection?.score!=null)score=Math.max(score??0,sources.reflection.score);
  if(score!=null){out[w+'_attend']=score;out[w+'_attendEntered']=true;out[w+'_attendProvisional']=!attendance&&!(best?.score!=null&&sources.reflection?.score!=null);}
 }
 const value=out[w+'_attend']??(attRecorded?Number(g[w]?.attend??g[w+'_attend']):null);
 if(value!=null)out[w+'_attendNote']=value<max?ATTENDANCE_FOLLOWUP:'';
 if(g[w+'_hwAutoMissed']===true&&Number(g[w+'_hw'])>0){out[w+'_hwNote']='';out[w+'_hwAutoMissed']=false;}
 return Object.fromEntries(Object.entries(out).filter(([k,v])=>g[k]!==v));
}
export async function finalizeAutomaticCoursework(env,tokenProvider,{force=false,limit=20,backup,dryRun=false}={}){
 const now=new Date().toISOString(),state=await env.DB.prepare('SELECT * FROM coursework_auto_scan WHERE id=1').first();
 const due=await env.DB.prepare("SELECT COUNT(*) count FROM course_lessons WHERE status='published' AND ((opens_at>? AND opens_at<=?) OR (closes_at>? AND closes_at<=?))").bind(state?.scanned_at||'',now,state?.scanned_at||'',now).first();
 if(!force&&!state?.pending&&!due?.count&&state&&Date.now()-Date.parse(state.scanned_at)<300000)return {updated:0,skipped:true};
 const lessons=(await env.DB.prepare("SELECT l.*,a.attendance_max FROM course_lessons l LEFT JOIN lesson_assessment a ON a.lesson_id=l.id WHERE l.status='published' AND l.opens_at<=?").bind(now).all()).results;
 if(!lessons.length)return {updated:0};
 const token=await tokenProvider(env),headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const read=async path=>{const response=await fetch(`${base}/${path}.json`,{headers});if(!response.ok)throw Error('AUTO_GRADE_READ_'+response.status);return await response.json()||{};};
 const paths=['subjects','semesters','students','enrollments','grades','users','professionalEnrollments','studentAdminSheets','packages'];
 const values=await Promise.all(paths.map(read)),root=Object.fromEntries(paths.map((p,i)=>[p,values[i]]));
 if(backup)await backup(root.grades);
 const [homework,attendance,reflections]=await Promise.all([
  env.DB.prepare('SELECT lesson_id,student_key,MAX(score) score FROM homework_attempts GROUP BY lesson_id,student_key').all(),
  env.DB.prepare('SELECT * FROM course_attendance').all(),env.DB.prepare('SELECT * FROM attendance_reflections WHERE score IS NOT NULL').all()
 ]);
 const source=(l,key)=>({best:homework.results.find(r=>r.lesson_id===l.id&&r.student_key===key),attendance:attendance.results.find(r=>r.lesson_id===l.id&&r.student_key===key),reflection:reflections.results.find(r=>r.lesson_id===l.id&&r.student_key===key)});
 const candidates=[];
 for(const l of lessons){const subject=root.subjects[l.subject_key];if(!subject||!isCurrent(subject,root.semesters,l.subject_key)||String(l.subject_key).startsWith('professional_'))continue;
  const keys=new Set(Object.values(root.enrollments).filter(e=>e.subjectKey===l.subject_key).map(e=>e.studentKey));
  for(const key of keys){const student=root.students[key];if(!student||student.planType==='PROFESSIONAL'||String(student.batch||'').startsWith('PRO-')||!SulukeraStudentAccount.isActiveInRoot(key,root)||!SulukeraAcademicPolicy.subjectAllowed(student,subject,root.packages))continue;
   const canonical=('grade_'+key+'_'+l.subject_key).replace(/[.#$[\]]/g,'_'),gradeKey=root.grades[canonical]?canonical:Object.entries(root.grades).find(([,g])=>g.studentKey===key&&g.subjectKey===l.subject_key)?.[0]||canonical,sources=source(l,key);
   if(Object.keys(automaticCourseworkFields(l,root.grades[gradeKey]||{},sources)).length)candidates.push({l,key,gradeKey,sources});
  }
 }
 if(dryRun)return {planned:candidates.length,missedHomework:candidates.filter(c=>automaticCourseworkFields(c.l,root.grades[c.gradeKey]||{},c.sources)['w'+c.l.week+'_hwAutoMissed']===true).length,provisionalAttendance:candidates.filter(c=>automaticCourseworkFields(c.l,root.grades[c.gradeKey]||{},c.sources)['w'+c.l.week+'_attendProvisional']===true).length};
 let updated=0,failed=0;
 for(const item of candidates.slice(0,limit)){let saved=false;
  for(let retry=0;retry<4;retry++){
   const url=`${base}/grades/${item.gradeKey}.json`,current=await fetch(url,{headers:{...headers,'X-Firebase-ETag':'true'}});if(!current.ok)throw Error('AUTO_GRADE_RECORD_READ');
   const previous=await current.json()||{},fields=automaticCourseworkFields(item.l,previous,item.sources);if(!Object.keys(fields).length){saved=true;break;}
   const payload={...previous,...fields,studentKey:item.key,subjectKey:item.l.subject_key,updatedAt:now,updatedBy:'automatic-coursework',updatedRole:'coursework'};
   for(const f of ['hw','attend'])if(previous['w'+item.l.week]&&Object.hasOwn(fields,'w'+item.l.week+'_'+f))payload['w'+item.l.week]={...payload['w'+item.l.week],[f]:fields['w'+item.l.week+'_'+f]};
   const etag=current.headers.get('etag');if(!etag)throw Error('AUTO_GRADE_ETAG_MISSING');
   const write=await fetch(url,{method:'PUT',headers:{...headers,'If-Match':etag},body:JSON.stringify(payload)});if(write.status===412)continue;if(!write.ok)throw Error('AUTO_GRADE_RECORD_WRITE');updated++;saved=true;break;
  }
  if(!saved)failed++;
 }
 await env.DB.prepare('INSERT INTO coursework_auto_scan VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET scanned_at=excluded.scanned_at,pending=excluded.pending').bind(now,candidates.length>limit||failed?1:0).run();
 return {updated,remaining:Math.max(0,candidates.length-limit)+failed};
}
