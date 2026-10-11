const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1300,height:950}});
 await page.setContent('<html dir="rtl"><body style="background:#f0f4ff;font-family:Arial;padding:20px"><div id="lecturerPerformanceContent"></div></body></html>');
 await page.addStyleTag({path:'lecturer-performance.css'});await page.addScriptTag({path:'grade-result-policy.js'});await page.addScriptTag({path:'coursework-ui.js'});
 await page.evaluate(()=>{window.currentUser={role:'admin'};window.users=[{_fbKey:'l1',name:'المحاضر التجريبي',username:'lecturer',role:'lecturer'}];window.subjects=[{_fbKey:'old',name:'مقرر تجريبي',batch:'Q2-26',lecturerUserId:'lecturer',students:[0]}];window.students=[{_fbKey:'s1',id:'SUL-TEST',firstName:'طالب',lastName:'تجريبي'}];window.grades={0:{0:{w1_attend:0,w1_attendEntered:true}}};window.getSubjectSemesterSummary=()=>({state:'finished',name:'الفصل السابق',startDate:'2026-08-23',endDate:'2026-09-24'});window.getSubjectStudentIdxs=s=>s.students;window.isExamEntered=g=>g?.examEntered===true||Number(g?.exam)>0;});
 await page.addScriptTag({path:'lecturer-performance.js'});await page.evaluate(()=>{lpExtra={lessons:[],reviews:[],logins:{},loginAvailable:true};lpPaint();});
 assert.match(await page.locator('.lp-card').innerText(),/12 بند متأخر/);assert.match(await page.locator('.lp-card').innerText(),/غير متوفرة/);
 await page.locator('.lp-card button').click();assert.equal(await page.locator('dialog').isVisible(),true);assert.equal(await page.locator('.lp-field').count(),12);assert.match(await page.locator('dialog').innerText(),/2026-09-24/);
 await page.locator('dialog header button').click();await page.locator('#lpSearch').fill('غير موجود');assert.equal(await page.locator('.lp-card').count(),0);await page.locator('#lpSearch').fill('');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.evaluate(()=>{currentUser={role:'lecturer'};renderLecturerPerformance();});assert.doesNotMatch(await page.locator('#lecturerPerformanceContent').innerText(),/المحاضر التجريبي/);
 await browser.close();console.log('PASS: dashboard cards, student drilldown, explicit zero, unavailable dates, search, mobile and admin-only guard.');
})().catch(e=>{console.error(e);process.exitCode=1;});
