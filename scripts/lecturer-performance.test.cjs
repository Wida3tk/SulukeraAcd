const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={console,Date,Set,Number,users:[{_fbKey:'l1',username:'lecturer',role:'lecturer',name:'محاضر'},{role:'admin'}],subjects:[{_fbKey:'old',lecturerUserId:'lecturer',students:[0,1]},{_fbKey:'new',lecturerUserId:'l1',students:[0]},{_fbKey:'future',lecturerUserId:'lecturer',students:[0]}],students:[{_fbKey:'s1',id:'SUL-001'},{_fbKey:'s2',id:'SUL-002'}],grades:{0:{0:{w1_attend:0,w1_attendEntered:true,updatedBy:'system',updatedAt:'2026-10-10T10:00:00Z'}}},getSubjectStudentIdxs:s=>s.students,getSubjectSemesterSummary:s=>({state:s._fbKey==='old'?'finished':s._fbKey==='future'?'upcoming':'ongoing'})};
context.isExamEntered=g=>g?.examEntered===true||Number(g?.exam)>0;
vm.createContext(context);vm.runInContext(fs.readFileSync('grade-result-policy.js','utf8'),context);vm.runInContext(fs.readFileSync('lecturer-performance.js','utf8'),context);
vm.runInContext(`lpExtra={lessons:[{subject_key:'new',week:1,status:'published',opens_at:'2020-01-01',closes_at:'2020-01-02'},{subject_key:'new',week:2,status:'published',opens_at:'2099-01-01',closes_at:'2099-01-02'}],reviews:[]}`,context);
const rows=vm.runInContext('lpRows()',context);assert.equal(rows.length,1);assert.equal(rows[0].students,2);assert.equal(rows[0].total,3);assert.equal(rows[0].graded,0);assert.equal(rows[0].remaining,3);assert.equal(rows[0].overdue,3);assert.equal(rows[0].last,undefined);
vm.runInContext("lpMode='current'",context);const current=vm.runInContext('lpRows()[0]',context);assert.equal(current.total,1);assert.equal(current.courses.length,1);
assert.equal(current.remaining,1); // Three missing components are one student record.
vm.runInContext("lpMode='finished'",context);assert.equal(vm.runInContext('lpRows()[0].total',context),2);
const eighty=vm.runInContext('lpRecordCount(Array.from({length:80},()=>({total:13,remaining:13,overdue:13})))',context);
assert.equal(eighty.remaining,80);assert.equal(eighty.overdue,80);assert.equal(eighty.total,80);
vm.runInContext('grades[1]={0:{w1_attend:0,w1_attendEntered:true,w1_hw:0,w1_hwEntered:true,w1_disc:0,w1_discEntered:true}};lpMode="current"',context);
assert.equal(vm.runInContext('lpRows()[0].graded',context),1);assert.equal(vm.runInContext('lpRows()[0].remaining',context),0);
assert.equal(vm.runInContext("lpDate('invalid')",context),'غير متوفرة');
assert.match(fs.readFileSync('lecturer-performance.js','utf8'),/await loadAllFromFirebase\(\);lpExtra=null/);
console.log('Lecturer performance: explicit zero, future lessons, unique students, attribution and term filters passed.');
