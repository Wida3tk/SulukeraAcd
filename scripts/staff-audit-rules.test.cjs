const assert=require('node:assert/strict');
const base='http://127.0.0.1:9007',project='demo-sulukera-security',ns=project+'-default-rtdb';
async function req(path,method,body,uid){
 const headers={'Content-Type':'application/json'},q=new URLSearchParams({ns});
 if(uid){const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');q.set('auth',`${enc({alg:'none',typ:'JWT'})}.${enc({iss:`https://securetoken.google.com/${project}`,aud:project,sub:uid,user_id:uid,iat:now,exp:now+3600})}.`);}else headers.Authorization='Bearer owner';
 const r=await fetch(`${base}/${path}.json?${q}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};
}
(async()=>{
 assert.equal((await req('.settings/rules','PUT',JSON.parse(require('node:fs').readFileSync('database.rules.json','utf8')))).status,200);
 assert.equal((await req('users/eman','PUT',{name:'إيمان حمدان',username:'eman.hamdan',role:'admin'})).status,200);
 const log={actorUid:'eman',actorName:'إيمان حمدان',actorUsername:'eman.hamdan',action:'تعديل بيانات',source:'firebase',createdAt:new Date().toISOString(),recordedAt:{'.sv':'timestamp'}};
 assert.equal((await req('','PATCH',{'students/a/firstName':'Updated','staffActivityLogs/act_test':log},'eman')).status,200);
 for(const [path,method,value] of [['staffActivityLogs/act_test','DELETE'],['staffActivityLogs/act_test/action','PUT','fake'],['staffActivityLogs/forged','PUT',{...log,actorUid:'admin'}],['staffActivityLogs/forged','PUT',{...log,actorName:'fake'}],['staffActivityLogs/forged','PUT',{...log,source:'worker'}]]) assert.equal((await req(path,method,value,'eman')).status,401,path);
 assert.equal((await req('','PATCH',{'students/a/firstName':'Should fail','staffActivityLogs/forged':{...log,actorUid:'other'}},'eman')).status,401);
 assert.equal((await req('students/a/firstName','GET',undefined,'eman')).data,'Updated');
 assert.equal((await req('staffActivityLogs/lecture','PUT',log,'lecturer')).status,401);
 assert.equal((await req('staffActivityLogs/student','PUT',log,'student')).status,401);
 console.log('PASS staff rules: atomic data+receipt; server timestamp; no forged identities, server impersonation, log replacement/deletion, student/lecturer writes; failed audit rolls back data');
})().catch(e=>{console.error(e);process.exitCode=1;});
