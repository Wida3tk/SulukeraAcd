(() => {
  const model=SulukeraWhatsApp,esc=value=>escapeHtml(value);
  let state,generation=0;
  function reset(){state={owner:currentUser?.authUid||'',selected:new Set(),projects:new Set(),loaded:false,error:'',loading:false,excludeProjects:true,activeOnly:true,country:'966',search:'',batch:'',text:'',queue:[],position:0,reviewed:false,epoch:++generation};}
  reset();
  const admin=()=>currentUser?.role==='admin'&&(typeof adminPageAllowed!=='function'||adminPageAllowed('whatsappmessages'));
  function session(){if(state.owner!==(currentUser?.authUid||''))reset();return admin();}
  const host=()=>document.getElementById('waMessagesContent');
  function invalidate(){state.reviewed=false;state.queue=[];state.position=0;}
  function rows(){
    const subjectMap=Object.fromEntries(subjects.map(s=>[s._fbKey,s]));
    return students.map(s=>{
      const key=s._fbKey||s.id,name=getStudentFullName(s)||s.name||s.id||'طالب';
      const project=state.projects.has(key)||SulukeraAcademicPolicy.projectStage(s,semestersData,subjectMap,packagesData);
      const active=SulukeraStudentAccount.isActive(s),phone=model.phone(s.phone,state.country);
      const reason=!phone?'رقم الجوال مفقود أو غير صالح':state.activeOnly&&!active?'حساب غير نشط':state.excludeProjects&&!state.loaded?'بانتظار التحقق من طلاب المشاريع':state.excludeProjects&&project?'طالب مشاريع — مستبعد':'';
      return {key,id:s.id||'',name,batch:s.batch||'',phone,rawPhone:s.phone||'',project,active,eligible:!reason,reason};
    });
  }
  function visible(all){const q=state.search.trim().toLowerCase();return all.filter(s=>(!state.batch||s.batch===state.batch)&&(!q||[s.name,s.id,s.rawPhone].join(' ').toLowerCase().includes(q)));}
  const statusLabel=s=>({pending:'بانتظار المراجعة',opened:'طُلب فتح واتساب — الإرسال غير مؤكد',sent:'أُرسلت يدويًا حسب تأكيدك',skipped:'تم التخطي'})[s]||s;
  async function log(action,item){
    if(!session())return;
    try{await saveActivityLog({action,targetType:'whatsapp_manual',targetKey:item?.key||'recipient_list',targetLabel:item?.name||'قائمة رسائل واتساب',studentKey:item?.key||'',details:item?'تواصل فردي عبر واتساب ويب؛ حالة الإرسال تعتمد على تأكيد المستخدم.':`عدد المستلمين الفريدين: ${state.queue.length}. مراجعة فقط، لم تُرسل رسائل تلقائيًا.`});}
    catch{showToast('تعذر تسجيل النشاط؛ حالة إرسال واتساب لا يمكن التحقق منها آليًا.');}
  }
  async function loadProjects(){
    if(!session()||state.loading)return;
    const owner=state.owner,epoch=++generation;state.epoch=epoch;state.loading=true;state.loaded=false;state.error='';invalidate();render();
    try{
      let data;
      try{data=await secureAdminExamRequest('/admin/whatsapp/project-students',{method:'GET'});}
      catch(firstError){
        const authUser=typeof firebase!=='undefined'?firebase.auth().currentUser:null;
        if(authUser?.getIdToken)await authUser.getIdToken(true);
        if(!admin()||state.owner!==owner||state.epoch!==epoch)return;
        data=await secureAdminExamRequest('/admin/whatsapp/project-students',{method:'GET'});
      }
      if(!admin()||state.owner!==owner||state.epoch!==epoch)return;
      if(!Array.isArray(data?.studentKeys)||data.studentKeys.some(k=>typeof k!=='string'))throw Error('INVALID_PROJECT_ROSTER');
      state.projects=new Set(data.studentKeys);state.loaded=true;
    }catch(error){
      console.warn('WhatsApp project roster could not be loaded',error?.message||'UNKNOWN_ERROR');
      if(state.owner===owner&&state.epoch===epoch)state.error=/UNAUTHENTICATED|TOKEN|انتهت جلسة|auth\//i.test(error?.message||'')?'انتهت جلسة التحقق. سجّلي الخروج ثم الدخول مرة أخرى لتجهيز قائمة الطلاب.':'تعذر تحميل قائمة استبعاد طلاب المشاريع. تحققي من الاتصال ثم أعيدي المحاولة.';
    }
    finally{if(state.owner===owner&&state.epoch===epoch){state.loading=false;render();}}
  }
  function render(){
    if(!host())return;
    if(!session()){host().replaceChildren();return;}
    const all=rows(),shown=visible(all),eligible=new Set(all.filter(s=>s.eligible).map(s=>s.key));
    for(const key of state.selected)if(!eligible.has(key))state.selected.delete(key);
    const selected=all.filter(s=>state.selected.has(s.key)),unique=new Set(selected.map(s=>s.phone)).size;
    host().innerHTML=`<div class="alert alert-info">اختاري الطلاب وراجعي الرسالة، ثم افتحيها لكل طالب في واتساب ويب واضغطي «إرسال» هناك. لا تُرسل الأداة أي رسالة تلقائيًا.</div><div class="wa-layout"><section class="card card-accent"><div class="card-title">1. اختيار الطلاب</div><div class="wa-filters"><label><input id="waExcludeProjects" type="checkbox" ${state.excludeProjects?'checked':''}>استبعاد طلاب المشاريع</label><label><input id="waActiveOnly" type="checkbox" ${state.activeOnly?'checked':''}>الحسابات النشطة فقط</label></div>${state.error?`<div class="alert alert-warn">${esc(state.error)} <button id="waRetry" class="btn btn-sm">إعادة المحاولة</button></div>`:state.loading?'<p role="status">جارٍ التحقق من طلاب المشاريع…</p>':''}<div class="wa-filters"><input id="waSearch" type="search" aria-label="البحث عن طالب" placeholder="بحث بالاسم أو الرقم أو الجوال" value="${esc(state.search)}"><select id="waBatch" aria-label="الدفعة"><option value="">كل الدفعات</option>${[...new Set(all.map(s=>s.batch).filter(Boolean))].sort().map(b=>`<option ${state.batch===b?'selected':''} value="${esc(b)}">${esc(b)}</option>`).join('')}</select><label>رمز الدولة للأرقام المحلية <input id="waCountry" value="${esc(state.country)}" inputmode="numeric" aria-label="رمز الدولة" style="width:76px" maxlength="4"></label></div><div class="wa-counts"><span>المحددون: ${selected.length}</span><span>المستلمون الفريدون: ${unique}</span><span>طلاب المشاريع: ${all.filter(s=>s.project).length}</span><span>أرقام غير صالحة: ${all.filter(s=>!s.phone).length}</span></div><div class="wa-actions"><button id="waSelectVisible" class="btn">تحديد المؤهلين في النتائج</button><button id="waClear" class="btn">إلغاء التحديد</button></div><p class="wa-note">لاستبعاد طلاب محددين، ابحثي عن أسمائهم وأزيلي علامة الاختيار. الأرقام المشتركة تستقبل رسالة واحدة في قائمة المراجعة.</p><div class="wa-roster" aria-label="قائمة الطلاب">${shown.map(s=>`<label class="wa-person" aria-disabled="${!s.eligible}"><input type="checkbox" data-wa-student="${esc(s.key)}" aria-label="اختيار ${esc(s.name)}" ${state.selected.has(s.key)?'checked':''} ${!s.eligible?'disabled':''}><span><strong>${esc(s.name)}</strong><small>${esc(s.id)} · ${esc(s.batch||'بلا دفعة')} · <span class="wa-phone">${esc(s.phone?'+'+s.phone:s.rawPhone||'لا يوجد جوال')}</span></small>${s.reason?`<small>${esc(s.reason)}</small>`:''}</span></label>`).join('')||'<div class="empty">لا يوجد طلاب مطابقون.</div>'}</div></section><section class="card card-accent wa-compose"><div class="card-title">2. كتابة الرسالة</div><label for="waText">نص الرسالة</label><textarea id="waText" maxlength="3000" placeholder="اكتبي الرسالة هنا…">${esc(state.text)}</textarea><p class="wa-note">للتخصيص: {الاسم} و{الرقم_الطلابي}. مثال: أهلًا {الاسم}، نذكّرك بموعد الواجب.</p><p class="wa-note">تبقى المسودة والقائمة خلال جلسة الصفحة الحالية؛ لا تُحفظ الرسالة عند تحديث الصفحة أو تسجيل الخروج.</p><button id="waReview" class="btn btn-primary" ${!unique||!state.text.trim()||state.excludeProjects&&!state.loaded?'disabled':''}>معاينة الرسائل والمستلمين (${unique})</button><div id="waReviewArea"></div></section></div>`;
    const bind=(id,event,fn)=>document.getElementById(id)?.addEventListener(event,fn);
    for(const [id,key] of [['waExcludeProjects','excludeProjects'],['waActiveOnly','activeOnly']])bind(id,'change',e=>{if(!session())return;state[key]=e.target.checked;invalidate();render();});
    bind('waCountry','change',e=>{state.country=e.target.value;invalidate();render();});
    bind('waBatch','change',e=>{state.batch=e.target.value;render();});
    bind('waSearch','input',e=>{const pos=e.target.selectionStart;state.search=e.target.value;render();const input=document.getElementById('waSearch');input.focus();input.setSelectionRange(pos,pos);});
    bind('waText','input',e=>{state.text=e.target.value;invalidate();document.getElementById('waReviewArea').replaceChildren();document.getElementById('waReview').disabled=!new Set(rows().filter(r=>r.eligible&&state.selected.has(r.key)).map(r=>r.phone)).size||!state.text.trim()||state.excludeProjects&&!state.loaded;});
    bind('waSelectVisible','click',()=>{if(!session())return;for(const row of shown)if(row.eligible)state.selected.add(row.key);invalidate();render();});
    bind('waClear','click',()=>{state.selected.clear();invalidate();render();});
    host().querySelectorAll('[data-wa-student]').forEach(input=>input.onchange=()=>{if(!session())return;input.checked?state.selected.add(input.dataset.waStudent):state.selected.delete(input.dataset.waStudent);invalidate();render();});
    bind('waRetry','click',loadProjects);
    bind('waReview','click',()=>{if(!session()||state.excludeProjects&&!state.loaded||!state.text.trim())return;state.queue=model.queue(rows(),state.selected,state.text.trim());state.position=0;state.reviewed=true;renderReview();void log('مراجعة قائمة رسائل واتساب');});
    renderReview();
  }
  function current(){return state.queue[state.position];}
  function renderReview(){
    const area=document.getElementById('waReviewArea');if(!area||!session())return;
    if(!state.reviewed||!state.queue.length){area.replaceChildren();return;}
    const item=current(),sent=state.queue.filter(s=>s.status==='sent').length;
    area.innerHTML=`<section class="wa-review"><hr><header><h3>3. مراجعة وفتح الرسائل</h3><span>${state.position+1} / ${state.queue.length} · تأكيد إرسال: ${sent}</span></header><div class="wa-queue-list" aria-label="المستلمون للمراجعة">${state.queue.map((s,i)=>`<button data-wa-index="${i}" aria-current="${i===state.position}">${i+1}. ${esc(s.sharedNames.join('، '))} — ${esc(statusLabel(s.status))}</button>`).join('')}</div><strong>${esc(item.name)}</strong><div class="wa-phone">+${esc(item.phone)}</div>${item.sharedNames.length>1?`<p class="wa-note">رقم مشترك مع: ${esc(item.sharedNames.slice(1).join('، '))}. ستُفتح رسالة واحدة بهذا الرقم، بالاسم الظاهر أعلاه.</p>`:''}<p class="wa-status" role="status">${esc(statusLabel(item.status))}</p><div class="wa-preview" id="waMessagePreview">${esc(item.text)}</div><div class="wa-actions"><a class="btn btn-success" id="waOpen" href="${esc(model.link(item))}" target="_blank" rel="noopener noreferrer">فتح رسالة الطالب في واتساب ويب</a><button class="btn" id="waCopy">نسخ الرسالة</button></div><p class="wa-note">راجعي اسم جهة الاتصال داخل واتساب قبل الإرسال. فتح المحادثة لا يعني أن الرسالة أُرسلت.</p><div class="wa-actions"><button id="waSent" class="btn btn-primary" ${item.status!=='opened'?'disabled':''}>أؤكد أنني أرسلتها في واتساب</button><button id="waSkip" class="btn">تخطي هذا المستلم</button></div><div class="wa-actions"><button id="waPrev" class="btn" ${state.position===0?'disabled':''}>السابق</button><button id="waNext" class="btn" ${state.position===state.queue.length-1?'disabled':''}>التالي</button></div></section>`;
    area.querySelectorAll('[data-wa-index]').forEach(b=>b.onclick=()=>{if(!session())return;state.position=Number(b.dataset.waIndex);renderReview();});
    function valid(){if(!session())return false;const now=rows().find(r=>r.key===item.key);if(!now?.eligible||now.phone!==item.phone){invalidate();render();showToast('تغيّرت بيانات المستلم. راجعي القائمة من جديد.');return false;}return true;}
    document.getElementById('waOpen').onclick=e=>{if(!valid()){e.preventDefault();return;}if(item.status!=='sent')item.status='opened';void log('فتح رسالة واتساب — الإرسال غير مؤكد',item);setTimeout(renderReview,0);};
    document.getElementById('waCopy').onclick=async()=>{if(!valid())return;try{await navigator.clipboard.writeText(item.text);showToast('تم نسخ نص الرسالة');}catch{showToast('تعذر النسخ؛ يمكنك تحديد النص من المعاينة.');}};
    document.getElementById('waSent').onclick=()=>{if(!valid()||item.status!=='opened')return;item.status='sent';void log('تأكيد المستخدم إرسال رسالة واتساب يدويًا',item);if(state.position<state.queue.length-1)state.position++;renderReview();};
    document.getElementById('waSkip').onclick=()=>{if(!valid())return;item.status='skipped';if(state.position<state.queue.length-1)state.position++;renderReview();};
    document.getElementById('waPrev').onclick=()=>{if(!session())return;state.position=Math.max(0,state.position-1);renderReview();};
    document.getElementById('waNext').onclick=()=>{if(!session())return;state.position=Math.min(state.queue.length-1,state.position+1);renderReview();};
  }
  const group=adminNavGroups.find(g=>g.id==='students');if(group&&!group.items.some(i=>i.id==='whatsappmessages'))group.items.push({id:'whatsappmessages',icon:'💬',label:'رسائل واتساب'});
  pageTitles.whatsappmessages='رسائل واتساب للطلاب';
  const studentPage=document.getElementById('page-students');
  if(studentPage&&!document.getElementById('page-whatsappmessages')){const page=document.createElement('div');page.className='page';page.id='page-whatsappmessages';page.innerHTML='<div id="waMessagesContent"></div>';studentPage.after(page);}
  const refresh=refreshPage;refreshPage=function(p,...args){if(p==='whatsappmessages'){render();if(admin()&&!state.loaded&&!state.loading&&!state.error)void loadProjects();return;}return refresh(p,...args);};
  const logout=doLogout;doLogout=async function(...args){reset();state.owner='';state.epoch++;host()?.replaceChildren();return logout(...args);};
  window.WhatsAppMessaging={render,loadProjects};
})();
