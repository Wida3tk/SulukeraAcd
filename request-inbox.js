/* Presentation only: retain the existing request handlers and their form IDs. */
function requestInboxResolved(status){return ['approved','completed','rejected','issued'].includes(status);}
function requestInboxFilter(){
  const host=document.getElementById('studentRequestsAlertsContent');if(!host)return;
  const search=(host.querySelector('[data-request-search]')?.value||'').trim().toLowerCase();
  const type=host.querySelector('[data-request-type]')?.value||'';
  for(const card of host.querySelectorAll('[data-inbox-request]'))card.hidden=!!((type&&card.dataset.type!==type)||(search&&!card.dataset.search.includes(search)));
  for(const group of host.querySelectorAll('.request-inbox-group')){
    const visible=[...group.querySelectorAll('[data-inbox-request]')].filter(c=>!c.hidden).length;
    group.querySelector('[data-visible-count]').textContent=visible;
    group.querySelector('.request-inbox-empty').hidden=visible>0;
  }
}
function organizeRequestInbox(){
  const host=document.getElementById('studentRequestsAlertsContent');if(!host||!isAdminRole())return;
  const cards=[...host.querySelectorAll('.request-card')];if(!cards.length)return;
  const items=[];
  for(const card of cards){
    const note=card.querySelector('textarea');
    const student=studentRequestsData.find(r=>getRequestAdminNoteInputId(r._fbKey)===note?.id);
    const lecturer=lecturerLeaveRequestsData.find(r=>`lecturer_leave_note_${r._fbKey}`===note?.id);
    const request=student||lecturer;if(!request)continue;
    const resolved=requestInboxResolved(request.status),isLecturer=!!lecturer;
    const head=card.querySelector('.request-card-head'),body=card.querySelector('.request-card-body'),actions=card.querySelector('.request-card-actions');
    const detail=document.createElement('details');detail.className='request-inbox-detail';
    const summary=document.createElement('summary');summary.append(head);
    const brief=document.createElement('div');brief.className='request-inbox-brief';brief.textContent=request.title||request.reason||request.details||getStudentRequestTypeLabel(request.type);summary.append(brief);
    const hint=document.createElement('span');hint.className='request-inbox-hint';hint.textContent=resolved?'عرض الطلب والقرار والتعليق':'فتح الطلب لاتخاذ الإجراء';summary.append(hint);
    detail.append(summary);if(body)detail.append(body);
    if(resolved&&note){const comment=document.createElement('div');comment.className='request-inbox-comment';comment.textContent=request.adminNote||'لا يوجد تعليق من الإدارة';const preserved=document.createElement('input');preserved.type='hidden';preserved.id=note.id;preserved.value=note.value;note.replaceWith(comment,preserved);}
    // Approved leave/exam postponements still need their existing completion action.
    const followup=request.status==='approved'&&(isLecturer||request.type==='exam_postponement'||(request.type==='leave'&&request.professionalProgramId));
    if(actions&&(!resolved||followup))detail.append(actions);
    card.replaceChildren(detail);card.dataset.inboxRequest=request._fbKey;card.dataset.type=isLecturer?'lecturer_leave':request.type||'other';
    const st=students.find(s=>s._fbKey===request.studentKey);
    card.dataset.search=[st?getStudentFullName(st):'',st?.id,st?.batch,request.lecturerName,request.title,request.details,request.reason,getStudentRequestTypeLabel(request.type)].filter(Boolean).join(' ').toLowerCase();
    card.classList.add(resolved?'request-inbox-resolved':'request-inbox-pending');items.push({card,resolved,request});
  }
  if(!items.length)return;
  const shell=document.createElement('div');shell.className='request-inbox';
  const pending=items.filter(i=>!i.resolved),done=items.filter(i=>i.resolved);
  const types=[...new Set(items.map(i=>i.card.dataset.type))];
  shell.innerHTML=`<header class="request-inbox-hero"><div><span>مركز الطلبات</span><h2>الطلبات والمتابعة</h2><p>افتحي الطلب للاطلاع على التفاصيل واتخاذ الإجراء. الطلبات التي تم الرد عليها محفوظة أسفل القائمة.</p></div><div class="request-inbox-totals"><div><strong>${pending.length}</strong><span>بانتظار الإجراء</span></div><div><strong>${done.length}</strong><span>تم الرد عليها</span></div></div></header><div class="request-inbox-tools"><input data-request-search type="search" aria-label="بحث في الطلبات" placeholder="بحث بالاسم أو رقم الطالب أو محتوى الطلب" oninput="requestInboxFilter()"><select data-request-type aria-label="نوع الطلب" onchange="requestInboxFilter()"><option value="">كل أنواع الطلبات</option>${types.map(t=>`<option value="${escapeHtml(t)}">${t==='lecturer_leave'?'إجازات المحاضرين':escapeHtml(getStudentRequestTypeLabel(t))}</option>`).join('')}</select></div>`;
  for(const [title,group,resolved] of [['طلبات معلقة — تحتاج إجراء',pending,false],['طلبات تم الرد عليها',done,true]]){
    const section=document.createElement('section');section.className='request-inbox-group';section.innerHTML=`<h3>${title} <span data-visible-count>${group.length}</span></h3><p class="request-inbox-empty" ${group.length?'hidden':''}>لا توجد طلبات في هذه القائمة.</p>`;
    const board=document.createElement('div');board.className='request-inbox-list';
    group.sort((a,b)=>String(resolved?b.request.reviewedAt||b.request.createdAt:b.request.createdAt).localeCompare(String(resolved?a.request.reviewedAt||a.request.createdAt:a.request.createdAt))).forEach(i=>board.append(i.card));
    section.append(board);shell.append(section);
  }
  host.replaceChildren(shell);
}
const requestInboxOriginalRender=renderAlertsPage;
renderAlertsPage=function(){const result=requestInboxOriginalRender.apply(this,arguments);organizeRequestInbox();return result;};
