/* Independent staff identities, atomic Firebase write receipts, and live activity view. */
(() => {
  const db = firebase.database();
  const proto = Object.getPrototypeOf(db.ref());
  const original = Object.fromEntries(['set','update','remove','transaction'].map(k => [k, proto[k]]));
  const labels = {students:'الطلاب',subjects:'المقررات',grades:'الدرجات',schedule:'الجداول',users:'المستخدمون',enrollments:'تسجيل المقررات',advisorCases:'الإرشاد الأكاديمي',studentRequests:'طلبات الطلاب',settings:'الإعدادات',semesters:'الفصول',programs:'البرامج',packages:'الباقات',professionalProgress:'تقدم البرنامج المهني',professionalEnrollments:'التسجيل المهني',examSchedule:'جدول الاختبارات',studentAdminSheets:'متابعة الطلاب'};
  const fields = {name:'الاسم',firstName:'الاسم الأول',midName:'الاسم الأوسط',lastName:'اسم العائلة',batch:'الدفعة',status:'الحالة',accountStatus:'حالة الحساب',date:'التاريخ',startTime:'وقت البداية',endTime:'وقت النهاية',startDate:'تاريخ البداية',endDate:'تاريخ النهاية',role:'الصلاحية',exam:'درجة الاختبار',subject:'المقرر',day:'اليوم',time:'الوقت',note:'الملاحظة',notes:'الملاحظات',nextAction:'الإجراء القادم',priority:'الأولوية'};
  const visibleValue = /^(name|firstName|midName|lastName|batch|status|accountStatus|date|startTime|endTime|startDate|endDate|role|exam|day|time|semesterNo|active|published|w\d+_(attend|hw|disc)(Entered|Approved)?)$/;
  const excluded = /^(activityLogs|staffActivityLogs)(\/|$)/;
  if(document.head) {
    const style=document.createElement('style');
    style.textContent=`#activityLogContent input,#activityLogContent select{padding:9px 12px;border:1px solid var(--border);border-radius:8px;font:inherit;max-width:100%}#activityLogContent td{overflow-wrap:anywhere}@media(max-width:700px){#activityLogContent .table-wrap{overflow:visible}#activityLogContent table,#activityLogContent tbody,#activityLogContent tr,#activityLogContent td{display:block;width:100%;min-width:0!important}#activityLogContent thead{display:none}#activityLogContent tr{border:1px solid var(--border);border-radius:10px;margin-bottom:12px;padding:8px;background:white}#activityLogContent td{display:grid;grid-template-columns:78px minmax(0,1fr);gap:8px;padding:8px;border:0}#activityLogContent td:before{content:attr(data-label);font-weight:700;color:var(--primary)}#activityLogContent td>div{grid-column:2}}`;
    document.head.appendChild(style);
  }
  let subscription = null, actorFilter = '', search = '';
  function actor() {
    const auth = firebase.auth().currentUser;
    return currentUser?.role === 'admin' && auth?.uid === currentUser.authUid ? {
      actorUid:auth.uid, actorUsername:currentUser.username || '', actorName:currentUser.name,
      actorRole:'admin', actorTitle:currentUser.staffTitle || 'إدارة'
    } : null;
  }
  function pathOf(ref) { return decodeURIComponent(ref.toString().slice(ref.root.toString().length)).replace(/^\/+|\/+$/g,''); }
  function describe(paths, value) {
    const targets = [...new Set(paths.map(p => p.split('/').slice(0,2).join('/')))];
    const target = targets[0] || '', [collection, key] = target.split('/');
    const student = students.find(s => s._fbKey === key);
    const subject = subjects.find(s => s._fbKey === key);
    const user = users.find(s => s._fbKey === key);
    const name = student ? getStudentFullName(student) : subject?.name || user?.name || '';
    const changes = [];
    function visit(v, path, depth=0) {
      if(changes.length >= 60) return;
      if(v && typeof v === 'object' && !Array.isArray(v) && depth < 4) {
        for(const [k, child] of Object.entries(v)) visit(child, path ? path+'/'+k : k, depth+1);
        return;
      }
      const field = path.split('/').pop();
      if(/password|token|secret|credential|authorization|apiKey/i.test(path)) return;
      const label = fields[field] || field;
      const shown = visibleValue.test(field) && (v === null || ['string','number','boolean'].includes(typeof v));
      changes.push(label + (shown ? ': '+String(v === null ? 'حذف' : v).slice(0,160) : ''));
    }
    visit(value,'');
    return {targetType:collection || 'general',targetKey:key || '',
      targetLabel:(labels[collection] || collection || 'النظام') + (name ? ' · '+name : key ? ' · '+target.split('/').slice(1).join('/') : '') + (targets.length>1 ? ` · ${targets.length} سجلات` : ''),
      details:changes.join('، ').slice(0,5000), paths:paths.slice(0,60), pathCount:paths.length,
      studentKey:collection==='students'?key:'',subjectKey:collection==='subjects'?key:''};
  }
  function receipt(identity, paths, value, method) {
    return {...identity,...describe(paths,value), action:method==='remove'?'حذف سجل':method==='transaction'?'تحديث بمعاملة':method==='update'?'تعديل بيانات':'حفظ بيانات',
      source:'firebase',createdAt:new Date().toISOString(), recordedAt:firebase.database.ServerValue.TIMESTAMP};
  }
  function write(ref, method, value, callback) {
    const identity = actor(), path = pathOf(ref);
    const paths = method==='update' ? Object.keys(value || {}).map(k => [path,k].filter(Boolean).join('/')) : [path];
    if(!identity || !path && method!=='update' || !paths.length || paths.some(p => excluded.test(p))) {
      return method==='remove' ? original.remove.call(ref,callback) : original[method].call(ref,value,callback);
    }
    const changes = method==='update' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [[path,k].filter(Boolean).join('/'),v])) : {[path]:method==='remove'?null:value};
    const auditKey = 'act_'+Date.now()+'_'+db.ref('staffActivityLogs').push().key;
    changes['staffActivityLogs/'+auditKey] = receipt(identity,paths,value,method);
    // Data and its receipt are accepted or rejected together by Firebase.
    return original.update.call(db.ref(),changes,callback);
  }
  proto.set = function(value, callback) { return write(this,'set',value,callback); };
  proto.update = function(value, callback) { return write(this,'update',value,callback); };
  proto.remove = function(callback) { return write(this,'remove',null,callback); };
  proto.transaction = function(update, onComplete, applyLocally) {
    const identity=actor(), path=pathOf(this);
    if(!identity || excluded.test(path)) return original.transaction.call(this,update,onComplete,applyLocally);
    const pending=original.transaction.call(this,update,undefined,applyLocally).then(async result => {
      if(result.committed) {
        try { await original.set.call(db.ref('staffActivityLogs/act_'+Date.now()+'_'+db.ref('staffActivityLogs').push().key),receipt(identity,[path],result.snapshot.val(),'transaction')); }
        catch(error) { showToast('تم التعديل لكن تعذر تسجيل النشاط؛ يرجى إبلاغ الإدارة.'); throw error; }
      }
      return result;
    });
    if(onComplete) pending.then(r => onComplete(null,r.committed,r.snapshot),e => onComplete(e,false,null));
    return pending;
  };
  function render() {
    const host=document.getElementById('activityLogContent');
    if(!host || !isAdminRole()) return;
    const logs=getRecentActivityLogs(1000);
    const actors=[...new Map(logs.map(l => [l.actorUid || l.actorUsername || l.actorName,l])).entries()];
    const filtered=logs.filter(l => (!actorFilter || (l.actorUid || l.actorUsername || l.actorName)===actorFilter) && (!search || [l.action,l.targetLabel,l.details,l.actorName,l.actorUsername].join(' ').toLowerCase().includes(search.toLowerCase())));
    host.innerHTML=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px"><select id="staffAuditActor" aria-label="تصفية النشاط حسب الموظف"><option value="">كل المستخدمين</option>${actors.map(([key,l])=>`<option value="${escapeHtml(key || '')}" ${actorFilter===key?'selected':''}>${escapeHtml(l.actorName || 'النظام')}${l.actorUsername?' ('+escapeHtml(l.actorUsername)+')':''}</option>`).join('')}</select><input id="staffAuditSearch" aria-label="بحث في سجل النشاط" placeholder="بحث في الإجراء أو التفاصيل" value="${escapeHtml(search)}"><span class="badge">${filtered.length} إجراء · آخر 500 سجل تفصيلي</span></div><div class="table-wrap"><table><thead><tr><th>الإجراء</th><th>المستهدف</th><th>التفاصيل</th><th>بواسطة</th><th>التاريخ والوقت</th></tr></thead><tbody>${filtered.slice(0,200).map(l=>`<tr><td data-label="الإجراء">${escapeHtml(l.action || 'تحديث')}${l.outcome==='failed'?' · لم يكتمل':l.outcome==='started'?' · بانتظار تأكيد النتيجة':''}</td><td data-label="المستهدف">${escapeHtml(l.targetLabel || 'سجل عام')}</td><td data-label="التفاصيل" style="min-width:230px">${escapeHtml(l.details || '—')}</td><td data-label="بواسطة">${escapeHtml(l.actorName || 'النظام')}<div style="font-size:11px">${escapeHtml(l.actorUsername || '')} · ${escapeHtml(l.actorTitle || getActivityRoleLabel(l.actorRole))}</div></td><td data-label="التاريخ والوقت">${escapeHtml(l.createdAt ? new Date(l.createdAt).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'}) : '—')}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد أنشطة مطابقة</td></tr>'}</tbody></table></div>`;
    document.getElementById('staffAuditActor').onchange=e=>{actorFilter=e.target.value;render();};
    document.getElementById('staffAuditSearch').onchange=e=>{search=e.target.value;render();};
  }
  function listen() {
    if(subscription) { subscription.ref.off('value',subscription.handler); subscription=null; }
    if(!isAdminRole()) return;
    const ref=db.ref('staffActivityLogs').orderByKey().limitToLast(500);
    const handler=snap=>{
      activityLogsData=activityLogsData.filter(l=>!l._staffAudit).concat(Object.entries(snap.val() || {}).map(([key,l])=>({...l,_fbKey:key,_staffAudit:true})));
      if(document.getElementById('page-alerts')?.classList.contains('active')) render();
    };
    ref.on('value',handler,()=>showToast('تعذر تحميل سجل نشاط الموظفين.'));
    subscription={ref,handler};
  }
  const finishLogin=_finishLogin;
  _finishLogin=async function(...args) { await finishLogin(...args); listen(); };
  const logout=doLogout;
  doLogout=async function(...args) { if(subscription){subscription.ref.off('value',subscription.handler);subscription=null;} actorFilter='';search='';return logout(...args); };
  const alerts=renderAlertsPage;
  renderAlertsPage=function(...args) { const result=alerts(...args);render();return result; };
})();
