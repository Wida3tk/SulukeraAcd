let facultyCoursesTab='current';
function facultyCourseGroups(subjects,terms,today){
 const groups={current:[],finished:[],upcoming:[],unclassified:[]},linked=new Set();
 for(const [key,term] of Object.entries(terms||{})){
  const rows=subjects.filter(s=>(term.subjects||[]).includes(s.key));if(!rows.length)continue;
  rows.forEach(s=>linked.add(s.key));const start=String(term.startDate||'').replace(/\//g,'-'),end=String(term.endDate||'').replace(/\//g,'-');
  const status=end&&end<today?'finished':start&&start>today?'upcoming':start&&end?'current':['inactive','completed','ended','archived'].includes(term.status)?'finished':'unclassified';
  groups[status].push({key,term,rows,start,end});
 }
 const unmatched=subjects.filter(s=>!linked.has(s.key));if(unmatched.length)groups.unclassified.push({key:'unclassified',term:{name:'مقررات بلا فصل مرتبط'},rows:unmatched,start:'',end:''});
 for(const items of Object.values(groups))items.sort((a,b)=>b.start.localeCompare(a.start));return groups;
}
function facultyCourseDate(value){return value?cwEscape(value.replace(/-/g,'/')): 'لم يحدد';}
function renderFacultyCoursesArchive(){
 if(currentUser?.role!=='lecturer')return;
 const groups=facultyCourseGroups(getLecturerSubjects(true),dbData.semesters,new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'}));
 const tabs=[['current','الفصل الحالي'],['finished','المقررات المنتهية'],['upcoming','الفصول القادمة'],['unclassified','غير مرتبطة بفصل']].filter(([key])=>['current','finished'].includes(key)||groups[key].length);
 document.getElementById('mainContent').innerHTML=`<div class="fe-shell"><section class="cw-report-hero"><span class="cw-eyebrow">المقررات · سجل الفصول</span><h2>المقررات</h2><p>مقرراتك الحالية وأرشيف المقررات المنتهية، مع فترة كل فصل.</p></section><div class="cw-report-tabs">${tabs.map(([key,label])=>`<button class="${facultyCoursesTab===key?'active':''}" onclick="facultyCoursesTab='${key}';renderFacultyCoursesArchive()">${label} <span>${groups[key].reduce((n,g)=>n+g.rows.length,0)}</span></button>`).join('')}</div>${groups[facultyCoursesTab].length?groups[facultyCoursesTab].map(group=>`<section class="card"><div class="fe-context"><strong>${cwEscape(group.term.name||'الفصل الدراسي')}</strong><span>تاريخ البدء: <b dir="ltr">${facultyCourseDate(group.start)}</b> · تاريخ الانتهاء: <b dir="ltr">${facultyCourseDate(group.end)}</b></span></div><div class="table-wrap"><table><thead><tr><th>#</th><th>المقرر</th><th>الدفعة</th><th>عدد الطلاب</th><th>المرصود نهائيًا</th><th>الرخصة</th></tr></thead><tbody>${group.rows.map((subject,i)=>{const students=getSubjectStudents(subject.key);return `<tr><td>${i+1}</td><td><strong>${cwEscape(subject.name)}</strong></td><td>${cwEscape(subject.batch||'—')}</td><td>${students.length}</td><td>${students.filter(s=>isExamEntered(getGrade_data(s.fbKey,subject.key))).length}</td><td>${cwEscape(subject.eligiblePlans?.join(' / ')||'عام')}</td></tr>`;}).join('')}</tbody></table></div></section>`).join(''):'<section class="card"><div class="empty">لا توجد مقررات ضمن هذا القسم.</div></section>'}</div>`;
}
