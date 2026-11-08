const FIREBASE_DB='https://sulukeraacd-default-rtdb.firebaseio.com';

export async function syncExamScheduleMirror(env,firebaseAdminToken){
  await env.DB.exec("CREATE TABLE IF NOT EXISTS exam_schedules_mirror(schedule_key TEXT PRIMARY KEY,batch TEXT NOT NULL DEFAULT '',subject_key TEXT NOT NULL DEFAULT '',course_key TEXT NOT NULL DEFAULT '',subject_name TEXT NOT NULL DEFAULT '',exam_date TEXT NOT NULL DEFAULT '',start_time TEXT NOT NULL DEFAULT '',end_time TEXT NOT NULL DEFAULT '',lecturer_name TEXT NOT NULL DEFAULT '',term_label TEXT NOT NULL DEFAULT '',published INTEGER NOT NULL DEFAULT 1,source_updated_at TEXT,synced_at TEXT NOT NULL);CREATE INDEX IF NOT EXISTS idx_exam_schedules_mirror_date ON exam_schedules_mirror(exam_date,published);");
  const token=await firebaseAdminToken(env),response=await fetch(`${FIREBASE_DB}/examSchedules.json`,{headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok)throw Error(`EXAM_SCHEDULE_MIRROR_READ_${response.status}`);
  const schedules=await response.json()||{},syncedAt=new Date().toISOString(),statements=[env.DB.prepare('DELETE FROM exam_schedules_mirror')];
  for(const [key,row] of Object.entries(schedules))statements.push(env.DB.prepare(
    'INSERT INTO exam_schedules_mirror VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).bind(key,String(row.batch||''),String(row.subjectKey||''),String(row.courseKey||''),String(row.subjectName||''),String(row.date||''),String(row.startTime||''),String(row.endTime||''),String(row.lecturerName||''),String(row.termLabel||''),row.published===false?0:1,row.updatedAt||null,syncedAt));
  await env.DB.batch(statements);
  return {count:Object.keys(schedules).length,syncedAt};
}
