const adminDiscussionReview = {
  actor: null,
  tasks: [],
  selected: '',
  batch: '',
  subject: '',
  search: '',
  busy: false,
  request: 0,
  drafts: new Map(),
};

async function renderAdminDiscussions() {
  if (currentUser?.role !== 'admin') return;
  const state = adminDiscussionReview;
  if (state.actor !== currentUser) {
    Object.assign(state, { actor: currentUser, tasks: [], selected: '', batch: '', subject: '', search: '', busy: false });
    state.drafts.clear();
  }
  const actor = currentUser;
  const request = ++state.request;
  const host = document.getElementById('adminDiscussionContent');
  host.innerHTML = '<div class="card" role="status">جاري تحميل المناقشات المطلوب رصدها…</div>';
  try {
    const result = await cwApi('/review-queue');
    if (currentUser !== actor || request !== state.request) return;
    const tasks = [...(result.tasks || []), ...(result.referrals || [])];
    state.tasks = tasks.filter(task => task.kind === 'discussion');
    adminDiscussionRender();
  } catch (error) {
    if (currentUser !== actor || request !== state.request) return;
    host.innerHTML = `<div class="card"><p role="alert">تعذر تحميل المناقشات. ${cwEscape(error.message)}</p><button class="btn" onclick="renderAdminDiscussions()">إعادة المحاولة</button></div>`;
  }
}

function adminDiscussionVisible() {
  const state = adminDiscussionReview;
  const search = state.search.trim().toLocaleLowerCase();
  return state.tasks.filter(task => (!state.batch || task.batch === state.batch) &&
    (!state.subject || task.subjectKey === state.subject) &&
    (!search || `${task.studentName} ${task.studentId} ${task.subjectName}`.toLocaleLowerCase().includes(search)));
}

function adminDiscussionRender() {
  if (currentUser?.role !== 'admin' || currentUser !== adminDiscussionReview.actor) return;
  const state = adminDiscussionReview;
  const visible = adminDiscussionVisible();
  const task = visible.find(item => item.key === state.selected) || visible[0];
  state.selected = task?.key || '';
  const batches = [...new Set(state.tasks.map(item => item.batch))];
  const subjects = [...new Map(state.tasks.filter(item => !state.batch || item.batch === state.batch)
    .map(item => [item.subjectKey, item.subjectName])).entries()];
  const draft = task ? state.drafts.get(task.key + '|' + task.version) || {} : {};
  document.getElementById('adminDiscussionContent').innerHTML = `<div class="ad-review">
    <header class="ad-heading"><div><h2>رصد المناقشات</h2><p>${state.tasks.length} مشاركة بانتظار التقييم · ${state.tasks.filter(item => item.attemptId).length} محاولة لتحسين الدرجة</p></div><div class="ad-actions"><button class="btn" id="adRefresh">تحديث القائمة</button><button class="btn" id="adLessons">مراجعة المناقشات حسب المحاضرة</button></div></header>
    <section class="card ad-filters"><label>الدفعة<select id="adBatch"><option value="">كل الدفعات</option>${batches.map(batch => `<option ${state.batch === batch ? 'selected' : ''} value="${cwEscape(batch)}">${cwEscape(batch)}</option>`).join('')}</select></label>
    <label>المقرر<select id="adSubject"><option value="">كل المقررات</option>${subjects.map(([key, name]) => `<option ${state.subject === key ? 'selected' : ''} value="${cwEscape(key)}">${cwEscape(name)}</option>`).join('')}</select></label>
    <label>بحث باسم الطالب أو رقمه<input id="adSearch" type="search" value="${cwEscape(state.search)}" placeholder="الاسم أو الرقم"></label><button class="btn" id="adSearchButton">بحث</button></section>
    <div class="ad-layout"><nav class="card ad-list" aria-label="المناقشات المعلقة"><p>${visible.length} مشاركة ضمن الاختيار</p>${visible.map((item, index) => `<button type="button" data-ad-task="${index}" aria-current="${item.key === task?.key}"><strong>${cwEscape(item.studentName)}</strong><span>${cwEscape(item.subjectName)} · ${cwEscape(item.batch)}</span><small>المحاضرة ${item.week} · ${item.attemptId ? 'تحسين الدرجة' : 'مناقشة جديدة'}</small></button>`).join('')}</nav>
    <section class="card ad-answer">${task ? `<h3>${cwEscape(task.studentName)} <small>${cwEscape(task.studentId)}</small></h3><p>${cwEscape(task.subjectName)} · ${cwEscape(task.batch)} · المحاضرة ${task.week}</p>
    ${task.referral?.status === 'open' ? `<p class="alert alert-warn">محالة للإدارة. ${cwEscape(task.referral.reason)}</p>` : ''}
    <h4>سؤال المناقشة</h4><div class="ad-text">${cwEscape(task.prompt)}</div><h4>إجابة الطالب</h4><div class="ad-text" dir="auto">${cwEscape(task.answer)}</div>
    <form id="adForm"><label>الدرجة من ${task.max}<input id="adScore" type="number" min="0" max="${task.max}" step="any" required value="${cwEscape(draft.score ?? '')}"></label><label>ملاحظة للطالب (اختياري)<textarea id="adFeedback" maxlength="4000">${cwEscape(draft.feedback || '')}</textarea></label><button type="submit" class="btn btn-primary">حفظ والانتقال للتالي</button></form>` : `<div class="ad-empty">${state.tasks.length ? 'لا توجد مناقشات تطابق البحث أو التصفية.' : 'اكتمل رصد جميع المناقشات المرسلة.'}</div>`}<p id="adStatus" role="status" aria-live="polite"></p></section></div></div>`;
  document.getElementById('adRefresh').onclick = renderAdminDiscussions;
  document.getElementById('adLessons').onclick = () => navTo('coursework');
  document.getElementById('adBatch').onchange = event => { state.batch = event.target.value; state.subject = ''; adminDiscussionRender(); };
  document.getElementById('adSubject').onchange = event => { state.subject = event.target.value; adminDiscussionRender(); };
  const search = () => { state.search = document.getElementById('adSearch').value; adminDiscussionRender(); };
  document.getElementById('adSearchButton').onclick = search;
  document.getElementById('adSearch').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); search(); } };
  document.querySelectorAll('[data-ad-task]').forEach(button => { button.onclick = () => { state.selected = visible[Number(button.dataset.adTask)].key; adminDiscussionRender(); }; });
  if (task) {
    const remember = () => state.drafts.set(task.key + '|' + task.version, { score: document.getElementById('adScore').value, feedback: document.getElementById('adFeedback').value });
    document.getElementById('adScore').oninput = remember;
    document.getElementById('adFeedback').oninput = remember;
    document.getElementById('adForm').onsubmit = event => { event.preventDefault(); void adminDiscussionSave(task); };
  }
}

