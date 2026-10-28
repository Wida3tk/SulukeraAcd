const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<html dir="rtl"><body><main><header class="topbar">المنصة</header><section id="mainContent">المحتوى الأصلي</section><section id="page-settings"></section></main></body></html>');
 await page.addStyleTag({content:'*{margin:0;padding:0;box-sizing:border-box}'});
 await page.addStyleTag({path:'platform-announcement.css'});
 await page.evaluate(()=>{
  window.currentUser={role:'student'};window.activeSecureAttempt={attemptId:'active'};window.uid='s1';window.writes=[];window.config={active:true,version:'whatsapp-service-20261028'};
  window.firebase={auth:()=>({currentUser:{uid:window.uid}}),database:()=>({ref:path=>({once:async()=>({val:()=>false}),on:(event,fn)=>{window.configListener=fn;fn({val:()=>window.config});},off:()=>{},set:async value=>writes.push({path,value}),update:async fields=>{writes.push({path,fields});config={...config,...fields};configListener({val:()=>config});}})})};
 });
 await page.addScriptTag({path:'platform-announcement.js'});await page.waitForTimeout(1500);
 assert.equal(await page.locator('.pa-banner').count(),1);assert.equal(await page.locator('.pa-dialog').count(),0);
 await page.evaluate(()=>activeSecureAttempt=null);await page.waitForSelector('.pa-dialog[open]');
 for(const viewport of [{width:1480,height:766},{width:390,height:844}]){await page.setViewportSize(viewport);const bounds=await page.locator('.pa-dialog').boundingBox();assert.ok(Math.abs(bounds.x+bounds.width/2-viewport.width/2)<=2);assert.ok(Math.abs(bounds.y+bounds.height/2-viewport.height/2)<=2);}
 // Broken image degrades to accessible text without preventing acknowledgement.
 await page.locator('.pa-dialog img').dispatchEvent('error');assert.equal(await page.locator('.pa-text').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'اطّلعت على التنويه'}).click();assert.equal(await page.locator('.pa-dialog').count(),0);await page.waitForTimeout(1400);assert.equal(await page.locator('.pa-dialog').count(),0);
 const writes=await page.evaluate(()=>window.writes);assert.equal(writes.length,1);assert.equal(writes[0].path,'platformAnnouncementAcknowledgements/s1/whatsapp-service-20261028');assert.equal(writes[0].value,true);
 await page.getByRole('button',{name:'عرض التنويه'}).click();assert.equal(await page.locator('.pa-dialog[open]').count(),1);
 await page.evaluate(()=>{activeSecureAttempt={attemptId:'new'};});await page.waitForTimeout(1400);assert.equal(await page.locator('.pa-dialog').count(),0);assert.equal(await page.locator('.pa-banner').count(),1);
 await page.evaluate(()=>{activeSecureAttempt=null;currentUser={role:'admin'};});await page.waitForSelector('#platformAnnouncementAdmin');await page.getByRole('button',{name:'إيقاف الإعلان بعد حل المشكلة'}).click();assert.equal(await page.locator('.pa-banner').count(),0);
 assert.equal(await page.locator('#mainContent').innerText(),'المحتوى الأصلي');assert.equal(errors.length,0,errors.join('\n'));
 assert.ok((await page.evaluate(()=>writes)).every(w=>w.path.startsWith('platformAnnouncementAcknowledgements/')||w.path==='settings/platformAnnouncement'));
 await page.evaluate(()=>{currentUser=null;uid='';});await page.waitForTimeout(1400);assert.equal(await page.locator('#platformAnnouncementAdmin').count(),0);
 await browser.close();console.log('PASS: mobile, deferred exam popup, acknowledgement scoped to account, manual reopening, active exam closes popup, admin disable, text fallback, no academic writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
