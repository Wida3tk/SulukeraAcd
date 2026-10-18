const cache={token:'',expires:0};
const fail=message=>{const error=new Error(message);error.status=503;throw error;};
const encode=value=>btoa(String.fromCharCode(...(value instanceof Uint8Array?value:new TextEncoder().encode(value)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function driveFile(url){try{const parsed=new URL(url);if(parsed.hostname!=='drive.google.com')return null;const id=parsed.pathname.match(/\/file\/d\/([\w-]+)/)?.[1]||parsed.searchParams.get('id');return id&&/^[\w-]+$/.test(id)?{id,resourceKey:parsed.searchParams.get('resourcekey')||''}:null;}catch{return null;}}
export function driveIdentity(env){try{const account=JSON.parse(env.DRIVE_SERVICE_ACCOUNT||env.FIREBASE_SERVICE_ACCOUNT);return {email:account.client_email,projectId:account.project_id,folderId:env.DRIVE_RECORDING_FOLDER_ID||''};}catch{return {email:'',folderId:env.DRIVE_RECORDING_FOLDER_ID||''};}}
async function token(env){
 if(cache.token&&cache.expires>Date.now()+60000)return cache.token;
 let account;try{account=JSON.parse(env.DRIVE_SERVICE_ACCOUNT||env.FIREBASE_SERVICE_ACCOUNT);}catch{fail('DRIVE_CONNECTION_REQUIRED');}
 const pem=account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,''),key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const now=Math.floor(Date.now()/1000),prefix=encode(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+encode(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/drive.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
 const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(prefix)));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:prefix+'.'+encode(signature)})});
 if(!response.ok)fail('DRIVE_CONNECTION_REQUIRED');const result=await response.json();cache.token=result.access_token;cache.expires=Date.now()+Number(result.expires_in)*1000;return result.access_token;
}
async function metadata(env,id,resourceKey=''){
 const headers={Authorization:'Bearer '+await token(env)};if(resourceKey)headers['X-Goog-Drive-Resource-Keys']=id+'/'+resourceKey;
 const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,parents,videoMediaMetadata,capabilities,trashed&supportsAllDrives=true`,{headers});if(!response.ok){const error=await response.json().catch(()=>({}));fail(error.error?.errors?.some(item=>item.reason==='accessNotConfigured')||error.error?.details?.some(item=>item.reason==='SERVICE_DISABLED')?'DRIVE_API_NOT_ENABLED':'DRIVE_FILE_ACCESS_REQUIRED');}return response.json();
}

const folderCache=new Map();
export {token as driveReadToken};
export async function folderVideos(env){
 const key=driveIdentity(env).email+':'+env.DRIVE_RECORDING_FOLDER_ID,cached=folderCache.get(key);if(cached&&cached.expires>Date.now())return cached.files;
 if(!env.DRIVE_RECORDING_FOLDER_ID)fail('DRIVE_CONNECTION_REQUIRED');
 const queue=[{id:env.DRIVE_RECORDING_FOLDER_ID,depth:0}],seen=new Set(),files=[];
 while(queue.length){const folder=queue.shift();if(seen.has(folder.id))continue;seen.add(folder.id);if(seen.size>100)fail('DRIVE_FOLDER_TOO_LARGE');let pageToken='';
 do{const params=new URLSearchParams({q:"'"+folder.id+"' in parents and trashed = false",fields:'files(id,name,mimeType,videoMediaMetadata,resourceKey),nextPageToken',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});if(pageToken)params.set('pageToken',pageToken);
 const response=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:{Authorization:'Bearer '+await token(env)}});if(!response.ok)fail('DRIVE_FILE_ACCESS_REQUIRED');const data=await response.json();
 for(const file of data.files||[]){if(file.mimeType==='application/vnd.google-apps.folder'&&folder.depth<8)queue.push({id:file.id,depth:folder.depth+1});else if(file.mimeType?.startsWith('video/'))files.push(file);}if(files.length>1000)fail('DRIVE_FOLDER_TOO_LARGE');pageToken=data.nextPageToken||'';
 }while(pageToken);}
 folderCache.set(key,{files,expires:Date.now()+5*60000});return files;
}

export async function checkedVideo(env,file){
 if(!env.DRIVE_RECORDING_FOLDER_ID)fail('DRIVE_CONNECTION_REQUIRED');const data=await metadata(env,file.id,file.resourceKey);if(data.trashed||!data.mimeType?.startsWith('video/')||data.capabilities?.canDownload===false)fail('DRIVE_VIDEO_UNAVAILABLE');
 let parents=data.parents||[],found=false;const seen=new Set();for(let level=0;level<8&&parents.length;level++){if(parents.includes(env.DRIVE_RECORDING_FOLDER_ID)){found=true;break;}const next=[];for(const id of parents){if(seen.has(id))continue;seen.add(id);next.push(...((await metadata(env,id)).parents||[]));}parents=next;}
 if(!found)found=(await folderVideos(env)).some(item=>item.id===file.id);if(!found)fail('DRIVE_FOLDER_MISMATCH');const duration=Number(data.videoMediaMetadata?.durationMillis)/1000;if(!Number.isFinite(duration)||duration<=0)fail('DRIVE_VIDEO_PROCESSING');return {duration,name:data.name};
}
export async function connection(env){const identity=driveIdentity(env);if(!identity.email||!identity.folderId)return {...identity,ready:false,reason:'DRIVE_CONNECTION_REQUIRED'};try{const folder=await metadata(env,identity.folderId);const files=await folderVideos(env);return {...identity,ready:folder.mimeType==='application/vnd.google-apps.folder'&&files.length>0,folderName:folder.name,videoCount:files.length,reason:files.length?'':'DRIVE_FOLDER_LIST_REQUIRED'};}catch(error){return {...identity,ready:false,reason:error.message};}}
export async function streamVideo(env,file,range){const headers={Authorization:'Bearer '+await token(env)};if(range){if(!/^bytes=(?:\d+-\d*|-\d+)$/.test(range)){const e=new Error('INVALID_RANGE');e.status=416;throw e;}headers.Range=range;}if(file.resourceKey)headers['X-Goog-Drive-Resource-Keys']=file.id+'/'+file.resourceKey;return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`,{headers});}
