/* Historical grade entry reuses the original ledger; no records are merged. */
let facultyGradingArchiveMode='current',facultyArchivePeriod='',facultyArchiveSubject='';
function facultyGradingArchiveGroups(){
 return facultyCourseGroups(getLecturerSubjects(true),dbData.semesters,new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'})).finished;
}
function facultyGradingArchiveTabs(){
 return `<div class="cw-report-tabs faculty-archive-tabs" aria-label="فترة الرصد"><button class="${facultyGradingArchiveMode==='current'?'active':''}" onclick="facultyGradingArchiveMode='current';renderAcademicCoursework()">الفصل الحالي</button><button class="${facultyGradingArchiveMode==='finished'?'active':''}" onclick="facultyGradingArchiveMode='finished';renderFacultyGradingArchive()">الفصول المنتهية · عرض ورصد الدرجات</button></div>`;
}
const facultyArchiveOriginalHome=cwRenderCourseworkHome;
cwRenderCourseworkHome=function(){
 if(currentUser?.role==='lecturer'&&facultyGradingArchiveMode==='finished'){renderFacultyGradingArchive();return;}
 facultyArchiveOriginalHome();if(currentUser?.role==='lecturer')cwHost().insertAdjacentHTML('afterbegin',facultyGradingArchiveTabs());
};
function renderFacultyGradingArchive(){
 if(currentUser?.role!=='lecturer')return;
 facultyGradingArchiveMode='finished';
 const groups=facultyGradingArchiveGroups();if(!groups.some(g=>g.key===facultyArchivePeriod))facultyArchivePeriod=groups[0]?.key||'';
 const group=groups.find(g=>g.key===facultyArchivePeriod),offerings=group?group.rows.flatMap(s=>s.offerings||[s]):[];
 if(!offerings.some(s=>s.key===facultyArchiveSubject))facultyArchiveSubject=offerings[0]?.key||'';
 cwHost().innerHTML=`<div class="cw-report-shell">${facultyGradingArchiveTabs()}<section class="cw-report-hero"><span class="cw-eyebrow">أرشيف الرصد · الفصول المنتهية</span><h2>درجات الفصول المنتهية</h2><p>تبقى جميع المقررات متاحة للاطلاع، حتى بعد اكتمال الرصد. يمكن استكمال البنود الناقصة ومعالجة طلبات مراجعة الدرجات.</p>${group?`<div class="cw-report-selectors"><label>الفصل / الفترة الدراسية<select onchange="facultyArchivePeriod=this.value;facultyArchiveSubject='';renderFacultyGradingArchive()">${groups.map(g=>`<option value="${cwEscape(g.key)}" ${g.key===facultyArchivePeriod?'selected':''}>${cwEscape(g.start)} — ${cwEscape(g.end)}</option>`).join('')}</select></label><label>المقرر والدفعة<select onchange="facultyArchiveSubject=this.value;renderFacultyGradingArchive()">${offerings.map(s=>`<option value="${cwEscape(s.key)}" ${s.key===facultyArchiveSubject?'selected':''}>${cwEscape(s.name)} · ${cwEscape(s.batch||'—')}</option>`).join('')}</select></label></div><p>تاريخ البدء: <b dir="ltr">${facultyCourseDate(group.start)}</b> · تاريخ الانتهاء: <b dir="ltr">${facultyCourseDate(group.end)}</b></p>`:''}</section>${group?'<div id="lecSubjContent" style="margin-top:20px"></div>':'<section class="card"><div class="empty">لا توجد مقررات منتهية مسندة إلى حسابك.</div></section>'}</div>`;
 if(facultyArchiveSubject){currentSubjectKey=facultyArchiveSubject;currentBatchName=null;renderGradeInput(facultyArchiveSubject,null);}
}
function facultyOpenArchivedGrade(key){
 const group=facultyGradingArchiveGroups().find(g=>g.rows.some(row=>(row.offerings||[row]).some(s=>s.key===key)));
 if(!group||currentUser?.role!=='lecturer'){toast('المقرر غير متاح ضمن الفصول المنتهية المسندة لحسابك.');return;}
 facultyGradingArchiveMode='finished';facultyArchivePeriod=group.key;facultyArchiveSubject=key;currentAppTab='coursework';
 document.querySelectorAll('.app-tab').forEach(b=>b.classList.toggle('active',b===getAppTabButtonById('coursework')));
 renderFacultyGradingArchive();
}
const facultyArchiveOriginalLedger=renderLecDashboard;
renderLecDashboard=function(){
 facultyArchiveOriginalLedger();if(currentUser?.role!=='lecturer')return;
 document.getElementById('mainContent').insertAdjacentHTML('afterbegin','<section class="card"><div class="card-title">الفصول السابقة</div><p>يمكنك الاطلاع على درجات المقررات المنتهية واستكمال الرصد، حتى بعد انتهاء الفصل.</p><button class="btn-out" onclick="facultyOpenArchiveFromLedger()">عرض ورصد درجات الفصول المنتهية ←</button></section>');
};
function facultyOpenArchiveFromLedger(){
 currentAppTab='coursework';facultyGradingArchiveMode='finished';document.querySelectorAll('.app-tab').forEach(b=>b.classList.toggle('active',b===getAppTabButtonById('coursework')));renderFacultyGradingArchive();
}
