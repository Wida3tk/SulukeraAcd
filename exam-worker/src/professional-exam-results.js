const base='https://sulukeraacd-default-rtdb.firebaseio.com';
export function approvedProfessionalResult(row,previous={},now=new Date().toISOString()){
 const value=Number(row.score);if(row.score===null||!Number.isFinite(value)||value<0||value>20||!row.evaluated_at)throw Error('INVALID_APPROVED_RESULT');
 const old=previous.approved===true&&Number.isFinite(previous.score)?previous.score:0,score=Math.max(old,value);
 return {...previous,examId:row.exam_id,title:row.subject_name,score,maxScore:20,passed:score>=16,approved:true,evaluated:true,evaluatedAt:row.evaluated_at,syncedAt:now,source:'secure_exam'};
}
export async function syncProfessionalExamResults(env,tokenProvider,filter={}){
 const rows=(await env.DB.prepare(`SELECT e.id exam_id,e.subject_name,a.student_key,MAX(a.score) score,v.submitted_at evaluated_at FROM exams e JOIN attempts a ON a.exam_id=e.id JOIN evaluations v ON v.exam_id=e.id AND v.student_key=a.student_key LEFT JOIN professional_exam_result_sync j ON j.exam_id=e.id AND j.student_key=a.student_key WHERE e.subject_key='professional_organizational_behavior_final' AND a.status='submitted' AND a.score IS NOT NULL AND (?='' OR a.student_key=?) AND (?='' OR e.id=?) GROUP BY e.id,a.student_key HAVING MAX(j.score) IS NULL OR MAX(j.score)<MAX(a.score) OR MAX(j.evaluated_at)<>v.submitted_at LIMIT 5`).bind(filter.studentKey||'',filter.studentKey||'',filter.examId||'',filter.examId||'').all()).results;
 if(!rows.length)return {synced:0};const token=await tokenProvider(env),headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};let synced=0;
 for(const row of rows){try{
   const path=`professionalProgress/${encodeURIComponent(row.student_key)}/organizational_behavior/examResults/${encodeURIComponent(row.exam_id)}`,url=`${base}/${path}.json`;let result,saved=false;
   for(let retry=0;retry<3;retry++){
    const response=await fetch(url,{headers:{...headers,'X-Firebase-ETag':'true'}});if(!response.ok)throw Error('PROFILE_RESULT_READ_FAILED');
    const previous=await response.json()||{};result=approvedProfessionalResult(row,previous);
    const etag=response.headers.get('etag');if(!etag)throw Error('PROFILE_RESULT_ETAG_MISSING');
    const write=await fetch(url,{method:'PUT',headers:{...headers,'If-Match':etag},body:JSON.stringify(result)});
    if(write.status===412)continue;if(!write.ok)throw Error('PROFILE_RESULT_WRITE_FAILED');saved=true;break;
   }
   if(!saved)throw Error('PROFILE_RESULT_CONCURRENT_RETRY');
   await env.DB.prepare('INSERT INTO professional_exam_result_sync VALUES (?,?,?,?,?) ON CONFLICT(exam_id,student_key) DO UPDATE SET score=MAX(professional_exam_result_sync.score,excluded.score),evaluated_at=excluded.evaluated_at,synced_at=excluded.synced_at').bind(row.exam_id,row.student_key,result.score,row.evaluated_at,result.syncedAt).run();synced++;
  }catch(error){console.error('professional_exam_result_sync_failed',{exam:row.exam_id,message:error.message});}}
 return {synced};
}
