// academic_discussions remains the best reviewed answer; retries have immutable answers.
export function discussionWithHistory(record,attempts,student=false){
 if(!record)return null;
 const history=attempts.filter(a=>a.lesson_id===record.lesson_id&&a.student_key===record.student_key).sort((a,b)=>a.submitted_at.localeCompare(b.submitted_at));
 const visible=a=>student&&!a.reviewed_at?{...a,score:null,feedback:''}:a;
 return {...visible(record),history:history.map(visible),pendingAttempt:history.find(a=>!a.reviewed_at)?visible(history.find(a=>!a.reviewed_at)):null};
}
export async function submitDiscussionImprovement(DB,record,answer,max,recordedScore){
 if(Math.max(record.score??0,recordedScore??0)>=max)return {error:'DISCUSSION_ALREADY_REVIEWED'};
 const id=crypto.randomUUID(),at=new Date().toISOString();
 const results=await DB.batch([
  DB.prepare("INSERT OR IGNORE INTO academic_discussion_attempts SELECT 'original:'||lesson_id||':'||student_key,lesson_id,student_key,answer,submitted_at,score,feedback,reviewed_by,reviewed_at FROM academic_discussions WHERE lesson_id=? AND student_key=? AND reviewed_at IS NOT NULL").bind(record.lesson_id,record.student_key),
  DB.prepare("INSERT INTO academic_discussion_attempts(id,lesson_id,student_key,answer,submitted_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM academic_discussions WHERE lesson_id=? AND student_key=? AND reviewed_at=? AND score<?) AND NOT EXISTS(SELECT 1 FROM academic_discussion_attempts WHERE lesson_id=? AND student_key=? AND reviewed_at IS NULL)").bind(id,record.lesson_id,record.student_key,answer,at,record.lesson_id,record.student_key,record.reviewed_at,max,record.lesson_id,record.student_key),
 ]);
 return results[1].meta.changes?{saved:true,attemptId:id}:{error:'DISCUSSION_IMPROVEMENT_PENDING'};
}
export async function reviewDiscussionImprovement(DB,{id,lessonId,studentKey,score,feedback,reviewer}){
 const at=new Date().toISOString();
 const results=await DB.batch([
  DB.prepare('UPDATE academic_discussion_attempts SET score=?,feedback=?,reviewed_by=?,reviewed_at=? WHERE id=? AND lesson_id=? AND student_key=? AND reviewed_at IS NULL').bind(score,feedback,reviewer,at,id,lessonId,studentKey),
  DB.prepare('UPDATE academic_discussions SET answer=(SELECT answer FROM academic_discussion_attempts WHERE id=?),submitted_at=(SELECT submitted_at FROM academic_discussion_attempts WHERE id=?),score=?,feedback=?,reviewed_by=?,reviewed_at=? WHERE lesson_id=? AND student_key=? AND (score IS NULL OR score<?) AND EXISTS(SELECT 1 FROM academic_discussion_attempts WHERE id=? AND lesson_id=? AND student_key=? AND reviewed_at=? AND reviewed_by=?)').bind(id,id,score,feedback,reviewer,at,lessonId,studentKey,score,id,lessonId,studentKey,at,reviewer),
 ]);
 return results[0].meta.changes===1;
}
