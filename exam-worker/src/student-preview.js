import '../../academic-policy.js';
import '../../student-account-policy.js';
import {handleCoursework,isCurrent} from './coursework.js';
import {startAcademicRecording} from './academic-recording-media.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const PROGRAM='organizational_behavior';
export async function resolveStudentPreview(params,auth,ctx){
 if(auth.profile.role!=='admin')fail('FORBIDDEN',403);
 const key=params.get('studentKey')||'',batch=params.get('batch')||'',plan=params.get('plan')||'QBA';
 if(key&&!/^[\w-]{1,100}$/.test(key))fail('INVALID_STUDENT');
 if(!key&&(!batch||!['QBA','QASP-S','PROFESSIONAL'].includes(plan)))fail('SELECT_PREVIEW_CONTEXT');
 const paths=['subjects','enrollments','packages','semesters','settings','schedule','examSchedules',`professionalPrograms/${PROGRAM}`];
 const values=await Promise.all(paths.map(p=>ctx.firebaseRead(p,auth.token)));const root=Object.fromEntries(paths.map((p,i)=>[p,values[i]||{}]));
 const student=key?await ctx.firebaseRead('students/'+key,auth.token):{batch,planType:plan,accountStatus:'active',firstName:'معاينة إدارية'};
 if(!student)fail('STUDENT_NOT_FOUND',404);
 const profiles=key?await ctx.firebaseRead('users',auth.token):{},profile=Object.values(profiles||{}).find(p=>p.role==='student'&&p.studentKey===key);
 const active=SulukeraStudentAccount.isActive(student)&&SulukeraStudentAccount.isActive(profile||{}),studentKey=key||'__admin_preview__';
 const enrollment=key?await ctx.firebaseRead(`professionalEnrollments/${key}/${PROGRAM}`,auth.token):plan==='PROFESSIONAL'?{status:'active',selectedTracks:{track_1:true,[params.get('track')||'track_1']:true}}:null;
 const enrolled=new Set(key?Object.values(root.enrollments).filter(e=>e.studentKey===key).map(e=>e.subjectKey):Object.entries(root.subjects).filter(([,s])=>String(s.batch).toUpperCase()===String(student.batch).toUpperCase()).map(([k])=>k));
 const allowed=new Set([...enrolled].filter(k=>root.subjects[k]&&SulukeraAcademicPolicy.subjectAllowed(student,root.subjects[k],root.packages)));
 const professional=enrollment?.status==='active'||!enrollment&&(student.planType==='PROFESSIONAL'||String(student.batch).startsWith('PRO-'));
 if(professional)allowed.add('professional_organizational_behavior_final');
 const resolved={student,studentKey,subjectKeys:allowed},fake={...auth,profile:{role:'student',studentKey,accountStatus:profile?.accountStatus||student.accountStatus}};
 return {root,key,student,active,enrollment:enrollment||{selectedTracks:{track_1:true}},professional,resolved,fake,allowed,enrolled};
}
export async function handleStudentPreview(request,env,auth,path,ctx){
 if(!path.startsWith('/admin/student-preview'))return null;
 if(auth.profile.role!=='admin')fail('FORBIDDEN',403);
 if(path!=='/admin/student-preview'&&path!=='/admin/student-preview/recording')fail('PREVIEW_ROUTE_NOT_ALLOWED',405);
 if(path==='/admin/student-preview'&&request.method!=='GET'||path.endsWith('/recording')&&request.method!=='POST')fail('PREVIEW_READ_ONLY',405);
 const params=new URL(request.url).searchParams,state=await resolveStudentPreview(params,auth,ctx),{root,key,student,active,enrollment,professional,resolved,fake,allowed,enrolled}=state;
 if(path.endsWith('/recording')){
  if(!active)fail('ACCOUNT_INACTIVE',403);const body=await request.json();
  if(body.lessonId){const l=await env.DB.prepare('SELECT * FROM course_lessons WHERE id=?').bind(String(body.lessonId)).first();if(!l||!allowed.has(l.subject_key)||l.status!=='published')fail('LESSON_NOT_AVAILABLE',403);return {data:{...await startAcademicRecording(env,l),previewOnly:true}};}
  const match=String(body.unitId||'').match(/^(track_[1-3])_(unit_[1-3])$/),unit=match&&root[`professionalPrograms/${PROGRAM}`]?.tracks?.[match[1]]?.units?.[match[2]];
  if(!professional||!match||unit?.status!=='published'||!(enrollment.selectedTracks?.[match[1]]??match[1]==='track_1')||!/^session_[1-5]$/.test(body.sessionKey||''))fail('SESSION_NOT_AVAILABLE',403);
  return {data:{...await ctx.professionalPreview({unitId:body.unitId,sessionKey:body.sessionKey}),previewOnly:true}};
 }
 let coursework={subjects:[],lessons:[]},exams=[];
 if(active){
  if(!professional){const result=await handleCoursework(new Request('https://preview/coursework'),env,fake,'/coursework',{...ctx,studentContext:async()=>resolved,firebaseStudentGrades:key?ctx.firebaseStudentGrades:async()=>({})});coursework=result.data;}
  exams=await ctx.studentExams(env,fake,resolved);
 }
 const examId=params.get('examId');let questions=[];
 if(examId){if(!exams.some(e=>e.id===examId))fail('EXAM_NOT_AVAILABLE',403);questions=(await env.DB.prepare('SELECT id,prompt,choices_json,correct_index,points FROM questions WHERE exam_id=? ORDER BY position').bind(examId).all()).results||[];}
 const now=Date.now();exams=exams.map(exam=>({...exam,availability:now<Date.parse(exam.opensAt)?'لم يفتح موعد الاختبار':now>Date.parse(exam.closesAt)?'انتهى موعد الاختبار؛ يلزم استثناء':'متاح الآن',previewOnly:true}));
 const reasons=Object.entries(root.subjects).filter(([k,s])=>enrolled.has(k)||String(s.batch).toUpperCase()===String(student.batch).toUpperCase()).map(([k,s])=>({subjectKey:k,name:s.name,reason:!active?'الحساب موقوف':!enrolled.has(k)?'غير مسجل بالمقرر':!allowed.has(k)?'خارج الخطة أو الرخصة':!isCurrent(s,root.semesters,k)?'مقرر غير حالي / فصل منتهٍ':'متاح ضمن المقررات الحالية'}));
 const schedule=Object.values(root.schedule.weekly||{}).filter(s=>s.active!==false&&!s.archivedAt&&String(s.batch).toUpperCase()===String(student.batch).toUpperCase()&&SulukeraAcademicPolicy.subjectAllowed(student,root.subjects[s.subjectKey]||{},root.packages)&&isCurrent({...root.subjects[s.subjectKey],startDate:s.termStartDate||root.subjects[s.subjectKey]?.startDate,endDate:s.termEndDate||root.subjects[s.subjectKey]?.endDate},root.semesters,s.subjectKey));
 const rawException=key?await ctx.firebaseRead('studentExamExceptions/'+key,auth.token):null,exception=SulukeraAcademicPolicy.exceptionApplies(rawException,student,'',root.semesters)?rawException:null;
 const blocksExams=!!(exception?.active&&(!exception.secureOpensAt||!exception.secureClosesAt));
 const examSchedules=Object.entries(root.examSchedules).filter(([,s])=>s.published!==false&&String(s.batch).toUpperCase()===String(student.batch).toUpperCase()&&allowed.has(s.subjectKey)).map(([id,s])=>({id,...s}));
 const lessonAvailability=(await env.DB.prepare('SELECT id,subject_key,title,status,opens_at,closes_at,recording_url FROM course_lessons').all()).results.filter(l=>allowed.has(l.subject_key)).map(l=>({name:l.title,reason:l.status!=='published'?'لم تُنشر المحاضرة':now<Date.parse(l.opens_at)?'لم يفتح موعد الواجب':now>Date.parse(l.closes_at)?'انتهى موعد تسليم الواجب':'الواجب متاح الآن',recording:l.recording_url?'التسجيل مضاف':'التسجيل غير مضاف'}));
 const units=professional&&active?Object.entries(root[`professionalPrograms/${PROGRAM}`].tracks||{}).filter(([track])=>enrollment.selectedTracks?.[track]??track==='track_1').flatMap(([track,t])=>Object.entries(t.units||{}).filter(([,u])=>u.status==='published').map(([unit,u])=>({id:track+'_'+unit,trackTitle:t.title,...u}))):[];
 return {data:{previewOnly:true,studentKey:key||null,student:{name:[student.firstName,student.midName,student.lastName].filter(Boolean).join(' ')||student.name,batch:student.batch,plan:student.planType},active,coursework,exams:blocksExams?[]:exams,questions:blocksExams?[]:questions,schedule:active?schedule:[],examSchedules:active&&!blocksExams?examSchedules:[],units,reasons,lessonAvailability,examBlockReason:blocksExams?'استثناء تأجيل معتمد دون موعد بديل؛ الاختبارات محجوبة لهذا الطالب':null}};
}
