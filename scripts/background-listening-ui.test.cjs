const assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:['C:/Users/Maryam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://media.test/**',r=>r.fulfill({status:204}));
  await page.setContent('<html dir="rtl"><body></body></html>');
  await page.evaluate(()=>{
   window.currentUser={role:'student',fbKey:'fixture'};window.EXAM_API_BASE='https://media.test';window.calls=[];window.showToast=()=>{};
   const timers=new Map;window.timerCallbacks=timers;window.setInterval=fn=>{const id=timers.size+1;timers.set(id,fn);return id};window.clearInterval=id=>timers.delete(id);
   Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
   Object.defineProperties(HTMLMediaElement.prototype,{paused:{configurable:true,get(){return this._paused!==false}},ended:{configurable:true,get:()=>false},currentTime:{configurable:true,get(){return this._position||0},set(v){this._position=v}},duration:{configurable:true,get:()=>100}});
   HTMLMediaElement.prototype.play=function(){this._paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve()};HTMLMediaElement.prototype.pause=function(){this._paused=true;this.dispatchEvent(new Event('pause'))};
   window.closeProfessionalViewer=()=>document.getElementById('professionalViewerOverlay')?.remove();window.professionalExternalRecording=()=>false;window.escapeHtml=s=>String(s||'');window.professionalSafeUrl=s=>s;
  });
  await page.addScriptTag({path:'coursework-ui.js'});await page.addScriptTag({path:'professional-recording-ui.js'});
  await page.evaluate(async()=>{
   cwApi=async(path,body)=>{calls.push({type:'academic',path,body});return path==='/recording/start'?{runId:'a',mediaPath:'/academic',title:'محاضرة اختبار',percent:0}:{percent:10}};
   cwData={lessons:[{id:'lesson'}]};await cwOpenRecording('lesson');
  });
  assert.ok((await page.locator('dialog').innerText()).includes('يُحتسب الاستماع من تبويب آخر'));
  await page.evaluate(async()=>{const v=document.querySelector('dialog video');await v.play()});
  await page.waitForFunction(()=>calls.filter(c=>c.path==='/recording/checkpoint').length>=1);
  await page.evaluate(()=>{document.querySelector('dialog video').currentTime=4;document.dispatchEvent(new Event('visibilitychange'))});
  await page.waitForFunction(()=>calls.some(c=>c.type==='academic'&&c.body?.position===4));
  assert.equal(await page.evaluate(()=>document.querySelector('dialog video').paused),false);
  assert.equal(await page.evaluate(()=>calls.find(c=>c.body?.position===4).body.visible),false);assert.equal(await page.evaluate(()=>calls.find(c=>c.body?.position===4).body.playing),true);
  await page.locator('dialog button').click();const before=await page.evaluate(()=>calls.length);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await page.evaluate(()=>calls.length),before,'closed academic player removes visibility listener');
  await page.evaluate(async()=>{
   secureExamRequest=async(path,options)=>{const body=JSON.parse(options.body);calls.push({type:'professional',path,body});return path.endsWith('/start')?{runId:'p',duration:100,title:'اختبار',mediaPath:'/professional'}:{seconds:4,percent:4}};
   await openProfessionalRecording('unit','session',encodeURIComponent('https://drive.google.com/file/d/test/view'));
   await document.getElementById('recVideo').play();
  });
  await page.waitForFunction(()=>calls.some(c=>c.type==='professional'&&c.path.endsWith('/checkpoint')));
  await page.evaluate(()=>{document.getElementById('recVideo').currentTime=4;document.dispatchEvent(new Event('visibilitychange'))});
  await page.waitForFunction(()=>calls.some(c=>c.type==='professional'&&c.body.position===4));assert.equal(await page.evaluate(()=>document.getElementById('recVideo').paused),false);
  assert.ok(await page.evaluate(()=>calls.filter(c=>c.path.endsWith('/checkpoint')).every(c=>c.body.visible===false)));
  await page.locator('#recClose').click();const last=await page.evaluate(()=>calls.length);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await page.evaluate(()=>calls.length),last);assert.equal(await page.evaluate(()=>timerCallbacks.size),0);
  assert.deepEqual(errors,[]);console.log('PASS listening UI: academic and professional players keep playing while hidden, submit hidden checkpoints and clean listeners/timers on close; no real media or grade writes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
