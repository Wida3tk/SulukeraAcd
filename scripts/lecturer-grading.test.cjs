const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:950}});
 await page.setContent('<html dir="rtl"><body style="font-family:Arial;background:#f1f5ff;padding:24px"><main id="mainContent"></main></body></html>');
 await page.addStyleTag({path:'coursework.css'});await page.addStyleTag({path:'lecturer-grading.css'});
 await page.addScriptTag({path:'coursework-ui.js'});await page.addScriptTag({path:'lecturer-grading.js'});
 await page.evaluate(()=>{
  window.currentUser={role:'lecturer'};window.showToast=()=>{};
  const lesson={id:'lesson',subject_key:'subject',title:'المحاضرة 1',week:1,status:'published',opens_at:new Date().toISOString(),closes_at:new Date(Date.now()+86400000).toISOString(),homeworkMax:6,attendanceMax:3,discussionMax:6,discussionPrompt:'سؤال النقاش',zoom_url:'https://zoom.us/test',questions_json:JSON.stringify([{prompt:'سؤال الواجب',choices:['أ','ب'],correct:0}])};
  cwData={subjects:[{key:'subject',name:'مقرر تجريبي',batch:'Q1'}],lessons:[lesson]};
  cwReport={lesson,students:[{key:'first',name:'أحمد',id:'test1',attendance:{score:3,percent:100},result:{score:6,attempts:1},homeworkAttempts:[{score:6,answers_json:'[0]',submitted_at:new Date().toISOString()}]},{key:'second',name:'بدر',id:'test2',attendance:{score:1,percent:40},reflection:{answers_json:'["إجابة أولى","إجابة ثانية","إجابة ثالثة"]'},result:{score:4}}],discussions:[{student_key:'first',answer:'إجابة مناقشة تجريبية',score:null}]};cwActiveLesson='lesson';cwRenderReport();
 });
 assert.equal(await page.locator('.faculty-student').count(),2);
 assert.equal(await page.locator('.faculty-attendance').first().isDisabled(),true);
 await page.locator('.faculty-homework').first().click();assert.match(await page.locator('.faculty-modal').innerText(),/المحاولة 1/);await page.keyboard.press('Escape');
 await page.locator('.faculty-attendance').nth(1).click();assert.match(await page.locator('.faculty-modal').innerText(),/إجابة أولى/);await page.keyboard.press('Escape');
 await page.locator('.faculty-discussion').first().click();await page.locator('#cwDiscScore0').fill('0');await page.locator('#cwDiscFeedback0').fill('ملاحظة');
 await page.evaluate(()=>{cwApi=async()=>{throw Error('فشل تجريبي');};});await page.getByRole('button',{name:'حفظ تقييم المناقشة'}).click();assert.equal(await page.locator('#cwDiscScore0').inputValue(),'0');assert.match(await page.locator('#facultyReviewError').innerText(),/فشل تجريبي/);
 await page.evaluate(()=>{cwApi=async(path,body)=>{if(path==='/discussion-review'){window.saved=body;cwReport.discussions[0].score=Number(body.score);return {synced:true};}return cwReport;};});
 await page.getByRole('button',{name:'حفظ تقييم المناقشة'}).click();await page.waitForFunction(()=>!document.getElementById('facultyReviewDialog'));assert.equal((await page.evaluate(()=>saved)).score,'0');assert.match(await page.locator('.faculty-discussion').first().innerText(),/0/);
 await page.screenshot({path:'.tools/lecturer-grading-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('.faculty-discussion').first().click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.tools/lecturer-grading-mobile.png',fullPage:true});await page.keyboard.press('Escape');
 await page.evaluate(()=>{document.getElementById('mainContent').innerHTML=cwHomeLessonCard(cwData.subjects[0],1);});assert.equal(await page.locator('.faculty-question[open]').count(),0);assert.equal(await page.getByText('دخول Zoom',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'رصد الدرجات ←'}).count(),1);
 await page.evaluate(()=>{currentUser.role='admin';document.getElementById('mainContent').innerHTML=cwReportStudentCard(cwReport.students[0],0);});assert.equal(await page.locator('.cw-student-card').count(),1);
 await browser.close();console.log('PASS: lecturer cards, attempts, attendance, discussion modal, failed save retention, zero score save, mobile, unchanged admin. No live writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
