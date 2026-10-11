const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),g={w1:{attend:null,hw:null,disc:null},w2:{attend:null,hw:null,disc:null},w3:{attend:null,hw:null,disc:null},w4:{attend:null,hw:null,disc:null},exam:null};
const context={settings:{attend:3,hw:6,disc:6,exam:40,gradeFail:80,gradeA:85,gradeB:70,gradeC:60},grades:{0:{0:g}},getLecturerName:()=>'',canManageAcademicAdmin:()=>false,pc:()=>''};vm.createContext(context);vm.runInContext(fs.readFileSync('grade-result-policy.js','utf8'),context);
for(const name of ['calcTotal','getGrade','getStatus','isExamEntered','getGradeStatus','getGradeDisplay','renderProfileGrades']){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+1);vm.runInContext(html.slice(start,end),context);}
const render=()=>context.renderProfileGrades(0,[{idx:0,name:'مقرر تجريبي'}]);
let output=render();assert.equal((output.match(/class="week-box-val">لم تُرصد/g)||[]).length,4);assert.match(output,/لا توجد درجات مرصودة بعد/);assert.doesNotMatch(output,/class="week-box-val">0/);
for(const f of ['attend','hw','disc']){g.w1[f]=0;g['w1_'+f+'Entered']=true;}output=render();assert.match(output,/class="week-box-val">0/);assert.doesNotMatch(output,/لا توجد درجات مرصودة بعد/);assert.equal(context.gradeWeekDisplay(g,'w1'),'0');
g.w1.discEntered=false;g.w1_discEntered=false;assert.equal(context.gradeWeekDisplay(g,'w1'),'لم تُرصد');
g.exam=0;g.examEntered=true;assert.match(render(),/>0\/40<\/span>/);g.examEntered=false;assert.doesNotMatch(render(),/>0\/40<\/span>/);
console.log('PASS: profile unknown grades never display as zero; explicit zero retained; partial weeks pending; exam zero distinguished.');
