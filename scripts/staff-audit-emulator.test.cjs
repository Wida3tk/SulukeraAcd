/* Uses only a demo emulator, including the real Firebase browser SDK. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:['C:/Users/Maryam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
const base='http://127.0.0.1:9007',namespace='demo-sulukera-security-default-rtdb';
async function rest(path='',method='GET',body){const r=await fetch(`${base}/${path}.json?ns=${namespace}`,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200);return r.json();}
(async()=>{
 await rest('.settings/rules','PUT',JSON.parse(fs.readFileSync('database.rules.json','utf8')));
 await rest('','PUT',{users:{eman:{role:'admin',name:'إيمان حمدان',username:'eman.hamdan'},owner:{role:'admin',name:'Owner',username:'owner'}},students:{s:{firstName:'Original'}}});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html lang="ar" dir="rtl"><body><div id="page-alerts" class="active"><div id="activityLogContent"></div></div></body></html>');
  const html=fs.readFileSync('index.html','utf8');await page.addStyleTag({content:html.match(/<style>([\s\S]*?)<\/style>/)[1]});
  for(const name of ['app','auth','database']) {const path='.tools/firebase-'+name+'-compat-test.js';if(!fs.existsSync(path)){const r=await fetch(`https://www.gstatic.com/firebasejs/9.23.0/firebase-${name}-compat.js`);assert.equal(r.ok,true);fs.writeFileSync(path,await r.text());}await page.addScriptTag({path});}
  await page.evaluate(({namespace})=>{
   firebase.initializeApp({projectId:'demo-sulukera-security',apiKey:'fake-key',databaseURL:'https://'+namespace+'.firebaseio.com'});
   firebase.database().useEmulator('127.0.0.1',9007,{mockUserToken:{sub:'eman',user_id:'eman'}});
   // Emulator supplies database auth; this isolated UI fixture supplies the matching signed-in identity.
   firebase.auth=()=>({currentUser:{uid:'eman'}});
   window.currentUser={role:'admin',authUid:'eman',name:'إيمان حمدان',username:'eman.hamdan',staffTitle:'خدمة العملاء - الإرشاد الأكاديمي'};
   window.students=[{_fbKey:'s',firstName:'Original'}];window.subjects=[];window.users=[];window.activityLogsData=[];
   window.getStudentFullName=s=>s.firstName;window._finishLogin=async()=>{};window.doLogout=async()=>{};window.renderAlertsPage=()=>{};
   window.isAdminRole=()=>currentUser?.role==='admin';window.getRecentActivityLogs=(n=20)=>[...activityLogsData].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,n);
   window.getActivityRoleLabel=()=> 'إدارة';window.showToast=()=>{};window.escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },{namespace});
  await page.addScriptTag({path:'staff-audit.js'});await page.evaluate(()=>_finishLogin());
  await page.evaluate(async()=>{
   await firebase.database().ref('students/s').update({firstName:'Changed'});
   await firebase.database().ref().update({'grades/g/exam':0,'grades/g/studentKey':'s','grades/g/subjectKey':'subject'});
   await firebase.database().ref('schedule/weekly/l').set({day:'Monday'});
   await firebase.database().ref('schedule/weekly/l').remove();
  });
  let data=await rest();assert.equal(data.students.s.firstName,'Changed');assert.equal(data.grades.g.exam,0);assert.ok(!data.schedule);assert.equal(Object.keys(data.staffActivityLogs).length,4);
  assert.ok(Object.values(data.staffActivityLogs).every(l=>l.actorUid==='eman' && typeof l.recordedAt==='number'));
  const key=Object.keys(data.staffActivityLogs)[0];
  for(const [path,method,value] of [[`staffActivityLogs/${key}`,'DELETE',undefined],[`staffActivityLogs/${key}/actorName`,'PUT','Fake'],['staffActivityLogs/forged','PUT',{actorUid:'owner',actorName:'Owner',actorUsername:'owner',action:'fake',source:'firebase',createdAt:'now',recordedAt:{'.sv':'timestamp'}}]]){
   const denied=await page.evaluate(async({path,method,value})=>{try{const ref=firebase.database().ref(path);if(method==='DELETE')await ref.remove();else await ref.set(value);return false;}catch{return true;}},{path,method,value});assert.equal(denied,true,'log tampering must fail');
  }
  // Invalid receipt rejects both the data update and receipt in the same atomic write.
  await page.evaluate(async()=>{currentUser.name='Forged';try{await firebase.database().ref('students/s').update({firstName:'Should fail'});throw Error('Unexpected success');}catch(e){if(e.message==='Unexpected success')throw e;}currentUser.name='إيمان حمدان';});
  assert.equal((await rest('students/s')).firstName,'Changed');
  await page.waitForFunction(()=>document.getElementById('activityLogContent').textContent.includes('إيمان حمدان'));
  await page.locator('#staffAuditActor').selectOption('eman');assert.ok((await page.locator('#activityLogContent').innerText()).includes('eman.hamdan'));
  await page.locator('#staffAuditSearch').fill('حذف');await page.locator('#staffAuditSearch').dispatchEvent('change');assert.equal(await page.locator('#activityLogContent tbody tr').count(),1);
  await page.screenshot({path:'.tools/staff-audit-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.tools/staff-audit-mobile.png'});
  assert.deepEqual(errors,[]);await page.evaluate(()=>doLogout());
  console.log('PASS real Firebase SDK + emulator: atomic data/receipt, zero grades, immutable identity, rejected tampering, live owner view, staff/search filters, desktop/mobile');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
