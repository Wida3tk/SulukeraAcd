import '../../lecturer-survey-model.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function handleLecturerSurvey(request,env,auth,path,deps){
 if(!path.startsWith('/lecturer/satisfaction')&&!path.startsWith('/admin/lecturer-satisfaction'))return null;
 const model=SulukeraLecturerSurvey,campaign=model.campaign;
 if(path.startsWith('/lecturer/')){
  if(auth.profile.role!=='lecturer')fail('FORBIDDEN',403);
  if(path!=='/lecturer/satisfaction')fail('NOT_FOUND',404);
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT submitted_at FROM lecturer_survey_responses WHERE campaign_id=? AND lecturer_uid=?').bind(campaign.id,auth.uid).first();return {data:{campaign,completed:!!row,submittedAt:row?.submitted_at||null,name:auth.profile.name||auth.profile.username}};}
  if(request.method==='POST'){
   let body;try{body=await request.json();}catch{fail('INVALID_JSON');}
   if(body.campaignId!==campaign.id)fail('INVALID_CAMPAIGN');
   let answers;try{answers=model.validate(body.responses);}catch(e){fail(e.message);}
   await env.DB.prepare('INSERT INTO lecturer_survey_responses (campaign_id,lecturer_uid,lecturer_name,lecturer_username,responses_json,submitted_at) VALUES (?,?,?,?,?,?) ON CONFLICT(campaign_id,lecturer_uid) DO NOTHING').bind(campaign.id,auth.uid,auth.profile.name||auth.profile.username||auth.uid,auth.profile.username||auth.uid,JSON.stringify(answers),new Date().toISOString()).run();
   const saved=await env.DB.prepare('SELECT submitted_at FROM lecturer_survey_responses WHERE campaign_id=? AND lecturer_uid=?').bind(campaign.id,auth.uid).first();if(!saved)fail('SURVEY_SAVE_FAILED',500);return {data:{saved:true,completed:true,submittedAt:saved.submitted_at}};
  }
  fail('METHOD_NOT_ALLOWED',405);
 }
 if(auth.profile.role!=='admin')fail('FORBIDDEN',403);
 if(path!=='/admin/lecturer-satisfaction'||request.method!=='GET')fail('NOT_FOUND',404);
 const [result,users]=await Promise.all([env.DB.prepare('SELECT lecturer_uid,lecturer_name,lecturer_username,responses_json,submitted_at FROM lecturer_survey_responses WHERE campaign_id=? ORDER BY submitted_at DESC').bind(campaign.id).all(),deps.firebaseRead('users',auth.token)]);
 const records=result.results.map(r=>({uid:r.lecturer_uid,name:r.lecturer_name,username:r.lecturer_username,responses:model.validate(JSON.parse(r.responses_json)),submittedAt:r.submitted_at})),roster=Object.entries(users||{}).filter(([,u])=>u.role==='lecturer').map(([uid,u])=>({uid,name:u.name||u.username,username:u.username||uid})),answered=new Set(records.map(r=>r.uid)),eligibleResponded=roster.filter(u=>answered.has(u.uid)).length;
 return {data:{campaign,...model.analytics(records),eligibleCount:roster.length,eligibleResponded,responseRate:roster.length?eligibleResponded/roster.length*100:null,pending:roster.filter(u=>!answered.has(u.uid)),records}};
}
