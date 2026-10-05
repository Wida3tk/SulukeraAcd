/* Academic coursework; all authorization and scoring are enforced by the worker. */
const CW_REFLECTION_QUESTIONS = [
  "اذكر ثلاثة موضوعات رئيسية تمت مناقشتها في المحاضرة",
  "اذكر أهم مفهوم أو معلومة جديدة تعلمتها من المحاضرة، واشرحها باختصار",
  "كيف يمكن تطبيق أحد المفاهيم التي تناولتها المحاضرة في الممارسة المهنية أو الحياة اليومية؟",
];
let cwData = null,
  cwSelectedSubject = "",
  cwReport = null,
  cwPreview = null,
  cwActiveLesson = null,
  cwQuestionCount = 0,
  cwRequestId = null;
const cwEscape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cwNotify = (v) =>
  typeof showToast === "function" ? showToast(v) : toast(v);
const cwHost = () =>
  document.getElementById("academicCourseworkContent") ||
  document.getElementById("mainContent");
const cwDate = (v) =>
  v
    ? new Date(v).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit' })
    : "لم يحدد";
const cwLocal = (v) =>
  v ? new Date(Date.parse(v) + 3 * 3600000).toISOString().slice(0, 16) : "";
const cwIso = (v) => (v ? `${v}:00+03:00` : "");
const cwName = (s) =>
  [s.firstName, s.midName, s.lastName].filter(Boolean).join(" ") ||
  s.name ||
  s.id ||
  s.key;
const cwLink = (url, label) =>
  /^https:\/\//i.test(url || "")
    ? `<a class="btn-out" style="display:inline-block" href="${cwEscape(url)}" target="_blank" rel="noopener">${label}</a>`
    : "";
