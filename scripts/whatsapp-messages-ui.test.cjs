const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:['C:/Users/Maryam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.context().route('https://web.whatsapp.com/**',r=>r.fulfill({body:'<h1>Test only — no messages sent</h1>',contentType:'text/html'}));
  await page.setContent('<html dir="rtl" lang="ar"><body><main style="max-width:1150px;margin:24px auto"><div id="page-students"></div></main></body></html>');
  const html=fs.readFileSync('index.html','utf8');await page.addStyleTag({content:html.match(/<style>([\s\S]*?)<\/style>/)[1]});await page.addStyleTag({path:'whatsapp-messages.css'});
  await page.evaluate(()=>{
   window.currentUser={role:'admin',authUid:'owner',name:'الإدارة'};window.adminNavGroups=[{id:'students',items:[]}];window.pageTitles={};window.semestersData={};window.packagesData=[];window.subjects=[];window.requests=[];window.logs=[];window.projectCalls=0;
   window.students=[{_fbKey:'a',id:'S-1',name:'عائشة',phone:'0501234567',batch:'Q2'},{_fbKey:'b',name:'طالب مشاريع',phone:'0502234567',batch:'Q1'},{_fbKey:'c',name:'مرحلة مشاريع',phone:'0503234567',project:true,batch:'Q1'},{_fbKey:'d',name:'موقوف',phone:'0504234567',accountStatus:'suspended'},{_fbKey:'e',name:'جوال ناقص',phone:'123'},{_fbKey:'f',name:'رقم مشترك',phone:'+966501234567',batch:'Q2'},{_fbKey:'g',name:'طالب مستبعد',phone:'0505234567',batch:'Q2'},{_fbKey:'h',name:'طالب دولي',phone:'+971501234567',batch:'Q3'}];
   window.getStudentFullName=s=>s.name;window.escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.SulukeraStudentAccount={isActive:s=>s.accountStatus!=='suspended'};window.SulukeraAcademicPolicy={projectStage:s=>!!s.project};window.showToast=()=>{};window.saveActivityLog=async entry=>logs.push(entry);window.refreshPage=()=>{};window.doLogout=async()=>{currentUser=null};
   window.secureAdminExamRequest=async(path,options)=>{requests.push({path,options});if(projectCalls++===0)throw Error('offline');return {projects:[{students:[{student_key:'b',eligible:1}],groups:[]}]};};
  });
  await page.addScriptTag({path:'whatsapp-model.js'});await page.addScriptTag({path:'whatsapp-messages.js'});await page.evaluate(()=>{document.getElementById('page-whatsappmessages').classList.add('active');refreshPage('whatsappmessages');});
  await page.waitForSelector('#waRetry');await page.locator('#waSelectVisible').click();assert.equal(await page.locator('[data-wa-student]:checked').count(),0,'project exclusion fails closed');
  await page.locator('#waRetry').click();await page.waitForFunction(()=>!document.getElementById('waRetry')&&!document.getElementById('waMessagesContent').textContent.includes('جارٍ'));
  assert.equal(await page.locator('[data-wa-student="b"]').isDisabled(),true);assert.equal(await page.locator('[data-wa-student="c"]').isDisabled(),true);assert.equal(await page.locator('[data-wa-student="d"]').isDisabled(),true);assert.equal(await page.locator('[data-wa-student="e"]').isDisabled(),true);
  await page.locator('#waSelectVisible').click();assert.equal(await page.locator('[data-wa-student]:checked').count(),4);
  await page.locator('#waSearch').fill('مستبعد');await page.locator('[data-wa-student="g"]').uncheck();await page.locator('#waSearch').fill('');
  await page.locator('#waText').fill('أهلًا {الاسم}، رقمك {الرقم_الطلابي}\nموعد الواجب & رابط <img src=x>');assert.equal(await page.locator('#waOpen').count(),0,'no external link before review');
  await page.locator('#waReview').click();assert.equal(await page.locator('[data-wa-index]').count(),2,'shared number receives one message');assert.equal(await page.locator('#waSent').isDisabled(),true);assert.equal(await page.locator('#waMessagePreview img').count(),0);assert.ok((await page.locator('#waMessagePreview').innerText()).includes('أهلًا عائشة'));
  const link=await page.locator('#waOpen').getAttribute('href');const url=new URL(link);assert.equal(url.searchParams.get('phone'),'966501234567');assert.ok(url.searchParams.get('text').includes('<img src=x>'));
  const popupPromise=page.waitForEvent('popup');await page.locator('#waOpen').click();const popup=await popupPromise;await popup.waitForLoadState();await popup.close();assert.equal(await page.locator('#waSent').isEnabled(),true);assert.ok((await page.locator('.wa-status').innerText()).includes('غير مؤكد'));assert.equal(await page.evaluate(()=>logs.some(l=>l.action.includes('تأكيد المستخدم'))),false);
  await page.locator('#waSent').click();assert.ok((await page.locator('.wa-review').innerText()).includes('تأكيد إرسال: 1'));assert.equal(await page.evaluate(()=>logs.filter(l=>l.action.includes('تأكيد المستخدم')).length),1);
  await page.screenshot({path:'.tools/whatsapp-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.tools/whatsapp-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no mobile page overflow');
  await page.locator('#waText').fill('رسالة معدّلة');assert.equal(await page.locator('#waOpen').count(),0,'editing invalidates approval');await page.locator('#waReview').click();await page.evaluate(()=>students.find(s=>s._fbKey==='a').phone='0509999999');await page.locator('[data-wa-index="0"]').click();await page.locator('#waOpen').click();assert.equal(await page.locator('#waOpen').count(),0,'stale recipient invalidates queue');
  assert.ok((await page.evaluate(()=>requests)).every(r=>r.options.method==='GET'));await page.evaluate(()=>doLogout());assert.equal(await page.locator('#waMessagesContent').innerText(),'');await page.evaluate(()=>refreshPage('whatsappmessages'));assert.equal(await page.locator('#waMessagesContent').innerText(),'');assert.deepEqual(errors,[]);
  console.log('PASS WhatsApp UI: fail-closed projects, active/invalid filters, named exclusions, preview escaping, one manual popup, no auto-send, user-confirmed status, stale approval, mobile, logout and read-only API.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
