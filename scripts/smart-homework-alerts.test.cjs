const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-11-22T12:00:00Z']));}static now(){return new Date('2026-11-22T12:00:00Z').getTime();}}
const subjects=[{_fbKey:'subject',name:'نهج تحليلات السلوك',batch:'Q2'}];
const semesters={term:{status:'active',name:'الفصل الحالي',startDate:'2026-11-15',endDate:'2026-12-17',batches:['Q2'],subjects:['subject']}};
const original=[1,2,3,4].map(week=>({subject_key:'subject',week,status:'published',questionCount:week===1?5:6}));
let payload={lessons:original};const ctx={Date:FixedDate,console:{warn(){}},setTimeout:()=>0,subjects,semestersData:semesters,scheduleData:{weekly:{slot:{subjectKey:'subject',semesterKey:'term'}}},examSchedulesData:{},currentUser:{role:'admin'},adminProfile:()=> 'full',secureAdminExamRequest:async()=>({exams:[]}),cwApi:async()=>{if(payload instanceof Error)throw payload;return payload;},document:{getElementById:()=>null}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('admin-smart.js','utf8'),ctx);
const by=kind=>ctx.buildSmartAlerts().find(a=>a.kind===kind)?.items.length||0;
(async()=>{
 await ctx.loadSmartData(true);assert.equal(by('missingHomework'),0,'the actual top-level coursework response must not report every upload missing');assert.equal(ctx.navBadgeCounts().coursework,0);
 payload={lessons:original.map(l=>l.week===1?{...l,questionCount:0}:l)};await ctx.loadSmartData(true);assert.equal(by('missingHomework'),1,'empty published lesson has no uploaded homework');
 payload={lessons:original.map(l=>l.week===1?{...l,status:'draft'}:l)};await ctx.loadSmartData(true);assert.equal(by('missingHomework'),0);assert.equal(by('unpublishedHomework'),1,'uploaded drafts need publishing, not reupload');
 payload={lessons:original.map(({questionCount,...l})=>({...l,questions:[{prompt:'question'}]}))};await ctx.loadSmartData(true);assert.equal(by('missingHomework'),0,'question arrays also represent uploaded content');
 for(const bad of [{data:{lessons:original}},null,Error('network')]){payload=bad;await ctx.loadSmartData(true);assert.equal(ctx.__smartCache.lessons,null);assert.equal(by('missingHomework'),0,'unavailable data must not become a missing-homework list');assert.ok(ctx.__smartCache.error.includes('الواجبات'));const card=ctx.smartAlertsCard();assert.ok(card.includes('الفحص غير مكتمل'));assert.ok(!card.includes('كل شيء في مكانه'));}
 payload={lessons:[]};await ctx.loadSmartData(true);assert.equal(by('missingHomework'),2,'a confirmed empty list really is missing two due weeks');
 console.log('PASS smart alerts: top-level API, content counts, draft distinction, unknown/failed response, no false green and genuine missing homework.');
})().catch(e=>{console.error(e);process.exitCode=1});
