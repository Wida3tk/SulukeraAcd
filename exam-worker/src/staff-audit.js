const labels = [
  ['/coursework/lesson','إضافة أو تعديل محاضرة'], ['/coursework/questions','تعديل أسئلة المحاضرة'],
  ['/coursework/review','مراجعة ورصد واجب'], ['/coursework/discussion-review','مراجعة ورصد مناقشة'],
  ['/coursework/discussion','تعديل مناقشة'], ['/coursework/attendance','رصد الحضور'],
  ['/coursework/sync','مزامنة درجات أعمال المقرر'], ['/coursework/report','إدارة تقارير المحاضرات'],
  ['/admin/graduation-projects','إدارة مشاريع التخرج'], ['/admin/revenue','إدارة المالية'],
  ['/admin/professional','إدارة البرنامج المهني'],
  ['/admin/student-password','تغيير كلمة مرور طالب'],
  ['/admin/staff-password','تعيين كلمة مرور موظف'],
  ['/admin/exams','إدارة الاختبارات'], ['/admin/exceptions','استثناء اختبار'],
  ['/admin/evaluations','إدارة تقييم المقررات'], ['/admin/zoom-attendance','إدارة الحضور'],
  ['/admin/recording','إدارة التسجيلات'], ['/admin/student-preview','معاينة حساب طالب'],
  ['/admin/email','إدارة الرسائل'], ['/coursework','إدارة أعمال المقرر'],
  ['/graduation','إدارة مشاريع التخرج'], ['/revenue','إدارة المالية'],
  ['/professional','إدارة البرنامج المهني'],
];
export async function beginStaffAudit(request, auth, persist) {
  if(auth.profile.role!=='admin' || !['POST','PUT','PATCH','DELETE'].includes(request.method)) return null;
  const path=new URL(request.url).pathname;
  if(path==='/admin/auth-account-lookup') return null;
  let body={};
  if(request.headers.get('content-type')?.includes('application/json')) {
    try { body=await request.clone().json(); } catch { /* Handler reports malformed input. */ }
  }
  const identifiers=['studentKey','subjectKey','examId','scheduleKey','lessonId','taskId','groupId','submissionId','requestId','id'];
  const details=identifiers.filter(k=>['string','number'].includes(typeof body?.[k])).map(k=>`${k}: ${String(body[k]).slice(0,120)}`).join('، ');
  const values=['score','grade','status','approved','published','batch','date','opensAt','closesAt','durationMinutes','maxAttempts','extraAttempts'].filter(k=>['string','number','boolean'].includes(typeof body?.[k])).map(k=>`${k}: ${String(body[k]).slice(0,160)}`).join('، ');
  const entry={actorUid:auth.uid,actorUsername:auth.profile.username || '',actorName:auth.profile.name || auth.profile.username || auth.uid,
    actorRole:'admin',actorTitle:auth.profile.staffTitle || 'إدارة',source:'worker',action:labels.find(([prefix])=>path.startsWith(prefix))?.[1] || 'إجراء في النظام',
    targetType:'api',targetKey:body?.studentKey || body?.examId || '',targetLabel:path,details:[details,values].filter(Boolean).join('، '),
    studentKey:typeof body?.studentKey==='string'?body.studentKey:'',subjectKey:typeof body?.subjectKey==='string'?body.subjectKey:'',
    createdAt:new Date().toISOString(),recordedAt:Date.now(),outcome:'started'};
  const key='act_'+Date.now()+'_srv_'+crypto.randomUUID();
  // Record intent before executing: unavailable audit storage prevents an untracked action.
  await persist(key,entry);
  return async response => {
    const completed={...entry,outcome:response.ok?'completed':'failed',httpStatus:response.status,completedAt:new Date().toISOString()};
    try { await persist(key,completed); }
    catch { console.error('staff_audit_completion_pending',key); }
  };
}
