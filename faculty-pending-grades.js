/* Read-only prior-term reminders; grade entry uses the existing authorized flow. */
function facultyMissingGradeFields(grade){
 const fields=[];for(let week=1;week<=4;week++)for(const [field,label] of [['attend','الحضور'],['hw','الواجب'],['disc','المناقشة']])if(!isCourseworkFieldEntered(grade,'w'+week,field))fields.push(`الأسبوع ${week}: ${label}`);
 // Final exams are graded electronically and are read-only for lecturers.
 return fields;
}
function facultyPreviousGradeAlerts(){
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'}),terms=Object.values(dbData.semesters||{}),currentTerms=terms.filter(t=>t.startDate<=today&&t.endDate>=today);
 const belongs=(subject,term)=>typeof facultySubjectInTerm==='function'?facultySubjectInTerm(subject,term,dbData.subjects||{}):(term.subjects||[]).includes(subject.key);
 const requests=getLecturerGradeReviewRequests(),alerts=[];
 for(const subject of getLecturerSubjects(true)){
  if(currentTerms.some(term=>belongs(subject,term)))continue;
  const term=terms.filter(t=>t.endDate&&t.endDate<today&&belongs(subject,t)).sort((a,b)=>b.endDate.localeCompare(a.endDate))[0];if(!term)continue;
  const rows=getSubjectStudents(subject.key).map(student=>({student,missing:facultyMissingGradeFields(getGrade_data(student.fbKey,subject.key)),requests:requests.filter(r=>r.subjectKey===subject.key&&r.studentKey===student.fbKey)})).filter(row=>row.missing.length||row.requests.length);
  if(rows.length)alerts.push({subject,term,rows});
 }
 return alerts.sort((a,b)=>a.term.endDate.localeCompare(b.term.endDate));
}
function facultyPendingGradesMarkup(alerts){
 if(!alerts.length)return '';
 const count=alerts.reduce((n,a)=>n+a.rows.length,0),requestCount=alerts.reduce((n,a)=>n+a.rows.reduce((m,row)=>m+row.requests.length,0),0);
 return `<section class="fpg-alert" aria-labelledby="facultyPastGradesTitle"><header><span class="fpg-icon" aria-hidden="true">!</span><div><small>إجراء عاجل · فصول منتهية</small><h2 id="facultyPastGradesTitle">يرجى استكمال رصد درجات الفصل السابق بشكل عاجل</h2><p>درجات معلّقة تؤخر اكتمال نتائج الطلاب. التنبيه يخص بنود الحضور والواجبات والمناقشات في الفصول المنتهية. الاختبار النهائي يُرصد إلكترونيًا.</p></div><div class="fpg-count"><strong>${count}</strong><span>سجل طالب يحتاج إجراء</span>${requestCount?`<small>${requestCount} طلب مراجعة معلّق</small>`:''}</div></header><div class="fpg-items">${alerts.map((alert,i)=>`<details ${i===0?'open':''}><summary><strong>${cwEscape(alert.subject.name)}</strong><span>${cwEscape(alert.subject.batch||'')} · ${alert.rows.length} طالب</span></summary><div class="fpg-period">${cwEscape(alert.term.name||'الفصل السابق')} · انتهى بتاريخ <b dir="ltr">${cwEscape(alert.term.endDate)}</b></div><div class="fpg-students">${alert.rows.map(row=>`<div><strong>${cwEscape(getStudentDisplayName(row.student))}</strong><small>${cwEscape(row.student.id||'')} · ${cwEscape(row.student.batch||'')}</small><span>${row.missing.length?`${row.missing.length} بند درجة لم يُرصد`:'الدرجات مكتملة'}${row.requests.length?' · طلب مراجعة بانتظارك':''}</span><details><summary>تفاصيل المطلوب</summary><p>${cwEscape(row.missing.join('، ')||'راجع طلب تعديل الدرجة المحال من الإدارة.')}</p></details></div>`).join('')}</div><button class="btn-primary" onclick="facultyOpenPastGrades('${encodeURIComponent(alert.subject.key)}')">استكمال الرصد ومعالجة الطلبات ←</button></details>`).join('')}</div></section>`;
}
let facultyGradeSnapshotPending=null,facultyGradeSnapshotUser=null,facultyGradeAlertGeneration=0;
async function facultyRefreshGradeSnapshot(){
 const user=currentUser;if(user?.role!=='lecturer')return false;
 if(facultyGradeSnapshotPending&&facultyGradeSnapshotUser===user)return facultyGradeSnapshotPending;
 const operation=(async()=>{
  const [subjectsSnap,termsSnap]=await Promise.all([fbRef('subjects').get(),fbRef('semesters').get()]);
  if(currentUser!==user)return false;
  dbData.subjects=subjectsSnap.exists()?subjectsSnap.val():{};dbData.semesters=termsSnap.exists()?termsSnap.val():{};
  const keys=[...new Set(getLecturerSubjects(true).map(subject=>subject.key))];
  // Staff already read these ledgers at sign-in. Fetch each once rather than issuing an unindexed query per course.
  const [gradeSnap,enrollmentSnap]=await Promise.all([fbRef('grades').get(),fbRef('enrollments').get()]);
  if(currentUser!==user)return false;
  const scope=new Set(keys),grades={...dbData.grades},enrollments={...dbData.enrollments};
  for(const [key,grade] of Object.entries(grades))if(scope.has(grade.subjectKey))delete grades[key];
  for(const [key,enrollment] of Object.entries(enrollments))if(scope.has(enrollment.subjectKey))delete enrollments[key];
  for(const [key,grade] of Object.entries(gradeSnap.val()||{}))if(scope.has(grade.subjectKey))grades[key]=grade;
  for(const [key,enrollment] of Object.entries(enrollmentSnap.val()||{}))if(scope.has(enrollment.subjectKey))enrollments[key]=enrollment;
  dbData.grades=grades;dbData.enrollments=enrollments;return true;
 })();
 facultyGradeSnapshotPending=operation;facultyGradeSnapshotUser=user;
 try{return await operation;}finally{if(facultyGradeSnapshotPending===operation){facultyGradeSnapshotPending=null;facultyGradeSnapshotUser=null;}}
}
function facultyRemoveLegacyGradeAlert(){
 const host=document.getElementById('mainContent');
 for(const heading of host.querySelectorAll('.card-title'))if(heading.textContent.includes('تنبيهات الرصد الناقص'))heading.closest('.card')?.remove();
 host.querySelector('.fpg-refresh')?.remove();host.querySelector('.fpg-alert')?.remove();
 const button=getAppTabButtonById('grades');button?.querySelector('.fpg-nav-badge')?.remove();
}
function facultyPaintConfirmedGradeAlerts(){
 facultyRemoveLegacyGradeAlert();const alerts=facultyPreviousGradeAlerts();document.getElementById('mainContent').insertAdjacentHTML('afterbegin',facultyPendingGradesMarkup(alerts));
 const button=getAppTabButtonById('grades');if(button&&alerts.length)button.insertAdjacentHTML('beforeend','<span class="fpg-nav-badge">'+alerts.reduce((n,a)=>n+a.rows.length,0)+'</span>');
}
const facultyPendingOriginalHome=renderLecturerHomeTab;
renderLecturerHomeTab=function(){
 facultyPendingOriginalHome();if(currentUser?.role!=='lecturer')return;
 facultyRemoveLegacyGradeAlert();const user=currentUser,generation=++facultyGradeAlertGeneration;
 document.getElementById('mainContent').insertAdjacentHTML('afterbegin','<p class="fpg-refresh" role="status">جاري التحقق من آخر رصد محفوظ…</p>');
 void facultyRefreshGradeSnapshot().then(refreshed=>{
  if(!refreshed||currentUser!==user||currentAppTab!=='home'||generation!==facultyGradeAlertGeneration)return;
  facultyPendingOriginalHome();facultyPaintConfirmedGradeAlerts();
 }).catch(error=>{
  if(currentUser!==user||currentAppTab!=='home'||generation!==facultyGradeAlertGeneration)return;
  facultyRemoveLegacyGradeAlert();document.getElementById('mainContent').insertAdjacentHTML('afterbegin','<p class="fpg-refresh" role="status">تعذر التحقق من آخر رصد الآن. أعد فتح الرئيسية للمحاولة مجددًا.</p>');console.warn('Faculty grade snapshot unavailable',error);
 });
};

function facultyOpenPastGrades(encodedKey){
 const key=decodeURIComponent(encodedKey),alert=facultyPreviousGradeAlerts().find(a=>a.subject.key===key);
 if(!alert||currentUser?.role!=='lecturer'){toast('تمت معالجة التنبيه أو لم يعد المقرر متاحًا.');renderLecturerHomeTab();return;}
 facultyOpenArchivedGrade(key);
}
