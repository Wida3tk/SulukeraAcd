const PROJECT_ID='sulukeraacd';
const FIREBASE_DB='https://sulukeraacd-default-rtdb.firebaseio.com';
const ALLOWED_ORIGINS=new Set(['https://acd.sulukera.com','http://localhost','http://127.0.0.1']);

function corsHeaders(request){
  const origin=request.headers.get('Origin')||'';
  const allowed=ALLOWED_ORIGINS.has(origin)||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:');
  return {'Access-Control-Allow-Origin':allowed?origin:'https://acd.sulukera.com','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin'};
}
function reply(request,data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json;charset=UTF-8',...corsHeaders(request)}});}
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function base64UrlBytes(value){const normalized=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');return Uint8Array.from(atob(normalized),c=>c.charCodeAt(0));}
function decodePart(value){return JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));}

let cachedJwks={expires:0,keys:[]};
async function verifyFirebaseToken(token){
  const parts=String(token||'').split('.');
  if(parts.length!==3) fail('UNAUTHENTICATED',401);
  const header=decodePart(parts[0]),payload=decodePart(parts[1]);
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||!header.kid||payload.aud!==PROJECT_ID||payload.iss!==`https://securetoken.google.com/${PROJECT_ID}`||!payload.sub||payload.exp<=now) fail('INVALID_TOKEN',401);
  if(cachedJwks.expires<Date.now()){
    const response=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    if(!response.ok) fail('AUTH_KEYS_UNAVAILABLE',503);
    cachedJwks={keys:(await response.json()).keys||[],expires:Date.now()+60*60*1000};
  }
  const jwk=cachedJwks.keys.find(key=>key.kid===header.kid);
  if(!jwk) fail('UNKNOWN_SIGNING_KEY',401);
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64UrlBytes(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if(!valid) fail('INVALID_SIGNATURE',401);
  return payload;
}
async function firebaseRead(path,token){
  const response=await fetch(`${FIREBASE_DB}/${path}.json?auth=${encodeURIComponent(token)}`);
  if(!response.ok) fail('PROFILE_ACCESS_DENIED',403);
  return response.json();
}
async function firebaseStudentEnrollments(studentKey,token){
  const response=await fetch(`${FIREBASE_DB}/enrollments.json?auth=${encodeURIComponent(token)}&orderBy=%22studentKey%22&equalTo=${encodeURIComponent(JSON.stringify(studentKey))}`);
  if(!response.ok) fail('ENROLLMENT_ACCESS_DENIED',403);
  return response.json();
}
async function authenticate(request){
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer ')) fail('UNAUTHENTICATED',401);
  const token=authorization.slice(7);
  const jwt=await verifyFirebaseToken(token);
  const profile=await firebaseRead(`users/${jwt.sub}`,token);
  if(!profile?.role) fail('ACCOUNT_NOT_REGISTERED',403);
  return {uid:jwt.sub,token,profile};
}
function requireRole(auth,...roles){if(!roles.includes(auth.profile.role)) fail('FORBIDDEN',403);}
function iso(value){const date=new Date(value);if(Number.isNaN(date.getTime())) fail('INVALID_DATE');return date.toISOString();}
function answerIndex(value){if(Number.isInteger(value)&&value>=0&&value<=3)return value;const normalized=String(value||'').trim().toUpperCase();return ({A:0,'أ':0,'ا':0,B:1,'ب':1,C:2,'ج':2,D:3,'د':3})[normalized]??-1;}
async function bodyJson(request){try{return await request.json();}catch{fail('INVALID_JSON');}}

