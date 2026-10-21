const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
 try{
  await page.setContent('<html dir="rtl"><body></body></html>');
  await page.evaluate(()=>{
   window.cwRenderCourseworkHome=()=>{};window.cwEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.cwDate=s=>s;window.cwNotify=s=>{throw Error(s)};
   window.EXAM_API_BASE='https://test.invalid';window.firebase={auth:()=>({currentUser:{getIdToken:async()=> 'test-token'}})};window.saved=[];
   window.fetch=async(url,options)=>url.endsWith('/process')?({ok:true,json:async()=>({processed:1})}):options?.method==='POST'?(saved.push(JSON.parse(options.body)),{ok:true,json:async()=>({saved:true})}):({ok:true,json:async()=>({scopeLabels:{l3:'Q3',l2:'Q2'},scopeRosters:{l3:['q3'],l2:['q2']},students:[{key:'q2',name:'آثار سامي عبدالله',id:'TEST2',batch:'Q2'},{key:'q3',name:'منى سالم عمر',id:'TEST3',batch:'Q3'},{key:'outsider',name:'خارج اللقاء',id:'NO'}],reports:[{id:'r',approvedNames:saved.map(x=>x.zoomName),topic:'لقاء مشترك',host:'test@example.com',starts_at:'2026-10-21',state:'partial',result_json:JSON.stringify({targets:['l3','l2'],unmatched:[{name:'آثار سامي عبدالله'},{name:'منى عمر'},{name:'Zoom User'}]})}]})});
  });
  await page.addScriptTag({path:'zoom-attendance-admin.js'});await page.evaluate(()=>openZoomAttendanceReports());
  assert.equal(await page.locator('dialog').isVisible(),true);
  assert.equal(await page.locator('option[value="outsider"]').count(),0);
  assert.equal(await page.locator('[data-za-row]').nth(0).locator('select').inputValue(),'q2');
  await page.getByRole('button',{name:'حفظ الاختيارات المحددة دفعة واحدة',exact:true}).click();
  const saved=await page.evaluate(()=>saved);assert.equal(saved.length,2);assert.equal(saved[0].scopeKey,'l2');assert.equal(saved[1].scopeKey,'l3');
  assert.equal(await page.locator('[data-za-save][data-saved="true"]').count(),2);
  assert.equal(await page.locator('[data-za-row]').nth(2).locator('select').inputValue(),'');
  await page.evaluate(()=>openZoomAttendanceReports());assert.equal(await page.locator('[data-za-row]').count(),1,'saved names never return as needing approval while report is pending');
  console.log('PASS: rendered shared-cohort dialog excludes outsiders, saves selected suggestions in correct scopes, and leaves unknown names unresolved.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
