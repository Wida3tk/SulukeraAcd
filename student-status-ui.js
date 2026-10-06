function studentAccountBadge(student){const status=SulukeraStudentAccount.status(student);return `<span class="badge ${status==='active'?'badge-pass':status==='frozen'?'badge-warn':'badge-fail'}">${SulukeraStudentAccount.label(status)}</span>`;}
function studentStatusOptions(value='active'){return [['active','النشطون'],['inactive','كل الحسابات غير النشطة'],['suspended','الموقوفون'],['frozen','المجمّدون'],['withdrawn','المنسحبون'],['all','جميع الحالات']].map(([key,label])=>`<option value="${key}" ${key===value?'selected':''}>${label}</option>`).join('');}
function openStudentStatusModal(index){
  if(!canManageAcademicAdmin())return;
  const student=students[index];if(!student?._fbKey)return;
  document.getElementById('studentStatusModal')?.remove();
  const modal=document.createElement('div');modal.id='studentStatusModal';modal.className='modal-overlay open';
  modal.innerHTML=`<div class="modal" style="width:min(480px,92vw)"><div class="modal-header"><h3>حالة حساب ${escapeHtml(getStudentFullName(student))}</h3><button class="btn btn-sm" onclick="document.getElementById('studentStatusModal').remove()">إغلاق</button></div><div class="modal-body"><p>تُطبّق الحالة على الحساب وجميع البرامج والقوائم. تبقى الدرجات والتسجيلات محفوظة.</p><label for="studentStatusValue">حالة الحساب</label><select id="studentStatusValue" style="width:100%;padding:12px;margin:10px 0">${Object.entries(SulukeraStudentAccount.labels).map(([key,label])=>`<option value="${key}" ${key===SulukeraStudentAccount.status(student)?'selected':''}>${label}</option>`).join('')}</select><label for="studentStatusReason">ملاحظة الإدارة (اختياري)</label><textarea id="studentStatusReason" style="width:100%;min-height:90px;margin-top:8px">${escapeHtml(student.statusReason||'')}</textarea><div role="status" id="studentStatusMessage"></div></div><div class="modal-footer"><button class="btn btn-primary" onclick="saveStudentAccountStatus(${index},this)">اعتماد الحالة</button></div></div>`;
  document.body.appendChild(modal);
}
async function saveStudentAccountStatus(index,button){
  if(!canManageAcademicAdmin())return;
  const student=students[index],next=document.getElementById('studentStatusValue')?.value,reason=document.getElementById('studentStatusReason')?.value||'';
  if(!student?._fbKey||!Object.hasOwn(SulukeraStudentAccount.labels,next))return;
  if(!confirm(`تغيير حالة ${getStudentFullName(student)} إلى ${SulukeraStudentAccount.label(next)} في جميع البرامج؟\nلن تُحذف أي درجات أو تسجيلات.`))return;
  button.disabled=true;
  try{
    const [accounts,enrollments,sheets]=await Promise.all([fbRef('users').get(),fbRef(`professionalEnrollments/${student._fbKey}`).get(),fbRef('studentAdminSheets').get()]);
    const updates=SulukeraStudentAccount.updates(student._fbKey,student,next,accounts.val()||{},enrollments.val()||{},{by:currentUser.username||currentUser.name||'admin',reason,sheets:sheets.val()||{}});
    await fbRef().update(updates);
    student.accountStatus=next;student.statusReason=reason;
    await saveActivityLog({action:'تغيير حالة حساب طالب',targetType:'student_account',targetKey:student._fbKey,targetLabel:getStudentFullName(student),studentKey:student._fbKey,details:`الحالة: ${SulukeraStudentAccount.label(next)}. ${reason}`}).catch(()=>{});
    await loadAllFromFirebase();
    document.getElementById('studentStatusModal')?.remove();
    renderStudentsTable();renderProfessionalStudentsAdmin();
    if(document.getElementById('gradeSubjectSelect')?.value)loadGradesTable();
    if(document.getElementById('page-student-profile')?.classList.contains('active'))openStudentProfile(students.findIndex(s=>s._fbKey===student._fbKey));
    showToast(`✅ تم توحيد حالة الحساب: ${SulukeraStudentAccount.label(next)}`);
  }catch(error){document.getElementById('studentStatusMessage').textContent='تعذر حفظ الحالة، لم يتم اعتماد التغيير. حاولي مجددًا.';console.error('student account status',error);}
  finally{button.disabled=false;}
}
