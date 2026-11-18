/* Semester-aware helpers for the admin: batch colours, weekly calendar, and smart reminders
   (homework not uploaded, exams not scheduled or without questions). Admin-only; student pages untouched. */
(function(root){
  const V=f=>{try{return f();}catch(error){return undefined;}};
  const esc=value=>typeof escapeHtml==='function'?escapeHtml(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const PALETTE=['#0C40FB','#15966A','#E08A00','#7B3FE4','#E0475F','#0891B2','#4F46E5','#C2410C','#0F766E','#BE185D','#65A30D','#475569'];
  const WEEK_DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const DAY=86400000;
  const todayIso=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});
  const parse=iso=>{const [y,m,d]=String(iso).split('-').map(Number);return Date.UTC(y,m-1,d);};
  const toIso=t=>new Date(t).toISOString().slice(0,10);
  const addDays=(iso,n)=>toIso(parse(iso)+n*DAY);
  const diffDays=(a,b)=>Math.round((parse(b)-parse(a))/DAY);
  const fmtDate=(iso,opts={day:'numeric',month:'long'})=>new Intl.DateTimeFormat('ar-SA-u-nu-latn',{...opts,calendar:'gregory',timeZone:'UTC'}).format(new Date(parse(iso)));
  const dayName=iso=>WEEK_DAYS[new Date(parse(iso)).getUTCDay()];
  const same=(a,b)=>typeof sameBatchName==='function'?sameBatchName(a,b):String(a||'')===String(b||'');

  // ── batch colours: stable per batch name across the admin
  function batchList(){
    const known=V(()=>getAllKnownBatches())||[];
    const fromSlots=Object.values(V(()=>scheduleData)?.weekly||{}).map(slot=>slot.batch).filter(Boolean);
    return [...new Set([...known,...fromSlots].map(String))].sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function batchColor(batch){
    const list=batchList(),index=list.findIndex(item=>same(item,batch));
    if(index>=0)return PALETTE[index%PALETTE.length];
    let hash=0;for(const ch of String(batch||''))hash=(hash*31+ch.charCodeAt(0))>>>0;return PALETTE[hash%PALETTE.length];
  }

  // ── semester structure
  function activeSemesters(){
    return Object.entries(V(()=>semestersData)||{}).filter(([,s])=>s?.status==='active'&&s.startDate&&s.endDate).map(([key,s])=>({key,...s}));
  }
  function semesterStructure(semester,date=todayIso()){
    const span=diffDays(semester.startDate,semester.endDate);
    const totalWeeks=Math.floor(span/7)+1;
    const examWeekStart=semester.examWeekStart||addDays(semester.startDate,7*(totalWeeks-1));
    const teachingWeeks=Math.max(1,Math.round(diffDays(semester.startDate,examWeekStart)/7));
    const offset=diffDays(semester.startDate,date);
    const week=offset<0?0:Math.min(totalWeeks,Math.floor(offset/7)+1);
    const phase=offset<0?'before':date>semester.endDate?'after':date>=examWeekStart?'exams':'teaching';
    return {totalWeeks,teachingWeeks,examWeekStart,week,phase,daysToExamWeek:diffDays(date,examWeekStart),daysLeft:diffDays(date,semester.endDate)};
  }
  function semesterFor(date){return activeSemesters().find(s=>date>=s.startDate&&date<=s.endDate)||null;}
  function semesterLabel(semester,date=todayIso()){
    if(!semester)return '';
    const st=semesterStructure(semester,date);
    if(st.phase==='before')return `يبدأ الفصل ${fmtDate(semester.startDate)}`;
    if(st.phase==='after')return 'انتهى الفصل';
    if(st.phase==='exams')return `أسبوع الاختبارات · ينتهي الفصل ${fmtDate(semester.endDate)}`;
    return `الأسبوع ${st.week} من ${st.teachingWeeks} أسابيع دراسية · أسبوع الاختبارات يبدأ ${fmtDate(st.examWeekStart)}`;
  }

  // ── schedule banner + weekly calendar
  let calendarOffset=0;
  function weekStart(offset=calendarOffset){const t=todayIso(),dow=new Date(parse(t)).getUTCDay();return addDays(t,-dow+offset*7);}
  function slotRunsOn(slot,iso){
    if(slot.active===false||slot.archivedAt)return false;
    if(slot.day!==dayName(iso))return false;
    const term=V(()=>semestersData)?.[slot.semesterKey]||{};
    const start=slot.termStartDate||term.startDate||'',end=slot.termEndDate||term.endDate||'';
    return (!start||iso>=start)&&(!end||iso<=end);
  }
  function scheduleBannerHtml(){
    const semesters=activeSemesters();
    if(!semesters.length)return '<div class="alert alert-warn" style="margin-bottom:1rem">لا يوجد فصل نشط. حددي الفصل من صفحة الفصول الدراسية.</div>';
    return semesters.map(semester=>{
      const st=semesterStructure(semester),pct=Math.min(100,Math.max(0,Math.round(diffDays(semester.startDate,todayIso())/Math.max(1,diffDays(semester.startDate,semester.endDate))*100)));
      return `<div class="sm-banner"><div class="sm-banner-main"><strong>${esc(semester.name||'الفصل الحالي')}</strong><span>${esc(fmtDate(semester.startDate,{day:'numeric',month:'long',year:'numeric'}))} — ${esc(fmtDate(semester.endDate,{day:'numeric',month:'long',year:'numeric'}))}</span></div><div class="sm-banner-phase sm-phase-${st.phase}">${esc(semesterLabel(semester))}</div><div class="sm-banner-bar"><span style="width:${pct}%"></span><i style="right:${Math.round(diffDays(semester.startDate,st.examWeekStart)/Math.max(1,diffDays(semester.startDate,semester.endDate))*100)}%" title="بداية أسبوع الاختبارات"></i></div></div>`;
    }).join('');
  }
  function scheduleCalendarHtml(){
    const start=weekStart(),today=todayIso();
    const slots=Object.values(V(()=>scheduleData)?.weekly||{});
    const exams=Object.values(V(()=>examSchedulesData)||{}).filter(exam=>exam?.date);
    const days=[0,1,2,3,4,5,6].map(i=>addDays(start,i)).map(iso=>({iso,slots:slots.filter(slot=>slotRunsOn(slot,iso)).sort((a,b)=>String(a.timeStart||'').localeCompare(String(b.timeStart||''))),exams:exams.filter(exam=>exam.date===iso).sort((a,b)=>String(a.startTime||'').localeCompare(String(b.startTime||'')))}));
    const visible=days.filter((day,i)=>i<5||day.slots.length||day.exams.length);
    const used=[...new Set(days.flatMap(day=>[...day.slots.map(s=>s.batch),...day.exams.map(e=>e.batch)]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const semester=semesterFor(addDays(start,3))||semesterFor(start)||activeSemesters()[0];
    const st=semester?semesterStructure(semester,addDays(start,3)):null;
    const weekTitle=!st?'':st.phase==='exams'?'أسبوع الاختبارات':st.phase==='teaching'?`الأسبوع ${st.week} من الفصل`:'';
    const card=(color,inner,extra='')=>`<div class="sm-slot ${extra}" style="--b:${color}">${inner}</div>`;
    const column=day=>{
      const isToday=day.iso===today,past=day.iso<today;
      const items=[...day.exams.map(exam=>card(batchColor(exam.batch),`<div class="sm-slot-time">${esc(String(exam.startTime||'').slice(0,5))}–${esc(String(exam.endTime||'').slice(0,5))}</div><div class="sm-slot-title">اختبار: ${esc(exam.subjectName||'')}</div><div class="sm-slot-meta">${esc(exam.batch||'')}${exam.published===false?' · مسودة':''}</div>`,'sm-exam')),...day.slots.map(slot=>card(batchColor(slot.batch),`<div class="sm-slot-time">${esc(slot.timeStart||'')}–${esc(slot.timeEnd||'')}</div><div class="sm-slot-title">${esc(slot.subject||'')}</div><div class="sm-slot-meta">${esc(slot.batch||'')} · ${esc(slot.lecturer||'—')}</div>`))];
      return `<div class="sm-day ${isToday?'sm-today':''} ${past?'sm-past':''}"><div class="sm-day-head"><span class="sm-day-name">${esc(dayName(day.iso))}</span><span class="sm-day-date">${esc(fmtDate(day.iso))}</span>${isToday?'<span class="sm-today-tag">اليوم</span>':''}</div><div class="sm-day-body">${items.length?items.join(''):'<div class="sm-day-empty">لا محاضرات</div>'}</div></div>`;
    };
    return `<div class="card sm-calendar"><div class="sm-cal-head"><div><div class="card-title" style="margin:0">التقويم الأسبوعي</div><div class="sm-cal-range">${esc(fmtDate(start))} — ${esc(fmtDate(addDays(start,6),{day:'numeric',month:'long',year:'numeric'}))}${weekTitle?` · <strong>${esc(weekTitle)}</strong>`:''}</div></div><div class="sm-cal-nav"><button class="btn btn-sm" onclick="smartCalendarShift(-1)">› الأسبوع السابق</button><button class="btn btn-sm ${calendarOffset===0?'btn-primary':''}" onclick="smartCalendarShift(0)">هذا الأسبوع</button><button class="btn btn-sm" onclick="smartCalendarShift(1)">الأسبوع التالي ‹</button></div></div>${used.length?`<div class="sm-legend">${used.map(batch=>`<span style="--b:${batchColor(batch)}"><i></i>${esc(batch)}</span>`).join('')}<span class="sm-legend-exam"><i></i>اختبار</span></div>`:''}<div class="sm-week" style="grid-template-columns:repeat(${visible.length},minmax(150px,1fr))">${visible.map(column).join('')}</div></div>`;
  }
  function renderScheduleCalendar(){
    const banner=document.getElementById('scheduleSemesterBanner');if(banner)banner.innerHTML=scheduleBannerHtml();
    const host=document.getElementById('scheduleWeekCalendar');if(host)host.innerHTML=scheduleCalendarHtml();
  }
  function smartCalendarShift(step){calendarOffset=step===0?0:calendarOffset+step;renderScheduleCalendar();}

  // ── smart reminders
  const cache={exams:null,lessons:null,loadedAt:0,loading:null,error:''};
  async function loadSmartData(force=false){
    if(!force&&cache.loadedAt&&Date.now()-cache.loadedAt<5*60000)return cache;
    if(cache.loading)return cache.loading;
    cache.loading=(async()=>{
      const errors=[];
      try{cache.exams=(await secureAdminExamRequest('/admin/exams')).exams||[];}catch(error){cache.exams=null;errors.push('الاختبارات');console.warn('smart alerts exams',error);}
      try{cache.lessons=typeof cwApi==='function'?((await cwApi(''))?.data?.lessons||[]):null;if(cache.lessons===null)errors.push('الواجبات');}catch(error){cache.lessons=null;errors.push('الواجبات');console.warn('smart alerts coursework',error);}
      cache.error=errors.length?`تعذر التحقق من: ${errors.join('، ')}`:'';cache.loadedAt=Date.now();cache.loading=null;return cache;
    })();
    return cache.loading;
  }
  function semesterSubjects(semester){
    const keys=new Set(semester.subjects||[]);
    return (V(()=>subjects)||[]).filter(subject=>subject._fbKey&&keys.has(subject._fbKey));
  }
  function buildSmartAlerts(){
    const today=todayIso(),alerts=[];
    const examRows=cache.exams,lessons=cache.lessons;
    for(const semester of activeSemesters()){
      const st=semesterStructure(semester,today);
      if(st.phase==='after'||st.phase==='before')continue;
      const list=semesterSubjects(semester);
      const schedules=Object.entries(V(()=>examSchedulesData)||{}).map(([key,value])=>({key,...value})).filter(exam=>exam.date&&exam.date>=semester.startDate&&exam.date<=addDays(semester.endDate,7));
      // exam scheduling reminder: from the start of the last teaching week
      if(st.daysToExamWeek<=7){
        const missing=list.filter(subject=>!schedules.some(exam=>exam.subjectKey===subject._fbKey));
        if(missing.length)alerts.push({level:st.phase==='exams'?'high':'medium',icon:'calendar',title:st.phase==='exams'?`أسبوع الاختبارات بدأ و${missing.length} ${missing.length===1?'مقرر بلا':'مقررات بلا'} موعد اختبار`:`جدولي الاختبارات: أسبوع الاختبارات يبدأ ${fmtDate(st.examWeekStart)} (${st.daysToExamWeek===0?'اليوم':st.daysToExamWeek===1?'غدًا':st.daysToExamWeek===2?'بعد يومين':`بعد ${st.daysToExamWeek} أيام`})`,items:missing.map(subject=>`${subject.name} — ${subject.batch||''}`),action:"navTo('exams',null)",actionLabel:'جدولة الاختبارات'});
      }
      // exams scheduled but questions not uploaded / not published
      if(examRows){
        const noQuestions=[],drafts=[];
        for(const exam of schedules){
          if(exam.date<today)continue;
          const days=diffDays(today,exam.date);
          if(days>10&&st.daysToExamWeek>7)continue;
          const row=examRows.find(item=>item.schedule_key===exam.key);
          if(!row||!Number(row.question_count))noQuestions.push({exam,days});
          if(exam.published===false)drafts.push(exam);
        }
        if(noQuestions.length)alerts.push({level:noQuestions.some(item=>item.days<=3)?'high':'medium',icon:'file',title:`${noQuestions.length} ${noQuestions.length===1?'اختبار مجدول بدون أسئلة مرفوعة':'اختبارات مجدولة بدون أسئلة مرفوعة'}`,items:noQuestions.sort((a,b)=>a.days-b.days).map(({exam,days})=>`${exam.subjectName||''} — ${exam.batch||''} · ${fmtDate(exam.date)}${days===0?' (اليوم)':days===1?' (غدًا)':days===2?' (بعد يومين)':` (بعد ${days} أيام)`}`),action:"navTo('exams',null)",actionLabel:'رفع الأسئلة'});
        if(drafts.length)alerts.push({level:'low',icon:'eye',title:`${drafts.length} ${drafts.length===1?'موعد اختبار مسودة غير ظاهر':'مواعيد اختبارات مسودة غير ظاهرة'} للطلاب`,items:drafts.map(exam=>`${exam.subjectName||''} — ${exam.batch||''} · ${fmtDate(exam.date)}`),action:"navTo('exams',null)",actionLabel:'مراجعة'});
      }
      // homework per teaching week
      if(lessons&&st.phase==='teaching'){
        const dueWeek=Math.min(st.teachingWeeks,st.week+(diffDays(addDays(semester.startDate,7*st.week),today)>=-2?1:0));
        const missing=[],unpublished=[];
        for(const subject of list){
          for(let week=1;week<=Math.min(4,dueWeek);week++){
            const lesson=lessons.find(item=>item.subject_key===subject._fbKey&&Number(item.week)===week);
            if(!lesson)missing.push({subject,week});
            else if(lesson.status&&lesson.status!=='published')unpublished.push({subject,week});
          }
        }
        if(missing.length)alerts.push({level:missing.some(item=>item.week<st.week)?'high':'medium',icon:'book',title:`${missing.length} ${missing.length===1?'واجب غير مرفوع':'واجبات غير مرفوعة'} حتى الأسبوع ${dueWeek}`,items:missing.sort((a,b)=>a.week-b.week).map(({subject,week})=>`الأسبوع ${week}: ${subject.name} — ${subject.batch||''}${week<st.week?' (متأخر)':week===st.week?' (هذا الأسبوع)':' (الأسبوع القادم)'}`),action:"navTo('coursework',null)",actionLabel:'رفع الواجبات'});
        if(unpublished.length)alerts.push({level:'low',icon:'eye',title:`${unpublished.length} ${unpublished.length===1?'واجب مرفوع وغير منشور':'واجبات مرفوعة وغير منشورة'}`,items:unpublished.map(({subject,week})=>`الأسبوع ${week}: ${subject.name} — ${subject.batch||''}`),action:"navTo('coursework',null)",actionLabel:'نشر'});
      }
      // schedule gaps
      const slots=Object.values(V(()=>scheduleData)?.weekly||{}).filter(slot=>slot.active!==false&&!slot.archivedAt&&slot.semesterKey===semester.key);
      const unscheduled=list.filter(subject=>!slots.some(slot=>slot.subjectKey===subject._fbKey));
      if(st.phase==='teaching'&&unscheduled.length)alerts.push({level:'medium',icon:'calendar',title:`${unscheduled.length} ${unscheduled.length===1?'مقرر بلا محاضرة':'مقررات بلا محاضرات'} في الجدول الأسبوعي`,items:unscheduled.map(subject=>`${subject.name} — ${subject.batch||''}`),action:"navTo('schedule',null)",actionLabel:'فتح الجدول'});
    }
    const order={high:0,medium:1,low:2};
    return alerts.sort((a,b)=>order[a.level]-order[b.level]);
  }
  const ICON_PATHS={calendar:'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',file:'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',book:'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',check:'M20 6 9 17l-5-5',spark:'M12 3v4M12 17v4M3 12h4M17 12h4'};
  const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name]||ICON_PATHS.spark}"/></svg>`;
  function smartAlertsInner(){
    const semesters=activeSemesters();
    const head=semesters.map(semester=>`<span class="sm-chip sm-phase-${semesterStructure(semester).phase}">${esc(semester.name||'الفصل الحالي')}: ${esc(semesterLabel(semester))}</span>`).join('');
    if(!cache.loadedAt)return `${head}<div class="sm-loading">جاري فحص الواجبات والاختبارات…</div>`;
    const alerts=buildSmartAlerts();
    const list=alerts.length?alerts.map(alert=>`<details class="sm-alert sm-${alert.level}" ${alert.level==='high'?'open':''}><summary><span class="sm-alert-ic">${svg(alert.icon)}</span><span class="sm-alert-title">${esc(alert.title)}</span><button class="btn btn-sm" onclick="event.preventDefault();${alert.action}">${esc(alert.actionLabel)}</button></summary><ul>${alert.items.slice(0,12).map(item=>`<li>${esc(item)}</li>`).join('')}${alert.items.length>12?`<li>و${alert.items.length-12} أخرى</li>`:''}</ul></details>`).join(''):`<div class="sm-allgood"><span class="sm-alert-ic">${svg('check')}</span>كل شيء في مكانه: الواجبات والاختبارات والجدول جاهزة حتى الآن.</div>`;
    return `${head}${list}${cache.error?`<div class="sm-note">${esc(cache.error)}</div>`:''}`;
  }
  function smartAlertsCard(){
    if(typeof adminProfile==='function'&&adminProfile()==='executive')return '';
    setTimeout(()=>loadSmartData().then(()=>{const host=document.getElementById('smartAlertsBody');if(host)host.innerHTML=smartAlertsInner();}),0);
    return `<section class="ops-card sm-card"><div class="ops-card-head"><div><div class="ops-card-title">تنبيهات ذكية</div><div class="ops-card-note">يفحص النظام هيكلة الفصل: الواجبات الأسبوعية، ومواعيد الاختبارات، ورفع الأسئلة</div></div><button class="btn btn-sm" onclick="refreshSmartAlerts()">تحديث</button></div><div id="smartAlertsBody">${smartAlertsInner()}</div></section>`;
  }
  async function refreshSmartAlerts(){const host=document.getElementById('smartAlertsBody');if(host)host.innerHTML='<div class="sm-loading">جاري الفحص…</div>';await loadSmartData(true);if(host)host.innerHTML=smartAlertsInner();}

  Object.assign(root,{batchColor,BATCH_PALETTE:PALETTE,semesterStructure,activeSemestersList:activeSemesters,renderScheduleCalendar,smartCalendarShift,smartAlertsCard,refreshSmartAlerts,buildSmartAlerts,loadSmartData,__smartCache:cache});
})(globalThis);
