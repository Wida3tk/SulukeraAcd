/* Revoke an already-open portal when administration changes account state. */
let studentAccountSubscriptions=[];
let inactiveStudentLogout=false;
function stopStudentAccountLiveUpdates(){for(const [path,handler] of studentAccountSubscriptions)fbRef(path).off('value',handler);studentAccountSubscriptions=[];}
async function disableInactiveStudent(){if(currentUser?.role!=='student'||inactiveStudentLogout)return;inactiveStudentLogout=true;try{await doLogout();showErr('الحساب غير نشط حاليًا. يرجى التواصل مع الإدارة الأكاديمية.');}finally{inactiveStudentLogout=false;}}
function startStudentAccountLiveUpdates(){
  stopStudentAccountLiveUpdates();if(currentUser?.role!=='student')return;
  const key=currentUser.fbKey,uid=currentUser.authUid||currentUser.authKey;
  const watch=(path,handler)=>{studentAccountSubscriptions.push([path,handler]);fbRef(path).on('value',handler,error=>console.error('account status listener',error));};
  watch('students/'+key,snapshot=>{if(currentUser?.role!=='student')return;const student=snapshot.val();if(!student||!SulukeraStudentAccount.isActive(student)){disableInactiveStudent();return;}currentUser.data={...currentUser.data,...student};});
  if(uid)watch('users/'+uid,snapshot=>{if(currentUser?.role==='student'&&!SulukeraStudentAccount.isActive(snapshot.val()))disableInactiveStudent();});
  watch('professionalEnrollments/'+key,snapshot=>{if(currentUser?.role==='student'&&SulukeraStudentAccount.resolve(currentUser.data,snapshot.val()||{})!=='active')disableInactiveStudent();});
}
