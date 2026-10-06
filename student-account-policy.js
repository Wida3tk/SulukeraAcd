/* One account state, shared by administration, student portal and API. */
(function(root){
  const labels={active:'نشط',suspended:'موقوف',frozen:'مجمّد',withdrawn:'منسحب'};
  function status(value){const raw=typeof value==='object'?value?.accountStatus:value;return ({paused:'suspended',inactive:'suspended',stopped:'suspended',freeze:'frozen',منسحب:'withdrawn',موقوف:'suspended',مجمد:'frozen'})[raw]||(Object.hasOwn(labels,raw)?raw:'active');}
  function isActive(value){return status(value)==='active';}
  function label(value){return labels[status(value)];}
  function matches(value,filter){return !filter||filter==='all'||(filter==='inactive'?!isActive(value):status(value)===filter);}
  function linked(user,student,key){return user?.role==='student'&&(user.studentKey?user.studentKey===key:!!student?.id&&String(user.username||'').toUpperCase()===String(student.id).toUpperCase());}
  function sheetStatus(value){return value==='paused'?'frozen':status(value);}
  function resolve(student,enrollments={},accounts=[],sheets=[]){if(!isActive(student))return status(student);for(const user of accounts)if(!isActive(user))return status(user);for(const sheet of sheets){const state=sheetStatus(sheet?.traineeStatus);if(state!=='active')return state;}for(const enrollment of Object.values(enrollments||{})){if(!isActive(enrollment?.accountStatus))return status(enrollment.accountStatus);if(!isActive(enrollment?.status))return status(enrollment.status);}return 'active';}
  function updates(key,student,next,users={},enrollments={},meta={}){
    if(!Object.hasOwn(labels,next)||!key)throw Error('INVALID_ACCOUNT_STATUS');
    const now=meta.at||new Date().toISOString(),by=meta.by||'admin',out={};
    out[`students/${key}/accountStatus`]=next;
    out[`students/${key}/statusUpdatedAt`]=now;out[`students/${key}/statusUpdatedBy`]=by;out[`students/${key}/statusReason`]=String(meta.reason||'');
    out[`students/${key}/withdrawnAt`]=next==='withdrawn'?(student.withdrawnAt||now):'';out[`students/${key}/withdrawnBy`]=next==='withdrawn'?(student.withdrawnBy||by):'';
    for(const [uid,user] of Object.entries(users||{}))if(linked(user,student,key))out[`users/${uid}/accountStatus`]=next;
    for(const [sheetKey,sheet] of Object.entries(meta.sheets||{}))if(sheet.studentKey===key)out[`studentAdminSheets/${sheetKey}/traineeStatus`]=next;
    for(const [program,enrollment] of Object.entries(enrollments||{})){
      const base=`professionalEnrollments/${key}/${program}`;
      out[`${base}/accountStatus`]=next;out[`${base}/status`]=next==='active'?(enrollment.statusBeforePause||'active'):'paused';
      out[`${base}/statusBeforePause`]=next==='active'?null:(enrollment.statusBeforePause||(enrollment.status==='active'?'active':null));
      out[`${base}/updatedAt`]=now;out[`${base}/updatedBy`]=by;
    }
    return out;
  }
  root.SulukeraStudentAccount={status,isActive,label,matches,linked,resolve,updates,labels,sheetStatus};
})(globalThis);
