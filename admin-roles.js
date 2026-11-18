/* Admin profiles inside the existing admin role: full administration, administrative assistant, and executive (view only).
   Student-facing pages and data are not touched. */
(function(root){
  const PROFILES={full:'إدارة كاملة',assistant:'مساعد إداري',executive:'اطلاع فقط (المدير التنفيذي)'};
  // Pages the administrative assistant can open. Edit this list to widen or narrow her access.
  const ASSISTANT_PAGES=['dashboard','alerts','academicadvisor','productivity','students','student-profile','cards','studentpreview','schedule','exams','coursework','discussionreview','professionalstudents','professionalprogress'];
  const EXECUTIVE_PAGES=['dashboard'];
  const RESOLVED=['completed','rejected','issued'];
  const FOLLOW_UP_TYPES=['exam_postponement','postpone','leave'];
  const DAY_NAMES=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const esc=value=>typeof escapeHtml==='function'?escapeHtml(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const V=f=>{try{return f();}catch(error){return undefined;}};
  const fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(Number(n)||0);

  function adminProfile(user=V(()=>currentUser)){
    if(user?.role!=='admin')return null;
    return PROFILES[user.adminProfile]?user.adminProfile:'full';
  }
  const isAssistant=()=>adminProfile()==='assistant';
  const isExecutive=()=>adminProfile()==='executive';
  function adminProfileLabel(user){return PROFILES[adminProfile(user)]||'';}
  function adminPageAllowed(pageId){
    const profile=adminProfile();
    if(!profile||profile==='full')return true;
    return (profile==='assistant'?ASSISTANT_PAGES:EXECUTIVE_PAGES).includes(pageId);
  }
  function visibleAdminNavGroups(){
    const profile=adminProfile();
    if(!profile||profile==='full')return adminNavGroups;
    return adminNavGroups.map(group=>({...group,items:group.items.filter(item=>adminPageAllowed(item.id))})).filter(group=>group.items.length);
  }
  function adminDashboardLabel(){return isAssistant()?'مهامي اليوم':isExecutive()?'الوضع العام':'لوحة التحكم';}

  // ── time helpers (Riyadh, like the rest of the system)
  const riyadhDate=(d=new Date())=>d.toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});
  const monthKey=(d=new Date())=>riyadhDate(d).slice(0,7);
  function shiftMonth(month,delta){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+delta,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
  function monthLabel(month){const [y,m]=month.split('-').map(Number);return new Intl.DateTimeFormat('ar-SA-u-nu-latn',{month:'long',calendar:'gregory',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1)));}
  const dayOf=iso=>iso?riyadhDate(new Date(iso)):'';
  const daysAgo=iso=>{const t=Date.parse(iso||'');return Number.isFinite(t)?(Date.now()-t)/86400000:Infinity;};

  // ── requests
  function requestIsOpen(request){
    const status=request.status||'pending';
    if(RESOLVED.includes(status))return false;
    if(status==='approved'&&!FOLLOW_UP_TYPES.includes(request.type))return false;
    return true;
  }
  function staffAssignees(){
    return (V(()=>users)||[]).filter(user=>user.role==='admin'&&adminProfile(user)!=='executive'&&user.username);
  }
  function assigneeName(username){
    if(!username)return '';
    if(username===V(()=>currentUser)?.username)return 'أنتِ';
    return staffAssignees().find(user=>user.username===username)?.name||username;
  }
  function requestAssignControl(request){
    if(!requestIsOpen(request))return request.assignedTo?`<span class="badge badge-info">كان مسندًا إلى ${esc(assigneeName(request.assignedTo))}</span>`:'';
    if(adminProfile()==='full'){
      const options=[`<option value="">— غير مسند —</option>`,...staffAssignees().map(user=>`<option value="${esc(user.username)}" ${request.assignedTo===user.username?'selected':''}>${esc(user.username===V(()=>currentUser)?.username?`أنا (${user.name})`:user.name)}</option>`)];
      return `<label class="ar-assign"><span>المسؤول</span><select onchange="assignStudentRequest('${esc(request._fbKey)}',this.value)">${options.join('')}</select></label>`;
    }
    if(!request.assignedTo)return '<span class="badge badge-warn">غير مسند</span>';
    return request.assignedTo===V(()=>currentUser)?.username?'<span class="badge badge-admin">مسند إليكِ</span>':`<span class="badge badge-info">مسند إلى ${esc(assigneeName(request.assignedTo))}</span>`;
  }
  async function assignStudentRequest(requestKey,username){
    if(adminProfile()!=='full')return showToast('⚠️ الإسناد متاح للإدارة فقط');
    const request=(V(()=>studentRequestsData)||[]).find(item=>item._fbKey===requestKey);
    if(!request)return showToast('⚠️ لم يتم العثور على الطلب');
    const now=new Date().toISOString();
    const payload=username?{assignedTo:username,assignedAt:now,assignedBy:V(()=>currentUser)?.username||'admin'}:{assignedTo:null,assignedAt:null,assignedBy:null};
    try{
      await fbRef('studentRequests/'+requestKey).update(payload);
      Object.assign(request,username?payload:{assignedTo:'',assignedAt:'',assignedBy:''});
      await saveActivityLog({action:username?'إسناد طلب طالب':'إلغاء إسناد طلب طالب',targetType:'student_request',targetKey:requestKey,targetLabel:request.title||getStudentRequestTypeLabel(request.type),studentKey:request.studentKey||'',details:username?`المسؤول: ${assigneeName(username)}`:''});
      showToast(username?'✅ تم إسناد الطلب':'✅ تم إلغاء الإسناد');
    }catch(error){console.error('Assign request error',error);showToast('⚠️ تعذر إسناد الطلب');}
  }

  // ── lecturer productivity (existing lecturerProductivity data + weekly schedule)
  function scheduledHours(lecturerName,month,untilIso){
    const name=String(lecturerName||'').trim();if(!name)return 0;
    const slots=Object.values(V(()=>scheduleData)?.weekly||{}).filter(slot=>slot.active!==false&&!slot.archivedAt&&String(slot.lecturer||'').trim()===name);
    if(!slots.length)return 0;
    const [y,m]=month.split('-').map(Number),days=new Date(Date.UTC(y,m,0)).getUTCDate();let total=0;
    for(let d=1;d<=days;d++){
      const date=new Date(Date.UTC(y,m-1,d)),iso=date.toISOString().slice(0,10);
      if(untilIso&&iso>untilIso)break;
      const dayName=DAY_NAMES[date.getUTCDay()];
      for(const slot of slots){
        if(slot.day!==dayName)continue;
        if(slot.termStartDate&&iso<slot.termStartDate)continue;
        if(slot.termEndDate&&iso>slot.termEndDate)continue;
        total+=typeof getTimeRangeHours==='function'?getTimeRangeHours(slot.timeStart,slot.timeEnd):0;
      }
    }
    return total;
  }
  function productivityRows(month=monthKey()){
    if(typeof lecturerHoursRows!=='function')return [];
    const current=month===monthKey(),until=current?riyadhDate():null,previous=shiftMonth(month,-1);
    const prevById=new Map(lecturerHoursRows(previous).map(row=>[row.id,row]));
    return lecturerHoursRows(month).map(row=>{
      const planned=scheduledHours(row.name,month,until);
      return {...row,planned,delivery:planned>0?Math.round(row.automatic/planned*100):null,previousDirect:prevById.get(row.id)?.direct||0};
    }).filter(row=>row.direct>0||row.office>0||row.planned>0).sort((a,b)=>b.direct-a.direct);
  }
  const deliveryClass=pct=>pct===null?'':pct>=90?'ar-good':pct>=70?'ar-warn':'ar-bad';
  function productivityCard({detailed=true,month=monthKey()}={}){
    const rows=productivityRows(month),allLecturers=(V(()=>users)||[]).filter(user=>user.role==='lecturer').length;
    const recorded=typeof lecturerHoursRows==='function'?lecturerHoursRows(month).filter(row=>row.recorded).length:0;
    const max=Math.max(1,...rows.map(row=>Math.max(row.total,row.planned)));
    const legend=detailed?`<div class="ar-legend"><span><i style="background:#0C40FB"></i>Zoom (تلقائي)</span><span><i style="background:#6C8DFD"></i>إنتاجية يدوية</span><span><i style="background:#E39A2C"></i>إضافية</span><span><i style="background:#B9C6DC"></i>مكتبية</span><span><i class="ar-plan-key"></i>المجدول حتى اليوم</span></div>`:`<div class="ar-legend"><span><i style="background:#0C40FB"></i>الساعات المنجزة</span><span><i class="ar-plan-key"></i>المجدول حتى اليوم</span></div>`;
    const bar=row=>{
      const seg=(value,color)=>value>0?`<span style="width:${(value/max*100).toFixed(2)}%;background:${color}"></span>`:'';
      const inner=detailed?seg(row.automatic,'#0C40FB')+seg(row.manual,'#6C8DFD')+seg(row.extra,'#E39A2C')+seg(row.office,'#B9C6DC'):seg(row.direct,'#0C40FB');
      return `<div class="ar-bar">${inner}${row.planned>0?`<b class="ar-plan" style="right:${Math.min(100,row.planned/max*100).toFixed(2)}%"></b>`:''}</div>`;
    };
    const body=rows.length?`<div class="ar-table-wrap"><table class="ar-table"><thead><tr><th>المحاضر</th><th style="width:38%">الساعات</th><th>المنجز</th><th>المجدول حتى اليوم</th><th>Zoom مقابل المجدول</th><th>الشهر الماضي</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${esc(row.name)}</strong></td><td>${bar(row)}</td><td><strong>${fmt(detailed?row.total:row.direct)} س</strong></td><td>${row.planned?fmt(row.planned)+' س':'<span class="ar-muted">غير مربوط بالجدول</span>'}</td><td>${row.delivery===null?'<span class="ar-muted">—</span>':`<span class="ar-cell ${deliveryClass(row.delivery)}">${row.delivery}%</span>`}</td><td class="ar-muted">${fmt(row.previousDirect)} س</td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">لا توجد ساعات مسجلة أو محاضرات مجدولة لهذا الشهر بعد.</div>';
    return `<section class="ops-card ar-card"><div class="ops-card-head"><div><div class="ops-card-title">إنتاجية المحاضرين — ${esc(monthLabel(month))}</div><div class="ops-card-note">ساعات Zoom تُحسب تلقائيًا من الاجتماعات · المجدول محسوب من الجدول الأسبوعي حسب اسم المحاضر</div></div><div class="ar-head-actions"><span class="ar-pill ${recorded<allLecturers?'ar-warn':'ar-good'}">التغطية: ${recorded} من ${allLecturers} محاضر</span>${isExecutive()?'':`<button class="btn btn-sm" onclick="navTo('productivity',null)">فتح الساعات الإنتاجية</button>`}</div></div>${legend}${body}</section>`;
  }

  // ── shared data
  function todayContext(){
    const now=new Date(),todayIso=riyadhDate(now),todayName=new Intl.DateTimeFormat('ar-SA',{weekday:'long',timeZone:'Asia/Riyadh'}).format(now);
    const slots=Object.values(V(()=>scheduleData)?.weekly||{}).filter(slot=>slot.active!==false&&!slot.archivedAt&&slot.day===todayName&&(!slot.termStartDate||todayIso>=slot.termStartDate)&&(!slot.termEndDate||todayIso<=slot.termEndDate)).sort((a,b)=>String(a.timeStart||'').localeCompare(String(b.timeStart||'')));
    const exams=Object.values(V(()=>examSchedulesData)||{}).filter(exam=>{if(exam.published===false||!exam.date||!exam.startTime||!exam.endTime)return false;const open=new Date(`${exam.date}T${String(exam.startTime).slice(0,5)}:00+03:00`),close=new Date(`${exam.date}T${String(exam.endTime).slice(0,5)}:00+03:00`);return now>=open&&now<=close;});
    return {todayIso,todayName,slots,exams};
  }
  function todayCard(){
    const {todayIso,todayName,slots,exams}=todayContext();
    const rows=[...exams.map(exam=>`<div class="ar-row"><span class="ar-time">—</span><span class="ar-grow"><strong>${esc(exam.subjectName||exam.title||'اختبار')}</strong><small>مفتوح الآن حتى ${esc(String(exam.endTime).slice(0,5))}</small></span><span class="ar-pill ar-good">مفتوح الآن</span></div>`),...slots.map(slot=>`<div class="ar-row"><span class="ar-time">${esc(slot.timeStart||'—')}</span><span class="ar-grow"><strong>${esc(slot.subject||'—')}</strong><small>${esc(slot.batch||'—')} · ${esc(slot.lecturer||'محاضر غير محدد')}</small></span></div>`)];
    return `<section class="ops-card ar-card"><div class="ops-card-head"><div><div class="ops-card-title">اليوم</div><div class="ops-card-note">${esc(todayName)} · ${esc(todayIso)} · بتوقيت الرياض</div></div></div>${rows.length?rows.join(''):'<div class="ops-empty">لا توجد محاضرات أو اختبارات مفتوحة اليوم.</div>'}</section>`;
  }
  function incompleteStudents(){
    return (V(()=>students)||[]).map((student,index)=>({student,index})).filter(item=>(typeof SulukeraStudentAccount==='undefined'||SulukeraStudentAccount.isActive(item.student))&&(!item.student.email||!item.student.phone||!item.student.program||!item.student.track||!item.student.batch));
  }
  function missingFields(student){return [['email','البريد'],['phone','الهاتف'],['program','البرنامج'],['track','المسار'],['batch','الدفعة']].filter(([key])=>!student[key]).map(([,label])=>label).join('، ');}
  const kpi=(label,value,sub,color='#0C40FB',action='')=>`<${action?'button':'div'} class="ops-kpi ar-kpi" style="--ops-color:${color}" ${action?`onclick="${action}"`:''}><div class="ops-kpi-label">${label}</div><div class="ops-kpi-value">${value}</div><div class="ops-kpi-sub">${sub}</div></${action?'button':'div'}>`;

  // ── assistant dashboard
  function assistantDashboardHtml(){
    const me=V(()=>currentUser)?.username,today=riyadhDate();
    const requests=(V(()=>studentRequestsData)||[]).filter(requestIsOpen).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    const mine=requests.filter(request=>request.assignedTo===me),unassigned=requests.filter(request=>!request.assignedTo);
    const incomplete=incompleteStudents();
    const cases=(V(()=>advisorCasesData)||[]).filter(item=>['review','follow_up','urgent'].includes(item.status));
    const month=monthKey(),missingHours=typeof lecturerHoursRows==='function'?lecturerHoursRows(month).filter(row=>!row.recorded):[];
    const doneToday=(V(()=>activityLogsData)||[]).filter(item=>item.actorUsername===me&&dayOf(item.createdAt)===today).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    const {slots,exams}=todayContext();
    const studentName=request=>{const student=(V(()=>students)||[]).find(item=>item._fbKey===request.studentKey);return student&&typeof getStudentFullName==='function'?getStudentFullName(student):'طالب';};
    const ageLabel=iso=>{const d=Math.floor(daysAgo(iso));return Number.isFinite(d)?(d<1?'اليوم':`منذ ${d} يوم`):'';};
    const requestRow=request=>`<div class="ar-row"><span class="ar-grow"><strong>${esc(typeof getStudentRequestTypeLabel==='function'?getStudentRequestTypeLabel(request.type):'طلب')} — ${esc(studentName(request))}</strong><small>${esc(request.title||'')} · ${esc(typeof getStudentRequestStatusMeta==='function'?getStudentRequestStatusMeta(request.status).label:request.status||'')}</small></span><span class="ar-pill ${daysAgo(request.createdAt)>=3?'ar-bad':'ar-neutral'}">${ageLabel(request.createdAt)}</span><button class="btn btn-sm" onclick="navTo('alerts',null)">فتح</button></div>`;
    const firstName=String(V(()=>currentUser)?.name||'').split(' ')[0];
    return `<div class="ops-dashboard ar-dashboard">
      <header class="ar-header"><div><div class="ar-eyebrow">${esc(new Intl.DateTimeFormat('ar-SA-u-nu-latn',{weekday:'long',day:'numeric',month:'long',calendar:'gregory',timeZone:'Asia/Riyadh'}).format(new Date()))}</div><h2 class="ar-title">أهلًا ${esc(firstName)}، هذه مهامك اليوم</h2></div></header>
      <section class="ops-kpis">${kpi('مسندة إليكِ',mine.length,mine.length?'طلبات مفتوحة':'لا توجد طلبات مسندة','#0C40FB',"navTo('alerts',null)")}${kpi('طلبات غير مسندة',unassigned.length,'بانتظار قرار الإدارة','#b35c00',"navTo('alerts',null)")}${kpi('بطاقات ناقصة',incomplete.length,'طلاب نشطون ببيانات ناقصة','#8e44ad',"navTo('students',null)")}${kpi('أنجزتِها اليوم',doneToday.length,'إجراءات مسجلة باسمك','#15966A')}${kpi('اليوم',slots.length+exams.length,`${slots.length} محاضرة · ${exams.length} اختبار مفتوح`,'#2980b9')}</section>
      <section class="ar-grid">
        <section class="ops-card ar-card"><div class="ops-card-head"><div><div class="ops-card-title">الطلبات المسندة إليكِ</div><div class="ops-card-note">الأقدم أولًا · تُغلق من صفحة الطلبات والتنبيهات</div></div></div>${mine.length?mine.map(requestRow).join(''):'<div class="ops-empty">لا توجد طلبات مسندة إليكِ حاليًا.</div>'}${unassigned.length?`<div class="ar-note">يوجد ${unassigned.length} طلب غير مسند بانتظار قرار الإدارة.</div>`:''}</section>
        ${todayCard()}
      </section>
      <section class="ar-grid">
        <section class="ops-card ar-card"><div class="ops-card-head"><div><div class="ops-card-title">بطاقات طلاب ناقصة البيانات</div><div class="ops-card-note">افتحي سجل الطالب وأكملي الحقول الناقصة</div></div><span class="ar-pill ar-neutral">${incomplete.length}</span></div>${incomplete.length?incomplete.slice(0,10).map(item=>`<div class="ar-row"><span class="ar-grow"><strong>${esc(typeof getStudentFullName==='function'?getStudentFullName(item.student):item.student.name||'—')}</strong><small>${esc(item.student.batch||'بلا دفعة')} · ينقص: ${esc(missingFields(item.student))}</small></span><button class="btn btn-sm" onclick="openStudentProfile(${item.index})">فتح السجل</button></div>`).join('')+(incomplete.length>10?`<div class="ar-note">و${incomplete.length-10} بطاقات أخرى في قائمة الطلاب.</div>`:''):'<div class="ops-empty">جميع بطاقات الطلاب النشطين مكتملة.</div>'}</section>
        <div class="ar-stack">
          <section class="ops-card ar-card"><div class="ops-card-head"><div><div class="ops-card-title">حالات المرشد الأكاديمي</div><div class="ops-card-note">حالات بحاجة متابعة</div></div><button class="btn btn-sm" onclick="navTo('academicadvisor',null)">فتح</button></div><div class="ar-big">${cases.length}</div></section>
          <section class="ops-card ar-card"><div class="ops-card-head"><div><div class="ops-card-title">ساعات ${esc(monthLabel(month))} بانتظار الإدخال</div><div class="ops-card-note">محاضرون لم تُسجل لهم ساعات بعد · ساعات Zoom تُحسب تلقائيًا</div></div><button class="btn btn-sm" onclick="navTo('productivity',null)">إدخال الساعات</button></div>${missingHours.length?missingHours.map(row=>`<div class="ar-row"><span class="ar-grow">${esc(row.name)}</span></div>`).join(''):'<div class="ops-empty">جميع المحاضرين لديهم ساعات مسجلة هذا الشهر.</div>'}</section>
        </div>
      </section>
      <section class="ops-card ar-card"><div class="ops-card-head"><div><div class="ops-card-title">ما أنجزتِه اليوم</div><div class="ops-card-note">يظهر نفس السجل للإدارة</div></div></div>${doneToday.length?doneToday.slice(0,12).map(item=>`<div class="ar-row"><span class="ar-pill ar-good">تم</span><span class="ar-grow"><strong>${esc(item.action||'تحديث')}</strong><small>${esc(item.targetLabel||'')}</small></span><span class="ar-muted">${esc(new Date(item.createdAt).toLocaleTimeString('ar-SA-u-nu-latn',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Riyadh'}))}</span></div>`).join(''):'<div class="ops-empty">لم تُسجل إجراءات باسمك اليوم بعد.</div>'}</section>
    </div>`;
  }

  // ── executive dashboard (read only: no write actions are rendered)
  function batchHealthRows(){
    const known=typeof getAllKnownBatches==='function'?getAllKnownBatches():[...new Set((V(()=>students)||[]).map(s=>s.batch).filter(Boolean))];
    const same=(a,b)=>typeof sameBatchName==='function'?sameBatchName(a,b):a===b;
    const isActive=student=>typeof SulukeraStudentAccount==='undefined'||SulukeraStudentAccount.isActive(student);
    return known.map(batch=>{
      const batchStudents=(V(()=>students)||[]).filter(student=>same(student.batch,batch)&&isActive(student));
      const keys=new Set(batchStudents.map(student=>student._fbKey));
      const sections=(V(()=>subjects)||[]).filter(subject=>same(subject.batch,batch));
      const weekly=Object.values(V(()=>scheduleData)?.weekly||{}).filter(slot=>slot.active!==false&&!slot.archivedAt&&same(slot.batch,batch)).length;
      const open=(V(()=>studentRequestsData)||[]).filter(request=>requestIsOpen(request)&&keys.has(request.studentKey)).length;
      const professional=(typeof normalizeBatchName==='function'?normalizeBatchName(batch):String(batch)).startsWith('PRO-');
      return {batch,count:batchStudents.length,sections:sections.length,assigned:sections.filter(subject=>subject.lecturerUserId).length,weekly,open,professional};
    }).filter(row=>row.count>0);
  }
  function batchHealthCard(){
    const rows=batchHealthRows(),academic=rows.filter(row=>!row.professional),professional=rows.filter(row=>row.professional);
    const cell=(cls,text)=>`<span class="ar-cell ${cls}">${text}</span>`;
    const table=list=>`<div class="ar-table-wrap"><table class="ar-table"><thead><tr><th>الدفعة</th><th>الطلاب النشطون</th><th>الجدول الأسبوعي</th><th>إسناد المحاضرين</th><th>طلبات مفتوحة</th></tr></thead><tbody>${list.map(row=>`<tr><td><strong>${esc(row.batch)}</strong></td><td>${row.count}</td><td>${row.professional?'<span class="ar-muted">برنامج مباشر</span>':row.weekly?cell('ar-good',`${row.weekly} محاضرة`):cell('ar-bad','بلا جدول')}</td><td>${row.sections?cell(row.assigned===row.sections?'ar-good':row.assigned?'ar-warn':'ar-bad',`${row.assigned}/${row.sections}`):'<span class="ar-muted">—</span>'}</td><td>${cell(row.open===0?'ar-good':row.open<3?'ar-warn':'ar-bad',row.open)}</td></tr>`).join('')}</tbody></table></div>`;
    return `<section class="ops-card ar-card"><div class="ops-card-head"><div><div class="ops-card-title">صحة الدفعات</div><div class="ops-card-note">أخضر: مكتمل · أصفر: يحتاج متابعة · أحمر: ناقص</div></div></div>${academic.length?table(academic):'<div class="ops-empty">لا توجد دفعات أكاديمية نشطة.</div>'}${professional.length?`<div class="ar-subtitle">البرامج المباشرة</div>${table(professional)}`:''}</section>`;
  }
  function semesterCard(){
    const semester=Object.values(V(()=>semestersData)||{}).find(item=>item.status==='active');
    const today=riyadhDate();
    const upcoming=Object.values(V(()=>examSchedulesData)||{}).filter(exam=>exam.published!==false&&exam.date&&exam.date>=today).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,4);
    let progress='';
    if(semester?.startDate&&semester?.endDate){
      const start=Date.parse(semester.startDate),end=Date.parse(semester.endDate),now=Date.parse(today);
      if(Number.isFinite(start)&&Number.isFinite(end)&&end>start){
        const totalWeeks=Math.max(1,Math.ceil((end-start)/604800000)),week=Math.min(totalWeeks,Math.max(0,Math.ceil((now-start+1)/604800000))),pct=Math.min(100,Math.max(0,Math.round((now-start)/(end-start)*100)));
        progress=`<div class="ar-note" style="margin:0 0 8px">الأسبوع ${week} من ${totalWeeks} · ${esc(semester.startDate)} — ${esc(semester.endDate)}</div><div class="ar-progress"><span style="width:${pct}%"></span></div>`;
      }
    }
    return `<section class="ops-card ar-card"><div class="ops-card-head"><div><div class="ops-card-title">الفصل الحالي</div><div class="ops-card-note">${esc(semester?.name||'لا يوجد فصل نشط')}</div></div></div>${progress}<div class="ar-subtitle">الاختبارات القادمة</div>${upcoming.length?upcoming.map(exam=>`<div class="ar-row"><span class="ar-grow"><strong>${esc(exam.subjectName||exam.title||'اختبار')}</strong><small>${esc(exam.batch||'')}</small></span><span class="ar-muted">${esc(exam.date)}</span></div>`).join(''):'<div class="ops-empty">لا توجد اختبارات منشورة قادمة.</div>'}</section>`;
  }
  function sparkline(values,color){
    const max=Math.max(1,...values),w=120,h=30,step=values.length>1?w/(values.length-1):w;
    return `<svg class="ar-spark" viewBox="0 0 ${w} ${h+2}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${values.map((v,i)=>`${(i*step).toFixed(1)},${(h+1-(v/max)*h).toFixed(1)}`).join(' ')}"/></svg>`;
  }
  function executiveDashboardHtml(){
    const month=monthKey(),months=[5,4,3,2,1,0].map(n=>shiftMonth(month,-n));
    const hours=months.map(m=>typeof lecturerHoursTotal==='function'?lecturerHoursTotal(m).direct:0);
    const activeStudents=(V(()=>students)||[]).filter(student=>typeof SulukeraStudentAccount==='undefined'||SulukeraStudentAccount.isActive(student)).length;
    const batches=batchHealthRows(),requests=V(()=>studentRequestsData)||[];
    const received=requests.filter(r=>daysAgo(r.createdAt)<=7).length,closed=requests.filter(r=>RESOLVED.concat('approved').includes(r.status)&&daysAgo(r.reviewedAt)<=7).length,open=requests.filter(requestIsOpen).length;
    const noSchedule=batches.filter(b=>!b.professional&&!b.weekly).map(b=>b.batch);
    const prodRows=productivityRows(month),totalLecturers=(V(()=>users)||[]).filter(u=>u.role==='lecturer').length,recorded=typeof lecturerHoursRows==='function'?lecturerHoursRows(month).filter(r=>r.recorded).length:0;
    const summary=[`${activeStudents} طالبًا نشطًا في ${batches.length} دفعة.`,`ساعات المحاضرين المسجلة في ${monthLabel(month)} حتى الآن ${fmt(hours[5])} ساعة (الشهر الماضي كاملًا: ${fmt(hours[4])} ساعة)، و${recorded} من ${totalLecturers} محاضرين لديهم ساعات مسجلة.`,`خلال آخر 7 أيام: ${received} طلبات طلاب جديدة و${closed} طلبات أُغلقت، و${open} مفتوحة حاليًا.`,noSchedule.length?`دفعات بلا جدول أسبوعي: ${noSchedule.join('، ')}.`:'جميع الدفعات الأكاديمية لها جدول أسبوعي.'].join(' ');
    const updated=new Date().toLocaleTimeString('ar-SA-u-nu-latn',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Riyadh'});
    return `<div class="ops-dashboard ar-dashboard">
      <div class="ar-readonly">وضع الاطلاع فقط · لا يمكن تعديل أي بيانات من هذا الحساب</div>
      <header class="ar-header"><div><div class="ar-eyebrow">آخر تحديث: اليوم ${esc(updated)}</div><h2 class="ar-title">الوضع العام — ${esc(monthLabel(month))}</h2></div></header>
      <section class="ops-card ar-card ar-summary"><div class="ops-card-title">ملخص</div><p>${esc(summary)}</p><div class="ar-muted">يُولَّد تلقائيًا من بيانات النظام الحالية</div></section>
      <section class="ops-kpis">
        <div class="ops-kpi ar-kpi" style="--ops-color:#0C40FB"><div class="ops-kpi-label">الطلاب النشطون</div><div class="ops-kpi-value">${activeStudents}</div><div class="ops-kpi-sub">باستثناء الحسابات غير النشطة</div></div>
        <div class="ops-kpi ar-kpi" style="--ops-color:#16a085"><div class="ops-kpi-label">الدفعات النشطة</div><div class="ops-kpi-value">${batches.length}</div><div class="ops-kpi-sub">${batches.filter(b=>b.professional).length} منها برامج مباشرة</div></div>
        <div class="ops-kpi ar-kpi" style="--ops-color:#8e44ad"><div class="ops-kpi-label">ساعات المحاضرين — ${esc(monthLabel(month))}</div><div class="ops-kpi-value">${fmt(hours[5])}</div>${sparkline(hours,'#8e44ad')}<div class="ops-kpi-sub">آخر 6 أشهر · الشهر الحالي حتى اليوم</div></div>
        <div class="ops-kpi ar-kpi" style="--ops-color:#b35c00"><div class="ops-kpi-label">طلبات الطلاب</div><div class="ops-kpi-value">${open}</div><div class="ops-kpi-sub">مفتوحة · آخر 7 أيام: ${received} جديدة، ${closed} أُغلقت</div></div>
      </section>
      ${productivityCard({detailed:false,month})}
      <section class="ar-grid">${batchHealthCard()}${semesterCard()}</section>
    </div>`;
  }

  function renderProfileDashboard(page){
    const profile=adminProfile();
    if(profile==='assistant'){page.innerHTML=assistantDashboardHtml();return true;}
    if(profile==='executive'){page.innerHTML=executiveDashboardHtml();return true;}
    return false;
  }

  // Assistant and executive cannot delete records, even if a delete button is reached.
  function guardDeletes(){
    ['deleteStudent','deleteUser','deleteSubject','deleteBatch','deleteProgram','deleteSemester','deleteSlot','deletePackage','deleteTrack','deleteUnit','removeProfessionalStudent','removeLegacyAcademicData'].forEach(name=>{
      const original=root[name];if(typeof original!=='function'||original.__adminGuarded)return;
      const guarded=function(...args){if(adminProfile()&&adminProfile()!=='full'){showToast('⚠️ الحذف متاح للإدارة الكاملة فقط');return;}return original.apply(this,args);};
      guarded.__adminGuarded=true;root[name]=guarded;
    });
  }

  Object.assign(root,{ADMIN_PROFILES:PROFILES,ADMIN_ASSISTANT_PAGES:ASSISTANT_PAGES,adminProfile,adminProfileLabel,adminPageAllowed,visibleAdminNavGroups,adminDashboardLabel,isAssistantAdmin:isAssistant,isExecutiveAdmin:isExecutive,requestIsOpen,requestAssignControl,assignStudentRequest,productivityRows,productivityCard,scheduledHours,assistantDashboardHtml,executiveDashboardHtml,renderProfileDashboard,guardDeletes});
  guardDeletes();
})(globalThis);
