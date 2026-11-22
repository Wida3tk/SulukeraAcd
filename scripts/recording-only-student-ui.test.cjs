const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:['C:/Users/Maryam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html dir="rtl" lang="ar"><body style="margin:20px;background:#f0f4ff;font-family:Arial"><main id="mainContent"></main></body></html>');
  await page.addStyleTag({path:'coursework.css'});await page.addScriptTag({path:'coursework-ui.js'});
  await page.evaluate(()=>{
   currentUser={role:'student'};window.notifications=[];window.requests=[];window.recordings=[];showToast=message=>notifications.push(message);
   cwApi=async(path,body)=>{requests.push({path,body});return {}};
   cwOpenRecording=async id=>recordings.push(id);
   cwData={subjects:[{key:'subject',name:'نهج تحليلات السلوك',batch:'Q2-26',courseworkPeriod:'current'}],lessons:[{id:'current',subject_key:'subject',title:'المحاضرة الأولى — نهج تحليلات السلوك',week:1,status:'published',opens_at:'2026-11-17T15:30:00Z',closes_at:'2099-11-24T15:29:59Z',homeworkMax:6,attendanceMax:3,discussionMax:6,recordedAttendanceQuestionsRequired:false,attendance:{percent:0},result:{score:6,submittedAt:'2026-11-22T12:02:29Z'},recordingProgress:{percent:35},recording_url:'https://drive.google.com/file/d/fixture/view',discussionPrompt:'طبّق مفهوم التعميم في موقف مهني'}]};
   document.getElementById('mainContent').innerHTML=cwStudentLessonCard(cwData.lessons[0],1);
  });
  assert.equal(await page.locator('h4').filter({hasText:'مشاهدة التسجيل'}).count(),1);
  assert.equal(await page.locator('[onclick*="cwReflection"]').count(),0);
  assert.ok(!(await page.locator('#mainContent').innerText()).includes('حل واجب الحضور المسجل'));
  assert.ok((await page.locator('.cw-task-attendance').innerText()).includes('لم يتم الحضور'));
  assert.equal(await page.getByRole('button',{name:'الاطلاع على إجاباتي'}).count(),1);
  assert.ok((await page.locator('.cw-task-homework').innerText()).includes('6/6'));
  assert.equal(await page.locator('.cw-task-discussion').count(),1);
  await page.locator('button[onclick*="cwOpenRecording"]').click();assert.deepEqual(await page.evaluate(()=>recordings),['current']);
  const states=await page.evaluate(()=>{
   const base=cwData.lessons[0],out=[];
   for(const flag of [false,undefined,true])for(const attendance of [null,{percent:0},{percent:20},{percent:100}]){
    const l={...base,recordedAttendanceQuestionsRequired:flag,attendance};
    const html=cwStudentLessonCard(l,1);out.push({noPrompt:!html.includes('حل واجب الحضور المسجل'),noForm:!html.includes('onclick="cwReflection('),watch:html.includes('<h4>مشاهدة التسجيل</h4>'),needs:cwNeedsReflection(attendance,l)});
   }
   return out;
  });assert.ok(states.every(s=>s.noPrompt&&s.noForm&&s.watch&&!s.needs),'date fallback also blocks stale or missing API flags');
  await page.screenshot({path:'.tools/recording-only-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.tools/recording-only-mobile.png',fullPage:true});
  await page.evaluate(()=>cwReflection('current'));assert.equal(await page.locator('.cw-written-card').count(),0);assert.ok((await page.evaluate(()=>notifications)).some(t=>t.includes('لا يوجد واجب إضافي')));
  await page.evaluate(async()=>{document.getElementById('mainContent').innerHTML='<textarea id="cwReflection0">old draft</textarea>';await cwSendReflection('current',{disabled:false});});assert.equal(await page.evaluate(()=>requests.length),0,'obsolete form cannot submit a request');assert.equal(await page.locator('#cwReflection0').count(),0);
  await page.evaluate(()=>{const l=cwData.lessons[0];l.id='legacy';l.opens_at='2026-10-04T15:00:00Z';l.recordedAttendanceQuestionsRequired=true;cwReflection('legacy');});assert.equal(await page.locator('.cw-written-card').count(),3,'historical reflection still opens');
  assert.equal(await page.evaluate(()=>cwUsesRecordingWatch({opens_at:'2026-11-14T23:59:59Z',recordedAttendanceQuestionsRequired:true})),false);
  assert.equal(await page.evaluate(()=>cwUsesRecordingWatch({opens_at:'2026-11-15T00:00:00Z'})),true);
  assert.deepEqual(errors,[]);console.log('PASS student recording UI: no obsolete prompts/forms for current lectures, stale API fallback, missing/partial/full attendance, direct open/send blocked, zero API writes, homework/discussion preserved, recording action, historical form and mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
