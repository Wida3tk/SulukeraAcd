const assert=require('node:assert/strict');require('../academic-policy.js');
const applies=SulukeraAcademicPolicy.exceptionApplies,student={batch:'Q2'},terms={old:{startDate:'2026-08-23',endDate:'2026-09-24',batches:['Q2'],subjects:['oldCourse']},current:{startDate:'2026-10-04',endDate:'2026-11-05',batches:['Q2'],subjects:['newCourse']}};
const old={active:true,fromDate:'2026-09-15',updatedAt:'2026-10-11'};
assert.equal(applies(old,student,'newCourse',terms),false);assert.equal(applies(old,student,'oldCourse',terms),true);assert.equal(applies(old,student,'',terms,'2026-10-11'),false);
assert.equal(applies({active:true,fromDate:'2026-10-10'},student,'newCourse',terms),true);
assert.equal(applies({active:true},student,'newCourse',terms),false);
assert.equal(applies({...old,semesterKey:'old'},student,'newCourse',terms),false);
console.log('PASS: exceptions stay in request term; historical scope retained; unscoped legacy does not carry forward.');
