/* Remove only attendance owned by an import; retain learning progress and an audit copy. */
function professionalAttendanceRemovalPlan(root, hash, programId, actor, now) {
  const record=root.professionalPrograms?.[programId]?.attendanceImports?.[hash];
  if(!record)throw Error('IMPORT_NOT_FOUND');
  const updates={},removed={},base=`professionalPrograms/${programId}`;
  const fields=['attendancePercent','attendanceMinutes','meetingDurationMinutes','attendanceStatus','attended','present','zoomNames','attendanceImportedAt','attendanceSourceHash'];
  for(const [studentKey,programs] of Object.entries(root.professionalProgress||{})) {
    const unit=programs?.[programId]?.units?.[record.unitId],session=unit?.sessions?.[record.sessionKey];
    if(session?.attendanceSourceHash!==hash)continue;
    const path=`professionalProgress/${studentKey}/${programId}/units/${record.unitId}`;
    removed[studentKey]=Object.fromEntries(fields.filter(f=>session[f]!==undefined).map(f=>[f,session[f]]));
    fields.forEach(f=>updates[`${path}/sessions/${record.sessionKey}/${f}`]=null);
    const remaining=Object.entries(unit.sessions||{}).filter(([key,s])=>key!==record.sessionKey&&s.attendancePercent!==undefined&&s.attendancePercent!==null&&Number.isFinite(Number(s.attendancePercent)));
    updates[`${path}/attendancePercent`]=remaining.length?Math.round(remaining.reduce((n,[,s])=>n+Number(s.attendancePercent),0)/5):null;
    updates[`${path}/attendanceUpdatedAt`]=now;
  }
  const productivityRemoved=[];
  for(const [period,lecturers] of Object.entries(root.lecturerProductivity||{}))for(const [username,data] of Object.entries(lecturers))for(const [key,meeting] of Object.entries(data.meetings||{})) {
    if(meeting.programId!==programId||meeting.sourceHash!==hash)continue;
    // Keep a shared meeting if another imported register still supports it.
    const shared=Object.entries(root.professionalPrograms?.[programId]?.attendanceImports||{}).some(([h,r])=>h!==hash&&Date.parse(r.meetingStart)===Date.parse(meeting.startsAt)&&Date.parse(r.meetingEnd)===Date.parse(meeting.endsAt));
    if(shared)continue;
    const path=`lecturerProductivity/${period}/${username}/meetings/${key}`;
    productivityRemoved.push({path,record:meeting});updates[path]=null;
  }
  updates[`${base}/attendanceImportArchive/${hash}_${Date.parse(now)}`]={original:record,attendance:removed,productivity:productivityRemoved,removedAt:now,removedBy:actor};
  updates[`${base}/attendanceImports/${hash}`]=null;
  return {updates,count:Object.keys(removed).length};
}
const professionalAttendanceImporterOriginal=renderProfessionalAttendanceImporter;
const professionalAttendanceApproveOriginal=approveProfessionalAttendance;
approveProfessionalAttendance=async function(){
  if(!isAdminRole())return;
  const p=professionalAttendancePreview;if(!p)return;
  let imports;
  try{imports=(await fbRef(`professionalPrograms/${PROFESSIONAL_PROGRAM_ID}/attendanceImports`).once('value')).val()||{};}
  catch(error){showToast('⚠️ تعذر التحقق من السجلات السابقة. حاولي مجددًا قبل الاعتماد.');return;}
  if(Object.values(imports).some(r=>r.unitId===p.unitId&&r.sessionKey===p.sessionKey)){
    showToast('⚠️ لهذا اللقاء سجل معتمد. أزيلي السجل السابق من القائمة أولًا ثم ارفعي الملف الصحيح.');return;
  }
  if(imports[p.hash]){showToast('⚠️ هذا الملف معتمد للقاء آخر؛ راجعيه في قائمة السجلات قبل إعادة رفعه.');return;}
  return professionalAttendanceApproveOriginal();
};
renderProfessionalAttendanceImporter=function(program){
  const units=professionalAttendanceUnits(program);
  const rows=Object.entries(professionalAttendanceImportsData||{}).sort(([,a],[,b])=>String(b.importedAt).localeCompare(String(a.importedAt)));
  return professionalAttendanceImporterOriginal(program)+`<section class="card card-accent"><div class="card-title">سجلات الحضور المعتمدة</div><p style="font-size:12px;color:var(--text-muted)">للتصحيح: أزيلي السجل الخاطئ، ثم اختاري اللقاء الصحيح وارفعي الملف واعتمديه من جديد. تُحفظ نسخة أرشيفية قبل الإزالة.</p><div class="table-wrap"><table><thead><tr><th>الوحدة</th><th>اللقاء</th><th>الملف</th><th>المتدربون</th><th>الإجراء</th></tr></thead><tbody>${rows.length?rows.map(([hash,r])=>`<tr><td>${escapeHtml(units.find(u=>u.unitId===r.unitId)?.unit.title||r.unitId)}</td><td>${escapeHtml(String(r.sessionKey).replace('session_','اللقاء '))}</td><td>${escapeHtml(r.fileName||'سجل Zoom')}</td><td>${Number(r.studentsCount)||0}</td><td><button class="btn btn-sm btn-danger" data-attendance-hash="${escapeHtml(hash)}" onclick="removeProfessionalAttendanceImport(this.dataset.attendanceHash,this)">إزالة السجل لإعادة الرفع</button></td></tr>`).join(''):'<tr><td colspan="5">لا توجد سجلات معتمدة.</td></tr>'}</tbody></table></div></section>`;
};
async function removeProfessionalAttendanceImport(hash,button){
  if(!isAdminRole())return;
  if(!confirm('إزالة أثر هذا الملف من حضور اللقاء؟ ستُحفظ نسخة أرشيفية، ولن تتغير المشاهدة أو المناقشات أو الاختبارات. بعد الإزالة ارفعي السجل الصحيح.'))return;
  if(button)button.disabled=true;
  try{
    const root=(await fbRef().once('value')).val()||{};
    const plan=professionalAttendanceRemovalPlan(root,hash,PROFESSIONAL_PROGRAM_ID,currentUser.username||currentUser.id||'admin',new Date().toISOString());
    await fbRef().update(plan.updates);
    // Patch only affected fields locally too, including students omitted from a corrected file.
    for(const [path,value] of Object.entries(plan.updates)){
      const parts=path.split('/');let node;
      if(parts[0]==='professionalProgress')node=professionalProgressData;
      else if(parts[0]==='lecturerProductivity')node=lecturerProductivityData;
      else continue;
      parts.shift();const last=parts.pop();for(const part of parts){node[part]??={};node=node[part];}if(value===null)delete node[last];else node[last]=value;
    }
    delete professionalAttendanceImportsData[hash];professionalAttendancePreview=null;
    renderProfessionalProgressAdmin();showToast(`✅ تمت إزالة السجل وأثره عن ${plan.count} متدرب/ة. يمكنك رفع الصحيح الآن.`);
  }catch(error){console.error('remove attendance import',error);showToast('⚠️ تعذر إزالة السجل؛ لم يتم اعتماد الإزالة. حدّثي الصفحة وحاولي مجددًا.');}
  finally{if(button)button.disabled=false;}
}
