import {productivityRecordingMetadata} from './zoom-drive-transfer.js';
// Read-only, bounded monthly jobs. Never changes attendance, grades, or videos.
export async function processProductivityAudit(env){
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='productivity_audit_jobs'").first();if(!exists)return;
 const now=Date.now(),job=await env.DB.prepare("UPDATE productivity_audit_jobs SET state='running',lock_until=?,attempts=attempts+1 WHERE id=(SELECT id FROM productivity_audit_jobs WHERE state='pending' OR state='running' AND lock_until<? ORDER BY id LIMIT 1) RETURNING *").bind(now+240000,now).first();if(!job)return;
 try{const data=await productivityRecordingMetadata(env,job.host,job.month,JSON.parse(job.files_json));await env.DB.prepare("UPDATE productivity_audit_jobs SET state='complete',result_json=?,error='',updated_at=? WHERE id=?").bind(JSON.stringify(data),new Date().toISOString(),job.id).run();}
 catch(e){await env.DB.prepare("UPDATE productivity_audit_jobs SET state=?,error=?,updated_at=? WHERE id=?").bind(job.attempts<3?'pending':'error',String(e.message).slice(0,180),new Date().toISOString(),job.id).run();}
}
