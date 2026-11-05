// Final visual layer for the management performance view: one KPI strip,
// methodology notes folded into a per-section "details" block, duplicates hidden,
// and empty sections removed. Data and calculations are untouched.
(function(){
  const num=t=>{const m=String(t||'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
  const txt=el=>el?el.textContent.trim():'';
  const fmt=v=>v==null?'—':v.toLocaleString('en-US',{maximumFractionDigits:2});

  function foldNotes(section,notes,label){
    notes=notes.filter(n=>n&&n.isConnected&&txt(n));
    if(!section||!notes.length)return;
    const d=document.createElement('details');d.className='pq-notes';
    d.innerHTML=`<summary>${label||'تفاصيل الحساب والمصادر'}</summary>`;
    notes.forEach(n=>d.appendChild(n));
    section.appendChild(d);
  }

  function kpis(host){
    const total=num(txt(host.querySelector('#mt-total .mt-total strong')));
    const active=num(txt(host.querySelector('#mt-active .mt-total strong')));
    const months=[...host.querySelectorAll('#mt-productivity .mt-months .mt-month strong')].map(s=>num(txt(s)));
    const valid=months.filter(v=>v!=null);
    const hours=valid.length?valid[valid.length-1]:null,prev=valid.length>1?valid[valid.length-2]:null;
    const satHead=host.querySelector('.mt-lecturer-survey .px-sat-card');
    const satLeaf=satHead?[...satHead.querySelectorAll('*')].find(e=>!e.children.length&&/^\d+(?:\.\d+)?%$/.test(txt(e))):null;
    const sat=satLeaf?num(txt(satLeaf)):null;
    const month=txt(host.querySelector('#meetingReportMonth option:checked'))||'';
    const delta=hours!=null&&prev?Math.round((hours-prev)/prev*100):null;
    const card=(label,value,sub,cls='')=>`<article class="pq-kpi ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;
    const el=document.createElement('div');el.className='pq-kpis';
    el.innerHTML=card('إجمالي تسجيلات البرامج',fmt(total),'تراكمي حتى '+month.replace(/ ·.*/,''),'is-main')
      +card('المتدربون النشطون',fmt(active),'حسابات نشطة حاليًا')
      +card('ساعات المحاضرين',fmt(hours),delta==null?month.replace(/ ·.*/,''):(delta>=0?'أعلى ':'أقل ')+Math.abs(delta)+'% عن الشهر السابق',delta>0?'is-up':'')
      +card('رضا المحاضرين',sat==null?'—':sat+'%','استبيان المحاضرين');
    return el;
  }


  // ---- Program names, delivery badges and per-batch drill-down ----
  const PQ_PROGRAMS={
    'تحليل السلوك · المسجل':{key:'abaRecorded',name:'تحليل السلوك التطبيقي',badge:'مسجل'},
    'ABAT · المسجل':{key:'abatRecorded',name:'أخصائي تحليل السلوك التطبيقي',badge:'مسجل'},
    'تحليل السلوك · المباشر':{key:'abaLive',name:'تحليل السلوك التطبيقي',badge:'مباشر'},
    'السلوك التنظيمي':{key:'obm',name:'إدارة السلوك التنظيمي'}
  };
  const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const reportMonth=()=>document.getElementById('meetingReportMonth')?.value||'';
  const monthLabel=m=>new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory',{month:'long',year:'numeric'}).format(new Date(m+'-15'));
  const inScope=s=>{const m=reportMonth();return !m||!s.regDate||String(s.regDate).slice(0,7)<=m;};

  function batchRows(key,total){
    const m=reportMonth();
    if(key==='abaLive'){
      const map=new Map();
      (typeof students!=='undefined'?students:[]).filter(s=>/تحليل السلوك التطبيقي/.test(s.program||'')&&!/مسجل|recorded|ABAT/i.test([s.program,s.track,s.planType].join(' '))&&inScope(s))
        .forEach(s=>{const b=s.batch||'بدون دفعة';map.set(b,(map.get(b)||0)+1);});
      const rows=[...map].sort((a,b)=>a[0].localeCompare(b[0])).map(([b,n])=>({label:'دفعة '+b,n}));
      return {rows,note:'حسابات النظام حسب الدفعة'};
    }
    if(key==='obm'&&typeof reviewObmHistory!=='undefined'){
      const groups=Object.values(reviewObmHistory).map(h=>({title:h.name,rows:h.batches.map(([label,n])=>({label,n}))}));
      const cur=(typeof students!=='undefined'?students:[]).filter(s=>/تنظيمي|OBM/i.test([s.program,s.track,s.batch].join(' '))&&inScope(s)).length;
      if(cur)groups[0].rows.push({label:'الدفعة السادسة · الحالية',n:cur,current:true});
      return {groups,note:'الدفعات التاريخية المعتمدة + الدفعة الحالية من حسابات النظام'};
    }
    if((key==='abaRecorded'||key==='abatRecorded')&&typeof performanceRecordedOpsData!=='undefined'){
      const d=performanceRecordedOpsData,field=key==='abaRecorded'?'qbaQasps':'abat';
      const months=(d.months||[]).filter(r=>!m||r.month<=m);
      const added=months.filter(r=>key==='abaRecorded'||r.month>(d.abatPlatform?.anchorMonth||'')).reduce((a,r)=>a+(r[field]||0),0);
      const rows=[];
      if(key==='abaRecorded'){rows.push({label:'الأساس المعتمد حتى 7 أكتوبر 2026 (QBA '+d.baseline.qba+' · QASP-S '+d.baseline.qasps+')',n:d.baseline.total,base:true});const t=num(total);if(t!=null&&t>d.baseline.total)rows.push({label:'إضافات بعد 7 أكتوبر',n:t-d.baseline.total});}
      else rows.push({label:'إجمالي المنصة حتى أكتوبر 2026',n:d.abatPlatform?.anchorTotal??465,base:true});
      return {rows,monthly:months.map(r=>({label:monthLabel(r.month),n:r[field]})),note:'برنامج مسجل بالتسجيل المفتوح، بدون دفعات · التسجيلات الشهرية من نظام العمليات'};
    }
    return {rows:[],note:''};
  }

  function openPrograms(cfg,total){
    document.querySelector('.pq-modal')?.remove();
    const data=batchRows(cfg.key,total);
    const list=rows=>{const max=Math.max(1,...rows.map(r=>r.n));return rows.map(r=>`<div class="pq-row${r.current?' is-current':''}${r.base?' is-base':''}"><span>${esc(r.label)}</span><div class="pq-track"><i style="width:${r.n/max*100}%"></i></div><b>${r.n}</b></div>`).join('');};
    let body='';
    if(data.groups)body=data.groups.map(g=>`<h4>${esc(g.title)} <small>${g.rows.reduce((a,r)=>a+r.n,0)} متدرب</small></h4>${list(g.rows)}`).join('');
    else body=list(data.rows)+(data.monthly&&data.monthly.length?`<h4>التسجيلات الشهرية في نظام العمليات <small>للمقارنة</small></h4>${list(data.monthly)}`:'');
    const el=document.createElement('div');el.className='pq-modal';el.setAttribute('role','dialog');
    el.innerHTML=`<div class="pq-dialog"><header><div><h3>${esc(cfg.name)} ${cfg.badge?`<em class="pq-badge ${cfg.badge==='مباشر'?'is-live':''}">${cfg.badge}</em>`:''}</h3><p>${esc(total)} متدرب · ${esc(data.note)}</p></div><button type="button" class="pq-close" aria-label="إغلاق">✕</button></header><div class="pq-body">${body||'<p>لا تتوفر تفاصيل الدفعات لهذا البرنامج.</p>'}</div></div>`;
    el.addEventListener('click',e=>{if(e.target===el||e.target.closest('.pq-close'))el.remove();});
    document.addEventListener('keydown',function k(e){if(e.key==='Escape'){el.remove();document.removeEventListener('keydown',k);}});
    document.body.appendChild(el);
  }

  function programBars(host){
    host.querySelectorAll('#mt-total .mt-breakdown .mt-bar').forEach(bar=>{
      const strong=bar.querySelector(':scope > div > strong');if(!strong||bar.dataset.pqProg)return;
      const cfg=PQ_PROGRAMS[txt(strong)];if(!cfg)return;
      bar.dataset.pqProg=cfg.key;
      strong.innerHTML=esc(cfg.name)+(cfg.badge?` <em class="pq-badge ${cfg.badge==='مباشر'?'is-live':''}">${cfg.badge}</em>`:'');
      const total=txt(bar.querySelector(':scope > div > b'));
      bar.classList.add('pq-clickable');bar.tabIndex=0;bar.setAttribute('role','button');bar.title='اضغط لعرض الدفعات';
      const go=()=>openPrograms(cfg,total);
      bar.addEventListener('click',go);bar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
    });
    host.querySelectorAll('#mt-active .mt-breakdown .mt-bar > div > strong').forEach(st=>{if(txt(st)==='السلوك التنظيمي')st.textContent='إدارة السلوك التنظيمي';});
  }

  function polish(){
    const host=document.getElementById('perfExec');
    if(!host)return;
    host.classList.add('pq');
    const nav=host.querySelector('.mt-nav');
    if(nav){const k=kpis(host),old=host.querySelector('.pq-kpis');if(!old)nav.before(k);else if(old.innerHTML!==k.innerHTML)old.innerHTML=k.innerHTML;}
    const once=el=>{if(!el||el.dataset.pq==='1')return false;el.dataset.pq='1';return true;};
    programBars(host);

    // 01 · totals
    const total=host.querySelector('#mt-total');
    if(once(total)){
      total.querySelectorAll('.mt-breakdown .mt-bar small').forEach(s=>{s.textContent=txt(s).split(' · ')[0];});
      const ops=total.querySelector('.mt-recorded-ops');
      ops?.querySelector('.or-table-wrap')?.remove();
      foldNotes(total,[...total.querySelectorAll(':scope > .px-note'),ops?.querySelector('.mt-insight'),...(ops?[...ops.querySelectorAll('.px-note')]:[]),total.querySelector('details.mt-history')]);
      const hist=total.querySelector('.pq-notes details.mt-history');if(hist)hist.open=false;
    }
    // 02 · active
    const active=host.querySelector('#mt-active');
    if(once(active)){
      active.querySelectorAll('.mt-breakdown .mt-bar small').forEach(s=>{s.textContent=txt(s).split(' · ')[0];});
      foldNotes(active,[...active.querySelectorAll('.px-note'),host.querySelector(':scope > .mt-scope-note')]);
    }
    // 03 · productivity: the month card repeats the KPI strip and the chart
    const prod=host.querySelector('#mt-productivity');
    if(once(prod)){
      const cards=prod.querySelectorAll('.mt-hour-cards article');
      if(cards.length>1)cards[cards.length-1].remove();
      prod.querySelector('.mt-hour-cards')?.classList.add('is-single');
      prod.querySelectorAll('.mt-months .mt-month').forEach(mo=>{if(/يوليو/.test(txt(mo.querySelector('b')))){const sm=mo.querySelector('small');if(sm&&/غير مرصود/.test(txt(sm))){sm.textContent='إجازة صيفية';mo.classList.add('is-holiday');}}});
      prod.querySelectorAll('.mt-months .mt-month').forEach(m=>{const sm=m.querySelector('small');if(/يوليو/.test(txt(m.querySelector('b')))&&sm&&/غير مرصود/.test(txt(sm))){sm.textContent='إجازة صيفية';m.classList.add('is-holiday');const st=m.querySelector('strong');if(st)st.textContent='إجازة';}});
      foldNotes(prod,[...prod.querySelectorAll(':scope > .px-note')]);
    }
    // 04 · satisfaction: hide the course-feedback block while it has no responses
    const sat=host.querySelector('#mt-satisfaction');
    if(sat){
      const course=sat.querySelector(':scope > section.px-section:not(.mt-lecturer-survey)');
      if(course&&!course.querySelector('.px-sat-card')&&/لا توجد/.test(txt(course)))course.remove();
      const lec=sat.querySelector('.mt-lecturer-survey');
      if(once(lec)){
        const h=lec.querySelector('.px-section-head');
        if(h&&!h.querySelector('.px-eyebrow-num')){const e=h.querySelector('.px-eyebrow');if(e)e.textContent='04 · الرضا';}
        foldNotes(lec,[lec.querySelector(':scope > .mt-insight')],'عن فترة الاستبيان');
      }
    }
  }

  function wrap(){
    if(typeof performanceRender!=='function'||performanceRender.__pq)return;
    const base=performanceRender;
    const next=function(){const r=base.apply(this,arguments);try{polish();}catch(e){console.warn('performance polish',e);}return r;};
    next.__pq=true;performanceRender=next;
  }
  wrap();
  // Other layers may re-wrap performanceRender later; also polish whenever #perfExec is rebuilt.
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;wrap();if(document.getElementById('perfExec')){try{polish();}catch(e){console.warn('performance polish',e);}}});})
    .observe(document.documentElement,{childList:true,subtree:true});
})();
