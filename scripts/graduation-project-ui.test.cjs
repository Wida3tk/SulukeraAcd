const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<html dir="rtl" lang="ar"><head><style>body{font-family:Tahoma,sans-serif;background:#f3f6fb;padding:24px;margin:0;box-sizing:border-box}button,input{font-family:inherit}*{box-sizing:border-box}</style></head><body><main id="mainContent"></main></body></html>');
  await page.addStyleTag({path:'graduation-project.css'});await page.addScriptTag({path:'graduation-project-model.js'});
  await page.evaluate(()=>{
   window.currentUser={role:'student',fbKey:'student1'};window.currentAppTab='graduation-project';window.escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.toast=()=>{};window.isGraduationProjectStageStudent=()=>true;window.getAppTabButtonById=()=>null;window.switchAppTab=()=>{};
   window.fixture={available:true,project:{id:'project',batch:'Q1',plan_type:'QASP-S',topics:[],generalMeetings:['2026-10-14','2026-10-21','2026-10-28','2026-11-04'].map(at=>({at:at+'T19:00:00+03:00',endsAt:at+'T20:00:00+03:00',link:''}))},group:null,attendance:[{meeting_index:0,attended:1},{meeting_index:1,attended:0}]};window.secureExamRequest=async()=>window.fixture;
  });await page.addScriptTag({path:'graduation-project-ui.js'});await page.evaluate(()=>renderStudentGraduationProject());
  assert.equal(await page.locator('.gp-meeting').count(),4);assert.equal(await page.locator('.gp-mark.present').count(),1);assert.equal(await page.locator('.gp-mark.absent').count(),1);assert.equal(await page.locator('.gp-link-pending').count(),4);
  await page.screenshot({path:'.tools/graduation-desktop.png',fullPage:true});
  await page.getByRole('tab',{name:'مواضيع المشروع'}).click();assert.match(await page.locator('#gp-panel').innerText(),/بعد اللقاء الأول مع المشرف/);assert.equal(await page.locator('.gp-topic').count(),0);
  await page.getByRole('tab',{name:'السياسات'}).click();assert.equal(await page.locator('.gp-policy').count(),10);assert.doesNotMatch(await page.locator('#gp-panel').innerText(),/رشد|أحلام|دعاء|مصعب|اعتماد/);
  await page.getByRole('tab',{name:'تسليم المشروع'}).click();assert.equal(await page.locator('#graduationProjectFile').isEnabled(),false);
  await page.evaluate(()=>{window.fixture.group={id:'group',topic:'عنوان <تجريبي>',memberProfiles:[{name:'عضو أول'},{name:'عضو ثان'}],submissions:[]};graduationStudentData=window.fixture;});
  await page.getByRole('tab',{name:'مواضيع المشروع'}).click();assert.equal(await page.locator('.gp-member').count(),2);assert.match(await page.locator('#gp-panel').innerText(),/عنوان <تجريبي>/);assert.equal(await page.locator('#gp-panel script').count(),0);
  await page.getByRole('tab',{name:'تسليم المشروع'}).click();assert.equal(await page.locator('#graduationProjectFile').getAttribute('accept'),'.pdf,application/pdf');assert.equal(await page.locator('#graduationProjectFile').isEnabled(),true);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.tools/graduation-upload-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('tab',{name:'الجدول واللقاءات'}).click();await page.screenshot({path:'.tools/graduation-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>loadGraduationMeetingNotice());assert.equal(await page.locator('#graduationMeetingNotice').count(),1);await page.screenshot({path:'.tools/graduation-notice-mobile.png',fullPage:true});await page.getByRole('button',{name:'حسنًا',exact:true}).click();await page.evaluate(()=>gpShowMeetingNotice());assert.equal(await page.locator('#graduationMeetingNotice').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: four meetings, explicit attendance, empty topics, team names, sanitized policies, PDF controls, one notice per session, desktop and mobile.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
