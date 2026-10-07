import '../../revenue-model.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const json=async request=>{try{return await request.json();}catch{fail('INVALID_JSON');}};
function validate(data){
 if(!data||!/^[a-f0-9]{64}$/.test(data.sourceHash)||!Array.isArray(data.periods)||!data.periods.length||data.periods.length>36)fail('INVALID_REVENUE_IMPORT');
 const months=new Set();for(const p of data.periods){if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(p.month)||months.has(p.month)||!Array.isArray(p.rows)||p.rows.length>5000)fail('INVALID_REVENUE_PERIOD');months.add(p.month);
  const ids=new Set();for(const r of p.rows){if(!r.id||ids.has(r.id)||!Number.isFinite(r.net)||!['included','excluded','review'].includes(r.state)||!['sale','collection'].includes(r.kind)||typeof r.category!=='string'||typeof r.product!=='string')fail('INVALID_REVENUE_ROW');ids.add(r.id);
   // Reapply exclusions on the server; clients cannot include prohibited categories.
   const reason=SulukeraRevenue.exclusion(r.category);if(reason){r.state='excluded';r.reason=reason;}
   r.baseCategory=SulukeraRevenue.base(r.category);r.family=SulukeraRevenue.family(r.category);r.kind=r.category.includes('تحصيل')?'collection':'sale';
   if(r.state==='included'&&(!SulukeraRevenue.day(r.date)||!r.date.startsWith(p.month)||!r.category))fail('INVALID_REVENUE_ROW');
  }
 }
 if(JSON.stringify(data).length>3500000)fail('REVENUE_IMPORT_TOO_LARGE',413);
}
export async function handleRevenue(request,env,auth,path){
 if(!path.startsWith('/admin/revenue'))return null;
 if(!['admin','finance'].includes(auth.profile.role))fail('FORBIDDEN',403);
 if(path==='/admin/revenue'&&request.method==='GET'){
  const periods=(await env.DB.prepare('SELECT data_json FROM revenue_periods ORDER BY month').all()).results.map(r=>JSON.parse(r.data_json));
  const config=(await env.DB.prepare('SELECT id,data_json FROM revenue_config').all()).results;
  return {data:{periods,quarterTargets:JSON.parse(config.find(r=>r.id==='quarterTargets')?.data_json||'[]'),goals:JSON.parse(config.find(r=>r.id==='goals')?.data_json||'{}'),imports:(await env.DB.prepare('SELECT filename,summary_json,imported_at FROM revenue_imports ORDER BY imported_at DESC LIMIT 10').all()).results}};
 }
 if(path==='/admin/revenue/import'&&request.method==='POST'){
  if(auth.profile.role!=='admin')fail('FORBIDDEN',403);
  const b=await json(request);validate(b);
  if(await env.DB.prepare('SELECT source_hash FROM revenue_imports WHERE source_hash=?').bind(b.sourceHash).first())return {data:{saved:true,duplicate:true}};
  const now=new Date().toISOString(),statements=b.periods.flatMap(p=>[env.DB.prepare('INSERT OR IGNORE INTO revenue_snapshots SELECT source_hash,month,data_json,? FROM revenue_periods WHERE month=?').bind(now,p.month),env.DB.prepare('INSERT INTO revenue_periods VALUES (?,?,?,?,?) ON CONFLICT(month) DO UPDATE SET data_json=excluded.data_json,source_hash=excluded.source_hash,imported_by=excluded.imported_by,imported_at=excluded.imported_at').bind(p.month,JSON.stringify(p),b.sourceHash,auth.uid,now)]);
  const old=JSON.parse((await env.DB.prepare("SELECT data_json FROM revenue_config WHERE id='quarterTargets'").first())?.data_json||'[]');
  const fresh=(b.quarterTargets||[]).filter(t=>!SulukeraRevenue.exclusion(t.category));
  if(fresh.some(t=>!/^20\d{2}-Q[1-4]$/.test(t.period)||typeof t.category!=='string'||!t.category||!Number.isFinite(t.amount)||t.amount<0||!['sale','collection'].includes(t.kind)))fail('INVALID_REVENUE_TARGET');
  const periods=new Set(fresh.map(t=>t.period)),targets=[...old.filter(t=>!periods.has(t.period)),...fresh];
  statements.push(env.DB.prepare("INSERT INTO revenue_config VALUES ('quarterTargets',?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify(targets),auth.uid,now));
  const summary={months:b.periods.map(p=>p.month),...SulukeraRevenue.summarize(b.periods.flatMap(p=>p.rows)),issues:b.issues||[]};
  statements.push(env.DB.prepare('INSERT INTO revenue_imports VALUES (?,?,?,?,?)').bind(b.sourceHash,b.filename,JSON.stringify(summary),auth.uid,now));
  await env.DB.batch(statements);return {data:{saved:true,summary}};
 }
 if(path==='/admin/revenue/goal'&&request.method==='POST'){
  if(auth.profile.role!=='admin')fail('FORBIDDEN',403);
  const b=await json(request);if(!/^20\d{2}(?:-(?:0[1-9]|1[0-2]|Q[1-4]))?$/.test(b.period)||typeof b.category!=='string'||b.category.length>250)fail('INVALID_REVENUE_TARGET');
  for(const k of ['sales','collections'])if(b[k]!==null&&(!Number.isFinite(b[k])||b[k]<0))fail('INVALID_REVENUE_TARGET');
  const goals=JSON.parse((await env.DB.prepare("SELECT data_json FROM revenue_config WHERE id='goals'").first())?.data_json||'{}'),key=b.period+'|'+b.category,previous=goals[key]||null,now=new Date().toISOString();
  goals[key]={sales:b.sales,collections:b.collections};
  await env.DB.batch([env.DB.prepare("INSERT INTO revenue_config VALUES ('goals',?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify(goals),auth.uid,now),env.DB.prepare('INSERT INTO revenue_goal_audit VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),b.period,b.category,JSON.stringify(previous),JSON.stringify(goals[key]),auth.uid,now)]);
  return {data:{saved:true}};
 }
 fail('NOT_FOUND',404);
}
