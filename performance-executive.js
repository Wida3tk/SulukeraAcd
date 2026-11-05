/* Executive meeting view for «الأداء والتقدم». Read-only: it renders existing loaded data and never writes. */
const perfExec={lecturer:{state:'idle',data:null},modal:null};

function execMonths(end,count){const out=[];for(let i=count-1;i>=0;i--)out.push(reviewMonth(end,-i));return out;}
function execMonthLabel(value){return new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-01T12:00:00Z'));}
function execShortMonth(value){return new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{month:'short',timeZone:'UTC'}).format(new Date(value+'-01T12:00:00Z'));}
function execRegistrations(rows,month){return rows.filter(s=>reviewDate(s.regDate).slice(0,7)===month).length;}
function execNumber(value,digits=0){return new Intl.NumberFormat('en-US',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(value);}
function execDelta(current,previous){if(!previous&&!current)return {cls:'flat',text:'بدون تغيير'};if(!previous)return {cls:'up',text:'↑ جديد هذا الشهر'};const d=current-previous,p=Math.round(d/previous*100);return d>0?{cls:'up',text:`↑ ${p}% عن الشهر السابق`}:d<0?{cls:'down',text:`↓ ${Math.abs(p)}% عن الشهر السابق`}:{cls:'flat',text:'مثل الشهر السابق'};}
function execPrograms(){return reviewModel().filter(p=>p.students.length);}
function execActive(rows){return rows.filter(s=>performanceStatus(s)==='active').length;}

/* Vertical bars, oldest month on the right to read naturally in Arabic. */
function execBarChart(items,{height=260,label='',color='#0C40FB'}={}){
 const n=items.length,w=Math.max(360,n*72),top=34,bottom=40,plot=height-top-bottom,max=Math.max(1,...items.map(i=>i.value)),step=w/n,bar=Math.min(46,step*.58);
 const bars=items.map((it,i)=>{const x=w-(i+1)*step+(step-bar)/2,h=it.value/max*plot,y=top+plot-h,fill=it.highlight?color:'#C9D4EA';
  return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bar.toFixed(1)}" height="${Math.max(h,it.value?2:0).toFixed(1)}" rx="6" fill="${fill}"><title>${escapeHtml(it.title||it.label)}: ${it.value}</title></rect><text x="${(x+bar/2).toFixed(1)}" y="${(y-9).toFixed(1)}" text-anchor="middle" class="px-bar-value${it.highlight?' is-on':''}">${execNumber(it.value)}</text><text x="${(x+bar/2).toFixed(1)}" y="${(height-12).toFixed(1)}" text-anchor="middle" class="px-bar-label${it.highlight?' is-on':''}">${escapeHtml(it.label)}</text></g>`;}).join('');
 return `<svg class="px-chart" viewBox="0 0 ${w} ${height}" role="img" aria-label="${escapeHtml(label)}" preserveAspectRatio="xMidYMid meet"><line x1="0" x2="${w}" y1="${top+plot}" y2="${top+plot}" stroke="#E2E8F2"/>${bars}</svg>`;
}
/* Horizontal comparison bars: current month vs previous per category. */
function execCompareBars(rows,{currentLabel,previousLabel}){
 const max=Math.max(1,...rows.flatMap(r=>[r.current,r.previous]));
 return `<div class="px-compare"><div class="px-legend"><span><i class="is-prev"></i>${escapeHtml(previousLabel)}</span><span><i class="is-cur"></i>${escapeHtml(currentLabel)}</span></div>${rows.map(r=>`<div class="px-compare-row"><span class="px-compare-name">${escapeHtml(r.name)}</span><div class="px-compare-bars"><div class="px-hbar is-prev" style="width:${r.previous/max*100}%"><b>${execNumber(r.previous)}</b></div><div class="px-hbar is-cur" style="width:${r.current/max*100}%"><b>${execNumber(r.current)}</b></div></div></div>`).join('')}</div>`;
}
function execRing(percent,color){const p=percent===null?0:Math.max(0,Math.min(100,percent)),r=52,c=2*Math.PI*r;return `<svg viewBox="0 0 128 128" class="px-ring" aria-hidden="true"><circle cx="64" cy="64" r="${r}" fill="none" stroke="#E7ECF5" stroke-width="12"/><circle cx="64" cy="64" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c*p/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 64 64)"/></svg>`;}
function execPercent(value){return value===null||value===undefined||!Number.isFinite(value)?'—':execNumber(value,1)+'%';}

function execStudentSatisfaction(){
 if(performanceState.evaluationState!=='ready')return null;const groups=performanceState.groups||[];
 const dim=keys=>typeof evaluationDimension==='function'?evaluationDimension(groups,keys):{percent:null,count:0};
 const sections=[['المحتوى العلمي',['q5','q6']],['أداء المحاضر',['q7','q8','q9','q10']],['التنظيم',['q11','q12','q13']],['الدعم والمتابعة',['q14','q15']]];
 const courses=groups.map(g=>({name:g.subjectName||g.subjectKey||'مقرر',batch:g.batch||'',responses:Number(g.responseCount||0),r:(typeof evaluationDimension==='function'?evaluationDimension([g],['q5','q6','q7','q8','q9','q10','q11','q12','q13','q14','q15']):{percent:null})})).filter(c=>c.r.percent!==null).sort((a,b)=>b.r.percent-a.r.percent);
 return {overall:dim(['q5','q6','q7','q8','q9','q10','q11','q12','q13','q14','q15']),sections:sections.map(([name,keys])=>({name,...dim(keys)})),responses:groups.reduce((n,g)=>n+Number(g.responseCount||0),0),reports:groups.length,courses};
}
async function execLoadLecturers(){
 if(perfExec.lecturer.state!=='idle'||typeof lecturerSurveyRequest!=='function')return;perfExec.lecturer.state='loading';
 const user=currentUser;try{const data=await lecturerSurveyRequest('/admin/lecturer-satisfaction');if(currentUser!==user)return;perfExec.lecturer={state:'ready',data};}catch{perfExec.lecturer={state:'error',data:null};}
 if(currentUser?.role==='admin'&&document.getElementById('perfExec'))execRefreshPanel();
}
function execLecturerSatisfaction(){
 const d=perfExec.lecturer.data;if(perfExec.lecturer.state!=='ready'||!d)return null;const q=d.questions||{},avg=keys=>{const v=keys.map(k=>q[k]?.percent).filter(x=>Number.isFinite(x));return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
 return {overall:d.overallPercent??null,responses:d.responseCount||0,rate:d.responseRate??null,period:d.campaign?.periodLabel||'',recommendation:d.recommendationAverage??null,sections:[{name:'التواصل',percent:avg(['responseSpeed','responseClarity'])},{name:'الدعم الإداري',percent:avg(['supportBefore','supportDuring','instructions'])},{name:'التجربة العامة',percent:d.overallPercent??null}]};
}

function execSatisfactionMarkup(){
 const s=execStudentSatisfaction(),l=execLecturerSatisfaction(),state=performanceState.evaluationState;
 const bars=list=>list.map(x=>`<div class="px-sat-row"><span>${escapeHtml(x.name)}</span><div class="px-sat-track"><i style="width:${x.percent===null?0:Math.max(0,Math.min(100,x.percent))}%"></i></div><b>${execPercent(x.percent)}</b></div>`).join('');
 const card=(title,sub,value,color,detail,body)=>`<article class="px-sat-card"><header><div><h4>${title}</h4><p>${sub}</p></div><div class="px-ring-wrap">${execRing(value,color)}<strong>${execPercent(value)}</strong></div></header><p class="px-sat-detail">${detail}</p>${body}</article>`;
 const student=s?card('رضا الطلاب','تقييمات المقررات المكتملة حتى الآن',s.overall.percent,'#0C40FB',`${execNumber(s.responses)} استجابة · ${execNumber(s.reports)} تقرير مقرر`,bars(s.sections)+(s.courses.length?`<details class="px-courses"><summary>الرضا حسب المقرر (${s.courses.length})</summary>${bars(s.courses.slice(0,12).map(c=>({name:c.name+(c.batch?' · '+c.batch:''),percent:c.r.percent})))}</details>`:'')):`<article class="px-sat-card is-empty"><h4>رضا الطلاب</h4><p>${state==='error'?'تعذر تحميل التقييمات؛ لا تُعرض أرقام بديلة.':'جاري تحميل تقييمات الطلاب…'}</p></article>`;
 const lect=l?card('رضا المحاضرين',escapeHtml(l.period||'آخر استبيان للمحاضرين'),l.overall,'#0E9F7E',`${execNumber(l.responses)} استجابة${l.rate===null?'':' · مشاركة '+execPercent(l.rate)}${l.recommendation===null?'':' · التوصية '+execNumber(l.recommendation,1)+' / 10'}`,bars(l.sections)):`<article class="px-sat-card is-empty"><h4>رضا المحاضرين</h4><p>${perfExec.lecturer.state==='error'?'تعذر تحميل استبيان المحاضرين.':'جاري تحميل استبيان المحاضرين…'}</p></article>`;
 return `<section class="px-section" aria-labelledby="pxSatTitle"><div class="px-section-head"><h3 id="pxSatTitle">الرضا</h3><p>نسبة الرضا = مجموع درجات الإجابات ÷ الدرجة الكاملة، من التقييمات التي اكتملت حتى الآن</p></div><div class="px-sat-grid">${student}${lect}</div></section>`;
}

function execProgramCard(p,month,prev){
 const cur=execRegistrations(p.students,month),before=execRegistrations(p.students,prev),delta=execDelta(cur,before),spark=execMonths(month,6).map(m=>execRegistrations(p.students,m)),max=Math.max(1,...spark);
 return `<button class="px-program" type="button" data-exec-program="${escapeHtml(p.name)}" aria-label="تحليل ${escapeHtml(p.name)}"><span class="px-program-name">${escapeHtml(p.name)}</span><span class="px-program-total"><strong>${execNumber(p.students.length)}</strong><small>متدرب</small></span><span class="px-program-meta">${execNumber(execActive(p.students))} فعال · ${execNumber(cur)} تسجيل في ${escapeHtml(execMonthLabel(month))}</span><span class="px-spark" aria-hidden="true">${spark.slice().reverse().map((v,i)=>`<i style="height:${Math.max(6,v/max*100)}%" class="${i===0?'is-on':''}"></i>`).join('')}</span><span class="px-delta is-${delta.cls}">${delta.text}</span><span class="px-open">عرض التحليل ←</span></button>`;
}

function execPanelMarkup(){
 const month=performanceState.period,prev=reviewMonth(month,-1),programs=execPrograms(),all=students,cur=execRegistrations(all,month),before=execRegistrations(all,prev),delta=execDelta(cur,before),active=execActive(all),s=execStudentSatisfaction(),l=execLecturerSatisfaction();
 const kpi=(label,value,sub,cls='')=>`<div class="px-kpi ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
 return `<header class="px-head"><div><span class="px-eyebrow">لوحة الاجتماع التنفيذي</span><h2>أداء الأكاديمية · ${escapeHtml(execMonthLabel(month))}</h2><p>مقارنة مع ${escapeHtml(execMonthLabel(prev))} · من سجلات الطلاب والتقييمات المحفوظة في النظام</p></div><div class="px-actions"><label>الشهر<input type="month" value="${month}" max="${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).format(new Date())}" onchange="performanceFilter('period',this.value)"></label><button class="px-btn" type="button" data-exec-program="__all">التسجيلات الشهرية لكل البرامج</button><button class="px-btn px-primary" type="button" onclick="execPresentation()">${document.fullscreenElement?.id==='perfExec'?'إنهاء العرض':'وضع الاجتماع ⛶'}</button></div></header>
 <div class="px-kpis">${kpi('إجمالي المتدربين',execNumber(all.length),`${execNumber(active)} فعال حاليًا`)}${kpi(`تسجيلات ${escapeHtml(execMonthLabel(month))}`,execNumber(cur),`<em class="is-${delta.cls}">${delta.text}</em>`)}${kpi('رضا الطلاب',s?execPercent(s.overall.percent):'—',s?execNumber(s.responses)+' استجابة':'قيد التحميل')}${kpi('رضا المحاضرين',l?execPercent(l.overall):'—',l?execNumber(l.responses)+' استجابة':'قيد التحميل')}</div>
 <section class="px-section" aria-labelledby="pxProgTitle"><div class="px-section-head"><h3 id="pxProgTitle">المتدربون حسب البرنامج</h3><p>اضغطي على أي برنامج لعرض تسجيلاته الشهرية وتوزيعه</p></div><div class="px-programs">${programs.map(p=>execProgramCard(p,month,prev)).join('')||'<p class="px-empty">لا توجد سجلات طلاب.</p>'}</div></section>
 ${execSatisfactionMarkup()}
 <p class="px-note">التسجيلات تُحسب من تاريخ التسجيل المحفوظ لكل طالب؛ ${execNumber(all.filter(s=>!reviewDate(s.regDate)).length)} سجلًا بلا تاريخ صالح لا تدخل في الأشهر. الشهر الجاري يُعرض حتى اليوم.</p>`;
}
function execRefreshPanel(){const el=document.getElementById('perfExec');if(el)el.innerHTML=execPanelMarkup();if(perfExec.modal)execOpen(perfExec.modal,true);}

function execModalMarkup(key){
 const month=performanceState.period,prev=reviewMonth(month,-1),months=execMonths(month,12),programs=execPrograms();
 const series=rows=>months.map(m=>({label:execShortMonth(m),title:execMonthLabel(m),value:execRegistrations(rows,m),highlight:m===month}));
 if(key==='__all'){
  const rows=programs.map(p=>({name:p.name,current:execRegistrations(p.students,month),previous:execRegistrations(p.students,prev)}));
  const total=series(students),sum=total.reduce((a,b)=>a+b.value,0);
  return `<header class="px-modal-head"><div><span class="px-eyebrow">كل البرامج</span><h3>التسجيلات الشهرية</h3><p>آخر 12 شهرًا حتى ${escapeHtml(execMonthLabel(month))} · ${execNumber(sum)} تسجيلًا</p></div><button class="px-close" type="button" data-exec-close aria-label="إغلاق">✕</button></header>
  <div class="px-modal-grid"><article class="px-panel px-wide"><h4>التسجيلات الجديدة شهريًا</h4>${execBarChart(total,{label:'التسجيلات الشهرية لكل البرامج'})}</article><article class="px-panel px-wide"><h4>${escapeHtml(execMonthLabel(month))} مقارنة بـ${escapeHtml(execMonthLabel(prev))} حسب البرنامج</h4>${execCompareBars(rows,{currentLabel:execMonthLabel(month),previousLabel:execMonthLabel(prev)})}</article></div>`;
 }
 const p=programs.find(x=>x.name===key);if(!p)return '<p class="px-empty">البرنامج غير موجود.</p>';
 const cur=execRegistrations(p.students,month),before=execRegistrations(p.students,prev),delta=execDelta(cur,before);
 const status=[['active','فعال','#0C40FB'],['frozen','مجمد','#D99A21'],['suspended','موقوف','#8B5CF6'],['withdrawn','منسحب','#94A3B8']].map(([k,label,color])=>({label,color,count:p.students.filter(s=>performanceStatus(s)===k).length})).filter(x=>x.count),total=p.students.length;
 const tracks=new Map();p.students.forEach(s=>{const t=s.planType||s.track||'غير محدد';const r=tracks.get(t)||{name:t,current:0,previous:0,total:0};r.total++;const m=reviewDate(s.regDate).slice(0,7);if(m===month)r.current++;if(m===prev)r.previous++;tracks.set(t,r);});
 const trackRows=[...tracks.values()].sort((a,b)=>b.total-a.total);
 return `<header class="px-modal-head"><div><span class="px-eyebrow">تحليل البرنامج</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(execMonthLabel(month))} مقارنة بـ${escapeHtml(execMonthLabel(prev))}</p></div><button class="px-close" type="button" data-exec-close aria-label="إغلاق">✕</button></header>
 <div class="px-kpis is-modal"><div class="px-kpi"><span>إجمالي المتدربين</span><strong>${execNumber(total)}</strong><small>${execNumber(execActive(p.students))} فعال</small></div><div class="px-kpi"><span>تسجيلات ${escapeHtml(execMonthLabel(month))}</span><strong>${execNumber(cur)}</strong><small><em class="is-${delta.cls}">${delta.text}</em></small></div><div class="px-kpi"><span>تسجيلات ${escapeHtml(execMonthLabel(prev))}</span><strong>${execNumber(before)}</strong><small>الشهر السابق</small></div></div>
 <div class="px-modal-grid"><article class="px-panel px-wide"><h4>التسجيلات الشهرية · آخر 12 شهرًا</h4>${execBarChart(series(p.students),{label:'التسجيلات الشهرية: '+p.name})}</article>
 <article class="px-panel"><h4>حسب المسار</h4>${execCompareBars(trackRows.map(r=>({name:`${r.name} (${r.total})`,current:r.current,previous:r.previous})),{currentLabel:execMonthLabel(month),previousLabel:execMonthLabel(prev)})}</article>
 <article class="px-panel"><h4>الحالة الحالية</h4><div class="px-stack" role="img" aria-label="توزيع الحالات">${status.map(x=>`<i style="width:${x.count/total*100}%;background:${x.color}"></i>`).join('')}</div><ul class="px-status">${status.map(x=>`<li><i style="background:${x.color}"></i><span>${x.label}</span><b>${execNumber(x.count)}</b><small>${execNumber(x.count/total*100,1)}%</small></li>`).join('')}</ul></article></div>`;
}
function execOpen(key,refresh=false){
 perfExec.modal=key;let overlay=document.getElementById('pxModal');
 if(!overlay){overlay=document.createElement('div');overlay.id='pxModal';overlay.className='px-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('[data-exec-close]'))execClose();});(document.getElementById('perfExec')||document.body).appendChild(overlay);}
 overlay.innerHTML=`<div class="px-modal" dir="rtl">${execModalMarkup(key)}</div>`;if(!refresh)overlay.querySelector('.px-close')?.focus();
}
function execClose(){perfExec.modal=null;document.getElementById('pxModal')?.remove();}
async function execPresentation(){const el=document.getElementById('perfExec');if(!el)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await el.requestFullscreen();}catch{el.classList.toggle('is-presenting');}}
document.addEventListener('fullscreenchange',()=>{if(document.getElementById('perfExec'))execRefreshPanel();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&perfExec.modal)execClose();});
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-exec-program]');if(b&&document.getElementById('perfExec')?.contains(b))execOpen(b.getAttribute('data-exec-program'));});

/* Mount above the existing detailed review, which stays available below. */
const execBaseRender=performanceRender;
performanceRender=function(){
 execBaseRender();const host=document.getElementById('performanceContent');if(!host||currentUser?.role!=='admin')return;
 const section=document.createElement('section');section.id='perfExec';section.className='px-exec';section.dir='rtl';section.innerHTML=execPanelMarkup();
 host.prepend(section);
 const details=host.querySelector('.or-dashboard');if(details&&!host.querySelector('.px-details-title'))details.insertAdjacentHTML('beforebegin','<h3 class="px-details-title">التفاصيل التشغيلية</h3>');
 if(perfExec.modal)execOpen(perfExec.modal,true);
 execLoadLecturers();
};
