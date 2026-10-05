/* Meeting view; only explicit manual-hour saves write to the existing productivity collection. */
const performanceState={period:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).format(new Date()),groups:[],evaluationState:'idle',updatedAt:null,hourDrafts:{},semester:''};
function performanceStatus(s){return s.accountStatus||'active';}
function performanceStatusLabel(s){return ({active:'فعال',withdrawn:'منسحب',frozen:'مجمد',suspended:'موقوف'})[s]||s;}
function performanceProgramKey(value){
  const name=String(value||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').replace(/\s+/g,' ').trim();
  return /ادارة السلوك التنظيمي/.test(name)?name.replace(/^(?:(?:شهادة|برنامج|دورة|دبلوم)\s+)+/,''):name;
}
function performanceProgramName(value){const key=performanceProgramKey(value);return programsData.find(p=>performanceProgramKey(p.name)===key)?.name||value||'';}
function performanceBatchKey(s){return JSON.stringify([performanceProgramKey(s.program),normalizeBatchName(s.batch||'')]);}
function performanceModel(){
  const programs=new Map();
  programsData.forEach(p=>{const name=performanceProgramName(p.name);if(!programs.has(name))programs.set(name,{name,students:[],batches:new Map()});});
  programsData.forEach(p=>(p.tracks||[]).forEach(t=>(t.batches||[]).forEach(b=>{const name=performanceProgramName(p.name),item={program:name,track:t.name,batch:b.name,students:[]},key=performanceBatchKey(item);if(!programs.get(name).batches.has(key))programs.get(name).batches.set(key,item);} )));
  students.forEach(s=>{const name=performanceProgramName(s.program);if(!programs.has(name))programs.set(name,{name,students:[],batches:new Map()});const p=programs.get(name),key=performanceBatchKey(s);p.students.push(s);if(!p.batches.has(key))p.batches.set(key,{program:name,track:s.track||'',batch:s.batch||'',students:[]});p.batches.get(key).students.push(s);});
  return [...programs.values()];
}
function performanceCounts(rows){const counts={active:0,withdrawn:0};rows.forEach(s=>{const status=performanceStatus(s);counts[status]=(counts[status]||0)+1;});return counts;}
function performanceRating(groups,keys){let sum=0,count=0;groups.forEach(g=>Object.entries(g.questions||{}).forEach(([key,q])=>{if(keys&&!keys.includes(key))return;const n=Number(q.count),percent=Number(q.percent);if(n>0&&Number.isFinite(percent)){sum+=percent*n;count+=n;}}));return count?Math.round(sum/count*10)/10:null;}
function performanceRatingText(value){return value===null?'غير متوفر':value+'%';}
function performanceBatchSubjects(b){const names=new Set(b.students.map(s=>s._fbKey)),matching=performanceModel().flatMap(p=>[...p.batches.values()]).filter(item=>item.batch&&sameBatchName(item.batch,b.batch));return subjects.filter(s=>b.batch&&sameBatchName(s.batch,b.batch)&&(matching.length===1||(s.students||[]).some(i=>names.has(students[i]?._fbKey))));}
function performanceBatchEvaluations(b){const assigned=new Set(performanceBatchSubjects(b).map(s=>s._fbKey));return performanceState.groups.filter(g=>sameBatchName(g.batch,b.batch)&&assigned.has(g.subjectKey));}
function performanceLecturerAssignments(u){
  const ids=[u.username,u.id,u._fbKey].filter(Boolean),assigned=subjects.filter(s=>ids.includes(s.lecturerUserId));
  Object.entries(professionalProgramsData||{}).forEach(([programKey,program])=>Object.entries(program.tracks||{}).forEach(([trackKey,track])=>Object.entries(track.units||{}).forEach(([unitKey,unit])=>{
    if(!ids.includes(unit.lecturerUserId))return;
    const keys=new Set(Object.entries(professionalEnrollmentsData||{}).filter(([,programs])=>{const enrollment=programs?.[programKey];return enrollment&&enrollment.status==='active'&&(enrollment.selectedTracks?.[trackKey]??trackKey==='track_1');}).map(([key])=>key));
    assigned.push({_fbKey:programKey+'/'+trackKey+'/'+unitKey,name:unit.title,students:students.map((s,i)=>keys.has(s._fbKey)?i:-1).filter(i=>i>=0)});
  })));
  return assigned;
}
async function renderPerformance(){
  if(currentUser?.role!=='admin')return;
  performanceRender();
  if(performanceState.evaluationState!=='idle')return;
  performanceState.evaluationState='loading';performanceRender();
  try{performanceState.groups=(await secureAdminExamRequest('/admin/evaluations')).evaluations||[];performanceState.evaluationState='ready';performanceState.updatedAt=new Date();}
  catch(error){performanceState.groups=[];performanceState.evaluationState='error';}
  if(currentUser?.role==='admin')performanceRender();
}
function performanceRefresh(){performanceState.evaluationState='idle';return renderPerformance();}
function performanceFilter(field,value){performanceState[field]=value;performanceRender();}
function performanceRender(){
  const host=document.getElementById('performanceContent');if(!host||currentUser?.role!=='admin')return;
  const e=escapeHtml,model=performanceModel(),batches=model.flatMap(p=>[...p.batches.values()]),counts=performanceCounts(students),max=Math.max(1,...batches.map(b=>b.students.length));
  const kpi=(label,value)=>`<div class="insight-card"><div class="insight-value">${value}</div><div class="insight-label">${label}</div></div>`;
  const eligibleGroups=performanceState.groups.filter(g=>subjects.some(s=>s._fbKey===g.subjectKey));
  const newStudents=students.filter(s=>/^\d{4}-\d{2}-\d{2}/.test(s.regDate)&&s.regDate.slice(0,7)===performanceState.period).length;
  const frozenKnown=Object.hasOwn(counts,'frozen');
  host.innerHTML=`<div dir="rtl"><div class="card performance-header"><div><h2>الأداء والتقدم</h2><p>المراجعة التشغيلية وتحليل أداء الأكاديمية</p><small>آخر تحديث للتقييمات: ${performanceState.updatedAt?e(performanceState.updatedAt.toLocaleString('ar-SA')):'غير متوفر'} · بيانات الطلاب: ${window.performanceStudentsLoadedAt?e(window.performanceStudentsLoadedAt.toLocaleString('ar-SA')):'الحالة الحالية المحملة عند الدخول'}</small></div><label>الشهر والسنة <input aria-label="الشهر والسنة" id="performancePeriod" type="month" value="${e(performanceState.period)}" onchange="performanceFilter('period',this.value)"></label><button class="btn" onclick="performanceRefresh()">تحديث التقييمات</button></div>
  <h3>الملخص التنفيذي</h3><div class="performance-kpis">${kpi('إجمالي الطلاب',students.length)}${kpi('الطلاب الفعالون',counts.active||0)}${kpi('التسجيلات الجديدة في الشهر',newStudents)}${kpi('المنسحبون — الحالة الحالية',counts.withdrawn||0)}${kpi('الحسابات المجمدة',frozenKnown?counts.frozen:'غير متوفر')}${kpi('دفعات بها طلاب فعالون',batches.filter(b=>b.batch&&b.students.some(s=>performanceStatus(s)==='active')).length)}${kpi('متوسط رضا الطلاب',performanceState.evaluationState==='ready'?performanceRatingText(performanceRating(eligibleGroups)):'غير متوفر')}${kpi('متوسط رضا المحاضرين','غير متوفر')}</div>
  <p class="performance-note">الشهر يحدد التسجيلات الجديدة وساعات عمل المحاضرين فقط؛ التوزيع والحالات والرضا يعرضان البيانات الحالية المتاحة، ولا يمثلان لقطة تاريخية. ${students.filter(s=>!/^\d{4}-\d{2}-\d{2}/.test(s.regDate)).length} سجلات بلا تاريخ تسجيل صالح للحساب الشهري. لا توجد حالة تجميد مستقلة مؤكدة؛ الإيقاف الحالي يُحفظ كمنسحب.</p>
  <div class="card">${Object.entries(counts).map(([status,n])=>performanceBar(performanceStatusLabel(status),n,students.length,status==='withdrawn'?'var(--danger)':'var(--primary)')).join('')}</div>
  <h3>البرامج والدفعات</h3>${model.map(p=>{const c=performanceCounts(p.students);return `<details class="card" open><summary><strong>${e(p.name||'برنامج غير محدد')}</strong> · ${p.students.length} طالب · ${p.batches.size} دفعة · فعال ${c.active||0} · منسحب ${c.withdrawn||0} · مجمد ${frozenKnown?c.frozen||0:'غير متوفر'}</summary><div class="performance-batches">${[...p.batches.entries()].map(([key,b])=>{const bc=performanceCounts(b.students),assigned=performanceBatchSubjects(b),lecturers=[...new Set(assigned.map(s=>getLecturerName(s.lecturerUserId)).filter(n=>n!=='—'))];return `<div class="performance-batch"><strong>${e(b.batch||'دفعة غير محددة')}</strong><b>${b.students.length} طالب</b><progress max="${max}" value="${b.students.length}" aria-label="عدد الطلاب"></progress><div class="performance-note">${Object.entries(bc).map(([status,n])=>performanceBar(performanceStatusLabel(status),n,b.students.length,status==='withdrawn'?'var(--danger)':'var(--primary)')).join('')}<br>رضا الطلاب: ${performanceRatingText(performanceRating(performanceBatchEvaluations(b)))}<br>المحاضرون: ${e(lecturers.join('، ')||'غير متوفر — لا توجد علاقة تسجيل مؤكدة')}</div></div>`;}).join('')}</div></details>`;}).join('')||'<div class="empty">لا توجد برامج أو طلاب مسجلون.</div>'}
  ${performanceSuccessMarkup(batches)}
  ${performanceHoursMarkup()}
  <details class="card" open><summary><strong>التقييم والرضا</strong></summary><p class="performance-note">متوسط موزون بعدد الإجابات الصالحة؛ رضا المحاضر يحسب من أسئلة عرض المحاضر واستجابته وإجاباته والتفاعل (q7–q10). التقييمات المتاحة لجميع الفترات.</p>${performanceState.evaluationState==='error'?'<div class="alert alert-warn">تعذر تحميل التقييمات. استخدم تحديث التقييمات للمحاولة مجددًا.</div>':performanceState.evaluationState==='loading'?'<div class="empty">جاري تحميل التقييمات…</div>':model.map(p=>{const groups=[...new Map([...p.batches.values()].flatMap(performanceBatchEvaluations).map(g=>[g.examId,g])).values()],rating=performanceRating(groups);return `<div class="performance-rating"><strong>${e(p.name||'برنامج غير محدد')}</strong><progress max="100" value="${rating||0}" aria-label="رضا البرنامج"></progress><span>${performanceRatingText(rating)}</span></div>`;}).join('')}<p>رضا المحاضرين: غير متوفر — يحتاج استبيانًا للمحاضرين مرتبطًا بالبرنامج والدفعة والفترة.</p></details>
  <details class="card"><summary>مصادر البيانات والبيانات المطلوبة</summary><p>الطلاب والبرامج: Firebase students / programs. المحاضرون والتسجيلات: users / subjects / enrollments. التقييمات: API /admin/evaluations. الساعات الشهرية: lecturerProductivity (productiveHours / officeHours).</p><p>يلزم إدخال يدوي لتصحيح البرامج والدفعات وتواريخ التسجيل الناقصة، وتوثيق التجميد منفصلًا عن الانسحاب. يلزم Backend لرضا المحاضرين، وسجل ساعات محاضرات مخططة لكل دفعة، ولقطات حالات تاريخية. آخر نشاط غير متوفر ما لم يوجد updatedAt أو lastActivityAt في سجل الطالب.</p></details></div>`;
  performanceBindHours();
}
function performanceIsAba(b){return b.students.some(s=>['QBA','QASP-S'].includes(getStudentListClassification(s)))||/\bABA\b|تحليل السلوك التطبيقي/i.test(b.program||'');}
function performanceHoursRows(){return users.filter(u=>u.role==='lecturer').map(u=>{
  const username=u.username||u.id||u._fbKey,record=getLecturerProductivityRecord(performanceState.period,username),draft=performanceState.hourDrafts[performanceState.period]?.[username],values=draft||record;
  const productive=values.productiveHours??'',office=values.officeHours??'',hasHours=productive!==''||office!=='';
  const assigned=performanceLecturerAssignments(u),semesters=[...new Set(assigned.filter(s=>subjects.includes(s)).map(s=>getSubjectSemesterSummary(s)).filter(s=>s.state==='ongoing').map(s=>s.name))];
  return {u,username,productive,office,hasHours,total:(Number(productive)||0)+(Number(office)||0),semester:semesters.join('، ')||'غير محدد',draft:!!draft};
});}
function performanceHoursMarkup(){
  const rows=performanceHoursRows(),recorded=rows.filter(r=>r.hasHours),productive=recorded.reduce((n,r)=>n+(Number(r.productive)||0),0),office=recorded.reduce((n,r)=>n+(Number(r.office)||0),0),e=escapeHtml;
  return `<details class="card" open><summary><strong>أداء المحاضرين — ساعات العمل الشهرية</strong></summary><p class="performance-note">أدخل الساعات الإنتاجية والمكتبية الفعلية للشهر المحدد، ثم احفظ لكل محاضر. الإجمالي = الإنتاجية + المكتبية. لا تُضاف الساعات المجدولة أو الساعات الإضافية القديمة تلقائيًا.</p><div class="performance-hour-totals">${[['الساعات الإنتاجية',productive],['الساعات المكتبية',office],['إجمالي ساعات الجميع',productive+office]].map(([label,value],index)=>`<div class="insight-card"><div class="insight-value" id="performanceHoursTotal${index}">${formatProductivityHours(value)}</div><div class="insight-label">${label}</div></div>`).join('')}</div><p class="performance-note" id="performanceHoursCoverage">${recorded.length} من ${rows.length} محاضر لديهم ساعات مرصودة. المجاميع تشمل القيم المدخلة غير المحفوظة أثناء التحرير.</p><div id="performanceHoursCharts">${performanceHoursCharts()}</div><div class="table-wrap"><table id="performanceHoursTable"><thead><tr><th>المحاضر</th><th>الفصل الحالي</th><th>ساعات إنتاجية</th><th>ساعات مكتبية</th><th>إجمالي ساعات العمل</th><th>الحفظ</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${e(r.u.name||r.username)}</td><td>${e(r.semester)}</td><td><input class="performance-hour-input" type="number" min="0" step="0.25" aria-label="ساعات إنتاجية ${e(r.u.name||r.username)}" data-hour-row="${i}" data-hour-field="productiveHours" value="${e(String(r.productive))}" placeholder="غير مرصود"></td><td><input class="performance-hour-input" type="number" min="0" step="0.25" aria-label="ساعات مكتبية ${e(r.u.name||r.username)}" data-hour-row="${i}" data-hour-field="officeHours" value="${e(String(r.office))}" placeholder="غير مرصود"></td><td id="performanceHourRowTotal${i}">${r.hasHours?formatProductivityHours(r.total):'غير مرصود'}</td><td><button class="btn btn-primary btn-sm" data-hour-save="${i}">حفظ</button><small role="status" id="performanceHourStatus${i}">${r.draft?'غير محفوظ':''}</small></td></tr>`).join('')||'<tr><td colspan="6">لا توجد حسابات محاضرين.</td></tr>'}</tbody></table></div></details>`;
}
function performanceBindHours(){
  const rows=performanceHoursRows();
  document.querySelectorAll('#performanceHoursTable [data-hour-field]').forEach(input=>input.oninput=()=>{
    const index=Number(input.dataset.hourRow),row=rows[index],period=performanceState.period;
    performanceState.hourDrafts[period]??={};performanceState.hourDrafts[period][row.username]??={productiveHours:row.productive,officeHours:row.office};
    performanceState.hourDrafts[period][row.username][input.dataset.hourField]=input.value;
    const values=performanceHoursRows();document.getElementById('performanceHourRowTotal'+index).textContent=values[index].hasHours?formatProductivityHours(values[index].total):'غير مرصود';
    document.getElementById('performanceHourStatus'+index).textContent='غير محفوظ';
    const totalProductive=values.reduce((n,r)=>n+(Number(r.productive)||0),0),totalOffice=values.reduce((n,r)=>n+(Number(r.office)||0),0),totals=[totalProductive,totalOffice,totalProductive+totalOffice];
    document.getElementById('performanceHoursCharts').innerHTML=performanceHoursCharts();
    totals.forEach((total,i)=>document.getElementById('performanceHoursTotal'+i).textContent=formatProductivityHours(total));
    document.getElementById('performanceHoursCoverage').textContent=`${values.filter(r=>r.hasHours).length} من ${values.length} محاضر لديهم ساعات مرصودة. المجاميع تشمل القيم المدخلة غير المحفوظة أثناء التحرير.`;
  });
  document.querySelectorAll('#performanceHoursTable [data-hour-save]').forEach(button=>button.onclick=()=>performanceSaveHours(Number(button.dataset.hourSave),button));
}
async function performanceSaveHours(index,button){
  if(currentUser?.role!=='admin')return;
  const row=performanceHoursRows()[index],period=performanceState.period,status=document.getElementById('performanceHourStatus'+index);
  if(!row||!/^\d{4}-\d{2}$/.test(period))return;
  const productive=Number(row.productive),office=Number(row.office);
  if(!row.hasHours||![productive,office].every(n=>Number.isFinite(n)&&n>=0)){status.textContent='أدخل ساعات صحيحة غير سالبة';return;}
  const payload={productiveHours:productive,officeHours:office,updatedAt:new Date().toISOString(),updatedBy:currentUser.username||currentUser.id||'admin'};
  button.disabled=true;status.textContent='جاري الحفظ…';
  try{
    await fbRef(`lecturerProductivity/${period}/${row.username}`).update(payload);
    lecturerProductivityData[period]??={};lecturerProductivityData[period][row.username]={...(lecturerProductivityData[period][row.username]||{}),...payload};
    const draft=performanceState.hourDrafts[period]?.[row.username];
    if(draft&&Number(draft.productiveHours)===productive&&Number(draft.officeHours)===office)delete performanceState.hourDrafts[period][row.username];
    if(performanceState.period===period&&status.isConnected)status.textContent=performanceState.hourDrafts[period]?.[row.username]?'تغييرات جديدة غير محفوظة':'تم الحفظ';
  }catch(error){if(status.isConnected)status.textContent='تعذر الحفظ — حاول مجددًا';}
  finally{button.disabled=false;}
}
function performanceSemesterResults(b){
  if(!performanceIsAba(b))return [];
  const grouped=new Map();
  performanceBatchSubjects(b).forEach(subject=>{
    const direct=subject.semesterKey&&semestersData[subject.semesterKey],matches=Object.entries(semestersData||{}).filter(([,semester])=>(semester.subjects||[]).includes(subject._fbKey)),entry=direct?[subject.semesterKey,direct]:(matches.length===1?matches[0]:null);
    const semester=entry?.[1],startDate=semester?.startDate||subject.startDate||'',endDate=semester?.endDate||subject.endDate||'',today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Karachi'}).format(new Date());
    if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||startDate>endDate||endDate>=today)return;
    const key=startDate+'|'+endDate;
    if(!grouped.has(key))grouped.set(key,{key,startDate,endDate,name:semester?.name||(subject.semesterNo?`الفصل ${subject.semesterNo}`:'فصل'),subjects:[]});
    grouped.get(key).subjects.push(subject);
  });
  return [...grouped.values()].map(semester=>{
    let tested=0,passed=0,absent=0,partial=0,eligible=0;
    b.students.forEach(student=>{
      const index=students.indexOf(student),assigned=semester.subjects.filter(subject=>(subject.students||[]).includes(index)||(enrollmentsData||[]).some(enrollment=>enrollment.studentKey===student._fbKey&&enrollment.subjectKey===subject._fbKey)||isExamEntered(grades[subjects.indexOf(subject)]?.[index]));
      if(!assigned.length)return;
      eligible++;
      const results=assigned.map(subject=>{const grade=grades[subjects.indexOf(subject)]?.[index];if(!grade?.semesterKey)return grade;const savedSemester=semestersData[grade.semesterKey];return savedSemester?(savedSemester.startDate===semester.startDate&&savedSemester.endDate===semester.endDate?grade:null):(grade.semesterKey===subject.semesterKey?grade:null);}),entered=results.filter(isExamEntered);
      if(!entered.length){if(performanceStatus(student)!=='withdrawn')absent++;else eligible--;return;}
      tested++;
      if(entered.length<results.length)partial++;
      if(entered.every(grade=>calcTotal(grade)>=Number(settings.gradeFail)))passed++;
    });
    return {...semester,program:b.program,batch:b.batch,eligible,tested,passed,absent,partial,rate:tested?Math.round(passed/tested*1000)/10:null};
  });
}
function performanceBar(label,value,max,color='var(--primary)',suffix=''){
  const number=Number(value)||0;return `<div class="performance-chart-row"><span>${escapeHtml(label)}</span><div class="performance-chart-track"><span style="width:${Math.min(100,max?number/max*100:0)}%;background:${color}"></span></div><strong>${formatProductivityHours(number)}${suffix}</strong></div>`;
}
function performanceSuccessMarkup(batches){
  const all=batches.filter(performanceIsAba).flatMap(performanceSemesterResults),semesters=[...new Map(all.map(s=>[s.key,s.name])).entries()].sort(([a],[b])=>b.localeCompare(a));
  const selected=semesters.some(([key])=>key===performanceState.semester)?performanceState.semester:(semesters[0]?.[0]||'');performanceState.semester=selected;const rows=all.filter(s=>!selected||s.key===selected),sum=field=>rows.reduce((n,r)=>n+r[field],0),tested=sum('tested'),passed=sum('passed'),absent=sum('absent'),partial=sum('partial'),rate=tested?Math.round(passed/tested*1000)/10:null;
  const chart=(title,r)=>`<section class="performance-chart-card"><strong>${escapeHtml(title)}</strong><div class="performance-success-layout"><div>${performanceBar('اختبروا',r.tested,r.tested)}${performanceBar('نجحوا ممن اختبروا',r.passed,r.tested,'var(--success)')}<div class="performance-note">${r.passed} ناجح من ${r.tested} ممن اختبروا · نسبة الاجتياز: <strong>${r.rate===null?'غير متوفرة':r.rate+'%'}</strong></div>${r.rate!==null?performanceBar('نسبة الاجتياز',r.rate,100,'var(--success)','%'):''}</div><aside class="performance-absent-counter"><strong>${r.absent}</strong><span>لم يختبروا</span><small>دون المنسحبين · خارج نسبة الاجتياز</small></aside></div><p class="performance-note">${r.partial} ممن اختبروا بقيت لهم اختبارات؛ النجاح الحالي يعتمد على نتائج الاختبارات التي قدموها فقط.</p></section>`;
  return `<details class="card" open><summary><strong>الاختبارات ونسبة النجاح — ABA</strong></summary><label class="performance-semester-filter">الفصل <select aria-label="فصل نسبة النجاح" onchange="performanceFilter('semester',this.value)">${semesters.map(([key,name])=>`<option value="${escapeHtml(key)}" ${key===selected?'selected':''}>${escapeHtml(key.split('|').join(' إلى '))}</option>`).join('')}</select></label><p class="performance-note">يُحسب الفصل المكتمل فقط وفق تاريخ بدايته ونهايته، وتُستبعد الفصول المستقبلية والجارية والفصول التي لم تُحدد مدتها. الفترة المحددة: ${escapeHtml(selected.split('|').join(' إلى ')||'غير متوفرة')}. اختبروا = قدموا اختبارًا نهائيًا واحدًا على الأقل من مقررات هذا الفصل. نجحوا ممن اختبروا = اجتازوا جميع الاختبارات التي قدموها وسُجلت نتائجها في هذه الفترة، حسب حد النظام (${escapeHtml(String(settings.gradeFail))}). نسبة النجاح = المجتازون ÷ الذين اختبروا. لا تدخل الاختبارات التي لم يقدمها الطالب في حكم نجاحه الحالي. العداد الجانبي لمن لم يقدموا أي اختبار يستبعد المنسحبين ولا يدخل في مقام النسبة. OBM برنامج مستمر، ولا تدخل دفعاته في الحساب. </p>${rows.length?chart('إجمالي دفعات ABA'+(selected?' — '+selected.split('|').join(' إلى '):''),{eligible:sum('eligible'),tested,passed,absent,partial,rate}):'<div class="empty">لا توجد فصول ABA مكتملة بمدة محددة لعرض النتائج.</div>'}<div class="performance-charts">${rows.map(r=>chart([r.program,r.batch,r.name,r.startDate+' إلى '+r.endDate].join(' / '),r)).join('')}</div></details>`;
}
function performanceHoursCharts(){
  const rows=performanceHoursRows(),max=Math.max(1,...rows.map(r=>r.total));
  const productive=rows.reduce((n,r)=>n+(Number(r.productive)||0),0),office=rows.reduce((n,r)=>n+(Number(r.office)||0),0),total=productive+office;
  return `<section class="performance-chart-card"><strong>إجمالي ساعات الجميع — ${escapeHtml(performanceState.period)}</strong>${performanceBar('إنتاجية',productive,Math.max(1,total))}${performanceBar('مكتبية',office,Math.max(1,total),'#7c3aed')}${performanceBar('إجمالي العمل',total,Math.max(1,total),'var(--success)')}</section><div class="performance-charts">${rows.map(r=>`<section class="performance-chart-card"><strong>${escapeHtml(r.u.name||r.username)}</strong>${r.hasHours?performanceBar('إنتاجية',Number(r.productive)||0,max)+performanceBar('مكتبية',Number(r.office)||0,max,'#7c3aed')+performanceBar('إجمالي العمل',r.total,max,'var(--success)'):'<p class="performance-note">لم تُرصد ساعات هذا الشهر</p>'}</section>`).join('')}</div>`;
}
