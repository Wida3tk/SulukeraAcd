const fields=['exam',...Array.from({length:4},(_,i)=>['attend','hw','disc'].map(field=>`w${i+1}_${field}`)).flat()];
function recordedValue(grade,field){
 const [week,component]=field.split('_'),raw=field==='exam'?(grade.exam??grade.exam_score):(grade[week]?.[component]??grade[field]);
 const flag=grade[field+'Entered']??grade[week]?.[component+'Entered'];
 if(field!=='exam'&&flag===false)return null;
 if(raw===null||raw===undefined||raw===''||!Number.isFinite(Number(raw)))return null;
 return flag===true||Number(raw)>0?Number(raw):null;
}
function mergeHighestGrades(records,studentKey,subjectKey,at){
 const own=records.filter(row=>row.grade.subjectKey===subjectKey).sort((a,b)=>String(b.grade.updatedAt||'').localeCompare(String(a.grade.updatedAt||'')))[0];
 const merged={...(own?.grade||{}),studentKey,subjectKey},sources={};
 for(const week of ['w1','w2','w3','w4'])delete merged[week];
 for(const field of fields){
  const candidates=records.map(row=>({...row,value:recordedValue(row.grade,field)})).filter(row=>row.value!==null)
   .sort((a,b)=>b.value-a.value||Number(b.grade.subjectKey===subjectKey)-Number(a.grade.subjectKey===subjectKey)||String(b.grade.updatedAt||'').localeCompare(String(a.grade.updatedAt||'')));
  if(!candidates.length){delete merged[field];merged[field+'Entered']=false;delete merged[field+'Approved'];continue;}
  const best=candidates[0];merged[field]=best.value;merged[field+'Entered']=true;sources[field]=best.key;
  if(field.endsWith('_disc')){delete merged[field+'Approved'];if(typeof best.grade[field+'Approved']==='boolean')merged[field+'Approved']=best.grade[field+'Approved'];}
  if(field==='exam')for(const key of ['secureExamId','secureExamScore20','secureExamSyncedAt','secureExamSource']){delete merged[key];if(best.grade[key]!==undefined)merged[key]=best.grade[key];}
 }
 delete merged.exam_score;
 merged.updatedAt=at;merged.updatedBy='duplicate-course-repair';merged.updatedRole='admin';
 merged.gradeMerge={at,policy:'highest_per_recorded_component',sources};
 return merged;
}
function buildRepair(root,at){
 const groups=new Map(),updates={},corrections=[];
 for(const [key,enrollment] of Object.entries(root.enrollments||{})){
  const subject=root.subjects?.[enrollment.subjectKey];if(!subject)continue;
  const identity=enrollment.studentKey+'|'+(subject.courseKey||enrollment.subjectKey);
  if(!groups.has(identity))groups.set(identity,[]);groups.get(identity).push({key,enrollment,subject});
 }
 for(const rows of groups.values()){
  if(rows.length<2)continue;
  const studentKey=rows[0].enrollment.studentKey,student=root.students?.[studentKey];if(!student)throw Error('Missing student');
  const own=rows.filter(row=>String(row.subject.batch||'').trim().toUpperCase()===String(student.batch||'').trim().toUpperCase());
  const ownSubjects=[...new Set(own.map(row=>row.enrollment.subjectKey))];if(ownSubjects.length!==1)throw Error('Ambiguous retained offering '+student.id);
  const subjectKey=ownSubjects[0],keys=new Set(rows.map(row=>row.enrollment.subjectKey));
  const records=Object.entries(root.grades||{}).filter(([,grade])=>grade.studentKey===studentKey&&keys.has(grade.subjectKey)).map(([key,grade])=>({key,grade}));
  const keepEnrollment=own.find(row=>row.key===`enr_${studentKey}_${subjectKey}`)||own[0];
  for(const row of rows)if(row!==keepEnrollment)updates['enrollments/'+row.key]=null;
  const gradeKey=`grade_${studentKey}_${subjectKey}`.replace(/[.#$[\]]/g,'_');
  if(records.length){updates['grades/'+gradeKey]=mergeHighestGrades(records,studentKey,subjectKey,at);for(const record of records)if(record.key!==gradeKey)updates['grades/'+record.key]=null;}
  corrections.push({studentKey,studentId:student.id,courseKey:rows[0].subject.courseKey,retainedSubjectKey:subjectKey,retainedEnrollmentKey:keepEnrollment.key,enrollments:Object.fromEntries(rows.map(row=>[row.key,row.enrollment])),grades:Object.fromEntries(records.map(row=>[row.key,row.grade])),mergedGradeKey:records.length?gradeKey:null});
 }
 return {updates,corrections};
}
module.exports={fields,recordedValue,mergeHighestGrades,buildRepair};