async function saveExam(request,env,auth){
  requireRole(auth,'admin');
  const body=await bodyJson(request),questions=Array.isArray(body.questions)?body.questions:[];
  if(!body.scheduleKey||!body.batch||!body.subjectKey||!body.subjectName||!questions.length) fail('MISSING_EXAM_FIELDS');
  const normalized=questions.map((question,index)=>{
    const choices=[question.choiceA,question.choiceB,question.choiceC,question.choiceD].map(value=>String(value||'').trim());
    const correct=answerIndex(question.answer),points=Number(question.points);
    if(!String(question.text||'').trim()||choices.some(value=>!value)||correct<0||!(points>0)) fail(`INVALID_QUESTION_${index+1}`);
    return {id:crypto.randomUUID(),position:index+1,prompt:String(question.text).trim(),choices,correct,points};
  });
  const total=normalized.reduce((sum,question)=>sum+question.points,0);
  if(Math.abs(total-20)>0.001) fail('TOTAL_MUST_EQUAL_20');
  const existing=await env.DB.prepare('SELECT id, created_at FROM exams WHERE schedule_key=?').bind(body.scheduleKey).first();
  const id=existing?.id||crypto.randomUUID(),now=new Date().toISOString();
  const opensAt=iso(body.opensAt),closesAt=iso(body.closesAt);
  if(closesAt<=opensAt) fail('INVALID_EXAM_WINDOW');
  const statements=[env.DB.prepare(`INSERT INTO exams (id,schedule_key,batch,subject_key,subject_name,opens_at,closes_at,duration_minutes,max_attempts,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(schedule_key) DO UPDATE SET batch=excluded.batch,subject_key=excluded.subject_key,subject_name=excluded.subject_name,opens_at=excluded.opens_at,closes_at=excluded.closes_at,duration_minutes=excluded.duration_minutes,max_attempts=excluded.max_attempts,status=excluded.status,updated_at=excluded.updated_at`).bind(id,body.scheduleKey,body.batch,body.subjectKey,body.subjectName,opensAt,closesAt,Number(body.durationMinutes)||120,Number(body.maxAttempts)||2,body.status==='published'?'published':'draft',auth.uid,existing?.created_at||now,now),env.DB.prepare('DELETE FROM questions WHERE exam_id=?').bind(id),...normalized.map(question=>env.DB.prepare('INSERT INTO questions (id,exam_id,position,prompt,choices_json,correct_index,points) VALUES (?,?,?,?,?,?,?)').bind(question.id,id,question.position,question.prompt,JSON.stringify(question.choices),question.correct,question.points))];
  await env.DB.batch(statements);
  return {id,status:body.status==='published'?'published':'draft',questionCount:normalized.length,total};
}
async function adminExams(env,auth){requireRole(auth,'admin');return (await env.DB.prepare('SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e ORDER BY opens_at DESC').all()).results;}
async function adminResults(env,auth){requireRole(auth,'admin');return (await env.DB.prepare(`SELECT e.id exam_id,e.subject_key,e.subject_name,e.batch,a.student_key,COUNT(a.id) attempt_count,MAX(CASE WHEN a.status='submitted' THEN a.score END) best_score,MAX(CASE WHEN a.status='submitted' THEN a.wrong_count END) last_wrong_count,MAX(a.submitted_at) last_submitted_at,CASE WHEN v.student_key IS NULL THEN 0 ELSE 1 END evaluated FROM exams e JOIN attempts a ON a.exam_id=e.id LEFT JOIN evaluations v ON v.exam_id=e.id AND v.student_key=a.student_key GROUP BY e.id,a.student_key ORDER BY e.opens_at DESC,a.student_key`).all()).results;}
async function saveException(request,env,auth){requireRole(auth,'admin');const body=await bodyJson(request);if(!body.examId||!body.studentKey)fail('MISSING_EXCEPTION_FIELDS');const now=new Date().toISOString();await env.DB.prepare(`INSERT INTO exam_exceptions (exam_id,student_key,opens_at,closes_at,duration_minutes,extra_attempts,active,reason,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(exam_id,student_key) DO UPDATE SET opens_at=excluded.opens_at,closes_at=excluded.closes_at,duration_minutes=excluded.duration_minutes,extra_attempts=excluded.extra_attempts,active=excluded.active,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(body.examId,body.studentKey,body.opensAt?iso(body.opensAt):null,body.closesAt?iso(body.closesAt):null,body.durationMinutes||null,Number(body.extraAttempts)||0,body.active===false?0:1,String(body.reason||''),auth.uid,now).run();return {saved:true};}
async function studentContext(auth){requireRole(auth,'student');if(!auth.profile.studentKey)fail('STUDENT_LINK_MISSING',403);const student=await firebaseRead(`students/${auth.profile.studentKey}`,auth.token);if(!student)fail('STUDENT_NOT_FOUND',404);const enrollments=await firebaseStudentEnrollments(auth.profile.studentKey,auth.token);return {studentKey:auth.profile.studentKey,student,subjectKeys:new Set(Object.values(enrollments||{}).map(enrollment=>enrollment.subjectKey).filter(Boolean))};}
async function studentExams(env,auth){const {studentKey,student,subjectKeys}=await studentContext(auth);const exams=(await env.DB.prepare(`SELECT e.*, x.opens_at exception_opens_at,x.closes_at exception_closes_at,x.duration_minutes exception_duration,x.extra_attempts,x.active exception_active FROM exams e LEFT JOIN exam_exceptions x ON x.exam_id=e.id AND x.student_key=? WHERE e.status='published' AND e.batch=? ORDER BY e.opens_at`).bind(studentKey,student.batch).all()).results.filter(exam=>subjectKeys.has(exam.subject_key)&&!(exam.exception_active&&!exam.exception_opens_at&&!exam.exception_closes_at));const attempts=(await env.DB.prepare('SELECT exam_id,attempt_no,status,wrong_count,score FROM attempts WHERE student_key=?').bind(studentKey).all()).results;const evaluations=(await env.DB.prepare('SELECT exam_id FROM evaluations WHERE student_key=?').bind(studentKey).all()).results;return exams.map(exam=>{const mine=attempts.filter(attempt=>attempt.exam_id===exam.id),evaluated=evaluations.some(row=>row.exam_id===exam.id);return {id:exam.id,subjectKey:exam.subject_key,subjectName:exam.subject_name,opensAt:exam.exception_active?exam.exception_opens_at||exam.opens_at:exam.opens_at,closesAt:exam.exception_active?exam.exception_closes_at||exam.closes_at:exam.closes_at,durationMinutes:exam.exception_active?exam.exception_duration||exam.duration_minutes:exam.duration_minutes,maxAttempts:exam.max_attempts+(exam.exception_active?exam.extra_attempts||0:0),attempts:mine.map(attempt=>({attemptNo:attempt.attempt_no,status:attempt.status,wrongCount:attempt.wrong_count,score:evaluated?attempt.score:null})),evaluated};});}
async function startAttempt(request,env,auth,examId){const {studentKey,student,subjectKeys}=await studentContext(auth);const exam=await env.DB.prepare(`SELECT e.*,x.opens_at exception_opens_at,x.closes_at exception_closes_at,x.duration_minutes exception_duration,x.extra_attempts,x.active exception_active FROM exams e LEFT JOIN exam_exceptions x ON x.exam_id=e.id AND x.student_key=? WHERE e.id=? AND e.status='published' AND e.batch=?`).bind(studentKey,examId,student.batch).first();if(!exam||!subjectKeys.has(exam.subject_key))fail('EXAM_NOT_FOUND',404);if(exam.exception_active&&!exam.exception_opens_at&&!exam.exception_closes_at)fail('EXAM_NOT_AVAILABLE',403);const now=new Date(),opens=new Date(exam.exception_active?exam.exception_opens_at||exam.opens_at:exam.opens_at),closes=new Date(exam.exception_active?exam.exception_closes_at||exam.closes_at:exam.closes_at);if(now<opens||now>closes)fail('EXAM_NOT_AVAILABLE',403);const active=await env.DB.prepare("SELECT * FROM attempts WHERE exam_id=? AND student_key=? AND status='in_progress' ORDER BY attempt_no DESC LIMIT 1").bind(examId,studentKey).first();let attempt=active&&new Date(active.expires_at)>now?active:null;if(!attempt){const count=await env.DB.prepare('SELECT COUNT(*) count FROM attempts WHERE exam_id=? AND student_key=?').bind(examId,studentKey).first();const max=exam.max_attempts+(exam.exception_active?exam.extra_attempts||0:0);if(count.count>=max)fail('NO_ATTEMPTS_REMAINING',403);const duration=exam.exception_active?exam.exception_duration||exam.duration_minutes:exam.duration_minutes,expires=new Date(Math.min(closes.getTime(),now.getTime()+duration*60000));attempt={id:crypto.randomUUID(),attempt_no:count.count+1,started_at:now.toISOString(),expires_at:expires.toISOString()};await env.DB.prepare('INSERT INTO attempts (id,exam_id,student_key,attempt_no,started_at,expires_at,status) VALUES (?,?,?,?,?,?,?)').bind(attempt.id,examId,studentKey,attempt.attempt_no,attempt.started_at,attempt.expires_at,'in_progress').run();}const questions=(await env.DB.prepare('SELECT id,position,prompt,choices_json,points FROM questions WHERE exam_id=? ORDER BY position').bind(examId).all()).results.map(question=>({...question,choices:JSON.parse(question.choices_json),choices_json:undefined}));return {attemptId:attempt.id,attemptNo:attempt.attempt_no,expiresAt:attempt.expires_at,questions};}
async function submitAttempt(request,env,auth,attemptId){const {studentKey}=await studentContext(auth);const attempt=await env.DB.prepare('SELECT * FROM attempts WHERE id=? AND student_key=?').bind(attemptId,studentKey).first();if(!attempt)fail('ATTEMPT_NOT_FOUND',404);if(attempt.status!=='in_progress')fail('ATTEMPT_ALREADY_SUBMITTED',409);if(Date.now()>new Date(attempt.expires_at).getTime()+60000)fail('ATTEMPT_EXPIRED',409);const body=await bodyJson(request),answers=body.answers&&typeof body.answers==='object'?body.answers:{};const questions=(await env.DB.prepare('SELECT id,correct_index,points FROM questions WHERE exam_id=?').bind(attempt.exam_id).all()).results;let score=0,wrong=0;for(const question of questions){if(answerIndex(answers[question.id])===question.correct_index)score+=question.points;else wrong++;}await env.DB.prepare("UPDATE attempts SET status='submitted',submitted_at=?,score=?,wrong_count=?,answers_json=? WHERE id=?").bind(new Date().toISOString(),score,wrong,JSON.stringify(answers),attemptId).run();const exam=await env.DB.prepare('SELECT max_attempts FROM exams WHERE id=?').bind(attempt.exam_id).first(),exception=await env.DB.prepare('SELECT extra_attempts FROM exam_exceptions WHERE exam_id=? AND student_key=? AND active=1').bind(attempt.exam_id,studentKey).first(),count=await env.DB.prepare('SELECT COUNT(*) count FROM attempts WHERE exam_id=? AND student_key=?').bind(attempt.exam_id,studentKey).first();return {submitted:true,wrongCount:wrong,perfect:wrong===0,attemptsRemaining:Math.max(0,exam.max_attempts+(exception?.extra_attempts||0)-count.count)};}
async function submitEvaluation(request,env,auth,examId){const {studentKey}=await studentContext(auth);const body=await bodyJson(request),responses=body.responses;if(!responses||typeof responses!=='object')fail('EVALUATION_REQUIRED');for(let number=5;number<=15;number++){const rating=Number(responses[`q${number}`]);if(!Number.isInteger(rating)||rating<1||rating>5)fail('EVALUATION_INCOMPLETE',400);}if(typeof responses.improvement!=='string'||!responses.improvement.trim())fail('EVALUATION_INCOMPLETE',400);const submitted=await env.DB.prepare("SELECT COUNT(*) count FROM attempts WHERE exam_id=? AND student_key=? AND status='submitted'").bind(examId,studentKey).first();if(!submitted.count)fail('NO_SUBMITTED_ATTEMPT',409);await env.DB.prepare('INSERT INTO evaluations (exam_id,student_key,responses_json,submitted_at) VALUES (?,?,?,?) ON CONFLICT(exam_id,student_key) DO UPDATE SET responses_json=excluded.responses_json,submitted_at=excluded.submitted_at').bind(examId,studentKey,JSON.stringify(responses),new Date().toISOString()).run();const best=await env.DB.prepare("SELECT MAX(score) score FROM attempts WHERE exam_id=? AND student_key=? AND status='submitted'").bind(examId,studentKey).first();return {evaluated:true,bestScore:best.score};}

export default {async fetch(request,env){if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(request)});try{const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/';if(path==='/health')return reply(request,{ok:true,service:'sulukera-exams'});const auth=await authenticate(request);if(path==='/admin/exams'&&request.method==='GET')return reply(request,{exams:await adminExams(env,auth)});if(path==='/admin/results'&&request.method==='GET')return reply(request,{results:await adminResults(env,auth)});if(path==='/admin/exams'&&request.method==='POST')return reply(request,await saveExam(request,env,auth));if(path==='/admin/exceptions'&&request.method==='POST')return reply(request,await saveException(request,env,auth));if(path==='/student/exams'&&request.method==='GET')return reply(request,{exams:await studentExams(env,auth)});let match=path.match(/^\/student\/exams\/([^/]+)\/start$/);if(match&&request.method==='POST')return reply(request,await startAttempt(request,env,auth,match[1]));match=path.match(/^\/student\/attempts\/([^/]+)\/submit$/);if(match&&request.method==='POST')return reply(request,await submitAttempt(request,env,auth,match[1]));match=path.match(/^\/student\/exams\/([^/]+)\/evaluation$/);if(match&&request.method==='POST')return reply(request,await submitEvaluation(request,env,auth,match[1]));return reply(request,{error:'NOT_FOUND'},404);}catch(error){console.error(error);return reply(request,{error:error.message||'INTERNAL_ERROR'},error.status||500);}}};
