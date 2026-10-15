import test from 'node:test';import assert from 'node:assert/strict';import {examGradeFields,syncAcademicExamGrades} from './src/exam-grade-sync.js';
test('authoritative score conversion includes explicit zero and rejects missing/invalid scores',()=>{const row={student_key:'s',subject_key:'course',exam_id:'exam',score:19};assert.equal(examGradeFields(row,'now').exam,38);assert.equal(examGradeFields({...row,score:0},'now').examEntered,true);for(const score of [null,NaN,21,-1])assert.throws(()=>examGradeFields({...row,score},'now'));});
test('sync ignores evaluation gating and patches only exam fields across duplicate grade records',async()=>{
 const fetchBefore=globalThis.fetch,writes=[],journals=[];const rows=[{student_key:'s',subject_key:'course',exam_id:'exam',score:19,evaluated:0}];
 const env={DB:{prepare:sql=>({all:async()=>({results:rows}),bind:(...args)=>({run:async()=>journals.push(args)})})}};
 globalThis.fetch=async(url,options)=>{if(options.method==='PATCH'){writes.push(JSON.parse(options.body));return new Response('{}');}return new Response(JSON.stringify({a:{subjectKey:'course',w1_hw:6,exam:0},b:{subjectKey:'course',exam:0},other:{subjectKey:'other',exam:30}}));};
 try{assert.equal((await syncAcademicExamGrades(env,async()=> 'token')).synced,1);assert.equal(writes[0]['a/exam'],38);assert.equal(writes[0]['b/exam'],38);assert(!Object.keys(writes[0]).some(k=>k.includes('w1')||k.startsWith('other/')));assert.equal(journals.length,1);}finally{globalThis.fetch=fetchBefore;}
});
test('failed Firebase saves are not marked synchronized and remain retryable',async()=>{const before=globalThis.fetch;let journal=0;const env={DB:{prepare:()=>({all:async()=>({results:[{student_key:'s',subject_key:'c',exam_id:'e',score:0}]}),bind:()=>({run:async()=>journal++})})}};globalThis.fetch=async()=>new Response('{}',{status:503});try{assert.equal((await syncAcademicExamGrades(env,async()=> 'token')).synced,0);assert.equal(journal,0);}finally{globalThis.fetch=before;}});
test('evaluation-triggered sync is limited to the evaluated student',async()=>{
 const calls=[],before=globalThis.fetch,env={DB:{prepare:sql=>({all:async()=>{calls.push({sql,args:[]});return {results:[]};},bind:(...args)=>({all:async()=>{calls.push({sql,args});return {results:[]};}})})}};
 globalThis.fetch=before;try{assert.deepEqual(await syncAcademicExamGrades(env,async()=> 'token',{studentKey:'s-1'}),{synced:0});assert.equal(calls.length,1);assert.match(calls[0].sql,/a\.student_key=\?/);assert.deepEqual(calls[0].args,['s-1']);}finally{globalThis.fetch=before;}
});
