/* Isolated emulator only: never writes production data. */
const assert=require('node:assert/strict');
const base='http://127.0.0.1:9007',project='demo-sulukera-security',ns=project+'-default-rtdb';
async function request(path,method,data,uid){
 const query=new URLSearchParams({ns});const headers={'Content-Type':'application/json'};
 if(uid){const now=Math.floor(Date.now()/1000),encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');query.set('auth',`${encode({alg:'none',typ:'JWT'})}.${encode({iss:`https://securetoken.google.com/${project}`,aud:project,sub:uid,user_id:uid,iat:now,auth_time:now,exp:now+3600,firebase:{sign_in_provider:'custom',identities:{}}})}.`);}else headers.Authorization='Bearer owner';
 const r=await fetch(`${base}/${path}.json?${query}`,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,data:await r.json()};
}
(async()=>{
 const seeded={users:{admin:{role:'admin'},lecturer:{role:'lecturer'},student:{role:'student',studentKey:'s'},other:{role:'student',studentKey:'o'},stopped:{role:'student',studentKey:'blocked',accountStatus:'suspended'}},students:{s:{accountStatus:'active'},blocked:{accountStatus:'active'}},grades:{g:{studentKey:'s',subjectKey:'course',exam:20,w1_hw:6}},professionalProgress:{s:{obm:{units:{u:{examPassed:true,sessions:{session_1:{attendancePercent:80,attended:true}}}}}}}};
 assert.equal((await request('','PUT',seeded)).status,200);
 const submitted={studentKey:'s',type:'leave',title:'إجازة',details:'سبب الإجازة',status:'pending',adminNote:'',lecturerNote:'',reviewedAt:'',reviewedBy:'',createdAt:new Date().toISOString()};
 assert.equal((await request('studentRequests/new','PUT',submitted,'student')).status,200);
 for(const change of [{status:'approved'},{adminNote:'forged'},{studentKey:'o'}])assert.equal((await request('studentRequests/new','PATCH',change,'student')).status,401);
 assert.equal((await request('studentRequests/new','DELETE',undefined,'student')).status,401);
 assert.equal((await request('studentRequests/forged','PUT',{...submitted,status:'approved'},'student')).status,401);
 assert.equal((await request('studentRequests/injected','PUT',{...submitted,approvedAt:'fake'},'student')).status,401);
 assert.equal((await request('studentRequests/other','PUT',submitted,'other')).status,401);
 assert.equal((await request('studentRequests/new','PATCH',{status:'approved',adminNote:'accepted'},'admin')).status,200);
 assert.equal((await request('studentRequests/new','PATCH',{lecturerNote:'reviewed',status:'returned_to_admin'},'lecturer')).status,200);
 const path='professionalProgress/s/obm/units/u';
 assert.equal((await request(path+'/sessions/session_1','PATCH',{watchedSeconds:15,percent:25,completed:false,lastWatchedAt:new Date().toISOString()},'student')).status,200);
 for(const change of [{attendancePercent:100},{attended:false},{attendanceSourceHash:'forged'}])assert.equal((await request(path+'/sessions/session_1','PATCH',change,'student')).status,401);
 assert.equal((await request(path,'PATCH',{examPassed:false},'student')).status,401);
 assert.equal((await request(path,'DELETE',undefined,'student')).status,401);
 assert.equal((await request(path+'/sessions/session_1','PATCH',{percent:101},'student')).status,401);
 assert.equal((await request(path+'/sessions/session_1','PATCH',{percent:30},'other')).status,401);
 assert.equal((await request('professionalProgress/blocked/obm/units/u/sessions/s1','PATCH',{percent:30},'stopped')).status,401);
 assert.equal((await request(path,'PATCH',{materialReviewed:true,completed:true,completedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),discussionSubmitted:true},'student')).status,200);
 assert.equal((await request('','PATCH',{'professionalDiscussions/s/obm/u':{q1:'answer',q2:'answer'},[path+'/discussionSubmitted']:true,[path+'/completed']:false,[path+'/completedAt']:null},'student')).status,200);
 assert.equal((await request(path+'/sessions/session_1','PATCH',{attendancePercent:0,attended:false},'admin')).status,200);
 assert.equal((await request('grades/g','PATCH',{w1_hw:0,w1_hwEntered:true},'lecturer')).status,200);
 assert.equal((await request('grades/g','PATCH',{exam:0},'lecturer')).status,401);
 assert.equal((await request('grades/g','DELETE',undefined,'lecturer')).status,401);
 assert.equal((await request('grades/g','PATCH',{secureExamId:'forged'},'lecturer')).status,401);
 assert.equal((await request('grades/g','PATCH',{w1_disc:0,w1_discEntered:true},'admin')).status,200);
 const grade=(await request('grades/g','GET',undefined,'lecturer')).data;assert.equal(grade.exam,20);assert.equal(grade.w1_hw,0);assert.equal(grade.w1_hwEntered,true);
 assert.equal((await request('grades/g','PATCH',{exam:40},'student')).status,401);
 console.log('PASS emulator: request forgery/deletion denied; attendance/exam protected; stopped/other student denied; recording, discussion, admin attendance, lecturer/admin zero grade saves preserved');
})().catch(e=>{console.error(e);process.exitCode=1;});
