const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('student.html','utf8');
const source=html.slice(html.indexOf('function isGraduationProjectStageStudent('),html.indexOf('function renderStudentHomeTab('));
const plan=html.slice(html.indexOf('function getStudentPlanType('),html.indexOf('function isStudentEligibleForSubject('));
const ctx={currentUser:null,dbData:{packages:{}}};vm.createContext(ctx);vm.runInContext(plan+source,ctx);
for(const student of [{batch:'Q1-26',planType:'QASP-S'},{batch:' q1-26 ',planType:'QASP-S'},{batch:'Q1-26',pkg:'QASP-S'}]){
 assert.equal(ctx.isGraduationProjectStageStudent(student),true);
 assert.match(ctx.getStudentWelcomeMessage(student).body,/مشروع التخرج/);
 assert.doesNotMatch(ctx.getStudentWelcomeMessage(student).body,/فصل جديد/);
}
for(const student of [{batch:'Q1-26',planType:'QBA'},{batch:'Q2-26',planType:'QASP-S'},{batch:'Q10-26',planType:'QASP-S'}]){
 assert.equal(ctx.isGraduationProjectStageStudent(student),false);
 assert.match(ctx.getStudentWelcomeMessage(student).body,/فصل جديد/);
}
assert.match(html,/const hasGraduationProject=isGraduationProjectStageStudent\(currentUser.data\)/);
assert.match(html,/hasGraduationProject\?\[\{id:'graduation-project'/);
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
console.log('PASS: Q1 QASP-S project tab and stage-specific welcome; QBA, Q2 and Q10 unaffected; inline scripts valid.');
