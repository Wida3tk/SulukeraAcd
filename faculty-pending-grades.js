/* Read-only prior-term reminders; grade entry uses the existing authorized flow. */
function facultyMissingGradeFields(grade){
 const fields=[];for(let week=1;week<=4;week++)for(const [field,label] of [['attend','الحضور'],['hw','الواجب'],['disc','المناقشة']])if(!isCourseworkFieldEntered(grade,'w'+week,field))fields.push(`الأسبوع ${week}: ${label}`);
 if(!isExamEntered(grade))fields.push('الاختبار النهائي');return fields;
}
function facultyPreviousGradeAlerts(){
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'}),terms=Object.values(dbData.semesters||{}),currentKeys=new Set(terms.filter(t=>t.startDate<=today&&t.endDate>=today).flatMap(t=>t.subjects||[]));
 const requests=getLecturerGradeReviewRequests(),alerts=[];
 for(const subject of getLecturerSubjects(true)){
  if(currentKeys.has(subject.key))continue;
  const term=terms.filter(t=>t.endDate&&t.endDate<today&&(t.subjects||[]).includes(subject.key)).sort((a,b)=>b.endDate.localeCompare(a.endDate))[0];if(!term)continue;
  const rows=getSubjectStudents(subject.key).map(student=>({student,missing:facultyMissingGradeFields(getGrade_data(student.fbKey,subject.key)),requests:requests.filter(r=>r.subjectKey===subject.key&&r.studentKey===student.fbKey)})).filter(row=>row.missing.length||row.requests.length);
  if(rows.length)alerts.push({subject,term,rows});
 }
 return alerts.sort((a,b)=>a.term.endDate.localeCompare(b.term.endDate));
}
function facultyPendingGradesMarkup(alerts){
 if(!alerts.length)return '';
 const count=alerts.reduce((n,a)=>n+a.rows.length,0),requestCount=alerts.reduce((n,a)=>n+a.rows.reduce((m,row)=>m+row.requests.length,0),0);
 return `<section class="fpg-alert" aria-labelledby="facultyPastGradesTitle"><header><span class="fpg-icon" aria-hidden="true">!</span><div><small>إجراء عاجل · فصول منتهية</small><h2 id="facultyPastGradesTitle">يرجى استكمال رصد درجات الفصل السابق بشكل عاجل</h2><p>درجات معلّقة تؤخر اكتمال نتائج الطلاب. هذا التنبيه لا يشمل رصد الفصل الحالي.</p></div><div class="fpg-count"><strong>${count}</strong><span>سجل طالب يحتاج إجراء</span>${requestCount?`<small>${requestCount} طلب مراجعة معلّق</small>`:''}</div></header><div class="fpg-items">${alerts.map((alert,i)=>`<details ${i===0?'open':''}><summary><strong>${cwEscape(alert.subject.name)}</strong><span>${cwEscape(alert.subject.batch||'')} · ${alert.rows.length} طالب</span></summary><div class="fpg-period">${cwEscape(alert.term.name||'الفصل السابق')} · انتهى بتاريخ <b dir="ltr">${cwEscape(alert.term.endDate)}</b></div><div class="fpg-students">${alert.rows.map(row=>`<div><strong>${cwEscape(getStudentDisplayName(row.student))}</strong><small>${cwEscape(row.student.id||'')} · ${cwEscape(row.student.batch||'')}</small><span>${row.missing.length?`${row.missing.length} بند درجة لم يُرصد`:'الدرجات مكتملة'}${row.requests.length?' · طلب مراجعة بانتظارك':''}</span><details><summary>تفاصيل المطلوب</summary><p>${cwEscape(row.missing.join('، ')||'راجع طلب تعديل الدرجة المحال من الإدارة.')}</p></details></div>`).join('')}</div><button class="btn-primary" onclick="facultyOpenPastGrades('${encodeURIComponent(alert.subject.key)}')">استكمال الرصد ومعالجة الطلبات ←</button></details>`).join('')}</div></section>`;
}
const facultyPendingOriginalHome=renderLecturerHomeTab;
renderLecturerHomeTab=function(){
 facultyPendingOriginalHome();if(currentUser?.role!=='lecturer')return;
 const host=document.getElementById('mainContent');
 // Current-term missing grades are expected while lectures are underway.
 for(const heading of host.querySelectorAll('.card-title'))if(heading.textContent.includes('تنبيهات الرصد الناقص'))heading.closest('.card')?.remove();
 const alerts=facultyPreviousGradeAlerts();host.insertAdjacentHTML('afterbegin',facultyPendingGradesMarkup(alerts));
 const button=getAppTabButtonById('grades');if(button){button.querySelector('.fpg-nav-badge')?.remove();if(alerts.length)button.insertAdjacentHTML('beforeend',`<span class="fpg-nav-badge">${alerts.reduce((n,a)=>n+a.rows.length,0)}</span>`);}
};
function facultyOpenPastGrades(encodedKey){
 const key=decodeURIComponent(encodedKey),alert=facultyPreviousGradeAlerts().find(a=>a.subject.key===key);
 if(!alert||currentUser?.role!=='lecturer'){toast('تمت معالجة التنبيه أو لم يعد المقرر متاحًا.');renderLecturerHomeTab();return;}
 facultyOpenArchivedGrade(key);
}
