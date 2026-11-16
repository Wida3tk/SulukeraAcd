function zaName(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/[\u064B-\u065Fـ\p{Cf}]/gu,'').replace(/[\p{P}\p{S}]/gu,' ').replace(/\s+/g,' ').trim();}
function zaSuggestedStudent(name,students){
 const tokens=zaName(name).split(' ').filter(Boolean);if(tokens.length<2)return '';
 const matches=students.filter(s=>{const full=zaName(s.name).split(' ');return tokens.every(t=>full.includes(t));});
 return matches.length===1?matches[0].key:'';
}
function zaSelectStudent(select){
 const row=select.closest('[data-za-row]'),student=select.value,scopes=JSON.parse(row.dataset.scopes),rosters=JSON.parse(row.dataset.rosters);
 row.dataset.scope=student==='__ignore'?scopes[0]:(scopes.find(key=>(rosters[key]||[]).includes(student))||'');
 row.querySelector('[data-za-status]').textContent=student==='__ignore'?'سيُستبعد من هذا المقرر':student?'جاهز للحفظ':'اختاري الطالب';
}
async function openZoomAttendanceReports(){
 try{
  const user=firebase.auth().currentUser,response=await fetch(EXAM_API_BASE+'/admin/zoom-attendance',{headers:{Authorization:'Bearer '+await user.getIdToken()}}),data=await response.json();if(!response.ok)throw Error(data.error||'تعذر عرض التقارير');
  document.getElementById('zoomAttendanceReportsDialog')?.remove();const dialog=document.createElement('dialog');dialog.id='zoomAttendanceReportsDialog';dialog.dir='rtl';dialog.style.cssText='width:min(1100px,94vw);max-height:90vh;overflow:auto;border:1px solid #dbe4f5;border-radius:20px;padding:24px;color:#17365c;background:white';
  const esc=cwEscape,students=data.students.sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
  dialog.innerHTML='<header style="display:flex;justify-content:space-between;gap:20px;align-items:center"><h2>مراجعة حضور Zoom</h2><button class="btn-out" onclick="this.closest(\'dialog\').close()">إغلاق</button></header><p>المطابقة المؤكدة تتم تلقائيًا. الربط الذي تعتمدينه يُتذكر للقاءات والمقررات القادمة على حساب Zoom نفسه، مع التحقق من التسجيل. الأسماء المقترحة تحتاج تأكيدك، ولا نرصد الغياب بسبب اسم غير معروف.</p>'+data.reports.map((r,i)=>{
   const v=JSON.parse(r.result_json||'{}'),approvedNames=new Set(r.approvedNames||[]);v.unmatched=(v.unmatched||[]).filter(p=>!approvedNames.has(p.name));
   const scopes=v.targets||[],scopedRosters=Object.fromEntries(scopes.map(key=>[key,data.scopeRosters?.[key]||[]])),eligible=students.filter(s=>scopes.some(key=>(data.scopeRosters?.[key]||[]).includes(s.key))),states={fetched:'بانتظار المعالجة',partial:'أسماء تحتاج مراجعة',complete:'اكتملت المزامنة',review:'تحتاج مراجعة المقرر/الموعد'};
   return '<section style="padding:18px;margin:14px 0;border:1px solid #dbe4f5;border-radius:14px;background:#f8faff"><h3>'+esc(r.topic)+' — '+cwDate(r.starts_at)+'</h3><small>'+esc(r.host)+'</small><p>'+scopes.map(key=>esc(data.scopeLabels?.[key]||key)).join(' · ')+'</p><p><b>'+esc(states[r.state]||r.state)+'</b> · رصد جديد: '+(v.applied||0)+' · سجلات سابقة محفوظة: '+(v.protected||0)+'</p>'+(approvedNames.size?'<p style="color:#087a52">'+approvedNames.size+' ربطًا محفوظًا ومعتمدًا؛ لا يحتاج إعادة إدخال.</p>':'')+((r.state==='fetched'||approvedNames.size)?'<button class="btn-out" data-report="'+esc(r.id)+'" onclick="processZoomAttendanceButton(this)">تحديث الحضور الآن</button><span data-za-process-status role="status"></span>':'')+(v.reason?'<button class="btn-out" data-report="'+esc(r.id)+'" onclick="retryZoomAttendanceReport(this.dataset.report,this)">إعادة الفحص بعد تصحيح الموعد</button><p>'+esc(({AMBIGUOUS_MEETING_TARGET:'يوجد أكثر من لقاء مطابق؛ يلزم مراجعة إعداد اللقاء.',NO_EXACT_LECTURE_MATCH:'لم يُعثر على محاضرة مطابقة للتاريخ ورقم الاجتماع.'})[v.reason]||v.reason)+'</p>':'')+((v.unmatched||[]).length?'<details open><summary>أسماء تحتاج تأكيدًا ('+v.unmatched.length+')</summary><p>تظهر هنا أسماء الطلاب المسجلين في دفعات هذا اللقاء فقط؛ يختار النظام المقرر المناسب تلقائيًا.</p><button class="btn-out" onclick="saveZoomAttendanceSelections(this)">حفظ الاختيارات المحددة دفعة واحدة</button><span data-za-summary role="status" aria-live="polite"></span>'+v.unmatched.map((p,j)=>{
    const suggested=zaSuggestedStudent(p.name,eligible),scope=scopes.find(key=>(data.scopeRosters?.[key]||[]).includes(suggested))||'';
    return '<div data-za-row data-scope="'+esc(scope)+'" data-scopes="'+esc(JSON.stringify(scopes))+'" data-rosters="'+esc(JSON.stringify(scopedRosters))+'" style="padding:14px 0;border-bottom:1px solid #dde5f2;display:flex;flex-wrap:wrap;gap:10px;align-items:center"><b style="min-width:180px">'+esc(p.name)+'</b><select style="max-width:100%" aria-label="الطالب المطابق لاسم '+esc(p.name)+'" onchange="zaSelectStudent(this)"><option value="">— اختاري الطالب —</option><option value="__ignore">استبعاد: محاضر أو ضيف</option>'+eligible.map(s=>'<option value="'+esc(s.key)+'" '+(s.key===suggested?'selected':'')+'>'+esc(s.name)+' — '+esc(s.id)+' — '+esc(s.batch)+'</option>').join('')+'</select><small data-za-status role="status">'+(suggested?'اقتراح يحتاج تأكيدك':'لم نجد مطابقة مؤكدة')+'</small><button class="btn-out" data-za-save data-report="'+esc(r.id)+'" data-name="'+esc(p.name)+'" onclick="saveZoomAttendanceAlias(this)">حفظ الربط</button></div>';
   }).join('')+'</details>':'')+'</section>';
  }).join('')+(data.reports.length?'':'<p>لم تصل تقارير بعد.</p>');
  dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
 }catch(error){cwNotify(error.message);}
}
async function saveZoomAttendanceAlias(button,deferProcessing=false){
 const row=button.closest('[data-za-row]'),studentKey=row.querySelector('select').value,scopeKey=row.dataset.scope;
 if(!studentKey||!scopeKey){cwNotify('اختاري طالبًا مسجلًا في هذا اللقاء أولًا');return false;}button.disabled=true;
 try{
  const user=firebase.auth().currentUser,response=await fetch(EXAM_API_BASE+'/admin/zoom-attendance/alias',{method:'POST',headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/json'},body:JSON.stringify({reportId:button.dataset.report,scopeKey,zoomName:button.dataset.name,studentKey:studentKey==='__ignore'?'':studentKey,ignore:studentKey==='__ignore'})}),data=await response.json();
  if(!response.ok)throw Error(({STUDENT_NOT_ENROLLED:'تغيّر تسجيل الطالب في هذا المقرر؛ أعيدي فتح التقارير لتحديث القائمة.',STUDENT_NOT_ACTIVE:'حساب الطالب غير نشط.',ALIAS_SCOPE_INVALID:'تغيّرت بيانات اللقاء؛ أعيدي فتح التقارير.'})[data.error]||'تعذر حفظ الربط؛ حاولي مجددًا');
  button.dataset.saved='true';button.textContent='تم الحفظ';row.querySelector('select').disabled=true;row.querySelector('[data-za-status]').textContent='تم اعتماد الربط · ستكتمل المزامنة تلقائيًا';if(!deferProcessing)await processZoomAttendanceReport(button.dataset.report,row.querySelector('[data-za-status]'));return true;
 }catch(error){row.querySelector('[data-za-status]').textContent=error.message;button.disabled=false;return false;}
}
async function saveZoomAttendanceSelections(button){
 const section=button.closest('details'),rows=[...section.querySelectorAll('[data-za-row]')].filter(row=>row.querySelector('select').value&&!row.querySelector('[data-za-save]').disabled),summary=section.querySelector('[data-za-summary]');
 if(!rows.length){summary.textContent=' اختاري الأسماء التي تريدين اعتمادها أولًا.';return;}
 button.disabled=true;let saved=0;try{for(const row of rows){if(await saveZoomAttendanceAlias(row.querySelector('[data-za-save]'),true))saved++;summary.textContent=' تم حفظ '+saved+' من '+rows.length;}if(saved)await processZoomAttendanceReport(rows[0].querySelector('[data-za-save]').dataset.report,summary);}finally{button.disabled=false;}
}

async function processZoomAttendanceReport(reportId,status){
 status.textContent='تم حفظ الروابط · جارٍ تحديث الحضور…';
 try{const user=firebase.auth().currentUser,r=await fetch(EXAM_API_BASE+'/admin/zoom-attendance/process',{method:'POST',headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/json'},body:JSON.stringify({reportId})}),data=await r.json();if(!r.ok||data.state==='review'||data.reason)throw Error('PROCESS_FAILED');
 status.textContent=data.busy||data.continuation?'الروابط محفوظة ومعتمدة · يجري استكمال المزامنة تلقائيًا':'الروابط محفوظة ومعتمدة · تم تحديث الحضور؛ أعيدي فتح التقرير لعرض النتيجة.';
 }catch(error){status.textContent='الروابط محفوظة ومعتمدة · تعذر تحديث الحضور الآن؛ يمكن إعادة المحاولة دون ربط الأسماء مجددًا.';}
}
async function processZoomAttendanceButton(button){button.disabled=true;try{await processZoomAttendanceReport(button.dataset.report,button.parentElement.querySelector('[data-za-process-status]'));}finally{button.disabled=false;}}

const zoomAttendanceOriginalHome=cwRenderCourseworkHome;
const recordingReviewReasons = {
  AMBIGUOUS_RECORDING_FILES: 'وجد Zoom أكثر من ملف محتمل للمحاضرة.',
  RECORDING_VIDEO_NOT_READY: 'ملف الفيديو غير جاهز في Zoom.',
  NO_EXACT_LECTURE_MATCH: 'تعذرت مطابقة التسجيل مع محاضرة في الجدول.',
  NO_EXACT_PROFESSIONAL_SESSION: 'تعذرت مطابقة التسجيل مع لقاء في البرنامج المهني.',
  AMBIGUOUS_PROFESSIONAL_SESSION: 'طابق التسجيل أكثر من لقاء في البرنامج المهني.',
  MEETING_NOT_CONFIGURED: 'رابط اجتماع Zoom غير مربوط بمقرر.',
};

async function loadRecordingSyncStatus() {
  const user = firebase.auth().currentUser;
  const response = await fetch(EXAM_API_BASE + '/admin/recording-sync', {
    headers: {Authorization: 'Bearer ' + await user.getIdToken()},
  });
  if (!response.ok) throw Error('تعذر التحقق من مزامنة التسجيلات');
  return response.json();
}

async function renderRecordingSyncAlert(container) {
  if (!container || currentUser?.role !== 'admin') return;
  container.querySelector('[data-recording-sync-alert]')?.remove();
  const alert = document.createElement('section');
  alert.dataset.recordingSyncAlert = '';
  alert.style.cssText = 'margin:12px 0;padding:12px 16px;background:#fff7e6;color:#713f12;border:1px solid #e8c578;border-radius:12px';
  container.prepend(alert);
  alert.hidden = true;
  let message;
  try {
    const data = await loadRecordingSyncStatus();
    const reviewCount = data.jobs.filter(job => job.state === 'review').length;
    const delayedCount = data.jobs.filter(job =>
      ['queued', 'uploading'].includes(job.state) && Date.now() - Date.parse(job.updated_at) > 3600000
    ).length;
    const latest = data.runs[0];
    const saudiNow = new Date(Date.now() + 3 * 3600000).toISOString();
    const expectedDay = saudiNow.slice(11, 16) >= '23:15'
      ? saudiNow.slice(0, 10)
      : new Date(Date.parse(saudiNow) - 86400000).toISOString().slice(0, 10);
    const notices = [];
    if (!data.automatic) notices.push('مزامنة التسجيلات التلقائية متوقفة.');
    else if (!latest || latest.day < expectedDay || latest.state === 'running' && Date.now() - Date.parse(latest.updated_at) > 900000) notices.push('فحص التسجيلات لم يكتمل في موعده.');
    else if (latest.state === 'review') notices.push('تعذر فحص بعض حسابات Zoom.');
    if (reviewCount) notices.push('تسجيلات تحتاج مراجعة (' + reviewCount + ').');
    if (delayedCount) notices.push('تسجيلات تأخر نقلها أكثر من ساعة (' + delayedCount + ').');
    message = notices.join(' ');
  } catch (error) {
    message = error.message;
  }
  if (!message || !alert.isConnected || currentUser?.role !== 'admin') return;
  const label = document.createElement('strong');
  label.textContent = message;
  const button = document.createElement('button');
  button.className = 'btn-out';
  button.style.marginInlineStart = '12px';
  button.textContent = 'عرض حالة التسجيلات';
  button.onclick = openNightlyRecordingStatus;
  alert.append(label, button);
  alert.hidden = false;
}

const recordingOriginalDashboard = renderDashboard;
renderDashboard = function (...args) {
  const result = recordingOriginalDashboard.apply(this, args);
  void renderRecordingSyncAlert(document.querySelector('#page-dashboard .ops-dashboard'));
  return result;
};
async function openNightlyRecordingStatus(){try{const data=await loadRecordingSyncStatus();const dialog=document.createElement('dialog');dialog.dir='rtl';dialog.style.cssText='width:min(900px,94vw);max-height:85vh;overflow:auto;border:1px solid #dce4f4;border-radius:20px;padding:24px;color:#17365c;background:white';const labels={queued:'بانتظار النقل',uploading:'يجري استكمال النقل',complete:'اكتمل',retained:'التسجيل موجود — دون تكرار',review:'تحتاج مراجعة'},last=data.runs[0];dialog.innerHTML='<header style="display:flex;justify-content:space-between;gap:20px"><h2>المزامنة اليومية للتسجيلات</h2><button class="btn-out" onclick="this.closest(\'dialog\').close()">إغلاق</button></header><p>المزامنة '+(data.automatic?'مفعّلة':'متوقفة')+' — يوميًا الساعة <b>11:00 مساءً بتوقيت السعودية</b>.</p><p>البحث مرة واحدة يوميًا؛ استكمال الملفات المعلّقة لا يعيد البحث في الحسابات. مشروع التخرج مستثنى.</p>'+(last?'<p>آخر فحص: '+cwEscape(last.day)+' — '+cwEscape(labels[last.state]||last.state)+'</p>':'<p>أول فحص تلقائي يبدأ في الموعد المحدد.</p>')+[...data.jobs].sort((a,b)=>Number(b.state==="review")-Number(a.state==="review")).map(j=>'<section style="border:1px solid #dce4f4;border-radius:12px;padding:16px;margin:12px 0"><b>'+cwEscape(j.topic)+'</b><p>'+cwEscape(labels[j.state]||j.state)+'</p>'+(j.reason?'<small>التفاصيل: '+cwEscape(recordingReviewReasons[j.reason]||j.reason)+'</small>':'')+'</section>').join('');dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}catch(error){cwNotify(error.message);}}
async function retryZoomAttendanceReport(reportId,button){button.disabled=true;try{const user=firebase.auth().currentUser,response=await fetch(EXAM_API_BASE+'/admin/zoom-attendance/retry',{method:'POST',headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/json'},body:JSON.stringify({reportId})});if(!response.ok)throw Error('تعذر إعادة الفحص');button.textContent='تمت الإضافة إلى المزامنة';}catch(error){cwNotify(error.message);button.disabled=false;}}
cwRenderCourseworkHome=function(){zoomAttendanceOriginalHome();if(currentUser.role!=='admin')return;const hero=cwHost()?.querySelector('.cw-report-hero');if(!hero)return;const button=document.createElement('button');button.type='button';button.className='btn-out';button.style.cssText='margin-top:14px;background:#fff;color:#1644a0;border-radius:12px;padding:10px 16px';button.textContent='تقارير حضور Zoom والمزامنة';button.onclick=openZoomAttendanceReports;hero.append(button);const recordings=document.createElement('button');recordings.type='button';recordings.className='btn-out';recordings.style.cssText=button.style.cssText+';margin-inline-start:8px';recordings.textContent='حالة مزامنة التسجيلات';recordings.onclick=openNightlyRecordingStatus;hero.append(recordings);void renderRecordingSyncAlert(hero.parentElement);};
