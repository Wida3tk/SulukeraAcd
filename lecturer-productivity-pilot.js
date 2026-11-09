/* Afnan-only pilot: monthly delivery time plus conservative grading-session estimates. */
(function(){
  const PILOT={username:'Aalmubaddal',uid:'Rd1O695bgWdbu3xk1AUAoIYmJPk2',name:'أفنان المبدل'};
  const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value||'');
  const formatDuration=seconds=>{
    const total=Math.max(0,Math.round(Number(seconds)||0)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),secs=total%60;
    return [hours,minutes,secs].map(value=>String(value).padStart(2,'0')).join(':');
  };
  function afnanGradeEvents(month){
    if(!validMonth(month))return [];
    const aliases=new Set([PILOT.username.toLowerCase(),PILOT.uid.toLowerCase()]),events=[];
    Object.values(typeof grades==='undefined'?{}:grades).forEach(subjectGrades=>Object.values(subjectGrades||{}).forEach(grade=>{
      const at=String(grade?.updatedAt||''),actor=String(grade?.updatedBy||'').toLowerCase();
      if(at.slice(0,7)!==month||!aliases.has(actor)||!Number.isFinite(Date.parse(at)))return;
      events.push({at,studentKey:grade.studentKey||'',subjectKey:grade.subjectKey||'',role:grade.updatedRole||''});
    }));
    return events.sort((a,b)=>a.at.localeCompare(b.at));
  }
  function gradingSessions(events,gapMinutes=15){
    const sessions=[];
    events.forEach(event=>{
      const timestamp=Date.parse(event.at),current=sessions.at(-1);
      if(!current||timestamp-current.last>gapMinutes*60000)sessions.push({first:timestamp,last:timestamp,events:[event]});
      else{current.last=timestamp;current.events.push(event);}
    });
    return sessions.map(session=>({...session,minutes:Math.max(5,Math.ceil((session.last-session.first)/60000))}));
  }
  function afnanPilotModel(month){
    const record=typeof lecturerProductivityData==='undefined'?{}:lecturerProductivityData?.[month]?.[PILOT.username]||{},lectures=Object.values(record.recordingAudit?.lectures||{}),recordingKnown=lectures.filter(lecture=>lecture.recordingSeconds!=null),recordingSeconds=recordingKnown.reduce((sum,lecture)=>sum+Math.max(0,Number(lecture.recordingSeconds)||0),0),meetings=Object.values(record.meetings||{}),meetingSeconds=meetings.reduce((sum,meeting)=>sum+Math.max(0,Number(meeting.durationMinutes)||0)*60,0),events=afnanGradeEvents(month),sessions=gradingSessions(events),students=new Set(events.map(event=>event.studentKey).filter(Boolean));
    return {month,recordingSeconds:recordingKnown.length?recordingSeconds:meetingSeconds,deliveryCount:recordingKnown.length||meetings.length,deliverySource:recordingKnown.length?'مدة التسجيل الفعلية':'مدة اجتماع Zoom — بانتظار تدقيق التسجيل',gradingMinutes:sessions.reduce((sum,session)=>sum+session.minutes,0),gradingSessions:sessions.length,gradedStudents:students.size,saveEvents:events.length,estimated:true};
  }
  function afnanPilotMarkup(month){
    const model=afnanPilotModel(month),label=new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{year:'numeric',month:'long',timeZone:'Asia/Riyadh'}).format(new Date(month+'-01T12:00:00Z'));
    return `<section class="or-productivity" id="afnanProductivityPilot"><div class="or-section-heading"><div><span class="or-eyebrow">تجربة محدودة · حساب واحد</span><h3>إنتاجية ${PILOT.name} · ${label}</h3></div><span class="recording-audit-period">احتساب شهري</span></div><div class="or-productivity-totals"><div><span>إجمالي وقت التقديم</span><strong dir="ltr">${formatDuration(model.recordingSeconds)}</strong></div><div><span>دقائق الرصد المقدرة</span><strong>${model.gradingMinutes} دقيقة</strong></div><div><span>الطلاب المرصودون</span><strong>${model.gradedStudents}</strong></div><div><span>جلسات الرصد</span><strong>${model.gradingSessions}</strong></div></div><div class="or-table-wrap"><table aria-label="تفاصيل تجربة إنتاجية أفنان"><thead><tr><th>المحاضر</th><th>المحاضرات</th><th>مصدر وقت التقديم</th><th>عمليات الحفظ المتاحة</th><th>طريقة احتساب الرصد</th></tr></thead><tbody><tr><th>${PILOT.name}</th><td>${model.deliveryCount}</td><td>${model.deliverySource}</td><td>${model.saveEvents}</td><td>${model.gradingSessions?`${model.gradingSessions} جلسة · حد أدنى 5 دقائق للجلسة`:'لا توجد عمليات حفظ منسوبة للحساب في هذا الشهر'}</td></tr></tbody></table></div><p class="or-note">دقائق الرصد في التجربة تقديرية: تُجمع عمليات الحفظ المتقاربة خلال 15 دقيقة في جلسة واحدة، وبحد أدنى 5 دقائق للجلسة. لا تشمل أي عمل لم ينتج عنه سجل حفظ منسوب لأفنان.</p></section>`;
  }
  const baseRender=typeof renderLecturerProductivity==='function'?renderLecturerProductivity:null;
  if(baseRender)renderLecturerProductivity=function(){
    if(!window.lecturerHoursPageMonth)window.lecturerHoursPageMonth=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit'}).format(new Date());
    const result=baseRender.apply(this,arguments),host=document.getElementById('lecturerProductivityContent'),dashboard=host?.querySelector('.or-dashboard'),month=window.lecturerHoursPageMonth;
    if(dashboard&&!dashboard.querySelector('#afnanProductivityPilot'))dashboard.querySelector('.or-header')?.insertAdjacentHTML('afterend',afnanPilotMarkup(month));
    return result;
  };
  if(typeof globalThis!=='undefined')globalThis.SulukeraAfnanProductivityPilot={afnanGradeEvents,gradingSessions,afnanPilotModel,formatDuration};
})();
