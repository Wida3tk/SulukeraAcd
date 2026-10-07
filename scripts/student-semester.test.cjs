const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('student.html','utf8');
const profiles=html.slice(html.indexOf('const PORTAL_BATCH_SEMESTERS ='),html.indexOf('const PORTAL_FALLBACK_WEEKLY ='));
const functions=html.slice(html.indexOf('function getPortalBatchProfile('),html.indexOf('function sortScheduleSlots('));
const context={dbData:{semesters:{}},currentUser:null,isGraduationProjectStageStudent:()=>false,normalizeBatchName:b=>String(b).trim().toLowerCase(),sameBatchName:(a,b)=>a===b};
vm.createContext(context);vm.runInContext(profiles+functions,context);
assert.equal(context.getCurrentSemesterForBatch('Q3-26').semesterNo,2);
assert.equal(context.getPortalBatchProfile('q3-26').name,'الفصل الثاني');
context.dbData.semesters={current:{name:'الفصل الثاني',semesterNo:2,batches:['Q3-26'],status:'active',startDate:'2020-01-01',endDate:'2090-01-01'},future:{name:'الفصل الثالث',semesterNo:3,batches:['Q3-26'],status:'active',startDate:'2091-01-01',endDate:'2092-01-01'}};
assert.equal(context.getCurrentSemesterForBatch('Q3-26').semesterNo,2);
assert.equal(context.getPortalBatchProfile('Q3-26').semesterNo,2);
assert.equal(context.getPortalBatchProfile('Q3-26').startDate,'2020-01-01');
context.dbData.semesters.current={...context.dbData.semesters.current,name:'الفصل المعتمد',semesterNo:4};
assert.equal(context.getPortalBatchProfile('Q3-26').name,'الفصل المعتمد');
console.log('PASS: Q3 second semester fallback, future semester excluded, schedule and overview use same current semester.');

context.dbData.semesters.current={name:'Q3-26 — الفصل 3 — أكتوبر 2026',batches:['Q3-26'],status:'active',startDate:'2026-10-04',endDate:'2090-01-01'};
assert.equal(context.getCurrentSemesterForBatch('Q3-26').semesterNo,2);
assert.match(context.getPortalBatchProfile('Q3-26').name,/الفصل الثاني/);
