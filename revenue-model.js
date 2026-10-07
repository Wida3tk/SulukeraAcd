/* Shared financial import rules. No private transactions belong in static assets. */
(function(root){
 const months=['يناير','فبراير','مارس','ابريل','مايو','يونيو','يوليو','اغسطس','سبتمبر','اكتوبر','نوفمبر','ديسمبر'];
 const norm=v=>String(v??'').trim().replace(/[أإآ]/g,'ا').replace(/\s+/g,' ');
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v.trim())?Number(v):null;
 const base=v=>String(v||'').trim().replace(/\s*-?\s*تحصيل\s*$/,'').trim();
 function exclusion(category){const n=norm(category);return n==='تحصيل - اخرى'?'تحصيل - أخرى':/رسوم ادارية|الرسوم الادارية/.test(n)?'رسوم إدارية':/المتجر|^كتاب /.test(n)?'المتجر':'';}
 function family(category){return /ABA|ABAT|تحليل السلوك/.test(category)?'برامج تحليل السلوك ABA':/OBM/.test(category)?'إدارة السلوك التنظيمي OBM':/إشراف|الإشراف|تقييم الكفاءة|الاستشارات/.test(category)?'الإشراف والاستشارات':/بالمنزل/.test(category)?'التأهيل والعلاج بالمنزل':'الدورات والتعليم المستمر';}
 function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?value:null;}
 function parse(source){
  const periods=[],issues=[],quarterTargets=[],catalog=new Set();
  const availableYears=Object.keys(source.sheets||{}).map(sheet=>{const m=norm(sheet).match(/^(\S+) (\d{2}|\d{4})$/);return m&&months.some(n=>norm(n)===m[1])?(m[2].length===2?2000+Number(m[2]):Number(m[2])):0;}).filter(Boolean);
  const reportYear=Number(source.year)||Math.max(0,...availableYears);
  for(const [sheet,grid] of Object.entries(source.sheets||{})){
   const match=norm(sheet).match(/^(\S+) (\d{2}|\d{4})$/);if(!match)continue;
   const m=months.findIndex(n=>norm(n)===match[1]);if(m<0)continue;
   const year=match[2].length===2?2000+Number(match[2]):Number(match[2]);if(year!==reportYear)continue;const month=`${year}-${String(m+1).padStart(2,'0')}`;
   const header=grid.findIndex(r=>norm(r[5])==='التصنيف'&&norm(r[18])==='المبيعات بدون الضريبة');
   if(header<0){issues.push({sheet,reason:'تخطيط قديم غير مطابق؛ لم يُستورد هذا الشهر'});continue;}
   const rows=[],duplicates=new Map();
   grid.slice(header+1).forEach((r,offset)=>{
    const sourceRow=header+offset+2;
    // Empty template rows contain formulas for row number and net zero.
    if(![r[1],r[5],r[8],r[14],r[16],r[20]].some(v=>v!==null&&v!==undefined&&v!==''))return;
    const date=day(r[1]),category=String(r[5]||'').trim(),product=String(r[8]||'').trim(),net=number(r[18]),gross=number(r[16]);
    const excluded=exclusion(category);
    const problems=[];if(!date)problems.push('تاريخ مفقود أو غير صالح');else if(!date.startsWith(month))problems.push('التاريخ خارج شهر الورقة');
    if(!category)problems.push('تصنيف مفقود');if(net===null)problems.push('مبلغ بدون الضريبة مفقود أو غير صالح');
    const row={id:month+'_'+sourceRow,sourceSheet:sheet,sourceRow,date:date||'',category,baseCategory:base(category),product:product||category,reference:String(r[14]??''),platform:String(r[20]||''),week:String(r[3]||''),net:net??0,gross,kind:category.includes('تحصيل')?'collection':'sale',family:family(category),state:excluded?'excluded':problems.length?'review':'included',reason:excluded||problems.join('؛ ')};
    if(typeof r[18]==='string'&&net!==null){row.note='مبلغ مخزن كنص؛ حُوّل إلى رقم دون تغيير قيمته';issues.push({sheet,row:sourceRow,reason:row.note});}
    if(problems.length&&!excluded)issues.push({sheet,row:sourceRow,reason:row.reason});
    const identity=JSON.stringify([date,category,product,row.reference,row.platform,net,gross]);
    if(row.reference&&duplicates.has(identity)){row.note=[row.note,'مرجع وبيانات متطابقة مع الصف '+duplicates.get(identity)+'؛ بقيت العمليتان كما وردتا في الملف'].filter(Boolean).join('؛ ');issues.push({sheet,row:sourceRow,reason:row.note});}else duplicates.set(identity,sourceRow);
    rows.push(row);if(row.state==='included')catalog.add(row.baseCategory);
   });
   const updated=day(grid[1]?.[3]);
   periods.push({month,rows,sourceTarget:number(grid[5]?.[4]),asOf:updated||rows.map(r=>r.date).sort().at(-1)||'',sheet});
  }
  const years=[...new Set(periods.map(p=>p.month.slice(0,4)))];
  let quarter=0;
  for(const [i,r] of (source.sheets?.['أهداف مبيعات المنتجات']||[]).entries()){
   const label=String(r[1]||'').trim();if(label==='الربع الأول')quarter=1;if(label==='الربع الثاني')quarter=2;if(label==='الربع الثالث')quarter=3;if(label==='الربع الرابع')quarter=4;
   if(!quarter||!label||number(r[2])===null||['الهدف الشهري','القسم','المنتج'].includes(label)||exclusion(label))continue;
   const category=base(label),kind=label.includes('تحصيل')?'collection':'sale';catalog.add(category);
   if(years.length===1)quarterTargets.push({period:years[0]+'-Q'+quarter,category,kind,amount:number(r[2]),sourceRow:i+1,sourceSheet:'أهداف مبيعات المنتجات'});
  }
  periods.sort((a,b)=>a.month.localeCompare(b.month));
  return {filename:String(source.filename||''),sourceHash:source.sourceHash,year:reportYear,periods,quarterTargets,catalog:[...catalog].sort(),issues};
 }
 function summarize(rows){const result={sales:0,collections:0,total:0,count:0,excluded:0,review:0};for(const r of rows){if(r.state==='excluded'){result.excluded+=r.net;continue;}if(r.state==='review'){result.review++;continue;}result[r.kind==='collection'?'collections':'sales']+=r.net;result.count++;}result.total=result.sales+result.collections;return result;}
 function selectedMonths(period,mode){const y=period.slice(0,4);return mode==='year'?Array.from({length:12},(_,i)=>`${y}-${String(i+1).padStart(2,'0')}`):mode==='quarter'?Array.from({length:3},(_,i)=>`${y}-${String((Number(period.slice(-1))-1)*3+i+1).padStart(2,'0')}`):[period];}
 root.SulukeraRevenue={parse,summarize,exclusion,base,family,selectedMonths,number,day};
})(globalThis);
