function professionalApprovedResultsMarkup(results){return Object.values(results||{}).filter(r=>r.approved===true&&r.evaluated===true&&Number.isFinite(r.score)).map(r=>`<section class="professional-approved-result"><div><span class="badge badge-pass">نتيجة معتمدة بعد إكمال التقييم</span><h3>${escapeHtml(r.title||'اختبار إدارة السلوك التنظيمي')}</h3><p>أعلى درجة محفوظة من محاولاتك · ${r.passed?'تم الاجتياز':'يمكن تحسين النتيجة بمحاولة أخرى خلال فترة الإتاحة'}</p></div><strong>${r.score}<small> / 20</small></strong></section>`).join('');}
function openProfessionalUnitExam(){switchAppTab('exams',Array.from(document.querySelectorAll('#appTabs .app-tab')).find(tab=>tab.getAttribute('onclick')?.includes("'exams'")));}
function professionalUnitTwoExamNotice(now=Date.now()){
 if(now<Date.parse('2026-11-04T00:00:00+03:00')||now>Date.parse('2026-11-05T22:00:00+03:00'))return '';
 return `<section class="obm-exam-intro" aria-label="موعد اختبار الوحدة الثانية"><span class="obm-exam-eyebrow">اختبار الوحدة الثانية · OBM-P 102</span><h3>اختبار إدارة الأداء التنظيمي</h3><p>متاح من الأربعاء 4 نوفمبر الساعة 6 مساءً حتى الخميس 5 نوفمبر الساعة 10 مساءً بتوقيت السعودية.</p><div class="obm-exam-facts"><span>20 سؤالًا · 20 درجة</span><span>30 دقيقة لكل محاولة</span><span>تُحفظ أعلى نتيجة</span></div><button type="button" class="btn btn-primary" style="margin-top:16px" onclick="openProfessionalUnitExam()">الانتقال إلى الاختبار</button></section>`;
}
if(typeof renderStudentHomeTab==='function'){
 const officialProfessionalHomeRender=renderStudentHomeTab;
 renderStudentHomeTab=function(){officialProfessionalHomeRender();if(currentUser?.role==='student'&&getStudentProfessionalContext())document.getElementById('mainContent')?.insertAdjacentHTML('afterbegin',professionalUnitTwoExamNotice());};
}
if(typeof renderStudentProfessionalProgram==='function'){
 const officialProfessionalProgramRender=renderStudentProfessionalProgram;
 renderStudentProfessionalProgram=function(){officialProfessionalProgramRender();const context=getStudentProfessionalContext();if(context)document.querySelector('#mainContent .pro-shell')?.insertAdjacentHTML('afterbegin',professionalUnitTwoExamNotice()+professionalApprovedResultsMarkup(context.progress?.examResults));};
}
if(typeof renderStudentProfile==='function'){
 const officialProfessionalProfileRender=renderStudentProfile;
 renderStudentProfile=function(idx){officialProfessionalProfileRender(idx);if(currentUser?.role!=='admin')return;const key=students[idx]?._fbKey,results=professionalProgressData?.[key]?.organizational_behavior?.examResults;document.getElementById('studentProfileContent')?.insertAdjacentHTML('afterbegin',professionalApprovedResultsMarkup(results));};
}
