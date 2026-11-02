import '../../academic-policy.js';
import '../../student-account-policy.js';
const taskKey=(kind,row)=>[kind,row.lesson_id,row.student_key,row.id||'original'].join(':');
export async function buildGradingReviewQueue(DB,scope,root){
 const [lessons,discussions,attempts,reflections,attendance,referrals]=await Promise.all([
  DB.prepare('SELECT l.*,a.discussion_max,a.attendance_max,a.discussion_prompt FROM course_lessons l LEFT JOIN lesson_assessment a ON a.lesson_id=l.id').all(),
  DB.prepare('SELECT * FROM academic_discussions WHERE score IS NULL OR reviewed_at IS NULL').all(),
  DB.prepare('SELECT * FROM academic_discussion_attempts WHERE reviewed_at IS NULL').all(),
  DB.prepare('SELECT * FROM attendance_reflections WHERE score IS NULL OR reviewed_at IS NULL').all(),
  DB.prepare('SELECT * FROM course_attendance').all(),
  DB.prepare('SELECT * FROM grading_review_referrals').all(),
 ]);
 const eligible=new Set(Object.values(root.enrollments||{}).filter(e=>scope.allowed.includes(e.subjectKey)&&SulukeraStudentAccount.isActiveInRoot(e.studentKey,root)&&SulukeraAcademicPolicy.subjectAllowed(root.students[e.studentKey],scope.subjects[e.subjectKey],root.packages||{})).map(e=>e.subjectKey+'|'+e.studentKey));
 const items=[];
 for(const [kind,rows] of [['discussion',discussions.results],['discussion',attempts.results],['reflection',reflections.results]])for(const row of rows){
  const lesson=lessons.results.find(l=>l.id===row.lesson_id);if(!lesson||lesson.status!=='published'||!scope.allowed.includes(lesson.subject_key)||!eligible.has(lesson.subject_key+'|'+row.student_key))continue;
  const max=Number(kind==='discussion'?lesson.discussion_max??scope.settings.disc??5:lesson.attendance_max??scope.settings.attend??5);
  // A fully credited live attendee has no attendance compensation left to assess.
  if(kind==='reflection'&&max===3&&lesson.opens_at>='2026-10-04'&&attendance.results.some(a=>a.lesson_id===row.lesson_id&&a.student_key===row.student_key&&a.percent>=50))continue;
  if(kind==='reflection'&&Object.values(root.grades||{}).some(g=>{if(g.studentKey!==row.student_key||g.subjectKey!==lesson.subject_key)return false;const w='w'+lesson.week,raw=g[w+'_attend']??g[w]?.attend;return raw!=null&&raw!==''&&Number(raw)>=max&&g[w+'_attendProvisional']!==true&&g[w+'_attendEntered']!==false;}))continue;
  const student=root.students[row.student_key],subject=scope.subjects[lesson.subject_key],key=taskKey(kind,row),version=row.submitted_at;
  items.push({key,version,kind,lessonId:lesson.id,studentKey:row.student_key,attemptId:row.id||null,subjectKey:lesson.subject_key,subjectName:subject.name,batch:subject.batch,week:lesson.week,studentName:[student.firstName,student.midName,student.lastName].filter(Boolean).join(' ')||student.name||student.id||row.student_key,studentId:student.id||'',submittedAt:row.submitted_at,max,prompt:lesson.discussion_prompt||'',answer:row.answer||'',answers:kind==='reflection'?JSON.parse(row.answers_json):[],referral:referrals.results.find(r=>r.task_key===key&&r.source_version===version)||null});
 }
 return items.sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt)||a.key.localeCompare(b.key)).map(item=>{
  const id=item.referral?.lecturer_uid||scope.subjects[item.subjectKey]?.lecturerUserId;
  const lecturer=Object.entries(root.users||{}).find(([key,u])=>[key,u.username,u.id,u.userId].some(v=>v&&v===id));
  return {...item,lecturerName:lecturer?.[1]?.name||id||''};
 });
}
export async function handleGradingReviewQueue(request,env,auth,path,ctx,scope){
 if(!path.startsWith('/coursework/review-queue'))return null;
 if(!['lecturer','admin'].includes(scope.role))throw Object.assign(Error('FORBIDDEN'),{status:403});
 const names=['enrollments','packages','users','studentAdminSheets','professionalEnrollments','grades'],values=await Promise.all(names.map(p=>ctx.firebaseRead(p,auth.token))),root={...Object.fromEntries(names.map((p,i)=>[p,values[i]||{}])),students:scope.students};
 const items=await buildGradingReviewQueue(env.DB,scope,root);
 if(path==='/coursework/review-queue'&&request.method==='GET'){
  const tasks=items.filter(t=>t.referral?.status!=='open');return {data:{tasks,referrals:scope.role==='admin'?items.filter(t=>t.referral?.status==='open'):[],referred:items.length-tasks.length}};
 }
 const b=await request.json();
 const item=items.find(t=>t.key===b.taskKey&&t.version===b.version);if(!item)throw Object.assign(Error('REVIEW_TASK_CHANGED'),{status:409});
 const now=new Date().toISOString();
 if(path==='/coursework/review-queue/refer'&&request.method==='POST'&&scope.role==='lecturer'){
  const reason=String(b.reason||'').trim();if(reason.length<10||reason.length>2000)throw Object.assign(Error('REFERRAL_REASON_REQUIRED'),{status:400});
  await env.DB.prepare("INSERT INTO grading_review_referrals(task_key,source_version,lesson_id,student_key,kind,attempt_id,reason,lecturer_uid,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'open',?,?) ON CONFLICT(task_key,source_version) DO UPDATE SET reason=excluded.reason,lecturer_uid=excluded.lecturer_uid,status='open',updated_at=excluded.updated_at,admin_note='',resolved_by=NULL").bind(item.key,item.version,item.lessonId,item.studentKey,item.kind,item.attemptId,reason,auth.uid,now,now).run();return {data:{saved:true}};
 }
 if(path==='/coursework/review-queue/return'&&request.method==='POST'&&scope.role==='admin'){
  const note=String(b.note||'').trim();if(note.length<5||note.length>2000)throw Object.assign(Error('ADMIN_NOTE_REQUIRED'),{status:400});
  await env.DB.prepare("UPDATE grading_review_referrals SET status='returned',admin_note=?,resolved_by=?,updated_at=? WHERE task_key=? AND source_version=? AND status='open'").bind(note,auth.uid,now,item.key,item.version).run();return {data:{saved:true}};
 }
 throw Object.assign(Error('FORBIDDEN'),{status:403});
}
