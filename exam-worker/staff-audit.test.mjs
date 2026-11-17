import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginStaffAudit} from './src/staff-audit.js';
const auth={uid:'eman',profile:{name:'إيمان حمدان',username:'eman.hamdan',role:'admin',staffTitle:'الإرشاد الأكاديمي'}};
test('records intent before mutation, identities and outcome without credentials or answers',async()=>{
 const calls=[],request=new Request('https://example.test/admin/student-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({studentKey:'s',password:'secret',answers:['private']})});
 const finish=await beginStaffAudit(request,auth,async(k,v)=>calls.push([k,v]));
 assert.equal(calls.length,1);assert.equal(calls[0][1].outcome,'started');assert.equal(calls[0][1].actorUid,'eman');assert.equal(calls[0][1].details,'studentKey: s');
 assert.ok(!JSON.stringify(calls).includes('secret'));assert.ok(!JSON.stringify(calls).includes('private'));assert.equal((await request.json()).password,'secret','body remains available to route');
 await finish(new Response('{}'));assert.equal(calls[1][1].outcome,'completed');assert.equal(calls[0][0],calls[1][0]);
});
test('unavailable audit prevents mutation; failure never claims success',async()=>{
 const req=new Request('https://example.test/admin/exams',{method:'POST'});
 await assert.rejects(beginStaffAudit(req,auth,async()=>{throw Error('unavailable')}),/unavailable/);
 const calls=[],finish=await beginStaffAudit(req,auth,async(k,v)=>calls.push(v));await finish(new Response('{}',{status:403}));assert.equal(calls[1].outcome,'failed');
});
test('read requests, lookups and student operations stay unchanged',async()=>{
 for(const [method,path,profile] of [['GET','/admin/exams',auth.profile],['POST','/admin/auth-account-lookup',auth.profile],['POST','/student/attempts/a/submit',{role:'student'}]]){
  assert.equal(await beginStaffAudit(new Request('https://example.test'+path,{method}),{...auth,profile},()=>{throw Error('unexpected')}),null);
 }
});
