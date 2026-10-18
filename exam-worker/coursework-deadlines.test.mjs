import test from 'node:test';
import assert from 'node:assert/strict';
import {studentLessonDeadline} from './src/coursework-deadlines.js';
import {automaticCourseworkFields} from './src/coursework-auto-grades.js';
test('personal extension affects only assigned student and lesson; automatic late zeros follow effective deadline',()=>{
 const first={id:'first',week:1,status:'published',opens_at:'2026-10-11T17:30:00Z',closes_at:'2026-10-17T17:30:00Z'},second={...first,id:'second',week:2,closes_at:'2026-10-24T17:30:00Z'};
 const student={homeworkExtensions:{first:{closesAt:'2026-10-24T23:59:59+03:00'}}};
 const effective=studentLessonDeadline(first,student),now=Date.parse('2026-10-18T12:00:00Z');
 assert.equal(effective.closes_at,'2026-10-24T20:59:59.000Z');
 assert.equal(studentLessonDeadline(second,student),second);assert.equal(studentLessonDeadline(first,{}),first);
 assert.equal(first.closes_at,'2026-10-17T17:30:00Z');
 assert.equal(automaticCourseworkFields(effective,{}, {},now).w1_hw,undefined);
 assert.equal(automaticCourseworkFields(first,{}, {},now).w1_hw,0);
 assert.equal(automaticCourseworkFields(effective,{w1_hw:0,w1_hwEntered:true,w1_hwAutoMissed:true},{},now).w1_hw,null);
 assert.equal(automaticCourseworkFields(effective,{w1_hw:0,w1_hwEntered:true},{},now).w1_hw,undefined);
 assert.equal(automaticCourseworkFields(effective,{}, {},Date.parse('2026-10-24T21:00:00Z')).w1_hw,0);
 assert.equal(studentLessonDeadline(first,{homeworkExtensions:{first:{closesAt:'invalid'}}}),first);
});
