/* Progressive enhancement of the admin layout, without changing page permissions. */ (()=>{
  const paths={
    dashboard:'M3 10 12 3l9 7v11h-6v-7H9v7H3z',performance:'M4 20V10m8 10V4m8 16v-7M2 21h20',students:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-8a4 4 0 0 1 0 8m5 10v-2a4 4 0 0 0-3-4',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-8a4 4 0 0 1 0 8',schedule:'M4 5h16v16H4zM16 3v4M8 3v4M4 11h16',revenue:'M3 7h18v14H3zM3 7V4h15M16 14h5',alerts:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2'
  }
  ;  const svg=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;  const mobile=()=>matchMedia('(max-width:850px)').matches;  const icon=id=>svg(paths[id]||'M5 3h14v18H5zM8 8h8M8 12h8M8 16h5');  function closeMobile(){
    if(mobile()&&currentUser?.role==='admin'){
      document.body.classList.add('admin-nav-collapsed');syncToggle();
    }
  }
  function syncToggle(){
    const collapsed=document.body.classList.contains('admin-nav-collapsed'),button=document.getElementById('adminMenuToggle');if(button){
      button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'فتح القائمة الجانبية':'طي القائمة الجانبية');
    }
    const side=document.querySelector('.sidebar');if(side&&currentUser?.role==='admin')side.inert=mobile()&&collapsed;
  }
  function navState(){
    document.querySelectorAll('#navMenu .nav-item').forEach(n=>n.setAttribute('aria-current',n.classList.contains('active')?'page':'false'));document.querySelectorAll('.nav-group').forEach(g=>{
      const head=g.querySelector('.nav-group-head');head?.setAttribute('aria-expanded',String(g.classList.contains('open')));
    }
    );
  }
  function enhance(){
    const admin=currentUser?.role==='admin';document.body.classList.toggle('admin-shell',admin);const sidebar=document.querySelector('.sidebar');if(!admin){
      sidebar.inert=false;
      sidebar.querySelector('.sidebar-logo').after(sidebar.querySelector('.sidebar-user'));
      sidebar.querySelector('.btn-logout').textContent='⬅ خروج';document.querySelector('.admin-command')?.close();return;
    }
    if(!document.getElementById('adminMenuToggle')){
      document.body.classList.toggle('admin-nav-collapsed',mobile());const button=document.createElement('button');button.id='adminMenuToggle';button.className='admin-menu-toggle';button.type='button';button.setAttribute('aria-controls','navMenu');button.innerHTML=svg('M4 6h16M4 12h16M4 18h16');button.onclick=()=>{
        document.body.classList.toggle('admin-nav-collapsed');syncToggle();if(mobile()&&!document.body.classList.contains('admin-nav-collapsed'))sidebar.querySelector('button')?.focus();
      }
      ;document.querySelector('.topbar>div').prepend(button);    const shade=document.createElement('button');shade.className='admin-nav-shade';shade.tabIndex=-1;shade.setAttribute('aria-label','إغلاق القائمة');shade.onclick=closeMobile;document.querySelector('#appShell').append(shade);    const close=document.createElement('button');close.className='admin-drawer-close';close.type='button';close.setAttribute('aria-label','إغلاق القائمة');close.innerHTML=svg('M6 6l12 12M6 18 18 6');close.onclick=()=>{
        closeMobile();button.focus();
      }
      ;sidebar.querySelector('.sidebar-logo').append(close);    const footer=sidebar.querySelector('.sidebar-footer');footer.prepend(sidebar.querySelector('.sidebar-user'));footer.querySelector('.btn-logout').textContent='خروج';    const breadcrumb=document.createElement('nav');breadcrumb.className='admin-breadcrumb';breadcrumb.setAttribute('aria-label','مسار الصفحة');document.getElementById('pageTitle').before(breadcrumb);    const tools=document.createElement('div');tools.className='admin-tools';tools.innerHTML=`<button type="button" class="admin-tool" id="adminCommandOpen" aria-label="البحث في صفحات الإدارة">${svg('M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6')}<span class="admin-search-label">انتقل إلى صفحة</span><kbd>Ctrl K</kbd></button><button type="button" class="admin-tool" id="adminAlerts" aria-label="الطلبات والتنبيهات">${icon('alerts')}<span id="adminAlertsCount"></span></button><details class="admin-profile"><summary class="admin-tool" aria-label="قائمة حساب الإدارة"><span class="admin-avatar"></span></summary><div class="admin-profile-panel"><strong class="admin-profile-name"></strong><p>مدير النظام</p><button class="btn" type="button" onclick="doLogout()">تسجيل الخروج</button></div></details>`;document.querySelector('.topbar').insertBefore(tools,document.getElementById('topbarActions'));tools.querySelector('#adminCommandOpen').onclick=openCommand;tools.querySelector('#adminAlerts').onclick=()=>navTo('alerts',null);
    }
    sidebar.querySelector('.sidebar-footer').prepend(sidebar.querySelector('.sidebar-user'));
    document.querySelector('.admin-profile-name').textContent=currentUser.name||'الإدارة';document.querySelector('.admin-avatar').textContent=(currentUser.name||'إ')[0];   document.querySelectorAll('#navMenu .nav-item').forEach(item=>{
      const id=item.dataset.pageId,iconNode=item.querySelector('.nav-icon');iconNode.innerHTML=icon(id);const label=[...item.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());if(label){
        const span=document.createElement('span');span.className='nav-label';span.textContent=label.textContent;label.replaceWith(span);
      }
      item.setAttribute('role','button');item.tabIndex=0;item.title=pageTitles[id]||item.textContent.trim();item.setAttribute('aria-label',item.title);item.onkeydown=e=>{
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();item.click();
        }
      }
      ;
    }
    );   document.querySelectorAll('.nav-group').forEach(g=>{
      const head=g.querySelector('.nav-group-head');head.querySelector('.nav-group-head-icon').innerHTML=icon(g.dataset.navGroup==='followup'?'performance':g.dataset.navGroup==='students'?'students':g.dataset.navGroup==='system'?'settings':'subjects');head.querySelector('.nav-group-head-icon+span').classList.add('nav-group-title');head.title=head.querySelector('.nav-group-title').textContent;const items=g.querySelector('.nav-group-items');items.id='admin-group-'+g.dataset.navGroup;head.setAttribute('aria-controls',items.id);if(!items.querySelector('.admin-group-inner')){
        const inner=document.createElement('div');inner.className='admin-group-inner';while(items.firstChild)inner.append(items.firstChild);items.append(inner);
      }
    }
    );navState();updateHeader();syncToggle();
  }
  function updateHeader(){
    if(currentUser?.role!=='admin')return;const active=document.querySelector('#navMenu .nav-item.active'),id=active?.dataset.pageId||'dashboard',group=adminNavGroups.find(g=>g.items.some(i=>i.id===id));const crumb=document.querySelector('.admin-breadcrumb');if(crumb){
      crumb.replaceChildren();const home=document.createElement('button');home.textContent='الإدارة';home.onclick=()=>navTo('dashboard',null);crumb.append(home);if(group){
        const sep=document.createElement('span');sep.textContent='/ '+group.label;crumb.append(sep);
      }
    }
    const count=getPendingStudentRequestCount(),counter=document.getElementById('adminAlertsCount');if(counter){
      counter.textContent=count?new Intl.NumberFormat('en-US').format(count):'';document.getElementById('adminAlerts').setAttribute('aria-label',`الطلبات والتنبيهات: ${count} طلبات بانتظار المراجعة`);
    }
  }
  function openCommand(){
    if(currentUser?.role!=='admin')return;let dialog=document.querySelector('.admin-command');if(!dialog){
      dialog=document.createElement('dialog');dialog.className='admin-command';dialog.dir='rtl';dialog.setAttribute('aria-labelledby','adminCommandTitle');dialog.innerHTML='<div class="admin-command-head"><label id="adminCommandTitle" for="adminCommandQuery">الانتقال السريع</label><button type="button" aria-label="إغلاق البحث">✕</button></div><input id="adminCommandQuery" type="search" placeholder="ابحث عن صفحة في الإدارة…" autocomplete="off"><div class="admin-command-results"></div><footer>بحث في الصفحات فقط · ↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق</footer>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.querySelector('input').oninput=renderCommand;dialog.addEventListener('keydown',e=>{
        if(e.key==='Escape'){
          e.preventDefault();e.stopPropagation();dialog.close();return;
        }
        const buttons=[...dialog.querySelectorAll('.admin-command-results button')];if(['ArrowDown','ArrowUp'].includes(e.key)&&buttons.length){
          e.preventDefault();const i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();
        }
        if(e.key==='Enter'&&document.activeElement===dialog.querySelector('input')){
          e.preventDefault();buttons[0]?.click();
        }
      }
      );
    }
    dialog.querySelector('input').value='';renderCommand();dialog.showModal();dialog.querySelector('input').focus();
  }
  function renderCommand(){
    const dialog=document.querySelector('.admin-command'),query=dialog.querySelector('input').value.trim(),items=[{
      id:'dashboard',label:'لوحة التحكم',group:'الرئيسية'
    }
    ,...adminNavGroups.flatMap(g=>g.items.map(i=>({
      ...i,group:g.label
    }
    )))].filter(i=>(i.label+' '+i.group).includes(query));const host=dialog.querySelector('.admin-command-results');host.replaceChildren();for(const item of items){
      const button=document.createElement('button');button.type='button';button.innerHTML=icon(item.id);const label=document.createElement('span');label.textContent=item.label;const group=document.createElement('small');group.textContent=item.group;button.append(label,group);button.onclick=()=>{
        dialog.close();navTo(item.id,null);
      }
      ;host.append(button);
    }
    if(!items.length){
      const empty=document.createElement('p');empty.textContent='لا توجد صفحات مطابقة. جرّب اسمًا آخر.';host.append(empty);
    }
  }
  function dashboardEnhance(){
    if(currentUser?.role!=='admin')return;const page=document.getElementById('page-dashboard'),heading=page.querySelector('.ops-heading');if(!heading)return;heading.textContent=`أهلًا، ${currentUser.name||'فريق الإدارة'}`;const intro=page.querySelector('.ops-subtitle');intro.textContent='مساحة عملك الأكاديمية: المؤشرات الحالية، الأولويات التي تحتاج قرارًا، وآخر التحديثات.';const context=document.createElement('div');context.className='admin-context';context.textContent=new Intl.DateTimeFormat('ar-SA-u-nu-latn',{
      dateStyle:'full',calendar:'gregory',timeZone:'Asia/Karachi'
    }
    ).format(new Date())+' · مدير النظام';heading.before(context);   const kpis=page.querySelectorAll('.ops-kpi');if(kpis[0])kpis[0].querySelector('.ops-kpi-sub').textContent='الحسابات النشطة فقط';if(kpis[1])kpis[1].querySelector('.ops-kpi-label').textContent='دفعات تضم طلابًا';const routes=['students','programs','subjects','exams','alerts'];page.querySelectorAll('.ops-kpi').forEach((card,i)=>{
      const button=document.createElement('button');button.type='button';button.className=card.className;button.style.cssText=card.style.cssText;button.innerHTML=`<span class="admin-kpi-icon">${icon(routes[i])}</span>`+card.innerHTML;button.onclick=()=>navTo(routes[i],null);button.setAttribute('aria-label',card.textContent.trim()+'، فتح '+(pageTitles[routes[i]]||''));card.replaceWith(button);
    }
    );   page.querySelectorAll('.ops-card-title').forEach(n=>{
      const h=document.createElement('h3');h.className=n.className;h.textContent=n.textContent;n.replaceWith(h);
    }
    );   const quick=document.createElement('section');quick.className='ops-card';quick.innerHTML='<div class="ops-card-head"><div><h3 class="ops-card-title">وصول سريع</h3><p class="ops-card-note">الأدوات اليومية في مكان واحد</p></div></div><div class="admin-quick-access"></div>';for(const id of ['students','coursework','grades','schedule','performance','evaluations']){
      const b=document.createElement('button');b.className='btn';b.type='button';b.innerHTML=icon(id);const text=document.createElement('span');text.textContent=pageTitles[id];b.append(text);b.onclick=()=>navTo(id,null);quick.querySelector('.admin-quick-access').append(b);
    }
    page.querySelector('.ops-dashboard').append(quick);updateHeader();
  }
  const originalRender=renderNav;renderNav=function(...args){
    const result=originalRender.apply(this,args);enhance();return result;
  }
  ;  const originalNav=navTo;navTo=function(...args){
    const result=originalNav.apply(this,args);if(currentUser?.role==='admin'){
      navState();updateHeader();closeMobile();
    }
    return result;
  }
  ;  const originalGroup=toggleNavGroup;toggleNavGroup=function(id){
    if(currentUser?.role!=='admin')return originalGroup(id);const target=document.querySelector(`.nav-group[data-nav-group="${id}"]`),active=document.querySelector('.nav-item.active')?.closest('.nav-group');if(target===active&&target.classList.contains('open'))return;originalGroup(id);if(active)active.classList.add('open');navState();
  }
  ;  const originalDashboard=renderAdminDashboard;renderAdminDashboard=function(...args){
    const result=originalDashboard.apply(this,args);dashboardEnhance();return result;
  }
  ;  const originalBadge=updateStudentRequestsNavBadge;updateStudentRequestsNavBadge=function(...args){
    const result=originalBadge.apply(this,args);updateHeader();return result;
  }
  ;  const originalLogout=doLogout;doLogout=async function(...args){
    document.querySelector('.admin-command')?.close();document.body.classList.remove('admin-shell','admin-nav-collapsed');document.querySelector('.sidebar').inert=false;return originalLogout.apply(this,args);
  }
  ;  matchMedia('(max-width:850px)').addEventListener('change',e=>{
    if(e.matches)closeMobile();else syncToggle();
  }
  );addEventListener('resize',syncToggle);document.addEventListener('keydown',e=>{
    if(currentUser?.role!=='admin')return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
      e.preventDefault();openCommand();
    }
    if(e.key==='Escape'&&!document.querySelector('.admin-command')?.open){
      closeMobile();
    }
    if(e.key==='Tab'&&mobile()&&!document.body.classList.contains('admin-nav-collapsed')){
      const focusable=[...document.querySelector('.sidebar').querySelectorAll('button,[tabindex="0"]')].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){
        e.preventDefault();last?.focus();
      }
      else if(!e.shiftKey&&document.activeElement===last){
        e.preventDefault();first?.focus();
      }
    }
  }
  );
}
)();
