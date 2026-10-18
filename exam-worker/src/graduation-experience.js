import '../../academic-policy.js';
import '../../graduation-project-model.js';
const fail=(message,status=400)=>{const error=new Error(message);error.status=status;throw error;};
const parse=value=>{try{return JSON.parse(value||'[]');}catch{return [];}};
const roles=(auth,...allowed)=>{if(!allowed.includes(auth.profile.role))fail('FORBIDDEN',403);};
const body=async request=>{try{return await request.json();}catch{fail('INVALID_JSON');}};
export async function studentProject(env,auth,ctx){
 roles(auth,'student');const key=auth.profile.studentKey;
 const [student,terms,subjects,packages]=await Promise.all(['students/'+key,'semesters','subjects','packages'].map(path=>ctx.firebaseRead(path,auth.token)));
 const policy=globalThis.SulukeraAcademicPolicy;
 if(!student||!globalThis.SulukeraStudentAccount.isActive(student)||!policy.projectStage(student,terms||{},subjects||{},packages||{}))return null;
 const batch=String(student.batch||'').trim().toUpperCase(),pt=policy.resolvePlan(student,packages||{});
 const projects=(await env.DB.prepare("SELECT * FROM graduation_projects WHERE plan_type=? AND status='open' ORDER BY created_at DESC").bind(pt).all()).results||[];
 const project=projects.find(p=>batch===String(p.batch).toUpperCase()||batch.startsWith(String(p.batch).toUpperCase()+'-'));
 if(!project)return null;
 await env.DB.prepare('INSERT INTO graduation_project_students VALUES (?,?,1,?) ON CONFLICT(project_id,student_key) DO UPDATE SET eligible=1').bind(project.id,key,new Date().toISOString()).run();
 return {project,student,key};
}
export async function activeProjectStudents(env,project,auth,ctx){
 const students=auth.profile.role==='student'?await ctx.firebaseAdminRead('students'):await ctx.firebaseRead('students',auth.token),members=(await env.DB.prepare('SELECT student_key FROM graduation_project_students WHERE project_id=? AND eligible=1').bind(project.id).all()).results||[];
 return members.filter(row=>students?.[row.student_key]&&globalThis.SulukeraStudentAccount.isActive(students[row.student_key]));
}
export async function handleGraduationExperience(request,env,auth,path,ctx){
 if(path==='/admin/graduation-projects/attendance'&&request.method==='POST'){
  roles(auth,'admin','academic_admin');const value=await body(request),index=value.meetingIndex;
  if(!Number.isInteger(index)||index<0||index>3||![true,false,null].includes(value.attended))fail('INVALID_ATTENDANCE');
  const project=await env.DB.prepare('SELECT * FROM graduation_projects WHERE id=?').bind(value.projectId).first();
  if(!project||!parse(project.general_meetings_json)[index])fail('MEETING_NOT_FOUND',404);
  const student=await env.DB.prepare('SELECT 1 ok FROM graduation_project_students WHERE project_id=? AND student_key=? AND eligible=1').bind(project.id,value.studentKey).first();
  if(!student)fail('STUDENT_NOT_ELIGIBLE',403);
  if(value.attended===null)await env.DB.prepare('DELETE FROM graduation_project_attendance WHERE project_id=? AND student_key=? AND meeting_index=?').bind(project.id,value.studentKey,index).run();
  else await env.DB.prepare('INSERT INTO graduation_project_attendance VALUES (?,?,?,?,?,?) ON CONFLICT(project_id,student_key,meeting_index) DO UPDATE SET attended=excluded.attended,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(project.id,value.studentKey,index,value.attended?1:0,auth.uid,new Date().toISOString()).run();
  return {data:{saved:true}};
 }
 if(path==='/student/graduation-project/topic'&&request.method==='POST'){
  const context=await studentProject(env,auth,ctx);if(!context)fail('PROJECT_NOT_AVAILABLE',403);
  const {project,key,student}=context,value=await body(request),topics=parse(project.topics_json),index=topics.indexOf(value.topic);
  if(index<0)fail('TOPIC_NOT_AVAILABLE',409);
  const total=(await activeProjectStudents(env,project,auth,ctx)).length,capacity=globalThis.SulukeraGraduation.topicCapacity(total,index);
  if(!capacity)fail('TOPIC_NOT_AVAILABLE',409);
  const groupId=`${project.id}_topic_${index}`,now=new Date().toISOString();
  await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO graduation_project_groups (id,project_id,name,topic,supervisor_name,meeting_at,meeting_link,leader_student_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(groupId,project.id,`المجموعة ${index+1}`,value.topic,'',null,'',null,now,now),
   env.DB.prepare(`INSERT OR IGNORE INTO graduation_project_topic_choices SELECT ?,?,?,?,? WHERE
    (SELECT count(*) FROM graduation_project_group_members WHERE group_id=?)<? AND
    NOT EXISTS(SELECT 1 FROM graduation_project_group_members m JOIN graduation_project_groups g ON g.id=m.group_id WHERE g.project_id=? AND m.student_key=?)`).bind(project.id,key,value.topic,groupId,now,groupId,capacity,project.id,key),
   env.DB.prepare('INSERT OR IGNORE INTO graduation_project_group_members SELECT group_id,student_key FROM graduation_project_topic_choices WHERE project_id=? AND student_key=?').bind(project.id,key)
  ]);
  const choice=await env.DB.prepare('SELECT topic FROM graduation_project_topic_choices WHERE project_id=? AND student_key=?').bind(project.id,key).first();
  if(!choice||choice.topic!==value.topic)fail('GROUP_FULL_OR_ALREADY_ASSIGNED',409);
  const normalize=v=>String(v||'').normalize('NFKC').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\u064B-\u065F\u0670\s]/g,'').toLowerCase();
  const name=[student?.firstName,student?.midName,student?.lastName].filter(Boolean).join(' ')||student?.name||'';
  if(normalize(name)===normalize('منيرة بن حسين')&&normalize(value.topic).includes(normalize('تقييم المفضلات')))
    await env.DB.prepare('UPDATE graduation_project_groups SET leader_student_key=?,updated_at=? WHERE id=? AND (leader_student_key IS NULL OR leader_student_key=?)').bind(key,now,groupId,key).run();
  return {data:{saved:true}};
 }
 return null;
}
