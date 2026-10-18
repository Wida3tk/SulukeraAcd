import test from 'node:test';import assert from 'node:assert/strict';
import {inspectPilotDrive,inspectPilotZoom,handleZoomDrivePilot} from './src/zoom-drive-pilot.js';
test('pilot endpoint is disabled without key and rejects missing/wrong key before external calls',async()=>{
 const request=key=>new Request('https://api/integrations/zoom-drive-pilot/inspect',{method:'POST',headers:key?{Authorization:'Bearer '+key}:{}});
 await assert.rejects(()=>handleZoomDrivePilot(request(),{},'/integrations/zoom-drive-pilot/inspect'),/PILOT_NOT_ENABLED/);
 await assert.rejects(()=>handleZoomDrivePilot(request('incorrect'),{RECORDING_PILOT_KEY:'x'.repeat(64)},'/integrations/zoom-drive-pilot/inspect'),/FORBIDDEN/);
 assert.equal(await handleZoomDrivePilot(request(),{},'/other'),null);
});
test('Drive inspection remains inside configured folders, identifies course folder and My Drive OAuth requirement',async()=>{
 const urls=[],env={DRIVE_RECORDING_FOLDER_ID:'root',FIREBASE_SERVICE_ACCOUNT:JSON.stringify({client_email:'service@example.com'})};
 const result=await inspectPilotDrive(env,async(url,options)=>{
  urls.push(url);assert.equal(options.headers.Authorization,'Bearer private-token');
  if(url.includes('/files/root?'))return Response.json({id:'root',name:'تسجيلات',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  const query=new URL(url).searchParams.get('q');
  return Response.json({files:query.startsWith("'root'")?[{id:'course',name:'تدخلات تغيير السلوك',capabilities:{canAddChildren:true}}]:[]});
 },async()=> 'private-token');
 assert.equal(result.uploadAuthorization,'google_user_oauth_required');assert.deepEqual(result.matchingFolders.map(f=>f.id),['course']);assert.equal(result.folderCount,1);assert.equal(urls.length,3);assert(!JSON.stringify(result).includes('private-token'));
});
test('Zoom pilot filters exact meeting and completed MP4 files; does not disclose download URLs or credentials',async()=>{
 const credentials={hostEmail:'rushdacd.sa@gmail.com',meetingId:'88245118262',clientId:'id',clientSecret:'secret',accountId:'account'};
 const result=await inspectPilotZoom({ZOOM_PILOT_CREDENTIALS:JSON.stringify(credentials)},async(url,options)=>{
  if(url==='https://zoom.us/oauth/token')return Response.json({access_token:'private-zoom-token'});
  assert.equal(options.headers.Authorization,'Bearer private-zoom-token');
  return Response.json({meetings:[{id:88245118262,uuid:'instance',topic:'تدخلات تغيير السلوك',start_time:'2026-10-04T14:45:11Z',recording_files:[{id:'video',file_type:'MP4',status:'completed',download_url:'https://zoom.us/private-download',file_size:100},{id:'chat',file_type:'TXT',status:'completed'}]},{id:123,recording_files:[]}]});
 });
 assert.equal(result.recordings.length,1);assert.equal(result.recordings[0].files.length,1);assert.equal(result.recordings[0].files[0].id,'video');assert(!JSON.stringify(result).includes('private-'));assert(!JSON.stringify(result).includes('secret'));
});
