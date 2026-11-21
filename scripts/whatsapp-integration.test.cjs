const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:['C:/Users/Maryam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(u.hostname==='app.test'){
    const file=path.resolve(u.pathname==='/'?'index.html':u.pathname.slice(1));
    if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return r.abort();
    return r.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
   }
   if(u.hostname==='www.gstatic.com')return r.fulfill({contentType:'text/javascript',body:`if(!window.firebase){class Ref{set(){return Promise.resolve()}update(){return Promise.resolve()}remove(){return Promise.resolve()}transaction(){return Promise.resolve({committed:false})}toString(){return 'https://test.invalid/'}get root(){return this}push(){return {key:'fixture'}}}const db={ref:()=>new Ref};const database=()=>db;database.ServerValue={TIMESTAMP:{'.sv':'timestamp'}};window.firebase={initializeApp(){},auth(){return {currentUser:null,signOut:async()=>{}}},database};}`});
   return r.abort();
  });
  await page.goto('https://app.test/',{waitUntil:'load'});assert.deepEqual(errors,[]);
  assert.equal(await page.locator('#appShell').isVisible(),false);
  await page.evaluate(()=>{
   currentUser={role:'admin',adminProfile:'full',authUid:'test',name:'إدارة تجريبية'};students=[{_fbKey:'fixture',id:'TEST',firstName:'طالبة',lastName:'تجريبية',batch:'Q2',phone:'0501234567',accountStatus:'active'}];subjects=[];semestersData={};packagesData=[];
   secureAdminExamRequest=async()=>({studentKeys:[]});saveActivityLog=async()=>{};
   document.getElementById('loginScreen').style.display='none';document.getElementById('appShell').style.display='block';renderNav();
  });
  await page.locator('[data-nav-group="students"] .nav-group-head').click();await page.locator('.nav-item[data-page-id="whatsappmessages"]').click();
  await page.waitForSelector('#waSelectVisible');await page.waitForFunction(()=>!document.getElementById('waMessagesContent').textContent.includes('جارٍ'));
  await page.locator('#waSelectVisible').click();await page.locator('#waText').fill('أهلًا {الاسم}، هذه معاينة فقط.');await page.locator('#waReview').click();
  assert.ok((await page.locator('#waMessagePreview').innerText()).includes('طالبة تجريبية'));assert.equal(await page.locator('#waSent').isDisabled(),true);assert.equal(await page.locator('#waOpen').getAttribute('target'),'_blank');
  await page.screenshot({path:'.tools/whatsapp-full-shell.png',fullPage:true});
  await page.evaluate(()=>{currentUser.adminProfile='executive';WhatsAppMessaging.render();});assert.equal(await page.locator('#waMessagesContent').innerText(),'');
  await page.evaluate(()=>{currentUser.adminProfile='assistant';renderNav();});assert.equal(await page.locator('.nav-item[data-page-id="whatsappmessages"]').count(),0,'assistant permissions are not widened');
  assert.deepEqual(errors,[]);console.log('PASS full production HTML and scripts: login isolation, real admin navigation, preview, executive/assistant restrictions; no WhatsApp requests or production mutations.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
