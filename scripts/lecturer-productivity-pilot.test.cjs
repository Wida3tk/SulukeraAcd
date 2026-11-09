const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

function pilotContext(){
  const context={Date,Intl,grades:{},lecturerProductivityData:{}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','lecturer-productivity-pilot.js'),'utf8'),context);
  return context;
}

test('Afnan pilot groups nearby saves and uses a five-minute minimum',()=>{
  const context=pilotContext(),pilot=context.SulukeraAfnanProductivityPilot;
  const sessions=pilot.gradingSessions([
    {at:'2026-11-08T10:00:00Z'},
    {at:'2026-11-08T10:03:00Z'},
    {at:'2026-11-08T11:00:00Z'},
  ]);
  assert.equal(sessions.length,2);
  assert.equal(Array.from(sessions,session=>session.minutes).join(','),'5,5');
});

test('Afnan pilot reports monthly meeting time and only her saved grades',()=>{
  const context=pilotContext(),pilot=context.SulukeraAfnanProductivityPilot;
  context.grades={0:{0:{studentKey:'student',subjectKey:'course',updatedAt:'2026-11-08T05:34:21Z',updatedBy:'Rd1O695bgWdbu3xk1AUAoIYmJPk2'},1:{studentKey:'other',subjectKey:'course',updatedAt:'2026-11-08T05:35:21Z',updatedBy:'admin'}}};
  context.lecturerProductivityData={'2026-11':{Aalmubaddal:{meetings:{one:{durationMinutes:88.4666666667}}}}};
  const model=pilot.afnanPilotModel('2026-11');
  assert.equal(Math.round(model.recordingSeconds),5308);
  assert.equal(model.gradingMinutes,5);
  assert.equal(model.gradingSessions,1);
  assert.equal(model.gradedStudents,1);
  assert.equal(model.saveEvents,1);
});

test('Afnan pilot can render October independently and prefers recording duration',()=>{
  const context=pilotContext(),pilot=context.SulukeraAfnanProductivityPilot;
  context.lecturerProductivityData={'2026-10':{Aalmubaddal:{meetings:{one:{durationMinutes:200}},recordingAudit:{lectures:{one:{recordingSeconds:3600},two:{recordingSeconds:1800}}}}}};
  const model=pilot.afnanPilotModel('2026-10');
  assert.equal(model.recordingSeconds,5400);
  assert.equal(model.deliveryCount,2);
  assert.equal(model.deliverySource,'مدة التسجيل الفعلية');
  assert.equal(model.gradingMinutes,0);
});
