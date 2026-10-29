/* Publication preserves results/exceptions; the closing timestamp determines availability. */
let examScheduleAdminView='current';
function examScheduleEnded(row,now=Date.now()){
 const value=`${row.date||''}T${row.endTime||'23:59'}:00+03:00`,end=Date.parse(value);
 return Number.isFinite(end)&&now>end;
}
function examScheduleState(row,now=Date.now()){
 if(examScheduleEnded(row,now))return {label:'منتهٍ · باستثناء معتمد فقط',badge:'badge-warn'};
 if(row.published===false)return {label:'مسودة',badge:'badge-warn'};
 const start=Date.parse(`${row.date}T${row.startTime||'00:00'}:00+03:00`);
 return {label:Number.isFinite(start)&&now>=start?'متاح في موعده':'مجدول',badge:'badge-pass'};
}
function renderExamSchedulesAdminList(){
 const host=document.getElementById('examSchedulesAdminList');if(!host)return;
 const now=Date.now(),all=Object.entries(examSchedulesData||{}).map(([key,value])=>({key,...value})),ended=all.filter(row=>examScheduleEnded(row,now)),current=all.filter(row=>!examScheduleEnded(row,now));
 const rows=(examScheduleAdminView==='ended'?ended:current).sort((a,b)=>`${a.batch}|${a.date}|${a.startTime}`.localeCompare(`${b.batch}|${b.date}|${b.startTime}`));
 renderExamSchedulesAdminRows(rows);
 const nav=document.createElement('nav');nav.setAttribute('aria-label','حالة الاختبارات');nav.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px';
 for(const [view,label,count]of [['current','الاختبارات الحالية والقادمة',current.length],['ended','اختبارات منتهية',ended.length]]){const button=document.createElement('button');button.type='button';button.className='btn '+(examScheduleAdminView===view?'btn-primary':'');button.setAttribute('aria-pressed',String(examScheduleAdminView===view));button.textContent=`${label} (${count})`;button.onclick=()=>{examScheduleAdminView=view;renderExamSchedulesAdminList();};nav.append(button);}
 host.prepend(nav);
 if(examScheduleAdminView==='ended'){const note=document.createElement('p');note.className='alert alert-info';note.textContent='هذه اختبارات منتهية. تبقى نتائجها ومحاولاتها محفوظة، ولا يفتح الاختبار لطالب بعد موعده إلا باستثناء معتمد ضمن المدة المحددة له.';nav.after(note);}
}
