const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const calls=[];
class Ref {
  constructor(path=''){this.path=path;this.root={toString:()=> 'https://example.test/'};}
  toString(){return 'https://example.test/'+this.path;}
  push(){return new Ref(this.path+'/key'+calls.length);}
  get key(){return this.path.split('/').pop();}
  set(value,cb){calls.push({method:'set',path:this.path,value});cb?.(null);return Promise.resolve();}
  update(value,cb){calls.push({method:'update',path:this.path,value});cb?.(null);return Promise.resolve();}
  remove(cb){calls.push({method:'remove',path:this.path});cb?.(null);return Promise.resolve();}
  transaction(fn){const value=fn({exam:1});calls.push({method:'transaction',value});return Promise.resolve({committed:value!==undefined,snapshot:{val:()=>value}});}
}
const db={ref:path=>new Ref(path)},database=()=>db;database.ServerValue={TIMESTAMP:{'.sv':'timestamp'}};
const context={firebase:{database,auth:()=>({currentUser:{uid:'eman'}})},currentUser:{role:'admin',authUid:'eman',name:'إيمان حمدان',username:'eman.hamdan',staffTitle:'الإرشاد الأكاديمي'},students:[{_fbKey:'s',name:'Student'}],subjects:[],users:[],getStudentFullName:s=>s.name,
  _finishLogin:async()=>{},doLogout:async()=>{},renderAlertsPage:()=>{},document:{getElementById:()=>null},showToast:()=>{},getRecentActivityLogs:()=>[],isAdminRole:()=>true};
vm.createContext(context);vm.runInContext(fs.readFileSync('staff-audit.js','utf8'),context);
(async()=>{
  await db.ref('students/s').update({firstName:'New name',password:'secret',notes:'private content'});
  let call=calls.at(-1),key=Object.keys(call.value).find(k=>k.startsWith('staffActivityLogs/')),log=call.value[key];
  assert.equal(call.path,'');assert.equal(call.value['students/s/firstName'],'New name');assert.equal(log.actorUid,'eman');assert.equal(log.actorName,'إيمان حمدان');assert.equal(log.targetLabel,'الطلاب · Student');assert.ok(log.details.includes('New name'));assert.ok(!log.details.includes('secret'));assert.ok(!log.details.includes('private content'));
  assert.match(key,/staffActivityLogs\/act_\d+_/);
  await db.ref('schedule/weekly/lesson').set({day:'Monday'});assert.equal(calls.at(-1).value['schedule/weekly/lesson'].day,'Monday');
  await db.ref('students/s').remove();assert.equal(calls.at(-1).value['students/s'],null);
  await db.ref().update({'grades/g/exam':0,'grades/g/examEntered':true});assert.equal(calls.at(-1).value['grades/g/exam'],0);assert.equal(Object.keys(calls.at(-1).value).length,3);
  const previous=calls.length;await db.ref('grades/g').transaction(()=>undefined);assert.equal(calls.length,previous+1,'aborted transactions never claim a change');
  await db.ref('grades/g').transaction(()=>({exam:0}));assert.equal(calls.at(-1).method,'set');assert.equal(calls.at(-1).value.action,'تحديث بمعاملة');
  await db.ref('activityLogs/a').set({action:'Existing log'});assert.equal(calls.at(-1).path,'activityLogs/a','audit logging cannot recurse');
  context.currentUser.role='lecturer';await db.ref('grades/g').update({exam:1});assert.equal(calls.at(-1).path,'grades/g','lecturer semantics unchanged');
  console.log('PASS staff audit: atomic set/update/remove, zero grades, multipath, identity, credential redaction, transactions, no recursion, lecturer compatibility');
})().catch(e=>{console.error(e);process.exitCode=1;});
