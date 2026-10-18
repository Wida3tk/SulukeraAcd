import test from 'node:test';import assert from 'node:assert/strict';
import '../graduation-project-model.js';
import {handleGraduationProject} from './src/graduation-projects.js';
const policy=globalThis.SulukeraGraduation;
test('ended meetings replace Zoom with recording, including exact end boundary; future meeting remains live',()=>{
 const meeting={at:'2026-10-14T16:00:00Z',endsAt:'2026-10-14T17:00:00Z',link:'https://example.com/live',recordingUrl:'https://example.com/recording'};
 assert.equal(policy.meetingAction(meeting,Date.parse('2026-10-14T16:30:00Z')).kind,'live');
 const action=policy.meetingAction(meeting,Date.parse(meeting.endsAt));assert.equal(action.kind,'recording');assert.equal(action.url,meeting.recordingUrl);assert.match(action.label,/مسجل/);
 assert.equal(policy.meetingAction({...meeting,recordingUrl:''},Date.parse(meeting.endsAt)).url,'');
 assert.equal(policy.meetingAction({...meeting,recordingUrl:'javascript:alert(1)'},Date.parse(meeting.endsAt)).url,'');
 assert.equal(policy.meetingAction({...meeting,endsAt:undefined},Date.parse(meeting.endsAt)).kind,'recording');
});
function fixture(role='admin'){
 const writes=[];const env={DB:{prepare(sql){return {sql,bind(...args){this.args=args;return this;},async first(){return sql.includes('SELECT general_meetings_json')?{general_meetings_json:JSON.stringify([{recordingUrl:'https://example.com/original'}])}:null;},async run(){writes.push(this);return {};}};}}};
 const send=recordingUrl=>handleGraduationProject(new Request('https://api/admin/graduation-projects/config',{method:'POST',body:JSON.stringify({projectId:'p',topics:['topic'],generalMeetings:[{at:'2026-10-14T16:00:00Z',link:'https://example.com/live',...(recordingUrl===undefined?{}:{recordingUrl})}]})}),env,{uid:'admin',profile:{role}},'/admin/graduation-projects/config',{});
 return {writes,send};
}
test('configuration persists recording, preserves omitted existing recording and allows explicit removal',async()=>{
 for(const value of ['https://example.com/new',undefined,'']){
  const f=fixture();await f.send(value);assert.equal(f.writes.length,1);const saved=JSON.parse(f.writes[0].args[1]);assert.equal(saved[0].recordingUrl,value===undefined?'https://example.com/original':value);assert.equal(saved[0].link,'https://example.com/live');assert.equal(saved[0].endsAt,'2026-10-14T17:00:00.000Z');assert.doesNotMatch(f.writes[0].sql,/attendance|grades|submissions/);
 }
});
test('invalid recording URLs and nonadministrators cannot save meeting configuration',async()=>{
 for(const [role,url] of [['admin','http://example.com'],['admin','javascript:alert(1)'],['student','https://example.com'],['lecturer','https://example.com']]){const f=fixture(role);await assert.rejects(()=>f.send(url));assert.equal(f.writes.length,0);}
});
