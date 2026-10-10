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
  function hasRecordedGrade(grade){
    return !!grade&&(grade.examEntered===true||Number(grade.exam??grade.exam_score)>0||['w1','w2','w3','w4'].some(w=>['attend','hw','disc'].some(field=>Number(grade[w]?.[field]??grade[w+'_'+field])>0)));
  }
  function canonicalSubjects(student,offerings,gradeFor,catalog=offerings){
    const ownKeys=new Set(catalog.filter(s=>normalize(s.batch)===normalize(student?.batch)).map(s=>s.courseKey).filter(Boolean));
    const groups=new Map();
    for(const subject of offerings){
      const identity=subject.courseKey||subject.key||subject._fbKey;
      if(!groups.has(identity))groups.set(identity,[]);
      groups.get(identity).push(subject);
    }
    const result=[];
    for(const candidates of groups.values()){
      const graded=candidates.filter(s=>hasRecordedGrade(gradeFor(s)));
      // Conflicting graded attempts require review; never silently discard a grade.
      const retained=graded.length>1?graded:[graded[0]||candidates.find(s=>normalize(s.batch)===normalize(student?.batch))||candidates[0]];
      for(const subject of retained)result.push({...subject,_withinPlan:normalize(subject.batch)===normalize(student?.batch)||!!subject.courseKey&&ownKeys.has(subject.courseKey),_duplicateGradeReview:graded.length>1});
    }
    return result;
  }
  function exceptionApplies(exception,student,subjectKey,semesters={},today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'})){
    if(!exception?.active)return false;
    if(exception.subjectKey&&subjectKey&&exception.subjectKey!==subjectKey)return false;
    if(exception.professionalProgramId)return true;
    const terms=Object.entries(semesters).filter(([,term])=>(term.batches||[]).some(b=>normalize(b)===normalize(student?.batch)));
    const date=String(exception.requestedAt||exception.createdAt||exception.fromDate||exception.updatedAt||'').slice(0,10).replace(/\//g,'-');
    const origin=exception.semesterKey?terms.find(([key])=>key===exception.semesterKey):terms.find(([,term])=>date&&term.startDate&&term.endDate&&term.startDate<=date&&term.endDate>=date);
    // Legacy unscoped exceptions must not silently follow students into a new term.
    if(!origin)return false;
    const target=subjectKey?terms.find(([,term])=>(term.subjects||[]).includes(subjectKey)):terms.find(([,term])=>term.startDate<=today&&term.endDate>=today);
    return !!target&&target[0]===origin[0];
  }
  root.SulukeraAcademicPolicy={resolvePlan,semesterLimit,subjectSemester,subjectAllowed,projectStage,hasRecordedGrade,canonicalSubjects,exceptionApplies};
})(globalThis);
