/* Shared academic track rules: used by the portal and the authorization worker. */
(function(root){
  const normalize=value=>String(value||'').trim().toUpperCase();
  function resolvePlan(student,packages={}){
    const resolve=value=>{const text=normalize(value),qasp=text.includes('QASP'),qba=text.includes('QBA');return qasp!==qba?(qasp?'QASP-S':'QBA'):'';};
    const direct=resolve(student?.planType);if(direct)return direct;
    const pkg=student?.pkg||'',name=Object.entries(packages).find(([key,p])=>key===pkg||p.name===pkg)?.[1]?.name||pkg;
    const track=resolve(student?.track),packagePlan=resolve(`${pkg} ${name}`);
    return track&&packagePlan&&track!==packagePlan?'':track||packagePlan;
  }
  const semesterLimit=plan=>plan==='QASP-S'?4:plan==='QBA'?6:0;
  function subjectSemester(subject){
    const explicit=Number(subject?.semesterNo);if(explicit>0)return explicit;
    const course=String(subject?.courseKey||'').match(/^course_(\d+)$/);
    return course?Math.ceil(Number(course[1])/3):0;
  }
  function subjectAllowed(student,subject,packages={}){
    const plan=resolvePlan(student,packages),limit=semesterLimit(plan),number=subjectSemester(subject);
    if(number&&(!limit||number>limit))return false;
    const plans=Array.isArray(subject?.eligiblePlans)?subject.eligiblePlans:[];
    return !plans.length||plans.includes(plan);
  }
  function projectStage(student,semesters={},subjects={},packages={},today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'})){
    const plan=resolvePlan(student,packages),limit=semesterLimit(plan),batch=normalize(student?.batch);
    if(!limit||!batch)return false;
    return Object.values(semesters).some(term=>{
      if(!(term.batches||[]).some(b=>normalize(b)===batch))return false;
      const end=String(term.endDate||'').replace(/\//g,'-');
      if(!end||end>=today)return false;
      const numbers=(term.subjects||[]).map(key=>subjectSemester(subjects[key])).filter(n=>n>0&&n<=limit);
      return Number(term.semesterNo)===limit||numbers.includes(limit);
    });
  }
  root.SulukeraAcademicPolicy={resolvePlan,semesterLimit,subjectSemester,subjectAllowed,projectStage};
})(globalThis);
