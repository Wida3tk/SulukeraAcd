function professionalApprovedResultsMarkup(results){return Object.values(results||{}).filter(r=>r.approved===true&&r.evaluated===true&&Number.isFinite(r.score)).map(r=>`<section class="professional-approved-result"><div><span class="badge badge-pass">نتيجة معتمدة بعد إكمال التقييم</span><h3>${escapeHtml(r.title||'اختبار إدارة السلوك التنظيمي')}</h3><p>أعلى درجة محفوظة من محاولاتك · ${r.passed?'تم الاجتياز':'يمكن تحسين النتيجة بمحاولة أخرى خلال فترة الإتاحة'}</p></div><strong>${r.score}<small> / 20</small></strong></section>`).join('');}
if(typeof renderStudentProfessionalProgram==='function'){
 const officialProfessionalProgramRender=renderStudentProfessionalProgram;
 renderStudentProfessionalProgram=function(){officialProfessionalProgramRender();const context=getStudentProfessionalContext();if(context)document.querySelector('#mainContent .pro-shell')?.insertAdjacentHTML('afterbegin',professionalApprovedResultsMarkup(context.progress?.examResults));};
}
if(typeof renderStudentProfile==='function'){
 const officialProfessionalProfileRender=renderStudentProfile;
 renderStudentProfile=function(idx){officialProfessionalProfileRender(idx);if(currentUser?.role!=='admin')return;const key=students[idx]?._fbKey,results=professionalProgressData?.[key]?.organizational_behavior?.examResults;document.getElementById('studentProfileContent')?.insertAdjacentHTML('afterbegin',professionalApprovedResultsMarkup(results));};
}
