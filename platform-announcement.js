/* Isolated communications UI. Never reads or writes coursework, grades or exam state. */
(()=>{'use strict';
 const VERSION='whatsapp-service-20261028',PATH='settings/platformAnnouncement';
 const MESSAGE='تنويه: خدمة العملاء عبر واتساب متوقفة مؤقتًا بسبب مشكلة تقنية. لاستفساراتكم: Care@sulukera.com أو عبر المرشد الأكاديمي.';
 const IMAGE='assets/announcements/whatsapp-service-20261028.png';
 let identity='',ref=null,config=null,ack=false,checked=false,dialog=null,banner=null,observer=null,focusBefore=null;
 const user=()=>typeof currentUser==='undefined'?null:currentUser;
 const busy=()=>!!(typeof activeSecureAttempt!=='undefined'&&activeSecureAttempt)||!!document.querySelector('#secureAttemptPanel,#secureExamForm,dialog[open]:not(.pa-dialog),.modal-overlay[style*="display: flex"],.faculty-modal,#professionalViewerOverlay')||!!document.querySelector('button:disabled[type="submit"],#saveBtn:disabled,#gradeSaveRow button:disabled');
 const localKey=()=>`sulukera-announcement:${identity}:${VERSION}`;
 function removeDialog(){if(!dialog)return;dialog.close();dialog.remove();dialog=null;if(focusBefore?.isConnected)focusBefore.focus();}
 function removeBanner(){observer?.disconnect();observer=null;banner?.remove();banner=null;document.documentElement.style.removeProperty('--pa-banner-height');}
 function reset(){ref?.off();ref=null;identity='';config=null;ack=false;checked=false;removeDialog();removeBanner();document.getElementById('platformAnnouncementAdmin')?.remove();}
 async function acknowledge(){ack=true;try{localStorage.setItem(localKey(),'1');}catch{}removeDialog();try{await firebase.database().ref(`platformAnnouncementAcknowledgements/${identity}/${VERSION}`).set(true);}catch{/* A local acknowledgement still closes the notice; retry after reconnect. */}}
 function show(){if(dialog||!config?.active||busy())return;
  focusBefore=document.activeElement;dialog=document.createElement('dialog');dialog.className='pa-dialog';dialog.setAttribute('aria-labelledby','paTitle');
  dialog.innerHTML='<header><h2 id="paTitle">تنويه مهم · قنوات التواصل</h2></header><img alt="تنويه سلوكيرا: توقف خدمة العملاء عبر واتساب مؤقتًا، والتواصل عبر البريد أو المرشد الأكاديمي"><div class="pa-text" hidden><p></p><p>نعمل على متابعة المشكلة واستعادة الخدمة في أقرب وقت ممكن. شكرًا لتفهمكم وتعاونكم.</p></div><footer><button type="button" class="pa-button pa-confirm">اطّلعت على التنويه</button><a class="pa-button" href="mailto:Care@sulukera.com">التواصل بالبريد</a></footer>';
  const image=dialog.querySelector('img');image.onerror=()=>{image.hidden=true;dialog.querySelector('.pa-text').hidden=false;};image.src=IMAGE;
  dialog.querySelector('.pa-text p').textContent=MESSAGE;dialog.querySelector('button').onclick=acknowledge;
  dialog.addEventListener('cancel',event=>{event.preventDefault();acknowledge();});document.body.append(dialog);dialog.showModal();dialog.querySelector('button').focus();
 }
 function renderBanner(){if(!config?.active){removeBanner();removeDialog();return;}
  const topbar=[...document.querySelectorAll('.topbar')].find(el=>el.getClientRects().length);if(!topbar)return;
  if(!banner){banner=document.createElement('aside');banner.className='pa-banner';banner.setAttribute('aria-label','تنويه خدمة العملاء');banner.innerHTML='<p></p><a href="mailto:Care@sulukera.com">Care@sulukera.com</a><button class="pa-button" type="button">عرض التنويه</button>';banner.querySelector('p').textContent='تنويه: خدمة العملاء عبر واتساب متوقفة مؤقتًا بسبب مشكلة تقنية. تواصلوا عبر البريد الإلكتروني أو المرشد الأكاديمي.';banner.querySelector('button').onclick=show;topbar.before(banner);if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>document.documentElement.style.setProperty('--pa-banner-height',banner.getBoundingClientRect().height+'px'));observer.observe(banner);}}
 }
 function renderAdmin(){if(user()?.role!=='admin')return;const settings=document.getElementById('page-settings');if(!settings)return;
  let box=document.getElementById('platformAnnouncementAdmin');if(!box){box=document.createElement('section');box.id='platformAnnouncementAdmin';box.className='pa-admin';box.innerHTML='<h3>إعلان قنوات التواصل</h3><p>إعلان بالصورة وشريط ثابت للطلاب والمحاضرين. إيقافه يزيلهما دون التأثير على الدراسة أو الاختبارات.</p><button type="button" class="pa-button" data-toggle></button><button type="button" class="pa-button" data-preview>معاينة الإعلان</button><span role="status"></span>';settings.prepend(box);box.querySelector('[data-preview]').onclick=show;box.querySelector('[data-toggle]').onclick=async()=>{const button=box.querySelector('[data-toggle]');button.disabled=true;try{await firebase.database().ref(PATH).update({active:!config?.active,version:VERSION,updatedAt:new Date().toISOString(),updatedBy:identity});box.querySelector('[role=status]').textContent='تم حفظ حالة الإعلان.';}catch{box.querySelector('[role=status]').textContent='تعذر حفظ الحالة؛ لم يتم تأكيد التغيير.';}finally{button.disabled=false;}};}
  box.querySelector('[data-toggle]').textContent=config?.active?'إيقاف الإعلان بعد حل المشكلة':'تفعيل الإعلان';
 }
 async function connect(uid){identity=uid;try{ack=localStorage.getItem(localKey())==='1';}catch{}
  const own=uid;try{const saved=await firebase.database().ref(`platformAnnouncementAcknowledgements/${uid}/${VERSION}`).once('value');if(identity!==own)return;ack=ack||saved.val()===true;}catch{}if(identity!==own)return;checked=true;
  ref=firebase.database().ref(PATH);ref.on('value',snapshot=>{if(identity!==own)return;const value=snapshot.val();config=value?.version===VERSION?value:null;renderBanner();renderAdmin();},()=>{config=null;removeBanner();removeDialog();});
  if(ack)try{await firebase.database().ref(`platformAnnouncementAcknowledgements/${uid}/${VERSION}`).set(true);}catch{}
 }
 function tick(){try{const u=user(),uid=typeof firebase!=='undefined'?firebase.auth().currentUser?.uid:'';if(!u||!uid){if(identity)reset();return;}if(identity!==uid){reset();connect(uid);return;}renderBanner();renderAdmin();if(busy()){if(dialog)removeDialog();return;}if(config?.active&&checked&&!ack&&!document.hidden)show();}catch{/* Announcement failures must not affect the platform. */}}
 setInterval(tick,1200);tick();
})();
