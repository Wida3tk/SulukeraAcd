/* Admin-only, read-only grading dashboard. Counts grade components, not totals. */
function lpFields(grade){
 const fields=[];
 for(let week=1;week<=4;week++)for(const [field,label] of [['attend','الحضور'],['hw','الواجب'],['disc','المناقشة']])fields.push({week,field,label:`المحاضرة ${week} · ${label}`,entered:isCourseworkFieldEntered(grade,'w'+week,field)});
 fields.push({week:0,field:'exam',label:'الاختبار النهائي',entered:isExamEntered(grade)});return fields;
}
function lpCount(fields){return {total:fields.length,graded:fields.filter(f=>f.entered).length,remaining:fields.filter(f=>!f.entered).length,overdue:fields.filter(f=>!f.entered&&f.overdue).length};}
let lpExtra=null,lpLoading=false,lpError='',lpMode='all',lpSearch='',lpOnlyOverdue=false;
function lpDate(value){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ar-SA-u-ca-gregory-nu-latn',{timeZone:'Asia/Riyadh'}):'غير متوفرة';}
function lpRows(){
 const now=Date.now();
 return users.filter(u=>u.role==='lecturer').map(user=>{
  const ids=new Set([user.id,user.username,user._fbKey,user.authUid].filter(Boolean));
  const courses=subjects.map((s,idx)=>({...s,idx})).filter(s=>ids.has(s.lecturerUserId)||(user.subjects||[]).includes(s._fbKey)).map(subject=>{
   const term=getSubjectSemesterSummary(subject),lessons=(lpExtra?.lessons||[]).filter(l=>l.subject_key===subject._fbKey);
   const rows=getSubjectStudentIdxs(subject).map(index=>{
    const grade=grades[subject.idx]?.[index]||{},all=lpFields(grade);
    const fields=all.filter(f=>{
     if(term.state==='finished'){f.overdue=true;return true;}
     if(term.state==='upcoming')return false;
     const lesson=lessons.find(l=>Number(l.week)===f.week);
     if(!lesson||lesson.status!=='published'||!Number.isFinite(Date.parse(lesson.opens_at)))return false;
     f.overdue=Number.isFinite(Date.parse(lesson.closes_at))&&Date.parse(lesson.closes_at)<now;
     return Date.parse(lesson.opens_at)<=now;
    });
    return {index,student:students[index],grade,fields,...lpCount(fields),recorded:all.filter(f=>f.entered).length};
   });
   return {subject,term,rows,undated:term.state==='ongoing'&&lessons.length===0};
  }).filter(c=>lpMode==='all'||(lpMode==='finished'?c.term.state==='finished':c.term.state==='ongoing'));
  const fields=courses.flatMap(c=>c.rows.flatMap(r=>r.fields));
  const reviews=(lpExtra?.reviews||[]).filter(r=>ids.has(r.reviewed_by)&&courses.some(c=>c.subject._fbKey===r.subject_key));
  // Grade timestamps are attributable only when the recorded actor matches this lecturer.
  const saved=courses.flatMap(c=>c.rows).filter(r=>ids.has(r.grade.updatedBy)&&r.grade.updatedAt).map(r=>r.grade.updatedAt);
  const last=[...saved,...reviews.map(r=>r.reviewed_at)].filter(v=>Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  return {user,courses,reviews,last,students:new Set(courses.flatMap(c=>c.rows.map(r=>r.student._fbKey))).size,...lpCount(fields)};
 });
}
async function renderLecturerPerformance(force=false){
 const host=document.getElementById('lecturerPerformanceContent');if(!host)return;
 if(currentUser?.role!=='admin'){host.innerHTML='<div class="card">هذه الصفحة للإدارة فقط.</div>';return;}
 if((!lpExtra||force)&&!lpLoading){lpLoading=true;lpPaint();try{
   const token=await firebase.auth().currentUser.getIdToken();
   const response=await fetch(EXAM_API_BASE+'/admin/lecturer-performance',{headers:{Authorization:'Bearer '+token}});
   if(!response.ok)throw Error('تعذر تحميل مواعيد المحاضرات وبيانات الدخول');lpExtra=await response.json();lpError='';
  }catch(e){lpError=e.message;}finally{lpLoading=false;}}
 lpPaint();
}
function lpPaint(){
 const host=document.getElementById('lecturerPerformanceContent');if(!host||currentUser?.role!=='admin')return;
 const all=lpRows(),rows=all.filter(r=>(!lpOnlyOverdue||r.overdue>0)&&(!lpSearch||String(r.user.name||r.user.username).toLowerCase().includes(lpSearch.toLowerCase()))),sum=key=>all.reduce((n,r)=>n+r[key],0);
 host.innerHTML=`<div class="lp-shell"><section class="lp-hero"><small>لوحة المتابعة الإدارية</small><h2>أداء المحاضرين</h2><p>رصد واضح، متابعة دقيقة، ودرجات لا تبقى معلّقة.</p><button class="btn" onclick="renderLecturerPerformance(true)" ${lpLoading?'disabled':''}>${lpLoading?'جاري التحديث…':'تحديث البيانات'}</button></section><div class="lp-stats">${[[all.length,'المحاضرون'],[sum('graded'),'بنود مرصودة'],[sum('remaining'),'بنود متبقية متاحة للرصد'],[sum('overdue'),'بنود متأخرة']].map(([n,l])=>`<article><strong>${n}</strong><span>${l}</span></article>`).join('')}</div><section class="lp-tools"><label>الفصل<select onchange="lpMode=this.value;lpPaint()"><option value="all" ${lpMode==='all'?'selected':''}>جميع الفصول</option><option value="current" ${lpMode==='current'?'selected':''}>الفصل الحالي</option><option value="finished" ${lpMode==='finished'?'selected':''}>الفصول المنتهية</option></select></label><label>بحث عن محاضر<input id="lpSearch" value="${cwEscape(lpSearch)}" oninput="lpSearch=this.value;lpPaintSearch()" placeholder="اسم المحاضر"></label><label class="lp-check"><input type="checkbox" ${lpOnlyOverdue?'checked':''} onchange="lpOnlyOverdue=this.checked;lpPaint()"> لديهم رصد متأخر فقط</label></section><p class="lp-note">النسب تحسب بنود الحضور والواجب والمناقشة المتاحة، وكل بنود الفصول المنتهية بما فيها الاختبار. الصفر المرصود محسوب؛ المحاضرات القادمة ليست متأخرة. الطلاب النشطون فقط. لا تُنسب الدرجات الآلية إلى المحاضر.</p>${lpError?`<p class="lp-warning">${cwEscape(lpError)}. بيانات الفصل الحالي غير مكتملة؛ لا نعتمد أرقامها حتى نجاح التحديث.</p>`:''}${!lpExtra?.loginAvailable&&lpExtra?'<p class="lp-warning">تعذر قراءة سجل الدخول؛ آخر الدخول غير متوفر حاليًا.</p>':''}<div class="lp-grid">${rows.map(r=>lpCard(r)).join('')||'<div class="card">لا يوجد محاضر مطابق للتصفية.</div>'}</div></div>`;
}
function lpPaintSearch(){const input=document.getElementById('lpSearch'),position=input.selectionStart;lpPaint();const next=document.getElementById('lpSearch');next.focus();next.setSelectionRange(position,position);}
function lpCard(r){
 const percent=r.total?Math.round(r.graded/r.total*100):null,key=encodeURIComponent(r.user._fbKey||r.user.id||r.user.username);
 return `<article class="lp-card ${r.overdue?'lp-late':''}"><header><div><small>عضو هيئة التدريس</small><h3>${cwEscape(r.user.name||r.user.username)}</h3></div><span class="lp-badge">${r.overdue?r.overdue+' بند متأخر':'لا يوجد رصد متأخر'}</span></header><div class="lp-mini">${[[r.courses.length,'مقررات مسندة'],[r.students,'طلاب دون تكرار'],[r.graded,'مرصود'],[r.remaining,'متبقي']].map(([n,l])=>`<div><strong>${n}</strong><span>${l}</span></div>`).join('')}</div><div class="lp-progress"><span>اكتمال الرصد <b>${percent===null?'لا توجد بنود مستحقة':percent+'%'}</b></span><progress max="100" value="${percent||0}"></progress></div><div class="lp-times"><span>آخر دخول فعلي <b dir="auto">${lpDate(lpExtra?.logins?.[r.user.authUid||r.user._fbKey])}</b></span><span>آخر رصد منسوب للمحاضر <b dir="auto">${lpDate(r.last)}</b></span></div><button class="btn btn-primary" onclick="lpDetails('${key}')">تفاصيل الرصد والطلاب ←</button></article>`;
}
function lpDetails(key){
 if(currentUser?.role!=='admin')return;const r=lpRows().find(r=>(r.user._fbKey||r.user.id||r.user.username)===decodeURIComponent(key));if(!r)return;
 document.getElementById('lpDialog')?.remove();const box=document.createElement('dialog');box.id='lpDialog';box.className='lp-dialog';
 box.innerHTML=`<header><div><small>تفاصيل أداء المحاضر</small><h2>${cwEscape(r.user.name)}</h2></div><button class="btn" onclick="document.getElementById('lpDialog').close()">إغلاق ×</button></header><p class="lp-note">الأسماء أدناه من التسجيلات الفعلية؛ لا نغيّر الدرجات أو التسجيلات. وقت تحديث سجل الدرجة قد يكون تحديثًا آليًا، وليس وقت دخول أو رصد المحاضر.</p>${r.courses.map(c=>`<details class="lp-course" ${c.rows.some(x=>x.remaining)?'open':''}><summary><strong>${cwEscape(c.subject.name)} · ${cwEscape(c.subject.batch)}</strong><span>${cwEscape(c.term.name)} · ${c.rows.length} طالب</span></summary><p class="lp-note" dir="auto">${cwEscape(c.term.startDate||'تاريخ البدء غير محدد')} — ${cwEscape(c.term.endDate||'تاريخ الانتهاء غير محدد')}</p>${c.undated?'<p class="lp-warning">لم تتوفر مواعيد المحاضرات؛ لا نصنف النقص كمتأخر.</p>':''}<div class="lp-table"><table><thead><tr><th>الطالب</th><th>المرصود / المستحق</th><th>البنود المتبقية</th><th>آخر تحديث سجل الدرجة</th></tr></thead><tbody>${c.rows.map(row=>`<tr><td><strong>${cwEscape(cwName(row.student))}</strong><small>${cwEscape(row.student.id)}</small></td><td>${row.graded} / ${row.total}</td><td>${row.fields.filter(f=>!f.entered).map(f=>`<span class="lp-field ${f.overdue?'lp-field-late':''}">${cwEscape(f.label)}</span>`).join('')||(row.total?'مكتمل':'لا يوجد رصد مستحق معروف')}</td><td>${lpDate(row.grade.updatedAt)}<small>${cwEscape(row.grade.updatedBy||'فاعل التحديث غير متوفر')}</small></td></tr>`).join('')}</tbody></table></div></details>`).join('')||'<p>لا توجد مقررات في العرض المحدد.</p>'}<h3>التصحيحات المحفوظة باسم المحاضر</h3><p class="lp-note">آخر تصحيح محفوظ للمناقشات وواجب الحضور المسجل؛ ليس سجلًا كاملًا لكل تعديل تاريخي. الدرجات القديمة اليدوية تظهر أعلاه بتوقيت آخر تحديث محفوظ.</p><div class="lp-timeline">${r.reviews.slice(0,100).map(e=>`<article><strong>${cwEscape(cwName(students.find(s=>s._fbKey===e.student_key)||{name:e.student_key}))}</strong><span>${cwEscape(subjects.find(s=>s._fbKey===e.subject_key)?.name||e.subject_key)} · المحاضرة ${e.week} · ${e.kind==='discussion'?'المناقشة':'واجب الحضور المسجل'} · الدرجة ${cwEscape(e.score)}</span><time>${lpDate(e.reviewed_at)}</time></article>`).join('')||'<p>لا توجد تصحيحات مؤرخة متوفرة لهذا العرض.</p>'}</div>`;
 document.body.appendChild(box);box.showModal();
}