async function cwApi(path, body) {
  const user = firebase.auth().currentUser;
  if (!user) throw Error("انتهت جلسة الدخول");
  const response = await fetch(EXAM_API_BASE + "/coursework" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + (await user.getIdToken()),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "تعذر الاتصال");
  return data;
}
async function renderAcademicCoursework() {
  const host = cwHost();
  if (!host) return;
  host.innerHTML =
    '<div class="card"><div class="empty">جاري تحميل المحاضرات والواجبات...</div></div>';
  try {
    cwData = await cwApi("");
    const role = currentUser.role,
      admin = role === "admin";
    if(role!=='student'){cwRenderCourseworkHome();return;}
    host.innerHTML = cwStudentCoursesMarkup();
  } catch (e) {
    host.innerHTML = `<div class="card"><div class="alert alert-warn">تعذر تحميل الواجبات. ${cwEscape(e.message)}</div><button class="btn" onclick="renderAcademicCoursework()">إعادة المحاولة</button></div>`;
  }
}
let cwHomeBatch='';
function cwRenderCourseworkHome(){
  const selected=cwData.subjects.find(s=>s.key===cwSelectedSubject);
  if(selected)cwHomeBatch=selected.batch;
  const batches=[...new Set(cwData.subjects.map(s=>s.batch))],options=cwData.subjects.filter(s=>s.batch===cwHomeBatch),lessons=selected?cwData.lessons.filter(l=>l.subject_key===selected.key):[],now=Date.now(),open=lessons.filter(l=>l.status==='published'&&Date.parse(l.opens_at)<=now&&Date.parse(l.closes_at)>=now).length;
  cwHost().innerHTML=`<div class="cw-report-shell cw-home-shell"><section class="cw-report-hero"><span class="cw-eyebrow">إدارة التعلّم · الفصل الحالي</span><h2>المحاضرات والواجبات</h2><p>من إعداد المحاضرة إلى متابعة الحضور والتقييم، كل خطوة في مكانها.</p><div class="cw-report-selectors cw-home-selectors"><label>اختر الدفعة<select onchange="cwHomeBatch=this.value;cwSelectedSubject='';cwRenderCourseworkHome()"><option value="">— اختر الدفعة —</option>${batches.map(b=>`<option value="${cwEscape(b)}" ${b===cwHomeBatch?'selected':''}>${cwEscape(b)}</option>`).join('')}</select></label><label>اختر مقرر الفصل الحالي<select ${!cwHomeBatch?'disabled':''} onchange="cwSelectedSubject=this.value;cwRenderCourseworkHome()"><option value="">— اختر المقرر —</option>${options.map(s=>`<option value="${cwEscape(s.key)}" ${s.key===cwSelectedSubject?'selected':''}>${cwEscape(s.name)}</option>`).join('')}</select></label></div></section>${selected?`<div class="cw-report-kpis cw-home-kpis">${[[4,'محاضرات المقرر'],[lessons.length,'محاضرات معدّة'],[open,'واجبات متاحة الآن'],[lessons.filter(l=>l.status==='published'&&Date.parse(l.opens_at)>now).length,'واجبات قادمة']].map(([n,label])=>`<div><strong>${n}</strong><span>${label}</span></div>`).join('')}</div><section class="card"><div class="cw-home-heading"><div><span class="cw-eyebrow">${cwEscape(selected.batch)}</span><h3>${cwEscape(selected.name)}</h3><p class="cw-muted">اختَر المحاضرة لعرض بطاقات الطلاب والحضور والمناقشات والتعويضات.</p></div><span class="cw-home-tag">المواعيد بتوقيت السعودية</span></div><div class="cw-lesson-grid">${[1,2,3,4].map(week=>cwHomeLessonCard(selected,week)).join('')}</div></section>`:`<section class="cw-home-empty"><div class="cw-home-empty-icon">▦</div><h3>${cwHomeBatch?'اختَر المقرر لنبدأ':'اختَر الدفعة والمقرر'}</h3><p>${cwData.subjects.length?'ستظهر هنا محاضرات المقرر وأدوات الإعداد والمتابعة، دون فتح جميع المقررات معًا.':'لا توجد مقررات حالية مرتبطة بحسابك.'}</p></section>`}<footer class="cw-home-footer"><span>المزامنة تعيد رصد النتائج المحفوظة فقط، ولا تغيّر إجابات الطلاب.</span><button class="btn-out" onclick="cwRetrySync()">مزامنة الدرجات المعلقة</button></footer></div>`;
}
function cwStudentCoursesMarkup(){
  return `<div class="cw-student-courses"><section class="cw-report-hero"><span class="cw-eyebrow">خطوتك التالية نحو الإنجاز</span><h2>مقرراتي ومحاضراتي</h2><p>محاضراتك، واجباتك ومناقشاتك في مكان واحد.</p><span class="cw-student-timezone">جميع المواعيد بتوقيت السعودية</span></section>${cwData.subjects.length?cwData.subjects.map(subject=>{
    const lessons=cwData.lessons.filter(l=>l.subject_key===subject.key),openCount=lessons.filter(cwStudentLessonOpen).length;
    return `<details class="cw-course-fold"><summary><span class="cw-course-icon">▤</span><span class="cw-course-title"><strong>${cwEscape(subject.name)}</strong><small>${cwEscape(subject.batch)} · الفصل الحالي</small></span><span class="cw-course-badge">${openCount?`${openCount} واجب متاح`:'متابعة المحاضرات'}</span><span class="cw-fold-arrow">⌄</span></summary><div class="cw-course-body"><div class="cw-student-lesson-grid">${[1,2,3,4].map(week=>cwStudentLessonCard(lessons.find(l=>l.week===week),week)).join('')}</div></div></details>`;
  }).join(''):'<div class="cw-home-empty">لا توجد مقررات حالية مرتبطة بالحساب.</div>'}</div>`;
}
function cwStudentLessonOpen(l){return l.status==='published'&&Date.now()>=Date.parse(l.opens_at)&&Date.now()<=Date.parse(l.closes_at);}
function cwStudentLessonCard(l,week){
  if(!l||l.status!=='published')return `<article class="cw-student-lesson cw-student-upcoming"><header><span class="cw-lesson-number">${String(week).padStart(2,'0')}</span><span class="cw-status">قريبًا</span></header><h3>المحاضرة ${week}</h3><p class="cw-muted">ستظهر تفاصيل المحاضرة ومتطلباتها عند إتاحتها.</p></article>`;
  const open=cwStudentLessonOpen(l),upcoming=Date.now()<Date.parse(l.opens_at),attendance=l.attendance,reflection=l.reflection;
  const attendanceText=!attendance?'الحضور بانتظار الرصد':reflection?.score!=null?`درجة الحضور بعد التعويض: ${reflection.score}/${l.attendanceMax}`:attendance.percent>=80?`الحضور مكتمل · ${l.attendanceMax}/${l.attendanceMax}`:`الحضور: ${cwAttendancePoints(attendance.percent,l.attendanceMax)}/${l.attendanceMax} · ${reflection?'التعويض بانتظار التقييم':'يمكنك تعويض الدرجة بمشاهدة التسجيل'}`;
  return `<article class="cw-student-lesson ${open?'cw-student-open':'cw-student-upcoming'}"><header><span class="cw-lesson-number">${String(week).padStart(2,'0')}</span><span class="cw-status">${open?'متاح الآن':upcoming?'لم يفتح بعد':'انتهى التسليم'}</span></header><h3>المحاضرة ${week}</h3><div class="cw-lesson-resources">${cwLink(l.zoom_url,'دخول اللقاء')}${cwLink(l.pdf_url,'مشاهدة الملف')}${cwLink(l.recording_url,'مشاهدة التسجيل')}</div><div class="cw-student-deadline"><span>آخر موعد للتسليم</span><strong>${cwDate(l.closes_at)}</strong><small>يفتح الواجب: ${cwDate(l.opens_at)}</small></div><div class="cw-student-result"><span>واجب المحاضرة</span><strong>${l.result?`${l.result.score}/${l.homeworkMax}`:'لم يُحل بعد'}</strong></div><p class="cw-student-attendance">${attendanceText}</p><div class="cw-student-actions">${open?`<button class="btn-primary" onclick="cwSolve('${l.id}')">${l.result?'إعادة المحاولة':'حل واجب المحاضرة'} ←</button>`:`<p class="cw-muted">${upcoming?'يُتاح الحل في الموعد الموضح أعلاه.':'انتهت فترة تسليم الواجب.'}</p>`}${attendance&&attendance.percent<80&&reflection?.score==null&&open?`<button class="btn-out" onclick="cwReflection('${l.id}')">${reflection?'تعديل إجابة التعويض':'تعويض درجة الحضور'}</button>`:''}</div>${l.discussionPrompt?cwDiscussionCard(l,open):''}${reflection?.feedback?`<p class="cw-muted">${cwEscape(reflection.feedback)}</p>`:''}</article>`;
}
function cwHomeLessonCard(subject,week){
  const l=cwData.lessons.find(l=>l.subject_key===subject.key&&l.week===week),admin=currentUser.role==='admin',now=Date.now();
  const state=!l?'empty':l.status!=='published'?'draft':now<Date.parse(l.opens_at)?'upcoming':now>Date.parse(l.closes_at)?'closed':'open';
  const labels={empty:'لم تُعدّ بعد',draft:'مسودة',upcoming:'مجدول',closed:'انتهت فترة الواجب',open:'الواجب متاح الآن'};
return `<article class="cw-lesson-card cw-lesson-${state}"><header><div class="cw-lesson-number">${String(week).padStart(2,'0')}</div><span class="cw-status">${labels[state]}</span></header><h3>المحاضرة ${week}</h3><p class="cw-lesson-subtitle">${cwEscape(subject.name)}</p>${l?`<div class="cw-lesson-dates"><div><span>فتح الواجب</span><strong>${cwDate(l.opens_at)}</strong></div><div><span>إغلاق الواجب</span><strong>${cwDate(l.closes_at)}</strong></div></div><div class="cw-lesson-weight"><span>الحضور <strong>${l.attendanceMax}</strong></span><span>الواجب <strong>${l.homeworkMax}</strong></span><span>المناقشة <strong>${l.discussionMax}</strong></span></div><section class="cw-discussion-preview"><h4>سؤال المناقشة · ${l.discussionMax} درجات</h4><p>${l.discussionPrompt?cwEscape(l.discussionPrompt):'لم يُضف سؤال المناقشة بعد.'}</p></section><div class="cw-lesson-resources">${cwLink(l.zoom_url,'دخول Zoom')}${cwLink(l.pdf_url,'مشاهدة الملف')}${cwLink(l.recording_url,'مشاهدة التسجيل')}</div><div class="cw-lesson-actions"><button class="btn-primary" onclick="cwOpenReport('${l.id}')">متابعة الطلاب والحضور ←</button>${admin?`<button class="btn-out" onclick="cwEditLesson('${subject.key}',${week})">تعديل الإعدادات</button>`:''}</div>`:`<p class="cw-muted cw-lesson-placeholder">أضف الأسئلة وروابط المحاضرة وحدّد موعد إتاحة الواجب، ثم انشره للطلاب.</p>${admin?`<button class="btn-primary" onclick="cwEditLesson('${subject.key}',${week})">إعداد المحاضرة والواجب</button>`:'<p class="cw-muted">بانتظار إعداد المحاضرة من الإدارة.</p>'}`}</article>`;
}
function cwEditLesson(subjectKey, week) {
  const l =
      cwData.lessons.find(
        (x) => x.subject_key === subjectKey && x.week === week,
      ) || {},
    qs = l.questions || cwData.templates?.find(t=>t.courseKey===cwData.subjects.find(s=>s.key===subjectKey)?.courseKey && t.week===week)?.questions || [{ prompt: "", choices: ["", "", "", ""], correct: 0 }];
  cwHost().innerHTML = `<section class="card"><h3>إعداد المحاضرة ${week} والواجب</h3><div class="field"><label>العنوان</label><input id="cwTitle" value="${cwEscape(l.title || `المحاضرة ${week}`)}"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>فتح الواجب — السعودية</label><input id="cwOpens" type="datetime-local" value="${cwLocal(l.opens_at)}"></div><div class="field"><label>إغلاق الواجب — السعودية</label><input id="cwCloses" type="datetime-local" value="${cwLocal(l.closes_at)}"></div></div>${[
    ["Zoom", "رابط Zoom", l.zoom_url],
    ["Recording", "رابط التسجيل", l.recording_url],
    ["Pdf", "رابط الملف", l.pdf_url],
  ]
    .map(
      ([key, label, v]) =>
        `<div class="field"><label>${label}</label><input id="cw${key}" value="${cwEscape(v)}"></div>`,
    )
    .join(
      "",
    )}<div class="field"><label>مدة اللقاء الفعلية بالدقائق (لحساب الحضور)</label><input id="cwDuration" type="number" min="1" value="${l.duration_minutes || 120}"></div><div class="field"><label>حالة الواجب</label><select id="cwStatus"><option value="draft">مسودة</option><option value="published" ${l.status === "published" ? "selected" : ""}>منشور</option></select></div><p>درجة الواجب ${l.homeworkMax || (cwData.subjects.find(s=>s.key===subjectKey)?.courseKey==='course_07'?6:cwData.maxHomework)}، والمحاولات غير محدودة حتى الإغلاق. لا يمكن تغيير الأسئلة بعد وجود تسليمات.</p><div id="cwQuestions">${qs.map((q, i) => cwQuestionEditor(q, i)).join("")}</div><button class="btn" onclick="cwAddQuestion()">إضافة سؤال</button><button class="btn btn-primary" onclick="cwSaveLesson('${subjectKey}',${week},this)">حفظ المحاضرة والواجب</button><button class="btn" onclick="renderAcademicCoursework()">رجوع</button></section>`;
  cwQuestionCount = qs.length;
  const assessmentTemplate=cwData.assessmentTemplates?.find(t=>t.course_key===cwData.subjects.find(s=>s.key===subjectKey)?.courseKey&&t.week===week);
  document.getElementById('cwQuestions').insertAdjacentHTML('beforebegin',`<section class="cw-discussion-preview"><h4>سؤال المناقشة · ${l.discussionMax ?? assessmentTemplate?.discussion_max ?? cwData.maxDiscussion} درجات</h4><textarea id="cwDiscussionPrompt" placeholder="اكتب سؤال مناقشة المحاضرة هنا">${cwEscape(l.discussionPrompt ?? assessmentTemplate?.discussion_prompt ?? '')}</textarea><p class="cw-muted">يُحفظ السؤال كأساس للمقرر والمحاضرة للدفعات القادمة. لا يمكن تغييره بعد وصول مشاركات الطلاب.</p></section>`);
}
function cwQuestionEditor(q, i) {
  return `<fieldset class="cw-question-editor" style="border:1px solid #dbe5ff;border-radius:14px;margin:12px 0;padding:14px"><legend>السؤال ${i + 1}</legend><textarea class="cw-prompt" placeholder="نص السؤال" style="width:100%;font-family:inherit">${cwEscape(q.prompt)}</textarea>${q.choices.map((choice, j) => `<div style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="radio" name="cwCorrect${i}" value="${j}" ${q.correct === j ? "checked" : ""}><input class="cw-choice" value="${cwEscape(choice)}" placeholder="الإجابة ${j + 1}" style="flex:1"></div>`).join("")}</fieldset>`;
}
function cwAddQuestion() {
  document
    .getElementById("cwQuestions")
    .insertAdjacentHTML(
      "beforeend",
      cwQuestionEditor(
        { prompt: "", choices: ["", "", "", ""], correct: 0 },
        cwQuestionCount++,
      ),
    );
}
async function cwSaveLesson(subjectKey, week, button) {
  const questions = [...document.querySelectorAll(".cw-question-editor")].map(
    (el) => ({
      prompt: el.querySelector(".cw-prompt").value,
      choices: [...el.querySelectorAll(".cw-choice")].map((x) => x.value),
      correct: Number(el.querySelector("input[type=radio]:checked")?.value),
    }),
  );
  try {
    button.disabled = true;
    await cwApi("/lesson", {
      subjectKey,
      week,
      title: document.getElementById("cwTitle").value,
      opensAt: cwIso(document.getElementById("cwOpens").value),
      closesAt: cwIso(document.getElementById("cwCloses").value),
      zoomUrl: document.getElementById("cwZoom").value.trim(),
      recordingUrl: document.getElementById("cwRecording").value.trim(),
      pdfUrl: document.getElementById("cwPdf").value.trim(),
      durationMinutes: Number(document.getElementById("cwDuration").value),
      status: document.getElementById("cwStatus").value,
      questions,
      discussionPrompt: document.getElementById('cwDiscussionPrompt').value.trim(),
    });
    cwNotify("تم حفظ المحاضرة والواجب");
    await renderAcademicCoursework();
  } catch (e) {
    cwNotify(e.message);
    button.disabled = false;
  }
}
async function cwSolve(id) {
  try {
    const data = await cwApi("/questions", { lessonId: id });
    cwActiveLesson = id;
    cwQuestionCount = data.questions.length;
    cwRequestId = crypto.randomUUID();
    cwHost().innerHTML = `<section class="card"><h3>واجب المحاضرة</h3><p>يمكنك إعادة المحاولة حتى ${cwDate(data.closesAt)}. تُعتمد أعلى نتيجة.</p>${data.questions.map((q, i) => `<fieldset style="padding:16px;border:1px solid #dbe5ff;border-radius:14px;margin-bottom:14px"><legend>${i + 1}. ${cwEscape(q.prompt)}</legend>${q.choices.map((choice, j) => `<label style="display:flex;gap:8px;padding:9px"><input type="radio" name="cwAnswer${i}" value="${j}">${cwEscape(choice)}</label>`).join("")}</fieldset>`).join("")}<button class="btn-primary" onclick="cwSubmit(this)">تسليم الواجب</button><button class="btn-out" onclick="renderAcademicCoursework()">رجوع</button></section>`;
  } catch (e) {
    cwNotify(e.message);
  }
}
function cwDiscussionCard(l,open){
  if(Date.now()<Date.parse(l.opens_at))return `<div class="cw-student-discussion"><div class="cw-student-discussion-coming"><strong>مناقشة المحاضرة</strong><span>تُتاح عند فتح الواجب · ${l.discussionMax} درجات</span></div></div>`;
  return `<details class="cw-student-discussion"><summary><span>مناقشة المحاضرة</span><span class="cw-discussion-label">${l.discussion?.score!=null?`${l.discussion.score}/${l.discussionMax}`:l.discussion?'تمت المشاركة':`${l.discussionMax} درجات`}</span><span class="cw-fold-arrow">⌄</span></summary><div class="cw-student-discussion-body"><div class="cw-discussion-question"><strong>سؤال المناقشة</strong><p>${cwEscape(l.discussionPrompt)}</p></div>${l.discussion?.score!=null?`<p>درجتك: ${l.discussion.score}/${l.discussionMax}</p><p class="cw-saved-answer">${cwEscape(l.discussion.answer)}</p><p>${cwEscape(l.discussion.feedback)}</p>`:open?`<label for="cwDiscussion_${l.id}">مشاركتك</label><textarea id="cwDiscussion_${l.id}" placeholder="اكتب إجابتك بأسلوبك، مع مثال يوضح فكرتك…">${cwEscape(l.discussion?.answer||'')}</textarea><button class="btn-primary" onclick="cwSendDiscussion('${l.id}',this)">${l.discussion?'تحديث المشاركة':'إرسال المشاركة'}</button>${l.discussion?'<p class="cw-muted">تم حفظ مشاركتك، بانتظار التقييم.</p>':''}`:`${l.discussion?`<p class="cw-saved-answer">${cwEscape(l.discussion.answer)}</p><p class="cw-muted">تم حفظ مشاركتك، بانتظار التقييم.</p>`:'<p class="cw-muted">انتهت فترة إرسال المناقشة.</p>'}`}</div></details>`;
}
async function cwSendDiscussion(id,button){
  try{button.disabled=true;await cwApi('/discussion',{lessonId:id,answer:document.getElementById('cwDiscussion_'+id).value});cwNotify('تم حفظ مشاركتك');await renderAcademicCoursework();}catch(e){cwNotify(e.message);button.disabled=false;}
}
function cwDiscussionReviewCard(s,i){
  const d=cwReport.discussions?.find(d=>d.student_key===s.key);
  if(!d)return '';
  return `<section style="padding:14px;margin:12px 0;background:#f4f2ff;border-radius:12px"><h4>مناقشة المحاضرة</h4><p>${cwEscape(cwReport.lesson.discussionPrompt)}</p><p style="white-space:pre-wrap;line-height:1.9">${cwEscape(d.answer)}</p><label>التقييم من ${cwReport.lesson.discussionMax}</label><input id="cwDiscScore${i}" type="number" min="0" max="${cwReport.lesson.discussionMax}" value="${d.score??''}"><textarea id="cwDiscFeedback${i}" style="width:100%;font:inherit" placeholder="تعليق المحاضر">${cwEscape(d.feedback)}</textarea><button class="btn" onclick="cwReviewDiscussion('${s.key}',${i},this)">حفظ تقييم المناقشة</button></section>`;
}
async function cwReviewDiscussion(key,i,button){
  try{button.disabled=true;const r=await cwApi('/discussion-review',{lessonId:cwActiveLesson,studentKey:key,score:document.getElementById('cwDiscScore'+i).value,feedback:document.getElementById('cwDiscFeedback'+i).value});cwNotify(r.synced?'تم رصد درجة المناقشة':'تم حفظ التقييم؛ مزامنة الدرجة معلقة');await cwOpenReport(cwActiveLesson);}catch(e){cwNotify(e.message);button.disabled=false;}
}
async function cwSubmit(button) {
  const answers = Array.from({ length: cwQuestionCount }, (_, i) => {
    const checked = document.querySelector(`input[name=cwAnswer${i}]:checked`);
    return checked ? Number(checked.value) : null;
  });
  if (answers.includes(null)) return cwNotify("أجب عن جميع الأسئلة");
  try {
    button.disabled = true;
    const result = await cwApi("/submit", {
      lessonId: cwActiveLesson,
      answers,
      requestId: cwRequestId,
    });
    cwNotify(
      `نتيجتك ${result.score}/${(cwData.lessons.find(l=>l.id===cwActiveLesson)?.homeworkMax||cwData.maxHomework)} · المعتمد ${result.bestScore}/${(cwData.lessons.find(l=>l.id===cwActiveLesson)?.homeworkMax||cwData.maxHomework)}${result.synced ? "" : " · تم الحفظ والرصد بانتظار المزامنة"}`,
    );
    if(result.synced){
      try{const snapshot=await firebase.database().ref('grades').orderByChild('studentKey').equalTo(currentUser.fbKey).get();dbData.grades=snapshot.val()||{};}catch(error){console.warn('coursework grades refresh',error);}
    }
    await renderAcademicCoursework();
  } catch (e) {
    cwNotify(e.message);
    button.disabled = false;
  }
}
function cwReflection(id) {
  const l = cwData.lessons.find((x) => x.id === id),
    answers = l.reflection ? JSON.parse(l.reflection.answers_json) : [];
  cwHost().innerHTML = `<section class="card"><h3>تعويض حضور ${cwEscape(l.title)}</h3>${cwLink(l.recording_url, "مشاهدة التسجيل")}<p>لتعويض درجة الحضور، يرجى مشاهدة المحاضرة بشكل مسجل والإجابة على الأسئلة التالية. يراجع المحاضر إجابتك ويعدّل درجة الحضور.</p>${CW_REFLECTION_QUESTIONS.map((q, i) => `<div class="field"><label>${q}</label><textarea id="cwReflection${i}" style="width:100%;min-height:130px;font-family:inherit">${cwEscape(answers[i] || "")}</textarea></div>`).join("")}<button class="btn-primary" onclick="cwSendReflection('${id}',this)">إرسال الإجابة</button><button class="btn-out" onclick="renderAcademicCoursework()">رجوع</button></section>`;
}
function cwAttendancePoints(percent,max){return max===3?(percent>=80?3:percent>=50?2:percent>0?1:0):percent>=80?max:0;}
async function cwSendReflection(id, button) {
  try {
    button.disabled = true;
    await cwApi("/reflection", {
      lessonId: id,
      answers: [0, 1, 2].map(
        (i) => document.getElementById(`cwReflection${i}`).value,
      ),
    });
    cwNotify("تم إرسال تعويض الحضور للمراجعة");
    await renderAcademicCoursework();
  } catch (e) {
    cwNotify(e.message);
    button.disabled = false;
  }
}
let cwReportFilter='all',cwReportOnlyActions=false;
async function cwOpenReport(id) {
  try {
    cwReport = await cwApi("/report", { lessonId: id });
    cwActiveLesson = id;
    cwRenderReport();
  } catch(e) {cwNotify(e.message);}
}
function cwStudentReportState(s){
  if(s.reflection?.score!=null)return 'reviewed';
  if(!s.attendance)return 'unrecorded';
  return s.attendance.percent>=80?'live':s.attendance.percent>0?'partial':'absent';
}
function cwStudentNeedsAction(s){
  const discussion=cwReport.discussions?.find(d=>d.student_key===s.key);
  return !!((s.reflection&&s.reflection.score==null)||(discussion&&discussion.score==null));
}
function cwDiscussionMatches(s,filter){
  const d=cwReport.discussions?.find(item=>item.student_key===s.key);
  return filter==='discussions'?!!d:filter==='discussionPending'?!!d&&d.score==null:false;
}
function cwReportDiscussionSummary(){
  const submissions=(cwReport.discussions||[]).filter(d=>cwReport.students.some(s=>s.key===d.student_key));
  const pending=submissions.filter(d=>d.score==null).length;
  return `<section class="card cw-discussion-preview"><h3>مناقشة المحاضرة · ${cwReport.lesson.discussionMax} درجات</h3><p>${cwEscape(cwReport.lesson.discussionPrompt||'لم يُضف سؤال المناقشة لهذه المحاضرة بعد.')}</p><div class="cw-discussion-stats"><span>المشاركات المستلمة: <strong>${submissions.length}</strong></span><span>بانتظار التقييم: <strong>${pending}</strong></span><span>تم التقييم: <strong>${submissions.length-pending}</strong></span></div><div class="cw-lesson-actions"><button class="btn-primary" onclick="cwReportFilter='discussions';cwReportOnlyActions=false;cwRenderReport()">عرض إجابات المناقشة</button><button class="btn-out" onclick="cwReportFilter='discussionPending';cwReportOnlyActions=false;cwRenderReport()">مناقشات تحتاج تقييمًا</button></div><p class="cw-muted">افتح مشاركة الطالب أسفل بطاقته لقراءة الإجابة ورصد الدرجة أو تعديلها.</p></section>`;
}
function cwReportTotals(s,l,discussion){
  const original=s.attendance?cwAttendancePoints(s.attendance.percent,l.attendanceMax):null;
  const attendance=s.reflection?.score??original,homework=s.result?.score??null,disc=discussion?.score??null;
  return {original,attendance,homework,disc,total:attendance!=null&&homework!=null&&disc!=null?attendance+homework+disc:null};
}
function cwReportStudentCard(s,i){
  const l=cwReport.lesson,d=cwReport.discussions?.find(d=>d.student_key===s.key),points=cwReportTotals(s,l,d),state=cwStudentReportState(s);
  const statuses={live:'حضور مباشر مكتمل',partial:'حضور جزئي',absent:'غياب',unrecorded:'لم يُرصد الحضور',reviewed:'تعويض معتمد'};
  const value=(v,max)=>v==null?'<span class="cw-muted">بانتظار الرصد / التقييم</span>':`<strong>${v}<small> / ${max}</small></strong>`;
  const reflection=s.reflection?`<details class="cw-review-detail"><summary>تعويض الحضور · ${s.reflection.score==null?'بانتظار التصحيح':'تم الاعتماد'}</summary><div class="cw-review-body">${JSON.parse(s.reflection.answers_json).map((a,j)=>`<div class="cw-answer"><strong>${cwEscape(CW_REFLECTION_QUESTIONS[j])}</strong><p>${cwEscape(a)}</p></div>`).join('')}<div class="cw-review-fields"><label>درجة الحضور الجديدة (من ${l.attendanceMax})<input id="cwReviewScore${i}" type="number" step="1" min="0" max="${l.attendanceMax}" value="${s.reflection.score??''}"></label><label>تعليق المحاضر<textarea id="cwReviewFeedback${i}" placeholder="اكتب ملاحظتك للطالب">${cwEscape(s.reflection.feedback)}</textarea></label></div><button class="btn-primary" onclick="cwReview('${s.key}',${i},this)">حفظ درجة الحضور</button>${s.reflection.reviewed_at?`<p class="cw-muted">آخر اعتماد: ${cwDate(s.reflection.reviewed_at)}</p>`:''}</div></details>`:`${state==='absent'||state==='partial'?'<div class="cw-followup-note">لم يرسل تعويض الحضور بعد · يمكنه مشاهدة التسجيل والإجابة من مقرراتي.</div>':''}`;
  return `<article class="cw-student-card cw-state-${state}"><header><div class="cw-avatar">${cwEscape(cwName(s).trim().slice(0,1))}</div><div><h4>${cwEscape(cwName(s))}</h4><p class="cw-muted">${cwEscape(s.id||'')} · ${cwEscape(s.batch||'')}</p></div><span class="cw-status">${statuses[state]}</span></header><div class="cw-attendance-line"><span>الحضور المباشر</span><strong>${s.attendance?s.attendance.percent+'%':'لم يُرصد'}</strong></div><div class="cw-progress"><span style="width:${s.attendance?.percent??0}%"></span></div><div class="cw-grade-grid"><div><span>الحضور</span>${value(points.attendance,l.attendanceMax)}</div><div><span>الواجب</span>${value(points.homework,l.homeworkMax)}</div><div><span>المناقشة</span>${value(points.disc,l.discussionMax)}</div></div><div class="cw-total"><span>مجموع المحاضرة</span>${points.total==null?'<strong>بانتظار اكتمال التقييم</strong>':`<strong>${points.total}<small> / ${l.attendanceMax+l.homeworkMax+l.discussionMax}</small></strong>`}</div>${state==='reviewed'?`<div class="cw-followup-note">درجة الحضور الأصلية: ${points.original??'لم ترصد'} · الدرجة بعد التعويض: ${points.attendance}. لا تُجمع الدرجتان.</div>`:''}${s.result?`<p class="cw-muted">الواجب: ${s.result.attempts} محاولات · أعلى نتيجة معتمدة</p>`:''}${d?`<details class="cw-review-detail" ${cwReportFilter==='discussions'||cwReportFilter==='discussionPending'?'open':''}><summary>مناقشة المحاضرة · ${d.score==null?'بانتظار التصحيح':'تم التقييم'}</summary>${cwDiscussionReviewCard(s,i)}</details>`:'<div class="cw-discussion-missing"><strong>مناقشة المحاضرة</strong>لم تصل مشاركة من الطالب بعد؛ تظهر الإجابة وخانة التقييم هنا بعد الإرسال.</div>'}${reflection}</article>`;
}
function cwRenderReport(){
  const l=cwReport.lesson,subject=cwData.subjects.find(s=>s.key===l.subject_key)||{},batches=[...new Set(cwData.subjects.map(s=>s.batch))],states=[['all','الكل'],['discussions','إجابات المناقشة'],['discussionPending','مناقشات للتقييم'],['absent','الغياب'],['partial','الحضور الجزئي'],['live','الحضور المكتمل'],['pending','تعويضات تنتظر التصحيح'],['reviewed','تعويضات معتمدة'],['unrecorded','لم يُرصد']];
  const count=state=>cwReport.students.filter(s=>state==='all'?true:state==='discussions'||state==='discussionPending'?cwDiscussionMatches(s,state):state==='pending'?!!(s.reflection&&s.reflection.score==null):cwStudentReportState(s)===state).length;
  cwHost().innerHTML=`<div class="cw-report-shell"><section class="cw-report-hero"><span class="cw-eyebrow">متابعة المحاضرة</span><h2>${cwEscape(subject.name||l.title)}</h2><p>${cwEscape(subject.batch||'')} · ${cwEscape(l.title)}</p><div class="cw-report-selectors"><label>الدفعة<select onchange="cwSelectReportBatch(this.value)">${batches.map(b=>`<option value="${cwEscape(b)}" ${b===subject.batch?'selected':''}>${cwEscape(b)}</option>`).join('')}</select></label><label>المقرر<select onchange="cwSelectReportSubject(this.value)">${cwData.subjects.filter(s=>s.batch===subject.batch).map(s=>`<option value="${cwEscape(s.key)}" ${s.key===l.subject_key?'selected':''}>${cwEscape(s.name)}</option>`).join('')}</select></label><label>المحاضرة<select onchange="cwOpenReport(this.value)">${cwData.lessons.filter(x=>x.subject_key===l.subject_key).map(x=>`<option value="${cwEscape(x.id)}" ${x.id===l.id?'selected':''}>${cwEscape(x.title)}</option>`).join('')}</select></label></div></section><div class="cw-report-kpis">${[['all','طلاب المحاضرة'],['live','حضور مكتمل'],['absent','غياب'],['partial','حضور جزئي'],['pending','تعويضات للتصحيح'],['reviewed','تعويضات معتمدة']].map(([key,label])=>`<button onclick="cwReportFilter='${key}';cwRenderReport()"><strong>${count(key)}</strong><span>${label}</span></button>`).join('')}</div>${cwReportDiscussionSummary()}<section class="card"><div class="cw-report-toolbar"><div class="cw-report-tabs">${states.map(([key,label])=>`<button class="${cwReportFilter===key?'active':''}" onclick="cwReportFilter='${key}';cwRenderReport()">${label} <span>${count(key)}</span></button>`).join('')}</div><label class="cw-actions-filter"><input type="checkbox" ${cwReportOnlyActions?'checked':''} onchange="cwReportOnlyActions=this.checked;cwRenderReport()"> يحتاج تصحيحًا فقط</label></div>${currentUser.role==='admin'?'<details class="cw-review-detail"><summary>استيراد حضور هذه الدفعة من Zoom</summary><div class="cw-review-body"><input type="file" accept=".csv" onchange="cwPreviewZoom(this.files[0])"><div id="cwAttendancePreview"></div></div></details>':''}<div id="cwReportCards"></div><button class="btn-out" style="margin-top:20px" onclick="renderAcademicCoursework()">العودة إلى المحاضرات</button></section></div>`;
  const groups=[['absent','الغياب — تعويض الحضور مطلوب'],['partial','الحضور الجزئي — يمكن استكمال الدرجة بالتعويض'],['live','الحضور المباشر المكتمل'],['reviewed','تعويض الحضور المعتمد'],['unrecorded','الحضور بانتظار الرصد']];
  document.getElementById('cwReportCards').innerHTML=groups.map(([state,title])=>{
    const selected=cwReport.students.map((s,i)=>({s,i})).filter(({s})=>cwStudentReportState(s)===state&&(cwDiscussionMatches(s,cwReportFilter)||cwReportFilter==='all'||cwReportFilter===state||(cwReportFilter==='pending'&&s.reflection&&s.reflection.score==null))&&(!cwReportOnlyActions||cwStudentNeedsAction(s)));
    return selected.length?`<section class="cw-student-section"><h3>${title} <span>${selected.length}</span></h3><div class="cw-student-grid">${selected.map(({s,i})=>cwReportStudentCard(s,i)).join('')}</div></section>`:'';
  }).join('')||'<div class="cw-empty-state">لا توجد أسماء ضمن هذا الاختيار.</div>';
}
function cwSelectReportSubject(key){
  const lesson=cwData.lessons.find(l=>l.subject_key===key);
  if(!lesson){cwNotify('لم يتم إعداد محاضرات هذا المقرر بعد');cwRenderReport();return;}
  cwSelectedSubject=key;cwReportFilter='all';cwOpenReport(lesson.id);
}
function cwSelectReportBatch(batch){const subject=cwData.subjects.find(s=>s.batch===batch&&cwData.lessons.some(l=>l.subject_key===s.key));if(subject)cwSelectReportSubject(subject.key);else{cwNotify('لا توجد محاضرات معدة لهذه الدفعة');cwRenderReport();}}
async function cwReview(key, i, button) {
  try {
    button.disabled = true;
    const r = await cwApi("/review", {
      lessonId: cwActiveLesson,
      studentKey: key,
      score: document.getElementById(`cwReviewScore${i}`).value,
      feedback: document.getElementById(`cwReviewFeedback${i}`).value,
    });
    cwNotify(
      r.synced
        ? "تم اعتماد درجة الحضور"
        : "تم اعتماد التعويض؛ مزامنة الدرجة معلقة",
    );
    await cwOpenReport(cwActiveLesson);
  } catch (e) {
    cwNotify(e.message);
    button.disabled = false;
  }
}
async function cwRetrySync() {
  try {
    const r = await cwApi("/sync", {});
    cwNotify(`تمت مزامنة ${r.synced} سجل`);
  } catch (e) {
    cwNotify(e.message);
  }
}
function cwParseCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
const cwNormalize = (v) =>
  String(v || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06ff]/g, "");
