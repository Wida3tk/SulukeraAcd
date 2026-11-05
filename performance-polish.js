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
    const sat=satHead?num((txt(satHead).match(/\d+(?:\.\d+)?%/)||[])[0]):null;
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

  function polish(){
    const host=document.getElementById('perfExec');
    if(!host)return;
    host.classList.add('pq');
    const nav=host.querySelector('.mt-nav');
    if(nav){const k=kpis(host),old=host.querySelector('.pq-kpis');if(!old)nav.before(k);else if(old.innerHTML!==k.innerHTML)old.innerHTML=k.innerHTML;}
    const once=el=>{if(!el||el.dataset.pq==='1')return false;el.dataset.pq='1';return true;};

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
