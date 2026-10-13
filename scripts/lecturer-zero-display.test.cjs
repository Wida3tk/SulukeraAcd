const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('student.html','utf8'),elements={};
const grade={w1_attend:0,w1_attendEntered:true,w1_hw:0,w1_disc:4,w1_discEntered:false,exam:0,examEntered:true};
const context={settings:{attend:3,hw:6,disc:6,exam:40,gradeFail:80,gradeA:85,gradeB:70,gradeC:60},dbData:{subjects:{course:{name:'مقرر تجريبي'}}},currentSubjectKey:'course',currentBatchName:'',lecturerStudentSortMode:'name',document:{getElementById:id=>elements[id]||(elements[id]={})},getSubjectStudents:()=>[{fbKey:'student',id:'TEST',firstName:'طالب'}],getGrade_data:()=>grade,getActiveExamException:()=>null,applyLecturerStudentSort:()=>{}};
vm.createContext(context);vm.runInContext(fs.readFileSync('grade-result-policy.js','utf8'),context);
for(const name of ['calcTotal','getGrade','getStatus','isExamEntered','getGradeStatus','getGradeDisplay','renderWeekTable']){
 const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+1);assert.ok(start>=0);vm.runInContext(html.slice(start,end),context);
}
const inputValue=field=>{const match=elements.gradeTableBody.innerHTML.match(new RegExp('value="([^"]*)"[^>]*data-field="'+field+'"'));assert.ok(match);return match[1];};
context.renderWeekTable(1);assert.equal(inputValue('w1_attend'),'0');assert.equal(inputValue('w1_hw'),'');assert.equal(inputValue('w1_disc'),'');
grade.w1_hw=6;context.renderWeekTable(1);assert.equal(inputValue('w1_hw'),'6');
context.renderWeekTable(0);assert.match(elements.gradeTableBody.innerHTML,/0 \/ 40/);assert(!elements.gradeTableBody.innerHTML.includes('data-field="exam"'));delete grade.examEntered;context.renderWeekTable(0);assert.match(elements.gradeTableBody.innerHTML,/لم تُرصد/);
console.log('PASS: saved explicit zero visible; legacy unrecorded zero and cleared positive grades blank; positive coursework retained; exam zero distinguished.');