async function adminDiscussionSave(task) {
  const state = adminDiscussionReview;
  if (state.busy || currentUser?.role !== 'admin' || currentUser !== state.actor) return;
  const score = document.getElementById('adScore').value;
  const feedback = document.getElementById('adFeedback').value;
  if (score === '' || !Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > task.max) return;
  const actor = currentUser;
  const draftKey = task.key + '|' + task.version;
  state.busy = true;
  document.querySelectorAll('#adminDiscussionContent button, #adminDiscussionContent input, #adminDiscussionContent select, #adminDiscussionContent textarea').forEach(input => { input.disabled = true; });
  try {
    const result = await cwApi('/discussion-review', { lessonId: task.lessonId, studentKey: task.studentKey,
      attemptId: task.attemptId || undefined, queueReview: true, sourceSubmittedAt: task.version, score: Number(score), feedback });
    if (currentUser !== actor) return;
    state.drafts.delete(draftKey);
    state.tasks = state.tasks.filter(item => item.key !== task.key);
    adminDiscussionRender();
    document.getElementById('adStatus').textContent = result.synced ? 'تم حفظ التقييم ومزامنة الدرجة مع سجل الطالب.' : 'تم حفظ التقييم. مزامنة الدرجة مع سجل الطالب قيد الانتظار.';
  } catch (error) {
    if (currentUser !== actor) return;
    if (/DISCUSSION_NOT_FOUND|DISCUSSION_ATTEMPT_ALREADY_REVIEWED|DISCUSSION_ATTEMPT_REQUIRED/.test(error.message)) {
      await renderAdminDiscussions();
      const status = document.getElementById('adStatus');
      if (status) status.textContent = 'تغيرت حالة المشاركة. تم تحديث القائمة، ويمكنك مراجعة المشاركة الحالية.';
    } else {
      document.getElementById('adStatus').textContent = 'تعذر حفظ التقييم. ' + error.message;
    }
  } finally {
    state.busy = false;
    if (currentUser === actor) document.querySelectorAll('#adminDiscussionContent button, #adminDiscussionContent input, #adminDiscussionContent select, #adminDiscussionContent textarea').forEach(input => { input.disabled = false; });
  }
}
