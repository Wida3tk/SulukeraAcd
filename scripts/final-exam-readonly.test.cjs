const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const html=fs.readFileSync('student.html','utf8');
const start=html.indexOf('function mergeSecureExamGrades(){'),end=html.indexOf('\nfunction ',start+1);
const grade={studentKey:'s',subjectKey:'course',exam:0,w1_hw:6},context={secureExamList:[{id:'e',subjectKey:'course',evaluated:false,attempts:[{status:'submitted',score:19}]}],dbData:{grades:{g:grade}},currentUser:{fbKey:'s'},getGrade_data:()=>grade};
vm.createContext(context);vm.runInContext(html.slice(start,end),context);context.mergeSecureExamGrades();assert.equal(grade.exam,38);assert.equal(grade.examEntered,true);assert.equal(grade.w1_hw,6);
assert(!html.includes('data-field="exam"'));assert(html.includes("if(field==='exam'&&currentUser?.role==='lecturer')return;"));
console.log('PASS unevaluated submitted exams supply actual final grades; weekly components preserved; lecturer final-exam input removed and save guarded');
