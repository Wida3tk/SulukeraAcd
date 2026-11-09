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
    const record=typeof lecturerProductivityData==='undefined'?{}:lecturerProductivityData?.[month]?.[PILOT.username]||{},lectures=Object.values(record.recordingAudit?.lectures||{}),meetings=Object.values(record.meetings||{}),hasAudit=lectures.length>0,items=(hasAudit?lectures.map(lecture=>({title:lecture.title||'محاضرة',topic:lecture.topic||'',startsAt:lecture.startsAt||'',seconds:lecture.recordingSeconds==null?null:Math.max(0,Number(lecture.recordingSeconds)||0)})):meetings.map(meeting=>({title:'محاضرة',topic:'',startsAt:meeting.startsAt||'',seconds:Math.max(0,Number(meeting.durationMinutes)||0)*60}))).sort((a,b)=>String(a.startsAt).localeCompare(String(b.startsAt))),recordingSeconds=items.reduce((sum,item)=>sum+(Number(item.seconds)||0),0),events=afnanGradeEvents(month),sessions=gradingSessions(events),students=new Set(events.map(event=>event.studentKey).filter(Boolean)),manualMinutes=Number(record.gradingPilot?.minutes),hasManual=Number.isFinite(manualMinutes)&&manualMinutes>=0;
    return {month,recordingSeconds,deliveryCount:items.length,deliveryItems:items,deliverySource:hasAudit?'مدة التسجيل الفعلية':'مدة اجتماع Zoom — بانتظار تدقيق التسجيل',gradingMinutes:hasManual?manualMinutes:sessions.reduce((sum,session)=>sum+session.minutes,0),gradingSessions:sessions.length,gradedStudents:students.size,saveEvents:events.length,gradingSource:hasManual?'manual_verified':'save_estimate'};
  }
  const lectureDate=value=>value?new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{timeZone:'Asia/Riyadh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'—';
  function afnanPilotMarkup(month){
    const model=afnanPilotModel(month),label=new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{year:'numeric',month:'long',timeZone:'Asia/Riyadh'}).format(new Date(month+'-01T12:00:00Z'));
    return `<section class="afnan-productivity-card" id="afnanProductivityPilot"><header><div><span>إنتاجيتي</span><h3>${label}</h3></div><b>${model.deliveryCount} ${model.deliveryCount===1?'محاضرة':'محاضرات'}</b></header><div class="afnan-productivity-metrics"><div><small>إجمالي ساعات التقديم</small><strong dir="ltr">${formatDuration(model.recordingSeconds)}</strong></div><div><small>إجمالي دقائق الرصد</small><strong>${model.gradingMinutes} دقيقة</strong></div></div><details><summary><span>تفاصيل المحاضرات</span><b>${model.deliveryCount} محاضرات · اضغطي للعرض</b></summary><div class="afnan-lecture-list">${model.deliveryItems.length?model.deliveryItems.map((item,index)=>`<div><span><i>${String(index+1).padStart(2,'0')}</i><span><strong>${item.title}</strong><small>${lectureDate(item.startsAt)}</small></span></span><b>${item.seconds==null?'المدة غير متاحة':`${Math.round(item.seconds/60)} دقيقة`}</b></div>`).join(''):'<p>لا توجد محاضرات مسجلة في هذا الشهر.</p>'}</div></details></section>`;
  }
  const baseRender=typeof renderLecturerProductivity==='function'?renderLecturerProductivity:null;
  if(baseRender)renderLecturerProductivity=function(){
    if(!window.lecturerHoursPageMonth)window.lecturerHoursPageMonth=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit'}).format(new Date());
    const result=baseRender.apply(this,arguments),host=document.getElementById('lecturerProductivityContent'),dashboard=host?.querySelector('.or-dashboard'),month=window.lecturerHoursPageMonth;
    if(dashboard&&!dashboard.querySelector('#afnanProductivityPilot'))dashboard.querySelector('.or-header')?.insertAdjacentHTML('afterend',afnanPilotMarkup(month));
    return result;
  };
  const baseDashboard=typeof renderDashboard==='function'?renderDashboard:null;
  if(baseDashboard)renderDashboard=function(){
    const result=baseDashboard.apply(this,arguments),identity=String(currentUser?.username||currentUser?.id||currentUser?._fbKey||'').toLowerCase();
    if(currentUser?.role==='lecturer'&&[PILOT.username.toLowerCase(),PILOT.uid.toLowerCase()].includes(identity)){
      const page=document.getElementById('page-dashboard'),month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit'}).format(new Date());
      if(page&&!page.querySelector('#afnanProductivityDashboardPilot')){
        const months=[...new Set(['2026-10',month])],markup=months.map(value=>afnanPilotMarkup(value).replace('id="afnanProductivityPilot"',`data-afnan-month="${value}"`)).join('');
        page.querySelector('.student-profile-header')?.insertAdjacentHTML('afterend',`<div id="afnanProductivityDashboardPilot">${markup}</div>`);
      }
    }
    return result;
  };
  if(typeof globalThis!=='undefined')globalThis.SulukeraAfnanProductivityPilot={afnanGradeEvents,gradingSessions,afnanPilotModel,formatDuration};
})();
