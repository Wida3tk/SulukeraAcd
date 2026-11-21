// Read only the identifiers needed for recipient exclusion, not project bundles.
export async function whatsappProjectStudents(env,auth){
  if(auth.profile.role!=='admin')throw Object.assign(new Error('FORBIDDEN'),{status:403});
  const rows=(await env.DB.prepare('SELECT student_key FROM graduation_project_students WHERE eligible=1 UNION SELECT student_key FROM graduation_project_group_members').all()).results||[];
  return {studentKeys:rows.map(r=>r.student_key).filter(k=>typeof k==='string'&&k)};
}
