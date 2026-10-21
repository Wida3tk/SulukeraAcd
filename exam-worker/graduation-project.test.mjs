import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import '../student-account-policy.js';
import {handleGraduationProject} from './src/graduation-projects.js';
import {readGraduationDirectory} from './src/graduation-directory.js';
test('directory service reads use OAuth Bearer headers rather than ID-token query authentication',async()=>{
 const data=await readGraduationDirectory('https://database.test','students/member','test-oauth',async(url,options)=>{
  assert.equal(url,'https://database.test/students/member.json');assert.equal(options.headers.Authorization,'Bearer test-oauth');
  return Response.json({firstName:'عضو'});
 });assert.equal(data.firstName,'عضو');
});
test('unpublished topics load without service directory credentials',async()=>{
 const {env,auth,ctx}=fixture();ctx.firebaseAdminRead=async()=>{throw Error('service unavailable');};
 const result=await handleGraduationProject(new Request('https://test/student/graduation-project'),env,auth('student'),'/student/graduation-project',ctx);
 assert.equal(result.data.available,true);assert.equal(result.data.project.generalMeetings.length,4);assert.equal(result.data.topicOptions.length,0);
});
function fixture(){
 const sql=new DatabaseSync(':memory:');for(const file of ['graduation_projects.sql','graduation-experience.sql'])sql.exec(readFileSync(new URL(file,import.meta.url),'utf8'));
 const statement=(query,args=[])=>({bind(...values){return statement(query,values);},first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:sql.prepare(query).run(...args).changes}}),execute:()=>sql.prepare(query).run(...args)});
 const students=Object.fromEntries(Array.from({length:24},(_,i)=>['s'+i,{firstName:'طالب '+i,batch:'Q1-26',planType:'QASP-S',accountStatus:'active'}]));
 const meetings=Array.from({length:4},(_,i)=>({at:`2026-10-${14+i*7<=31?14+i*7:4}T19:00:00+03:00`,link:''}));
 sql.prepare('INSERT INTO graduation_projects VALUES (?,?,?,?,?,?,?,?,?,?)').run('project','Q1','QASP-S','مشروع التخرج',4,'open','[]',JSON.stringify(meetings),'2026-10-01','2026-10-01');
 for(const key of Object.keys(students))sql.prepare('INSERT INTO graduation_project_students VALUES (?,?,1,?)').run('project',key,'2026-10-01');
 const env={sql,DB:{prepare:statement,batch:async commands=>{sql.exec('BEGIN');try{const result=commands.map(command=>command.execute());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}},GRADUATION_PROJECT_FILES:{put:async()=>{env.uploaded=true;}}};
 const root={students,semesters:{term:{batches:['Q1-26'],semesterNo:4,endDate:'2026-09-24',subjects:['last']}},subjects:{last:{courseKey:'course_12',semesterNo:4}},packages:{}};
 const ctx={firebaseRead:async(path,token)=>{if(token.startsWith('student:')&&(path==='students'||path.startsWith('students/')&&path!=='students/'+token.split(':')[1]))throw Object.assign(Error('PROFILE_ACCESS_DENIED'),{status:403});return path.split('/').reduce((value,key)=>value?.[key],root);},firebaseAdminToken:async()=> 'admin-token',firebaseAdminRead:async path=>path.split('/').reduce((value,key)=>value?.[key],root),corsHeaders:()=>({})};
 const auth=(role,key='s0')=>({uid:key,token:role+':'+key,profile:{role,studentKey:key}});
 const call=(path,value,role='student',key='s0')=>handleGraduationProject(new Request('https://test'+path,{method:value?'POST':'GET',...(value?{body:JSON.stringify(value)}:{})}),env,auth(role,key),path,ctx);
 return {env,call,auth,ctx,students};
}
test('four meetings persist; invalid links and student administration rejected',async()=>{
 const {env,call}=fixture();await call('/admin/graduation-projects/config',{projectId:'project',topics:[],generalMeetings:Array.from({length:4},(_,i)=>({at:new Date(Date.UTC(2026,9,14+i*7,16)).toISOString(),link:''}))},'admin');
 assert.equal(JSON.parse(env.sql.prepare('SELECT general_meetings_json FROM graduation_projects').get().general_meetings_json).length,4);
 await assert.rejects(call('/admin/graduation-projects/config',{projectId:'project'},'student'),error=>error.status===403);
 await assert.rejects(call('/admin/graduation-projects/config',{projectId:'project',generalMeetings:[{link:'javascript:alert(1)'}]},'admin'));
});
test('attendance is explicit, role restricted, and only own attendance is returned',async()=>{
 const {call}=fixture();await call('/admin/graduation-projects/attendance',{projectId:'project',studentKey:'s0',meetingIndex:0,attended:true},'admin');
 await call('/admin/graduation-projects/attendance',{projectId:'project',studentKey:'s1',meetingIndex:1,attended:false},'admin');
 const result=(await call('/student/graduation-project')).data;assert.equal(result.attendance.length,1);assert.equal(result.attendance[0].attended,1);assert.equal(result.group,null);
 await assert.rejects(call('/admin/graduation-projects/attendance',{projectId:'project',studentKey:'s0',meetingIndex:0,attended:false}),error=>error.status===403);
 await assert.rejects(call('/admin/graduation-projects/attendance',{projectId:'project',studentKey:'s0',meetingIndex:4,attended:true},'admin'));
 await call('/admin/graduation-projects/attendance',{projectId:'project',studentKey:'s0',meetingIndex:0,attended:null},'admin');assert.equal((await call('/student/graduation-project')).data.attendance.length,0);
});
test('all groups accept six members, reject a seventh, prevent duplicate membership, and scope team names',async()=>{
 const {call,env}=fixture();await assert.rejects(call('/student/graduation-project/topic',{topic:'one'}),error=>error.status===409);
 await call('/admin/graduation-projects/config',{projectId:'project',topics:['one','two','three','four','last'],generalMeetings:[]},'admin');
 for(let i=0;i<6;i++)await call('/student/graduation-project/topic',{topic:'one'},'student','s'+i);
 await assert.rejects(call('/student/graduation-project/topic',{topic:'one'},'student','s6'),error=>error.status===409);
 await assert.rejects(call('/student/graduation-project/topic',{topic:'two'},'student','s0'),error=>error.status===409);
 for(let i=6;i<12;i++)await call('/student/graduation-project/topic',{topic:'last'},'student','s'+i);
 await assert.rejects(call('/student/graduation-project/topic',{topic:'last'},'student','s12'),error=>error.status===409);
 const data=(await call('/student/graduation-project')).data;assert.equal(data.group.members.length,6);assert.equal(data.group.memberProfiles.length,6);assert.equal(data.group.memberProfiles.some(member=>member.key==='s6'),false);
 assert.equal(env.sql.prepare('SELECT count(*) n FROM graduation_project_group_members WHERE student_key=?').get('s0').n,1);
 await assert.rejects(call('/admin/graduation-projects/config',{projectId:'project',topics:['changed']},'admin'),error=>error.status===409);
});
test('project access excludes inactive students and PDF upload checks membership and file signature',async()=>{
 const {call,env,students,ctx,auth}=fixture();students.s0.accountStatus='withdrawn';assert.equal((await call('/student/graduation-project')).data.available,false);students.s0.accountStatus='active';
 env.sql.prepare('INSERT INTO graduation_project_groups VALUES (?,?,?,?,?,?,?,?,?,?)').run('group','project','فريق','عنوان','',null,'','s0','now','now');env.sql.prepare('INSERT INTO graduation_project_group_members VALUES (?,?)').run('group','s0');
 const upload=(name,data,key='s0')=>handleGraduationProject(new Request('https://test/student/graduation-project/upload',{method:'POST',headers:{'X-Group-Id':'group','X-File-Name':encodeURIComponent(name)},body:data}),env,auth('student',key),'/student/graduation-project/upload',ctx);
 await assert.rejects(upload('file.pdf','%PDF-1.7','s1'),error=>error.status===403);await assert.rejects(upload('file.docx','%PDF-1.7'));await assert.rejects(upload('file.pdf','not a pdf'));
 assert.equal((await upload('مشروعي.pdf','%PDF-1.7\n%%EOF')).data.uploaded,true);assert.equal(env.uploaded,true);
});
