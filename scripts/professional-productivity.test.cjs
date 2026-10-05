const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
require('../productivity-ledger.js');
const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('async function approveProfessionalAttendance(){'),end=html.indexOf('\nfunction ',start);
const meeting={start:'2026-10-04T15:00:00Z',end:'2026-10-04T17:10:00Z',durationMinutes:130,source:'zoom_meeting_summary'};
const writes=[],ledger={},context={Date,console,SulukeraProductivity,PROFESSIONAL_PROGRAM_ID:'obm',currentUser:{username:'admin'},students:[{_fbKey:'student',id:'S1'}],professionalProgressData:{},professionalAttendanceAliasesData:{},professionalAttendanceImportsData:{},confirm:()=>true,showToast:()=>{},renderProfessionalAttendancePreview:()=>{},normalizeProfessionalName:v=>v,getProfessionalProgram:()=>({tracks:{t:{units:{u:{lecturerUserId:'Aalmubaddal'}}}}}),mergeProfessionalAttendanceIntervals:()=>120,fbRef:()=>({update:async update=>writes.push(update)}),applyImportedProductivity:item=>ledger[item.path]=item.record};
vm.createContext(context);vm.runInContext(html.slice(start,end),context);
const preview=hash=>({fileName:'zoom.csv',hash,trackKey:'t',unitKey:'u',unitId:'t_u',sessionKey:'s1',meeting,meetingDuration:130,rows:[{include:true,studentKey:'student',name:'student',intervals:[[0,1]],duration:120}]});
(async()=>{
  context.professionalAttendancePreview=preview('one');await context.approveProfessionalAttendance();
  assert.equal(writes.length,1);const key=Object.keys(writes[0]).find(k=>k.startsWith('lecturerProductivity/'));
  assert.ok(key);assert.equal(writes[0][key].durationMinutes,130);assert.ok(Object.keys(writes[0]).some(k=>k.startsWith('professionalProgress/')));
  context.professionalAttendancePreview=preview('two');await context.approveProfessionalAttendance();assert.equal(Object.keys(ledger).length,1);
  context.professionalAttendancePreview={...preview('no-summary'),meeting:null};await context.approveProfessionalAttendance();assert.equal(Object.keys(writes[2]).some(k=>k.startsWith('lecturerProductivity/')),false);
  const before=Object.keys(ledger).length;context.professionalAttendancePreview=preview('failed');context.fbRef=()=>({update:async()=>{throw Error('TEST_EXPECTED_FAILURE')}});context.console={error:()=>{}};await context.approveProfessionalAttendance();assert.equal(Object.keys(ledger).length,before);assert.equal(context.professionalAttendancePreview.duplicate,undefined);
  console.log('PASS professional attendance and whole-meeting productivity saved atomically, shared file deduplication, missing summary skips credit, failed saves do not credit');
})().catch(e=>{console.error(e);process.exit(1)});
