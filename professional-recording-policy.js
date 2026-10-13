(function(root){
 function status(live,assignment,watch){
  const attended=Number(live?.attendancePercent)>=80||live?.attended===true;
  if(attended)return {mode:'live',label:'حضر مباشرًا',approved:true};
  if(assignment?.mode==='recorded')return {mode:'recorded',label:assignment.approved?'تعويض معتمد':Number(watch?.percent)>=80?'المشاهدة مكتملة — بانتظار مراجعة التعويض':'تعويض بالتسجيل',approved:assignment.approved===true||assignment.approved===1};
  return {mode:'optional',label:'التسجيل اختياري للمراجعة',approved:false};
 }
 root.SulukeraRecordingPolicy={status};if(typeof module!=='undefined')module.exports=root.SulukeraRecordingPolicy;
})(globalThis);