async function cwPreviewZoom(file) {
  if (!file) return;
  cwPreview=null;
  document.getElementById('cwAttendancePreview').innerHTML='';
  try {
    const text = (await file.text()).replace(/^\uFEFF/, ""),
      rows = cwParseCsv(text),
      headerIndex = rows.findIndex((row) =>
        row.some((cell) => /^name(?: \(original name\))?$/i.test(cell.trim())),
      );
    if (headerIndex < 0) throw Error("لم يتم العثور على أعمدة سجل Zoom");
    const meeting=cwZoomMeetingPeriod(rows.slice(0,headerIndex));
    if(!meeting)throw Error('الملف يحتوي سجل المشاركين فقط، ولا يحدد مدة الاجتماع الفعلية. صدّري تقرير Zoom الذي يتضمن ملخص الاجتماع وبدايته ونهايته؛ لم يُعدّل أي حضور.');
    const headers = rows[headerIndex].map((x) => x.trim().toLowerCase()),
      col = (names) => names.map((x) => headers.indexOf(x)).find((i) => i >= 0),
      nameCol = col(["name (original name)", "name"]),
      emailCol = col(["email", "user email"]),
      joinCol = col(["join time"]),
      leaveCol = col(["leave time"]),waitingCol=col(['in waiting room']);
    if (joinCol == null || leaveCol == null)
      throw Error(
        "يلزم سجل Zoom المفصل الذي يحتوي وقت الدخول والخروج لحساب التداخل",
      );
    const people = new Map();
    for (const row of rows.slice(headerIndex + 1)) {
      if(waitingCol!=null&&/^(yes|نعم)$/i.test(String(row[waitingCol]||'').trim()))continue;
      const name = row[nameCol]?.trim();
      if (!name) continue;
      const email = row[emailCol]?.trim() || "",
        id = email.toLowerCase() || cwNormalize(name),
        start = cwZoomTimestamp(row[joinCol]),
        end = cwZoomTimestamp(row[leaveCol]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        continue;
      const person = people.get(id) || { name, email, intervals: [] };
      person.intervals.push([start, end]);
      people.set(id, person);
    }
    if(!people.size)throw Error('لا توجد فترات حضور صالحة في الملف؛ لم يتم تعديل أي حضور');
    cwPreview = {
      meeting,
      sourceHash: Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
        ),
        (v) => v.toString(16).padStart(2, "0"),
      ).join(""),
      rows: [...people.values()].map((person) => {
        const candidates = cwReport.students.filter(
          (s) =>
            (person.email &&
              String(s.email || "").toLowerCase() ===
                person.email.toLowerCase()) ||
            cwNormalize(cwName(s)) === cwNormalize(person.name) ||
            cwNormalize(s.id) === cwNormalize(person.name),
        );
        return {
          ...person,
          studentKey: candidates.length === 1 ? candidates[0].key : "",
        };
      }),
    };
    cwRenderAttendancePreview();
  } catch (e) {
    cwNotify(e.message);
  }
}
function cwUnionMinutes(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0,
    last = null;
  for (const [start, end] of sorted) {
    if (!last) last = [start, end];
    else if (start <= last[1]) last[1] = Math.max(last[1], end);
    else {
      total += last[1] - last[0];
      last = [start, end];
    }
  }
  if (last) total += last[1] - last[0];
  return total / 60000;
}
function cwZoomTimestamp(value){
  const v=String(value||'').trim();
  if(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(v))return Date.parse(v);
  const us=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if(us){let h=Number(us[4]);if(us[7])h=h%12+(/PM/i.test(us[7])?12:0);return Date.parse(`${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}T${String(h).padStart(2,'0')}:${us[5]}:${us[6]||'00'}+03:00`);}
  if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(v))return Date.parse(v.replace(' ','T')+(v.length===16?':00':'')+'+03:00');
  return NaN;
}
function cwZoomMeetingPeriod(rows){
  const norm=v=>String(v||'').trim().toLowerCase().replace(/[\s_-]+/g,'');
  const startNames=['starttime','meetingstarttime','actualstarttime','وقتالبداية','بدايةالاجتماع'],endNames=['endtime','meetingendtime','actualendtime','وقتالنهاية','نهايةالاجتماع'];
  for(let i=0;i<rows.length-1;i++){
    const header=rows[i].map(norm),startCol=header.findIndex(x=>startNames.includes(x)),endCol=header.findIndex(x=>endNames.includes(x));
    const durationCol=header.findIndex(x=>['duration','duration(minutes)','durationminutes','مدةالاجتماع'].includes(x));
    if(startCol<0||(endCol<0&&durationCol<0))continue;
    const start=cwZoomTimestamp(rows[i+1][startCol]);
    const minutes=Number(rows[i+1][durationCol]);
    const end=endCol>=0?cwZoomTimestamp(rows[i+1][endCol]):start+minutes*60000;
    if(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=86400000)return {start:new Date(start).toISOString(),end:new Date(end).toISOString(),durationMinutes:(end-start)/60000,source:'zoom_meeting_summary'};
  }
  return null;
}
function cwClipIntervals(intervals,meeting){
  const start=Date.parse(meeting.start),end=Date.parse(meeting.end);
  return intervals.map(([a,b])=>[Math.max(a,start),Math.min(b,end)]).filter(([a,b])=>b>a);
}
function cwRenderAttendancePreview() {
  const groups=cwAttendanceReviewGroups(cwPreview.rows,cwReport.students);
  const renderRows=list=>list.map(({row,i})=>`<div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap"><span>${cwEscape(row.name)} (${Math.round(cwUnionMinutes(cwClipIntervals(row.intervals,cwPreview.meeting)))} دقيقة)</span><select onchange="cwSetAttendanceMatch(${i},this.value)"><option value="">بحاجة للمراجعة — دون تغيير درجات</option><option value="__exclude" ${row.excluded?'selected':''}>خارج الدفعة / استبعاد — لن يتأثر</option>${cwReport.students.map(s=>`<option value="${cwEscape(s.key)}" ${s.key===row.studentKey?'selected':''}>${cwEscape(cwName(s))}</option>`).join('')}</select></div>`).join('')||'<p>لا توجد أسماء.</p>';
  document.getElementById('cwAttendancePreview').innerHTML=`<section style="border:1px solid #dbe5ff;padding:14px;border-radius:14px"><h3>اعتماد حضور دفعة ${cwEscape(cwData.subjects.find(s=>s.key===cwReport.lesson.subject_key)?.batch||'المقرر المختار')}</h3><p>مدة الاجتماع: ${Math.round(cwPreview.meeting.durationMinutes*100)/100} دقيقة · من ${cwDate(cwPreview.meeting.start)} إلى ${cwDate(cwPreview.meeting.end)}</p><p>يمكن استيراد الملف نفسه للدفعة الأخرى. لن تتغير درجات أي حساب خارج قائمة هذه الدفعة، ولا يُرصد الغياب تلقائيًا.</p><h4>حضور مرتبط (${groups.linked.length})</h4>${renderRows(groups.linked)}<h4>أسماء بحاجة للمراجعة (${groups.review.length})</h4>${renderRows(groups.review)}<h4>أسماء خارج الدفعة / مستبعدة (${groups.excluded.length})</h4>${renderRows(groups.excluded)}<h4>طلاب الدفعة غير المرتبطين بالسجل (${groups.missing.length})</h4><p>تبقى درجاتهم الحالية كما هي. لرصد الغياب، راجعي كل الأسماء غير المرتبطة أولًا، ثم اختاري الغائبين وأكّدي اكتمال السجل.</p>${groups.missing.map(s=>`<label style="display:block;margin:9px 0"><input type="checkbox" class="cw-confirm-absent" value="${cwEscape(s.key)}" ${groups.review.length?'disabled':''}> ${cwEscape(cwName(s))} — رصد غياب 0</label>`).join('')||'<p>جميع طلاب الدفعة مرتبطون بالسجل.</p>'}<label style="display:block;margin:14px 0"><input id="cwConfirmAbsence" type="checkbox" ${groups.review.length?'disabled':''}> راجعت المطابقة والسجل كامل لهذه الدفعة، وأعتمد غياب الأسماء التي اخترتها فقط</label><button class="btn btn-primary" onclick="cwApproveAttendance(this)">اعتماد حضور الدفعة المختارة فقط</button></section>`;
}
function cwAttendanceReviewGroups(rows,students){
  const indexed=rows.map((row,i)=>({row,i})),linked=indexed.filter(x=>x.row.studentKey),review=indexed.filter(x=>!x.row.studentKey&&!x.row.excluded),excluded=indexed.filter(x=>!x.row.studentKey&&x.row.excluded),keys=new Set(linked.map(x=>x.row.studentKey));
  return {linked,review,excluded,missing:students.filter(s=>!keys.has(s.key))};
}
function cwSetAttendanceMatch(i,value){cwPreview.rows[i].studentKey=value==='__exclude'?'':value;cwPreview.rows[i].excluded=value==='__exclude';cwRenderAttendancePreview();}
async function cwApproveAttendance(button) {
  try {
    if(!cwPreview?.rows?.length)throw Error('استورد سجل الحضور وراجع المطابقة أولًا');
    if(!cwPreview.rows.some(row=>row.studentKey))throw Error('لم يتم ربط أي اسم بحساب طالب');
    button.disabled = true;
    const confirmedAbsentKeys=[...document.querySelectorAll('.cw-confirm-absent:checked')].map(el=>el.value);
    if(confirmedAbsentKeys.length&&(!document.getElementById('cwConfirmAbsence')?.checked||cwPreview.rows.some(row=>!row.studentKey&&!row.excluded)))throw Error('راجعي جميع الأسماء وأكّدي اكتمال السجل قبل رصد الغياب');
    const groups = new Map();
    for (const row of cwPreview.rows)
      if (row.studentKey) {if(!groups.has(row.studentKey))groups.set(row.studentKey,[]);groups.get(row.studentKey).push(...row.intervals);}
    const rows = [...groups].map(([studentKey, intervals]) => ({
      studentKey,
      percent: Math.min(
        100,
        Math.round(
          (cwUnionMinutes(cwClipIntervals(intervals,cwPreview.meeting)) / cwPreview.meeting.durationMinutes) *
            10000,
        ) / 100,
      ),
    }));
    for(const studentKey of confirmedAbsentKeys)if(!groups.has(studentKey))rows.push({studentKey,percent:0,kind:'confirmed_absence'});
    const r = await cwApi("/attendance", {
      lessonId: cwActiveLesson,
      sourceHash: cwPreview.sourceHash,
      meeting:cwPreview.meeting,
      rows,
      confirmedAbsentKeys,
    });
    cwNotify(
      `تم اعتماد ${r.count} سجل${r.pending ? ` · ${r.pending} درجات بانتظار المزامنة` : ""}`,
    );
    cwPreview = null;
    await cwOpenReport(cwActiveLesson);
  } catch (e) {
    cwNotify(e.message);
    button.disabled = false;
  }
}
