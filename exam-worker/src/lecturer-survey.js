import '../../lecturer-survey-model.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const dayInRiyadh=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh'}).format(new Date());
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const norm=value=>String(value||'').trim().toLowerCase();
const periodLabel=(start,end)=>`${new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(start+'T12:00:00Z'))} إلى ${new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(end+'T12:00:00Z'))}`;
function periods(semesters={},subjects={},today=dayInRiyadh()){
 const grouped=new Map();
 for(const [semesterKey,semester] of Object.entries(semesters||{})){
  if(!validDate(semester?.startDate)||!validDate(semester?.endDate)||semester.startDate>semester.endDate||semester.endDate>=today)continue;
  const key=semester.startDate+'|'+semester.endDate,entry=grouped.get(key)||{start:semester.startDate,end:semester.endDate,semesterKeys:[],subjectKeys:new Set()};
  entry.semesterKeys.push(semesterKey);for(const subjectKey of semester.subjects||[])entry.subjectKeys.add(subjectKey);grouped.set(key,entry);
 }
 return [...grouped.values()].map(entry=>{const lecturerIds=new Set();for(const key of entry.subjectKeys){const subject=subjects?.[key]||{};for(const value of [subject.lecturerUserId,subject.lecturerUid])if(value)lecturerIds.add(norm(value));}return {id:`lecturer-${entry.start}-${entry.end}`,title:'استبيان رضا محاضري سلوكيرا',start:entry.start,end:entry.end,periodLabel:periodLabel(entry.start,entry.end),semesterKeys:entry.semesterKeys,lecturerIds};}).sort((a,b)=>b.end.localeCompare(a.end)||b.start.localeCompare(a.start));
}
const belongs=(campaign,uid,profile)=>campaign.lecturerIds.has(norm(uid))||campaign.lecturerIds.has(norm(profile?.username));
const publicCampaign=campaign=>Object.fromEntries(['id','title','start','end','periodLabel'].map(key=>[key,campaign[key]]));
const isExempt=(campaign,uid,profile)=>(Array.isArray(profile.lecturerSurveyExemptCampaigns)&&profile.lecturerSurveyExemptCampaigns.includes(campaign.id))||campaign.id==='lecturer-2026-08-23-2026-09-24'&&(uid==='Rd1O695bgWdbu3xk1AUAoIYmJPk2'||norm(profile.username)==='aalmubaddal');
async function context(deps,token){const [semesters,subjects,users]=await Promise.all(['semesters','subjects','users'].map(path=>deps.firebaseRead(path,token)));return {campaigns:periods(semesters,subjects),users:users||{}};}
export async function handleLecturerSurvey(request,env,auth,path,deps){
 if(!path.startsWith('/lecturer/satisfaction')&&!path.startsWith('/admin/lecturer-satisfaction'))return null;
 const model=SulukeraLecturerSurvey;
 if(path.startsWith('/lecturer/')){
  if(auth.profile.role!=='lecturer')fail('FORBIDDEN',403);if(path!=='/lecturer/satisfaction')fail('NOT_FOUND',404);
  const {campaigns}=await context(deps,auth.token),campaign=campaigns.find(item=>belongs(item,auth.uid,auth.profile));
  if(!campaign)return {data:{completed:true,eligible:false,name:auth.profile.name||auth.profile.username}};
  const visible=publicCampaign(campaign);
  if(isExempt(campaign,auth.uid,auth.profile)){if(request.method==='GET')return {data:{campaign:visible,completed:true,exempt:true,name:auth.profile.name||auth.profile.username}};fail('SURVEY_EXEMPT',403);}
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT submitted_at FROM lecturer_survey_responses WHERE campaign_id=? AND lecturer_uid=?').bind(campaign.id,auth.uid).first();return {data:{campaign:visible,completed:!!row,eligible:true,submittedAt:row?.submitted_at||null,name:auth.profile.name||auth.profile.username}};}
  if(request.method==='POST'){
   let body;try{body=await request.json();}catch{fail('INVALID_JSON');}if(body.campaignId!==campaign.id)fail('INVALID_CAMPAIGN');
   let answers;try{answers=model.validate(body.responses);}catch(e){fail(e.message);}
   await env.DB.prepare('INSERT INTO lecturer_survey_responses (campaign_id,lecturer_uid,lecturer_name,lecturer_username,responses_json,submitted_at) VALUES (?,?,?,?,?,?) ON CONFLICT(campaign_id,lecturer_uid) DO NOTHING').bind(campaign.id,auth.uid,auth.profile.name||auth.profile.username||auth.uid,auth.profile.username||auth.uid,JSON.stringify(answers),new Date().toISOString()).run();
   const saved=await env.DB.prepare('SELECT submitted_at FROM lecturer_survey_responses WHERE campaign_id=? AND lecturer_uid=?').bind(campaign.id,auth.uid).first();if(!saved)fail('SURVEY_SAVE_FAILED',500);return {data:{saved:true,completed:true,submittedAt:saved.submitted_at}};
  }fail('METHOD_NOT_ALLOWED',405);
 }
 if(auth.profile.role!=='admin')fail('FORBIDDEN',403);if(path!=='/admin/lecturer-satisfaction'||request.method!=='GET')fail('NOT_FOUND',404);
 const {campaigns,users}=await context(deps,auth.token),campaign=campaigns[0];
 if(!campaign)return {data:{campaign:null,responseCount:0,eligibleCount:0,eligibleResponded:0,responseRate:null,pending:[],records:[],overallPercent:null,dimensionsPercent:null,recommendationAverage:null,recommendationDistribution:Array(10).fill(0),problemCount:0,stages:model.stages.map(([id,label])=>({id,label,count:0})),questions:Object.fromEntries(model.ratings.map(([key])=>[key,{distribution:[0,0,0,0,0],average:null,percent:null}]))}};
 const result=await env.DB.prepare('SELECT lecturer_uid,lecturer_name,lecturer_username,responses_json,submitted_at FROM lecturer_survey_responses WHERE campaign_id=? ORDER BY submitted_at DESC').bind(campaign.id).all();
 const roster=Object.entries(users).filter(([uid,u])=>u.role==='lecturer'&&belongs(campaign,uid,u)&&!isExempt(campaign,uid,u)).map(([uid,u])=>({uid,name:u.name||u.username,username:u.username||uid}));
 const eligible=new Set(roster.map(row=>row.uid)),records=result.results.filter(row=>eligible.has(row.lecturer_uid)).map(row=>({uid:row.lecturer_uid,name:row.lecturer_name,username:row.lecturer_username,responses:model.validate(JSON.parse(row.responses_json)),submittedAt:row.submitted_at})),answered=new Set(records.map(row=>row.uid)),eligibleResponded=roster.filter(row=>answered.has(row.uid)).length;
 return {data:{campaign:publicCampaign(campaign),...model.analytics(records),eligibleCount:roster.length,eligibleResponded,responseRate:roster.length?eligibleResponded/roster.length*100:null,pending:roster.filter(row=>!answered.has(row.uid)),records}};
}
export const lecturerSurveyInternals={periods,belongs};
