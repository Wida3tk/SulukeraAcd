import test from 'node:test';
import assert from 'node:assert/strict';
import '../graduation-attendance-import.js';
import '../student-account-policy.js';
import {handleGraduationExperience} from './src/graduation-experience.js';
const model=globalThis.SulukeraGraduationAttendance;
test('Zoom headers after summary, exact identity matching and reconnect merging retain presence without scores',()=>{
 const rows=model.parse([['Meeting report'],['Name (Original Name)','User Email','Duration (Minutes)'],['منيرة بن حسين','m@example.com',12],['منيرة بن حسين','m@example.com',0],['Guest','',4]]);
 const students=[{key:'m',id:'SUL-069',name:'منيره بن حسين',email:'m@example.com'}];
 assert.equal(model.match(rows[0],students),'m');assert.equal(model.match(rows[2],students),'');
 assert.deepEqual(model.merge(rows.slice(0,2).map(row=>({studentKey:model.match(row,students),attended:row.attended}))),[{studentKey:'m',attended:true}]);
 assert.equal(model.match({name:'منيرة بن حسين'},[...students,{key:'other',name:'منيرة بن حسين'}]),'');
 assert.throws(()=>model.parse([['Unknown column'],['data']]));
});
test('explicit absence and zero are preserved; unknown or blank attendance requires review',()=>{
 const rows=model.parse([['الرقم الطلابي','الحضور'],['SUL-069','لم يحضر'],['SUL-070','حضر'],['SUL-071',''],['SUL-072','wrong']]);
 assert.deepEqual(rows.map(row=>row.attended),[false,true,null,null]);
 assert.equal(model.match(rows[0],[{key:'m',id:'SUL-069'}]),'m');
 assert.throws(()=>model.merge([{studentKey:'m',attended:null}]));
});
function fixture(role='admin',inactive=false){
 const writes=[],project={id:'p',general_meetings_json:'[{"at":"2026-10-14"},{"at":"2026-10-21"}]'};
 const env={DB:{prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this;},async first(){return project;},async all(){return {results:[{student_key:'a'},{student_key:'b'}]};}};},async batch(statements){writes.push(...statements);}}};
 const ctx={firebaseRead:async()=>({a:{accountStatus:'active'},b:{accountStatus:inactive?'withdrawn':'active'}})};
 const auth={uid:'admin-id',profile:{role}};
 const send=body=>handleGraduationExperience(new Request('https://api/admin/graduation-projects/attendance-import',{method:'POST',body:JSON.stringify(body)}),env,auth,'/admin/graduation-projects/attendance-import',ctx);
 return {send,writes};
}
test('bulk attendance is atomic and restricted to the selected meeting; no grade or productivity writes',async()=>{
 const {send,writes}=fixture();const result=await send({projectId:'p',meetingIndex:1,rows:[{studentKey:'a',attended:true},{studentKey:'b',attended:false}]});
 assert.deepEqual(result.data,{saved:true,count:2,present:1,absent:1});assert.equal(writes.length,2);
 for(const statement of writes){assert.match(statement.sql,/INSERT INTO graduation_project_attendance/);assert.equal(statement.args[0],'p');assert.equal(statement.args[2],1);assert.equal(statement.args[4],'admin-id');assert.doesNotMatch(statement.sql,/grades|productivity/);}
 assert.deepEqual(writes.map(s=>s.args[3]),[1,0]);
});
test('nonadmins, duplicate mappings, invalid statuses, other-project and inactive students cannot write',async()=>{
 const base={projectId:'p',meetingIndex:0,rows:[{studentKey:'a',attended:true}]};
 for(const [f,payload] of [[fixture('student'),base],[fixture('lecturer'),base],[fixture(),{...base,rows:[...base.rows,...base.rows]}],[fixture(),{...base,rows:[{studentKey:'a',attended:1}]}],[fixture(),{...base,rows:[{studentKey:'outside',attended:true}]}],[fixture('admin',true),{...base,rows:[{studentKey:'b',attended:false}]}]]){
  await assert.rejects(()=>f.send(payload));assert.equal(f.writes.length,0);
 }
});
