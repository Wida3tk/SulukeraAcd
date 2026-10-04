/* Academic coursework; all authorization and scoring are enforced by the worker. */
const CW_REFLECTION_QUESTIONS = [
  "ما أبرز فكرة تعلمتها من هذا اللقاء؟ اشرحها بأسلوبك.",
  "كيف يمكنك تطبيقها؟ قدّم مثالًا مرتبطًا بمحتوى اللقاء.",
  "ما النقطة التي تحتاج إلى توضيح أو ترغب بمناقشتها؟",
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
    ? new Date(v).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })
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
    host.innerHTML = `<section class="card" style="background:linear-gradient(135deg,#071b4d,#1244f3);color:white"><h2>${role === "student" ? "مقرراتي ومحاضراتي" : "المحاضرات والواجبات"}</h2><p>${role === "student" ? "تابع محاضرات الفصل، حل واجب كل محاضرة، وراجع نتيجة مشاركتك." : "إعداد الواجبات، متابعة المحاولات، ومراجعة الحضور وتعويضه."}</p></section>${role !== "student" ? '<button class="btn" onclick="cwRetrySync()">إعادة مزامنة الدرجات المعلقة</button>' : ""}${
      cwData.subjects.length
        ? cwData.subjects.filter(subject => role === "student" || subject.key === cwSelectedSubject)
            .map(
              (subject) =>
                `<section class="card" style="margin-top:16px"><h3>${cwEscape(subject.name)}</h3><div style="color:#718096;font-size:12px">${cwEscape(subject.batch)}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:15px">${[
                  1, 2, 3, 4,
                ]
                  .map((week) => {
                    const l = cwData.lessons.find(
                      (x) => x.subject_key === subject.key && x.week === week,
                    );
                    if (!l)
                      return `<article style="border:1px solid #dbe5ff;border-radius:16px;padding:16px;background:#f7faff"><h4>المحاضرة ${week}</h4><p>سيتم نشر تفاصيل المحاضرة وواجبها قريبًا.</p>${admin ? `<button class="btn" onclick="cwEditLesson('${subject.key}',${week})">إعداد المحاضرة والواجب</button>` : ""}</article>`;
                    const now = Date.now(),
                      open =
                        now >= Date.parse(l.opens_at) &&
                        now <= Date.parse(l.closes_at),
                      attend = l.attendance,
                      reflection = l.reflection;
                    return `<article style="border:1px solid #dbe5ff;border-radius:16px;padding:16px;background:linear-gradient(135deg,#fff,#f2f8ff)"><h4>${cwEscape(l.title)}</h4><div style="display:flex;gap:7px;flex-wrap:wrap">${cwLink(l.zoom_url, "دخول Zoom")}${cwLink(l.pdf_url, "مشاهدة الملف")}${cwLink(l.recording_url, "مشاهدة التسجيل")}</div><p style="font-size:12px;line-height:1.8">فتح الواجب: ${cwDate(l.opens_at)}<br>الإغلاق: ${cwDate(l.closes_at)}<br>المواعيد بتوقيت السعودية</p>${role === "student" ? `<p>واجب المحاضرة: ${l.result ? `${l.result.score}/${l.homeworkMax} · ${l.result.attempts} محاولات` : "لم يُحل بعد"}</p><p style="font-size:12px">${attend ? (attend.percent >= 80 ? `الحضور المباشر مكتمل · ${l.attendanceMax}/${l.attendanceMax}` : reflection?.score != null ? `تعويض الحضور: ${reflection.score}/${l.attendanceMax}` : reflection ? "تعويض الحضور بانتظار المراجعة" : "بحاجة لتعويض الحضور") : "الحضور بانتظار الرصد"}</p>${open ? `<button class="btn-primary" onclick="cwSolve('${l.id}')">${l.result ? "إعادة المحاولة" : "حل واجب المحاضرة"}</button>` : `<span class="badge">${now < Date.parse(l.opens_at) ? "يفتح في الموعد المحدد" : "انتهت فترة الواجب"}</span>`}${attend && attend.percent < 80 && reflection?.score == null && open ? `<button class="btn-out" style="margin-top:8px" onclick="cwReflection('${l.id}')">${reflection ? "تعديل إجابة التعويض" : "إجابة تعويض الحضور"}</button>` : ""}${l.discussionPrompt ? cwDiscussionCard(l,open) : ""}${reflection?.feedback ? `<p>${cwEscape(reflection.feedback)}</p>` : ""}` : `<span class="badge">${l.status === "published" ? "منشور" : "مسودة"}</span><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">${admin ? `<button class="btn" onclick="cwEditLesson('${subject.key}',${week})">تعديل</button>` : ""}<button class="btn" onclick="cwOpenReport('${l.id}')">الحضور والتسليمات</button></div>`}</article>`;
                  })
                  .join("")}</div></section>`,
            )
            .join("")
        : '<div class="card"><div class="empty">لا توجد مقررات حالية مرتبطة بالحساب.</div></div>'
    }`;
    if (role !== "student") host.firstElementChild.insertAdjacentHTML("afterend", `<section class="card" style="margin-top:16px"><div class="field"><label>اختر المقرر المتاح هذا الفصل</label><select onchange="cwSelectedSubject=this.value;renderAcademicCoursework()"><option value="">— اختر المقرر —</option>${cwData.subjects.map(s=>`<option value="${cwEscape(s.key)}" ${s.key===cwSelectedSubject?'selected':''}>${cwEscape(s.name)} · ${cwEscape(s.batch)}</option>`).join('')}</select></div><p>تظهر مقررات الفصل الحالي المعتمدة فقط. اختر مقررًا لعرض محاضراته وواجباته.</p></section>`);
  } catch (e) {
    host.innerHTML = `<div class="card"><div class="alert alert-warn">تعذر تحميل الواجبات. ${cwEscape(e.message)}</div><button class="btn" onclick="renderAcademicCoursework()">إعادة المحاولة</button></div>`;
  }
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
  if(Date.now()<Date.parse(l.opens_at))return '<section style="margin-top:14px"><span class="badge">تتاح مناقشة المحاضرة عند فتح الواجب</span></section>';
  return `<section style="margin-top:16px;padding:14px;background:#f4f2ff;border-radius:14px"><h4>مناقشة المحاضرة · ${l.discussionMax} درجات</h4><p style="line-height:1.9">${cwEscape(l.discussionPrompt)}</p>${l.discussion?.score!=null?`<p>الدرجة: ${l.discussion.score}/${l.discussionMax}</p><p>${cwEscape(l.discussion.feedback)}</p>`:open?`<textarea id="cwDiscussion_${l.id}" style="width:100%;min-height:150px;box-sizing:border-box;font:inherit;padding:12px;border:1px solid #ccd6f0;border-radius:12px" placeholder="شارك إجابتك بأسلوبك">${cwEscape(l.discussion?.answer||'')}</textarea><button class="btn-primary" onclick="cwSendDiscussion('${l.id}',this)">${l.discussion?'تحديث المشاركة':'إرسال المشاركة'}</button>${l.discussion?'<p>تم حفظ مشاركتك، بانتظار تقييم المحاضر.</p>':''}`:'<p>تتاح المناقشة خلال فترة الواجب.</p>'}</section>`;
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
  cwHost().innerHTML = `<section class="card"><h3>تعويض حضور ${cwEscape(l.title)}</h3>${cwLink(l.recording_url, "مشاهدة التسجيل")}<p>شاهد اللقاء ثم أجب عن الأسئلة. يراجع المحاضر إجابتك ويعتمد درجة الحضور.</p>${CW_REFLECTION_QUESTIONS.map((q, i) => `<div class="field"><label>${q}</label><textarea id="cwReflection${i}" style="width:100%;min-height:130px;font-family:inherit">${cwEscape(answers[i] || "")}</textarea></div>`).join("")}<button class="btn-primary" onclick="cwSendReflection('${id}',this)">إرسال الإجابة</button><button class="btn-out" onclick="renderAcademicCoursework()">رجوع</button></section>`;
}
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
async function cwOpenReport(id) {
  try {
    cwReport = await cwApi("/report", { lessonId: id });
    cwActiveLesson = id;
    cwHost().innerHTML = `<section class="card"><h3>${cwEscape(cwReport.lesson.title)} — الحضور والواجبات</h3>${currentUser.role === "admin" ? '<div class="field"><label>استيراد سجل Zoom (CSV)</label><input type="file" accept=".csv" onchange="cwPreviewZoom(this.files[0])"></div><div id="cwAttendancePreview"></div>' : ""}<div style="display:grid;gap:12px">${cwReport.students
      .map(
        (s, i) =>
          `<article style="padding:16px;border:1px solid #dbe5ff;border-radius:14px"><strong>${cwEscape(cwName(s))}</strong><p>الواجب: ${s.result ? `${s.result.score}/${cwReport.lesson.homeworkMax} · ${s.result.attempts} محاولات` : "لم يسلم"} · الحضور: ${s.attendance ? `${s.attendance.percent}%` : "لم يرصد"}</p>${cwDiscussionReviewCard(s,i)}${
            s.reflection
              ? `<div>${JSON.parse(s.reflection.answers_json)
                  .map(
                    (a, j) =>
                      `<p><strong>${CW_REFLECTION_QUESTIONS[j]}</strong><br>${cwEscape(a)}</p>`,
                  )
                  .join(
                    "",
                  )}</div><label>درجة تعويض الحضور من ${cwReport?.lesson?.attendanceMax||cwData.maxAttendance}</label><input id="cwReviewScore${i}" type="number" min="0" max="${cwReport?.lesson?.attendanceMax||cwData.maxAttendance}" value="${s.reflection.score ?? ""}"><textarea id="cwReviewFeedback${i}" placeholder="تعليق المحاضر" style="width:100%;font-family:inherit">${cwEscape(s.reflection.feedback)}</textarea><button class="btn" onclick="cwReview('${s.key}',${i},this)">اعتماد التعويض</button>`
              : "<span>لا توجد إجابة تعويض.</span>"
          }</article>`,
      )
      .join(
        "",
      )}</div><button class="btn" style="margin-top:15px" onclick="renderAcademicCoursework()">رجوع</button></section>`;
  } catch (e) {
    cwNotify(e.message);
  }
}
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
        start = Date.parse(row[joinCol]),
        end = Date.parse(row[leaveCol]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        continue;
      const person = people.get(id) || { name, email, intervals: [] };
      person.intervals.push([start, end]);
      people.set(id, person);
    }
    if(!people.size)throw Error('لا توجد فترات حضور صالحة في الملف؛ لم يتم تعديل أي حضور');
    cwPreview = {
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
function cwRenderAttendancePreview() {
  document.getElementById("cwAttendancePreview").innerHTML =
    `<div style="border:1px solid #dbe5ff;padding:14px;border-radius:14px"><p>راجعي مطابقة الأسماء. اجمعي الأسماء المختلفة للطالب نفسه باختيار حسابه. سيُسجل الطلاب غير الموجودين في السجل بنسبة 0 بعد الاعتماد.</p>${cwPreview.rows.map((row, i) => `<div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap"><span>${cwEscape(row.name)} (${Math.round(cwUnionMinutes(row.intervals))} دقيقة)</span><select onchange="cwPreview.rows[${i}].studentKey=this.value"><option value="">استبعاد / لم يتم الربط</option>${cwReport.students.map((s) => `<option value="${s.key}" ${s.key === row.studentKey ? "selected" : ""}>${cwEscape(cwName(s))}</option>`).join("")}</select></div>`).join("")}<button class="btn btn-primary" onclick="cwApproveAttendance(this)">اعتماد الحضور ودرجاته</button></div>`;
}
async function cwApproveAttendance(button) {
  try {
    if(!cwPreview?.rows?.length)throw Error('استورد سجل الحضور وراجع المطابقة أولًا');
    if(!cwPreview.rows.some(row=>row.studentKey))throw Error('لم يتم ربط أي اسم بحساب طالب');
    button.disabled = true;
    const groups = new Map(cwReport.students.map((s) => [s.key, []]));
    for (const row of cwPreview.rows)
      if (row.studentKey) groups.get(row.studentKey).push(...row.intervals);
    const rows = [...groups].map(([studentKey, intervals]) => ({
      studentKey,
      percent: Math.min(
        100,
        Math.round(
          (cwUnionMinutes(intervals) / cwReport.lesson.duration_minutes) *
            10000,
        ) / 100,
      ),
    }));
    const r = await cwApi("/attendance", {
      lessonId: cwActiveLesson,
      sourceHash: cwPreview.sourceHash,
      rows,
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
