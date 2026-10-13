const base='https://sulukeraacd-default-rtdb.firebaseio.com';
export function examGradeFields(row,now){
 const score=Number(row.score);if(row.score===null||!Number.isFinite(score)||score<0||score>20)throw Error('INVALID_EXAM_SCORE');
 return {studentKey:row.student_key,subjectKey:row.subject_key,exam:Math.round(score*200)/100,examEntered:true,secureExamScore20:score,secureExamId:row.exam_id,secureExamSyncedAt:now,updatedAt:now,updatedBy:'secure_exam_service',updatedRole:'system'};
}
export async function syncAcademicExamGrades(env,tokenProvider){
 const rows=(await env.DB.prepare(`WITH results AS (SELECT e.subject_key,a.student_key,e.id exam_id,MAX(a.score) score FROM exams e JOIN attempts a ON a.exam_id=e.id WHERE a.status='submitted' AND a.score IS NOT NULL AND e.subject_key NOT LIKE 'professional_%' AND e.batch NOT LIKE 'PRO-%' GROUP BY e.subject_key,a.student_key) SELECT r.* FROM results r LEFT JOIN academic_exam_grade_sync j ON j.subject_key=r.subject_key AND j.student_key=r.student_key WHERE j.score IS NULL OR j.score<>r.score OR j.exam_id<>r.exam_id LIMIT 5`).all()).results;
 if(!rows.length)return {synced:0};const token=await tokenProvider(env),headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};let synced=0;
 for(const row of rows){
  try{
   const params=new URLSearchParams({orderBy:JSON.stringify('studentKey'),equalTo:JSON.stringify(row.student_key)});
   const response=await fetch(`${base}/grades.json?${params}`,{headers});if(!response.ok)throw Error('EXAM_GRADE_READ_FAILED');
   const grades=await response.json()||{},keys=Object.entries(grades).filter(([,g])=>g.subjectKey===row.subject_key).map(([key])=>key);
   if(!keys.length)keys.push(('grade_'+row.student_key+'_'+row.subject_key).replace(/[.#$[\]]/g,'_'));
   const now=new Date().toISOString(),fields=examGradeFields(row,now),patch={};for(const key of keys)for(const [field,value] of Object.entries(fields))patch[`${key}/${field}`]=value;
   const saved=await fetch(`${base}/grades.json`,{method:'PATCH',headers,body:JSON.stringify(patch)});if(!saved.ok)throw Error('EXAM_GRADE_WRITE_FAILED');
   await env.DB.prepare('INSERT INTO academic_exam_grade_sync VALUES (?,?,?,?,?) ON CONFLICT(subject_key,student_key) DO UPDATE SET exam_id=excluded.exam_id,score=excluded.score,synced_at=excluded.synced_at').bind(row.subject_key,row.student_key,row.exam_id,Number(row.score),now).run();synced++;
  }catch(error){console.error('academic_exam_grade_sync_failed',{exam:row.exam_id,message:error.message});}
 }
 return {synced};
}
