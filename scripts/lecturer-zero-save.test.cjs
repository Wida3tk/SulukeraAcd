const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('student.html','utf8');
async function scenario(existing,inputs){
 let stored=existing?structuredClone(existing):null,writeCount=0;const messages=[],button={};
 const ctx={console:{error:()=>{}},Date,Object,Number,Math,parseFloat,currentSubjectKey:'past',currentWeek:1,currentUser:{role:'lecturer',data:{username:'teacher'}},dbData:{grades:{}},document:{getElementById:()=>button,querySelectorAll:()=>inputs.map(([field,value])=>({dataset:{stkey:'student',field},value,checkValidity:()=>Number.isFinite(Number(value))&&Number(value)>=0}))},toast:v=>messages.push(v),getGrade_data:()=>existing,renderWeekTable:()=>{},renderSummaryTable:()=>{},fbRef:()=>({transaction:async update=>{stored=update(stored);writeCount++;return {committed:true,snapshot:{exists:()=>true,val:()=>stored}};}}),firebase:{database:()=>({ref:()=>({update:async()=>{}})})},isExamEntered:g=>g?.examEntered===true||Number(g?.exam)>0};
 vm.createContext(ctx);const start=html.indexOf('async function saveGrades(){'),end=html.indexOf('const DAYS =',start);vm.runInContext(html.slice(start,end),ctx);await ctx.saveGrades();return {stored,messages,button,writeCount};
}
(async()=>{
 const a=await scenario({exam:38,examEntered:true,w2_hw:6},[['w1_disc','0'],['w1_attend',''],['w1_hw','']]);assert.equal(a.stored.w1_disc,0);assert.equal(a.stored.w1_discEntered,true);assert.equal(a.stored.w1_hwEntered,undefined);assert.equal(a.stored.exam,38);assert.equal(a.stored.w2_hw,6);assert.match(a.messages.join(' '),/تم حفظ/);assert.equal(a.button.disabled,false);
 const b=await scenario(null,[['exam','0']]);assert.equal(b.stored.exam,0);assert.equal(b.stored.examEntered,true);assert.match(b.messages.join(' '),/تم حفظ/);
 for(const field of ['w1_attend','w1_hw','w1_disc']){const result=await scenario(null,[[field,'0']]);assert.equal(result.stored[field],0);assert.equal(result.stored[field+'Entered'],true);assert.match(result.messages.join(' '),/تم حفظ/);}
 const blank=await scenario(null,[['w1_disc','']]);assert.equal(blank.writeCount,0);assert.equal(blank.button.disabled,false);
 const invalid=await scenario(null,[['w1_disc','invalid']]);assert.equal(invalid.writeCount,0);assert.equal(invalid.button.disabled,false);assert.match(invalid.messages.join(' '),/خطأ في الحفظ/);
 console.log('PASS: manual coursework/exam zero saves, markers retained, other grades preserved, empty input writes nothing and restores save button.');
})().catch(e=>{console.error(e);process.exitCode=1;});
