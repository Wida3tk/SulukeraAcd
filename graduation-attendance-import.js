(function(root){
 const norm=v=>String(v??'').normalize('NFKC').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\u064B-\u065F\u0670ـ]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
 const identity=v=>norm(v).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^a-z0-9]/g,'');
 function parse(rows){
  let header=-1,cols;
  for(let i=0;i<Math.min(rows.length,50);i++){
   const values=rows[i].map(norm),name=values.findIndex(v=>/^(name(?: \(original name\))?|full name|participant name|user name|الاسم|اسم الطالب|اسم المتدرب|اسم المشارك|الاسم الكامل)$/.test(v)),id=values.findIndex(v=>/^(student id|student number|الرقم الطلابي|رقم الطالب|رقم المتدرب)$/.test(v)),email=values.findIndex(v=>/^(user email|email|email address|البريد الالكتروني)$/.test(v));
   if(name<0&&id<0&&email<0)continue;
   header=i;cols={name,id,email,status:values.findIndex(v=>/^(attendance|attended|status|الحضور|حاله الحضور)$/.test(v)),duration:values.findIndex(v=>/^(duration \(minutes\)|total duration \(minutes\)|duration|مده الحضور|الدقائق)$/.test(v))};break;
  }
  if(header<0)throw Error('لم أجد عمود الاسم أو الرقم الطلابي أو البريد الإلكتروني في الملف.');
  const result=[];
  for(const cells of rows.slice(header+1)){
   const name=String(cells[cols.name]??'').trim(),id=String(cells[cols.id]??'').trim(),email=String(cells[cols.email]??'').trim();
   if(!name&&!id&&!email)continue;
   let attended=true;
   if(cols.status>=0){const state=norm(cells[cols.status]);attended=['1','true','yes','present','attended','حضر','حاضر','نعم','✓'].includes(state)?true:['0','false','no','absent','لم يحضر','غائب','لا','✕'].includes(state)?false:null;}
   else if(cols.duration>=0){const raw=String(cells[cols.duration]??'').trim();const minutes=Number(raw);attended=raw!==''&&Number.isFinite(minutes)?minutes>0:null;}
   result.push({name,id,email,attended});
  }
  if(!result.length)throw Error('لا يحتوي الملف على سجلات حضور.');
  if(result.length>3000)throw Error('الملف يتجاوز 3000 سجل؛ اختاري ملف اللقاء فقط.');
  return result;
 }
 function match(record,students){
  const byId=record.id?students.filter(s=>identity(s.id)===identity(record.id)):[];
  if(byId.length===1)return byId[0].key;
  const byEmail=record.email?students.filter(s=>s.email&&norm(s.email)===norm(record.email)):[];
  if(byEmail.length===1)return byEmail[0].key;
  const byName=record.name?students.filter(s=>norm(s.name)===norm(record.name)):[];
  return byName.length===1?byName[0].key:'';
 }
 function merge(records){const result=new Map();for(const row of records){if(!row.studentKey||typeof row.attended!=='boolean')throw Error('INCOMPLETE_ATTENDANCE_MAPPING');const previous=result.get(row.studentKey);result.set(row.studentKey,{studentKey:row.studentKey,attended:row.attended||previous?.attended===true});}return [...result.values()];}
 root.SulukeraGraduationAttendance={parse,match,merge};
})(globalThis);
