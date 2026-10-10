/* Lecturer presentation only; shared scoring and authorization remain unchanged. */
const facultyGrading = () => currentUser?.role === 'lecturer';
const facultyOriginalHome=cwRenderCourseworkHome;
cwRenderCourseworkHome=function(){facultyOriginalHome();if(facultyGrading()){const heading=cwHost().querySelector('.cw-report-hero h2');if(heading)heading.textContent='رصد الدرجات';}};
const facultyOriginalSummary=cwReportDiscussionSummary;
cwReportDiscussionSummary=function(){const html=facultyOriginalSummary();return facultyGrading()?html.replace('سؤال مناقشة المحاضرة','سؤال المناقشة'):html;};
const facultyOriginalCard = cwReportStudentCard;
cwReportStudentCard = function(s,i){
  if(!facultyGrading())return facultyOriginalCard(s,i);
  const l=cwReport.lesson,d=cwReport.discussions?.find(x=>x.student_key===s.key),p=cwReportTotals(s,l,d),attempts=s.homeworkAttempts?.length||s.result?.attempts||0;
  const score=(v,max)=>v==null?'لم تُرصد':`${cwEscape(v)} <small>/ ${cwEscape(max)}</small>`;
  const tile=(kind,label,value,max,note,enabled)=>`<button class="faculty-grade faculty-${kind}" ${enabled?`onclick="facultyOpenReview('${kind}',${i},this)"`:'disabled'}><span>${label}</span><strong>${score(value,max)}</strong><small>${note}</small></button>`;
  return `<article class="faculty-student"><header><span class="cw-avatar">${cwEscape(cwName(s).slice(0,1))}</span><div><h4>${cwEscape(cwName(s))}</h4><small>${cwEscape(s.id||'')} · ${cwEscape(s.batch||'')}</small></div></header><div class="faculty-grades">${tile('homework','الواجب',p.homework,l.homeworkMax,`${attempts} محاولات · عرض الإجابات`,attempts>0)}${tile('attendance','الحضور',p.attendance,l.attendanceMax,p.attendance==null?'بانتظار رصد الحضور':p.attendance>=l.attendanceMax?'حضور مكتمل':s.reflection?'عرض واجب الحضور المسجل':'لم يُسلّم واجب الحضور المسجل',p.attendance!=null&&p.attendance<l.attendanceMax)}${tile('discussion','المناقشة',p.disc,l.discussionMax,d?'عرض المناقشة ←':'لم تصل مشاركة إلكترونية',!!d)}</div><footer><span>مجموع المحاضرة</span><strong>${p.total==null?'بانتظار اكتمال الرصد':`${p.total} / ${l.attendanceMax+l.homeworkMax+l.discussionMax}`}</strong>${s.reflection?.score!=null&&!s.result?'<small>تعويض الحضور معتمد؛ ينتظر إكمال الواجب الأساسي.</small>':''}</footer></article>`;
};
const facultyOriginalCards=cwRenderReportCards;
cwRenderReportCards=function(){
  if(!facultyGrading())return facultyOriginalCards();
  const selected=cwReport.students.map((s,i)=>({s,i})).filter(({s})=>cwReportSearchMatches(s)&&(!cwReportOnlyActions||cwStudentNeedsAction(s))&&(cwReportFilter==='all'||cwReportFilter.startsWith('discussion')&&cwDiscussionMatches(s,cwReportFilter)||cwReportFilter==='pending'&&s.reflection&&s.reflection.score==null||cwStudentReportState(s)===cwReportFilter)).sort((a,b)=>cwName(a.s).localeCompare(cwName(b.s),'ar'));
  document.getElementById('cwReportCards').innerHTML=`<div class="faculty-student-list">${selected.map(({s,i})=>cwReportStudentCard(s,i)).join('')||'<div class="cw-empty-state">لا توجد أسماء ضمن هذا الاختيار.</div>'}</div>`;
  const eyebrow=cwHost().querySelector('.cw-report-hero .cw-eyebrow');if(eyebrow)eyebrow.textContent='رصد الدرجات';
};
const facultyOriginalLesson=cwHomeLessonCard;
cwHomeLessonCard=function(subject,week){
  let html=facultyOriginalLesson(subject,week);if(!facultyGrading())return html;
  html=html.replace(/<section class="cw-discussion-preview"><h4>.*?<\/h4>(.*?)<\/section>/s,'<details class="cw-discussion-preview faculty-question"><summary>سؤال المناقشة</summary>$1</details>');
  html=html.replace(/<a\b[^>]*>دخول Zoom<\/a>/g,'').replace('متابعة الطلاب والحضور ←','رصد الدرجات ←');return html;
};
let facultyDialogFocus=null,facultyDialogOverflow='',facultyDialogSaving=false;
function facultyCloseReview(){
  if(facultyDialogSaving)return;
  document.getElementById('facultyReviewDialog')?.remove();document.body.style.overflow=facultyDialogOverflow;
  if(facultyDialogFocus?.isConnected)facultyDialogFocus.focus();
}
function facultyOpenReview(kind,i,trigger){
  if(document.getElementById('facultyReviewDialog'))return;
  const s=cwReport.students[i],l=cwReport.lesson;if(!s)return;
  let body='',title='';
  if(kind==='homework'){title='محاولات الواجب';body=cwHomeworkAnswers(s,l).replace('<details ','<details open ');}
  if(kind==='discussion'){title='رصد درجة المناقشة';body=`<details class="faculty-question"><summary>سؤال المناقشة</summary><p dir="auto">${cwEscape(l.discussionPrompt)}</p></details>`+cwDiscussionReviewCard(s,i);}
  if(kind==='attendance'){
    title='واجب الحضور المسجل';let answers=[];try{answers=JSON.parse(s.reflection?.answers_json||'[]');if(!Array.isArray(answers))answers=[];}catch{}
    body=s.reflection?`${answers.map((a,j)=>`<section class="cw-answer"><strong>${cwEscape(CW_REFLECTION_QUESTIONS[j])}</strong><p dir="auto">${cwEscape(a)}</p></section>`).join('')}<div class="cw-review-fields"><label>درجة الحضور من ${l.attendanceMax}<input id="cwReviewScore${i}" type="number" step="1" min="0" max="${l.attendanceMax}" value="${s.reflection.score??''}"></label><label>ملاحظات للطالب<textarea id="cwReviewFeedback${i}">${cwEscape(s.reflection.feedback)}</textarea></label></div><button class="btn-primary" onclick="cwReview('',${i},this)">حفظ درجة الحضور</button>`:'<p>لم يرسل الطالب واجب الحضور المسجل بعد. لا توجد إجابات متاحة للتقييم.</p>';
  }
  facultyDialogFocus=trigger;facultyDialogOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  document.body.insertAdjacentHTML('beforeend',`<div id="facultyReviewDialog" class="faculty-modal" onclick="if(event.target===this)facultyCloseReview()"><section role="dialog" aria-modal="true" aria-labelledby="facultyDialogTitle" tabindex="-1"><header><div><h2 id="facultyDialogTitle">${title}</h2><p>${cwEscape(cwName(s))} · ${cwEscape(l.title)}</p></div><button class="btn-out" aria-label="إغلاق" onclick="facultyCloseReview()">✕</button></header><div class="faculty-modal-body">${body}</div><p id="facultyReviewError" role="alert"></p></section></div>`);
  const dialog=document.getElementById('facultyReviewDialog');dialog.dataset.lesson=l.id;dialog.dataset.student=s.key;
  dialog.querySelector('section').focus();
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();facultyCloseReview();}if(event.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not(:disabled),input,textarea,summary,[tabindex="0"]')];const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.querySelector('section'))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
}
const facultyOriginalDiscussionSave=cwReviewDiscussion,facultyOriginalAttendanceSave=cwReview;
async function facultySaveReview(kind,i,button){
  const dialog=document.getElementById('facultyReviewDialog'),discussion=kind==='discussion',prefix=discussion?'cwDisc':'cwReview',score=document.getElementById(prefix+'Score'+i),feedback=document.getElementById(prefix+'Feedback'+i);
  if(!score.value.trim()||!score.checkValidity()){score.reportValidity();document.getElementById('facultyReviewError').textContent='أدخل درجة صحيحة ضمن الحد المحدد.';return;}
  const lessonId=dialog.dataset.lesson,studentKey=dialog.dataset.student;
  try{facultyDialogSaving=true;button.disabled=true;const r=await cwApi(discussion?'/discussion-review':'/review',{lessonId,studentKey,score:score.value,feedback:feedback.value});facultyDialogSaving=false;facultyCloseReview();cwNotify(r.synced?'تم حفظ الدرجة':'تم حفظ الدرجة؛ المزامنة معلقة');await cwOpenReport(lessonId);}catch(error){facultyDialogSaving=false;button.disabled=false;document.getElementById('facultyReviewError').textContent=error.message;}
}
cwReviewDiscussion=function(key,i,button){return facultyGrading()&&document.getElementById('facultyReviewDialog')?facultySaveReview('discussion',i,button):facultyOriginalDiscussionSave(key,i,button);};
cwReview=function(key,i,button){return facultyGrading()&&document.getElementById('facultyReviewDialog')?facultySaveReview('attendance',i,button):facultyOriginalAttendanceSave(key,i,button);};
