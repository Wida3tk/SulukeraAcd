import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  handleCoursework,
  gradeHomework,
  attendanceGrade,
  attendanceFromGrades,
} from "./src/coursework.js";
import vm from "node:vm";
const fixtures = () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("./coursework.sql", import.meta.url), "utf8"));
  sql.exec(readFileSync(new URL("./coursework_sync_triggers.sql", import.meta.url), "utf8"));
  const DB = {
    prepare(query) {
      const stmt = sql.prepare(query);
      return {
        all: async () => ({ results: stmt.all() }),
        bind(...args) {
          return {
            first: async () => stmt.get(...args) || null,
            all: async () => ({ results: stmt.all(...args) }),
            run: async () => ({ meta: { changes: stmt.run(...args).changes } }),
          };
        },
      };
    },
  };
  const records = {
    subjects: {
      course: {
        name: "مقرر",
        batch: "Q2-26",
        lecturerUserId: "teacher",
        startDate: "2026-10-04",
        endDate: "2026-11-05",
      },
    },
    settings: { hw: 5, attend: 5 },
    semesters: {},
    students: {
      student: {
        id: "SUL-1",
        batch: "Q2-26",
        planType: "QBA",
        accountStatus: "active",
      },
    },
    enrollments: { one: { studentKey: "student", subjectKey: "course" } },
  };
  const ctx = {
    firebaseRead: async (path) => records[path] || {},
    firebaseStudentGrades: async () => records.grades||{},
    studentContext: async () => ({
      studentKey: "student",
      student: records.students.student,
      subjectKeys: new Set(["course"]),
    }),
    firebaseAdminToken: async () => {
      throw Error("TEST_SYNC_OFFLINE");
    },
  };
  const auth = {
    admin: { uid: "admin", token: "token", profile: { role: "admin" } },
    student: {
      uid: "student-auth",
      token: "token",
      profile: { role: "student", studentKey: "student" },
    },
    teacher: {
      uid: "teacher",
      token: "token",
      profile: { role: "lecturer", username: "teacher" },
    },
    outsider: {
      uid: "other",
      token: "token",
      profile: { role: "lecturer", username: "other" },
    },
  };
  const call = (who, path, payload) =>
    handleCoursework(
      new Request("https://test/coursework" + path, {
        method: payload ? "POST" : "GET",
        ...(payload
          ? {
              body: JSON.stringify(payload),
              headers: { "Content-Type": "application/json" },
            }
          : {}),
      }),
      { DB },
      auth[who],
      "/coursework" + path,
      ctx,
    );
  const config = {
    subjectKey: "course",
    week: 1,
    title: "محاضرة",
    opensAt: new Date(Date.now() - 3600000).toISOString(),
    closesAt: new Date(Date.now() + 3600000).toISOString(),
    questions: [{ prompt: "سؤال", choices: ["أ", "ب", "ج", "د"], correct: 1 }],
    status: "published",
    durationMinutes: 120,
  };
  return { sql, DB, call, config, records, ctx };
};
test("current semester excludes unassigned courses and templates survive a new batch", async () => {
  const f = fixtures();
  f.records.subjects.course.courseKey = "shared-course";
  f.records.subjects.unassigned = {...f.records.subjects.course};
  f.records.semesters.current = {startDate:"2026-10-04",endDate:"2026-11-05",batches:["Q2-26"],subjects:["course"],status:"active"};
  const list = (await f.call("admin", "")).data;
  assert.deepEqual(list.subjects.map(s=>s.key), ["course"]);
  await f.call("admin", "/lesson", f.config);
  f.records.subjects.nextBatch = {...f.records.subjects.course,batch:"Q3-26"};
  f.records.semesters.current.batches.push("Q3-26");
  f.records.semesters.current.subjects.push("nextBatch");
  const next = (await f.call("admin", "")).data;
  assert.deepEqual(next.templates[0].questions,f.config.questions);
  assert.equal(next.lessons.some(l=>l.subject_key==="nextBatch"),false);
});
test("admin discussion editor saves reusable prompt and protects existing submissions", async () => {
  const f=fixtures();
  f.records.subjects.course.courseKey='shared-course';
  await f.call('admin','/lesson',{...f.config,discussionPrompt:'ناقش تطبيق المفهوم'});
  const id='course_lesson_1';
  assert.equal(f.sql.prepare('SELECT discussion_prompt FROM lesson_assessment WHERE lesson_id=?').get(id).discussion_prompt,'ناقش تطبيق المفهوم');
  const list=(await f.call('admin','')).data;
  assert.equal(list.assessmentTemplates[0].discussion_prompt,'ناقش تطبيق المفهوم');
  f.records.subjects.nextBatch={...f.records.subjects.course,batch:'Q3-26'};
  await f.call('admin','/lesson',{...f.config,subjectKey:'nextBatch'});
  assert.equal(f.sql.prepare('SELECT discussion_prompt FROM lesson_assessment WHERE lesson_id=?').get('nextBatch_lesson_1').discussion_prompt,'ناقش تطبيق المفهوم');
  await f.call('student','/discussion',{lessonId:id,answer:'مشاركتي في المناقشة'});
  await assert.rejects(f.call('admin','/lesson',{...f.config,discussionPrompt:'سؤال مختلف'}),/DISCUSSION_LOCKED_AFTER_SUBMISSION/);
  await f.call('admin','/lesson',{...f.config,discussionPrompt:'ناقش تطبيق المفهوم',title:'عنوان محدث'});
  assert.equal(f.sql.prepare('SELECT answer FROM academic_discussions WHERE lesson_id=?').get(id).answer,'مشاركتي في المناقشة');
  await assert.rejects(f.call('teacher','/lesson',{...f.config,discussionPrompt:'تعديل'}),/FORBIDDEN/);
});
test("homework score and attendance boundaries", () => {
  assert.equal(gradeHomework([{ correct: 0 }, { correct: 1 }], [0, 2], 5), 2.5);
  assert.equal(attendanceGrade(79.99, 5), null);
  assert.equal(attendanceGrade(80, 5), 5);
  assert.equal(attendanceGrade(97, 5), 5);
  assert.equal(attendanceGrade(0,3),0);
  assert.equal(attendanceGrade(0.1,3),1);
  assert.equal(attendanceGrade(49.99,3),1);
  assert.equal(attendanceGrade(50,3),2);
  assert.equal(attendanceGrade(79.99,3),2);
  assert.equal(attendanceGrade(80,3),3);
});
test("coursework home isolates selected batch and exposes four lecture cards with clear actions", () => {
  const host={innerHTML:''},context={currentUser:{role:'admin'},document:{getElementById:()=>host}};
  vm.createContext(context);vm.runInContext(readFileSync(new URL('../coursework-ui.js',import.meta.url),'utf8'),context);
  vm.runInContext(`cwData={subjects:[{key:'one',name:'المقرر الأول',batch:'Q2'},{key:'two',name:'المقرر الثاني',batch:'Q3'}],lessons:[{id:'l1',subject_key:'one',week:1,title:'المحاضرة الأولى',status:'published',opens_at:'2020-01-01T00:00:00Z',closes_at:'2040-01-01T00:00:00Z',attendanceMax:3,homeworkMax:6,discussionMax:6}]};cwSelectedSubject='one';cwRenderCourseworkHome();`,context);
  assert.ok(host.innerHTML.includes('متابعة الطلاب والحضور'));
  assert.ok(host.innerHTML.includes('تعديل الإعدادات'));
  assert.ok(host.innerHTML.includes('الواجب متاح الآن'));
  assert.equal((host.innerHTML.match(/class="cw-lesson-card /g)||[]).length,4);
  assert.ok(!host.innerHTML.includes('المقرر الثاني'));
  vm.runInContext("cwSelectedSubject='';cwHomeBatch='';cwRenderCourseworkHome();",context);
  assert.ok(host.innerHTML.includes('اختَر الدفعة والمقرر'));
  assert.equal((host.innerHTML.match(/class="cw-lesson-card /g)||[]).length,0);
});
test("lecture cards separate absence, partial attendance and reviewed compensation without treating missing grades as zero", () => {
  const host={innerHTML:''},cards={innerHTML:''},context={currentUser:{role:'lecturer'},document:{getElementById:id=>id==='cwReportCards'?cards:host}};
  vm.createContext(context);vm.runInContext(readFileSync(new URL('../coursework-ui.js',import.meta.url),'utf8'),context);
  vm.runInContext(`cwData={subjects:[{key:'course',name:'مقرر',batch:'Q2'}],lessons:[{id:'one',subject_key:'course',title:'المحاضرة الأولى'}]};cwReport={lesson:{id:'one',subject_key:'course',title:'المحاضرة الأولى',attendanceMax:3,homeworkMax:6,discussionMax:6},discussions:[],students:[{key:'absent',name:'غائب',batch:'Q2',attendance:{percent:0}},{key:'partial',name:'جزئي',batch:'Q2',attendance:{percent:60}},{key:'live',name:'حاضر',batch:'Q2',attendance:{percent:90}},{key:'reviewed',name:'معتمد',batch:'Q2',attendance:{percent:0},result:{score:6,attempts:1},reflection:{score:3,answers_json:'["أ","ب","ج"]',reviewed_at:'2026-10-05T12:00:00Z'}}]};cwRenderReport();`,context);
  assert.ok(cards.innerHTML.includes('الغياب — تعويض الحضور مطلوب'));
  assert.ok(cards.innerHTML.includes('الحضور الجزئي'));
  assert.ok(cards.innerHTML.includes('درجة الحضور الأصلية: 0'));
  assert.ok(cards.innerHTML.includes('بانتظار اكتمال التقييم'));
  assert.ok(host.innerHTML.includes('يحتاج تصحيحًا فقط'));
  const totals=context.cwReportTotals({attendance:{percent:60},result:{score:6}},{attendanceMax:3,homeworkMax:6,discussionMax:6},null);
  assert.equal(totals.attendance,2);assert.equal(totals.total,null);
  assert.ok(host.innerHTML.includes('المشاركات المستلمة: <strong>0'));
  assert.ok(cards.innerHTML.includes('لم تصل مشاركة من الطالب بعد'));
  vm.runInContext(`currentUser.role='admin';cwReport.lesson.discussionPrompt='سؤال النقاش';cwReport.discussions=[{student_key:'partial',answer:'إجابة الطالب',score:null}];cwReportFilter='discussionPending';cwRenderReport();`,context);
  assert.ok(host.innerHTML.includes('سؤال النقاش'));
  assert.ok(host.innerHTML.includes('المشاركات المستلمة: <strong>1'));
  assert.ok(cards.innerHTML.includes('إجابة الطالب'));
  assert.ok(cards.innerHTML.includes('حفظ تقييم المناقشة'));
  assert.ok(cards.innerHTML.includes('class="cw-discussion-row"'));
  assert.equal(cards.innerHTML.includes('<details class="cw-discussion-row" open'),false);
  assert.equal(cards.innerHTML.includes('<h4>غائب</h4>'),false);
});
test("shared Zoom file is approved independently per batch without zeroing unmatched students", async () => {
  const f=fixtures();
  f.records.subjects.second={...f.records.subjects.course,batch:'Q3-26'};
  f.records.students.other={id:'SUL-2',batch:'Q3-26',planType:'QBA',accountStatus:'active'};
  f.records.students.missing={id:'SUL-3',batch:'Q2-26',planType:'QBA',accountStatus:'active'};
  f.records.enrollments.two={studentKey:'other',subjectKey:'second'};
  f.records.enrollments.three={studentKey:'missing',subjectKey:'course'};
  const one=(await f.call('admin','/lesson',f.config)).data.id;
  const two=(await f.call('admin','/lesson',{...f.config,subjectKey:'second'})).data.id;
  await f.call('admin','/attendance',{lessonId:one,sourceHash:'shared',rows:[{studentKey:'student',percent:90}],confirmedAbsentKeys:[]});
  assert.equal(f.sql.prepare('SELECT COUNT(*) count FROM course_attendance').get().count,1);
  await assert.rejects(f.call('admin','/attendance',{lessonId:one,sourceHash:'shared',rows:[{studentKey:'other',percent:0}]}),/INVALID_ATTENDANCE_ROW/);
  await assert.rejects(f.call('admin','/attendance',{lessonId:one,sourceHash:'shared',rows:[{studentKey:'missing',percent:0,kind:'confirmed_absence'}]}),/ABSENCE_CONFIRMATION_REQUIRED/);
  await f.call('admin','/attendance',{lessonId:two,sourceHash:'shared',rows:[{studentKey:'other',percent:80}],confirmedAbsentKeys:[]});
  assert.equal(f.sql.prepare('SELECT percent FROM course_attendance WHERE lesson_id=?').get(one).percent,90);
  assert.equal(f.sql.prepare('SELECT COUNT(*) count FROM course_attendance WHERE student_key=?').get('missing').count,0);
  const context={};vm.createContext(context);vm.runInContext(readFileSync(new URL('../coursework-ui.js',import.meta.url),'utf8'),context);
  const groups=context.cwAttendanceReviewGroups([{studentKey:'student'},{studentKey:'',name:'unresolved'},{studentKey:'',excluded:true}],[{key:'student'},{key:'missing'}]);
  assert.equal(groups.linked.length,1);assert.equal(groups.review.length,1);assert.equal(groups.excluded.length,1);assert.equal(groups.missing[0].key,'missing');
});
test("whole meeting productivity is idempotent across shared batches and retries", async () => {
  const f=fixtures(),saved=new Map(),originalFetch=globalThis.fetch;
  f.records.subjects.second={...f.records.subjects.course,batch:'Q3-26'};
  f.records.students.other={id:'SUL-2',batch:'Q3-26',planType:'QBA',accountStatus:'active'};
  f.records.enrollments.two={studentKey:'other',subjectKey:'second'};
  f.ctx.firebaseAdminToken=async()=> 'test-only';
  globalThis.fetch=async(url,options={})=>{if(options.method==='PUT')saved.set(String(url),JSON.parse(options.body));return new Response('{}',{status:200});};
  try{
    const one=(await f.call('admin','/lesson',f.config)).data.id,two=(await f.call('admin','/lesson',{...f.config,subjectKey:'second'})).data.id;
    const meeting={start:'2026-10-04T15:00:00Z',end:'2026-10-04T17:15:00Z',durationMinutes:135,source:'zoom_meeting_summary'};
    const approve=(id,key,hash)=>f.call('admin','/attendance',{lessonId:id,sourceHash:hash,meeting,rows:[{studentKey:key,percent:90}],confirmedAbsentKeys:[]});
    assert.equal((await approve(one,'student','file-one')).data.productivity.recorded,true);
    await approve(two,'other','file-two');await approve(one,'student','retry');
    const entries=[...saved].filter(([path])=>path.includes('/lecturerProductivity/'));
    assert.equal(entries.length,1);assert.equal(entries[0][1].durationMinutes,135);assert.match(entries[0][0],/2026-10\/teacher\/meetings\/meeting_/);
    assert.equal(f.sql.prepare('SELECT COUNT(*) count FROM course_attendance').get().count,2);
    globalThis.fetch=async()=>new Response('{}',{status:503});
    await assert.rejects(approve(one,'student','offline'),/SYNC_UNAVAILABLE/);
  }finally{globalThis.fetch=originalFetch;}
});
test("every inactive account state blocks coursework without removing academic records", async () => {
  for(const status of ['suspended','frozen','withdrawn','paused']){
    const f=fixtures(),id=(await f.call('admin','/lesson',f.config)).data.id;
    f.records.students.student.accountStatus=status;
    await assert.rejects(f.call('student','/subjects'),/ACCOUNT_INACTIVE/);
    await assert.rejects(f.call('student','/attempt',{lessonId:id,answers:[1]}),/ACCOUNT_INACTIVE/);
    assert.equal(f.sql.prepare('SELECT COUNT(*) count FROM homework_attempts').get().count,0);
    const report=(await f.call('admin','/report',{lessonId:id})).data;
    assert.equal(report.students.length,0);assert.ok(f.records.enrollments.one);
  }
});
test("Zoom meeting duration is automatic; participant-only duration is not meeting duration", () => {
  const context={Date};vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../coursework-ui.js',import.meta.url),'utf8'),context);
  assert.equal(context.cwZoomMeetingPeriod([]),null);
  const shorter=context.cwZoomMeetingPeriod([['Start time','End time'],['10/04/2026 06:00:00 PM','10/04/2026 08:00:00 PM']]);
  assert.equal(shorter.durationMinutes,120);
  const longer=context.cwZoomMeetingPeriod([['Start Time','Duration (Minutes)'],['10/04/2026 06:00:00 PM','180']]);
  assert.equal(longer.durationMinutes,180);
  const start=Date.parse(shorter.start),end=Date.parse(shorter.end);
  const clipped=context.cwClipIntervals([[start-600000,start+3600000],[start+3000000,end+600000]],shorter);
  assert.equal(context.cwUnionMinutes(clipped),120);
  assert.equal(context.cwZoomTimestamp('10/04/2026 06:00:00 PM'),Date.parse('2026-10-04T18:00:00+03:00'));
});
test("grade sync preserves other weeks and exam while writing 6/6/3 components", async () => {
  const f=fixtures(),id=(await f.call('admin','/lesson',f.config)).data.id;
  f.sql.prepare('INSERT OR REPLACE INTO lesson_assessment VALUES (?,?,?,?,?)').run(id,6,3,6,'نقاش');
  f.ctx.firebaseAdminToken=async()=> 'test-token';
  const original=globalThis.fetch;
  let grade={exam:20,w2_hw:5},writes=0;
  globalThis.fetch=async(url,options={})=>{
    if(String(url).endsWith('/settings.json'))return Response.json({attend:5});
    if(options.method==='PUT'){grade=JSON.parse(options.body);writes++;return Response.json(grade);}
    return new Response(JSON.stringify(grade),{headers:{etag:'"test"','Content-Type':'application/json'}});
  };
  try{
    assert.equal((await f.call('student','/submit',{lessonId:id,answers:[1],requestId:'sync'})).data.synced,true);
    await f.call('student','/discussion',{lessonId:id,answer:'إجابة'});
    await f.call('teacher','/discussion-review',{lessonId:id,studentKey:'student',score:6});
    await f.call('admin','/attendance',{lessonId:id,sourceHash:'file',rows:[{studentKey:'student',percent:97}]});
    assert.equal(grade.w1_hw,6);assert.equal(grade.w1_disc,6);assert.equal(grade.w1_attend,3);
    assert.equal(grade.exam,20);assert.equal(grade.w2_hw,5);assert.equal(writes,3);
    await f.call('admin','/attendance',{lessonId:id,sourceHash:'partial',rows:[{studentKey:'student',percent:60}]});
    assert.equal(grade.w1_attend,2);
    await f.call('student','/reflection',{lessonId:id,answers:['الأول','الثاني','الثالث']});
    await assert.rejects(f.call('teacher','/review',{lessonId:id,studentKey:'student',score:1.5}),/INVALID_SCORE/);
    await f.call('teacher','/review',{lessonId:id,studentKey:'student',score:1});
    assert.equal(grade.w1_attend,1);
  }finally{globalThis.fetch=original;}
});
test("recorded attendance credit waits for completion of the basic homework without changing live attendance", async () => {
  const f=fixtures(),id=(await f.call('admin','/lesson',f.config)).data.id;
  f.ctx.firebaseAdminToken=async()=> 'test-token';
  const original=globalThis.fetch;let grade={exam:20};
  globalThis.fetch=async(url,options={})=>{
    if(String(url).endsWith('/settings.json'))return Response.json({attend:3});
    if(options.method==='PUT'){grade=JSON.parse(options.body);return Response.json(grade);}
    return new Response(JSON.stringify(grade),{headers:{etag:'"test"','Content-Type':'application/json'}});
  };
  try{
    await f.call('admin','/attendance',{lessonId:id,sourceHash:'recorded',rows:[{studentKey:'student',percent:0}]});
    await f.call('student','/reflection',{lessonId:id,answers:['الفكرة','المفهوم','التطبيق']});
    await f.call('teacher','/review',{lessonId:id,studentKey:'student',score:3});
    assert.equal(grade.w1_attend,0);
    await f.call('student','/submit',{lessonId:id,answers:[0],requestId:'completed-with-zero'});
    assert.equal(grade.w1_hw,0);assert.equal(grade.w1_attend,3);assert.equal(grade.exam,20);
    const second=(await f.call('admin','/lesson',{...f.config,week:2})).data.id;
    await f.call('admin','/attendance',{lessonId:second,sourceHash:'live',rows:[{studentKey:'student',percent:90}]});
    assert.equal(grade.w2_attend,3);
  }finally{globalThis.fetch=original;}
});
test("six-point homework and discussion are independent; discussion review is scoped and bounded", async () => {
  const f=fixtures(),id=(await f.call('admin','/lesson',f.config)).data.id;
  f.sql.prepare('INSERT OR REPLACE INTO lesson_assessment VALUES (?,?,?,?,?)').run(id,6,3,6,'سؤال نقاش');
  const attempt=(await f.call('student','/submit',{lessonId:id,answers:[1],requestId:'six'})).data;
  assert.equal(attempt.score,6);
  await f.call('student','/discussion',{lessonId:id,answer:'مشاركة الطالب'});
  await assert.rejects(f.call('outsider','/discussion-review',{lessonId:id,studentKey:'student',score:6}),/SUBJECT_ACCESS_DENIED/);
  await assert.rejects(f.call('teacher','/discussion-review',{lessonId:id,studentKey:'student',score:7}),/INVALID_SCORE/);
  await f.call('teacher','/discussion-review',{lessonId:id,studentKey:'student',score:6,feedback:'ممتاز'});
  const list=(await f.call('student','')).data;
  assert.equal(list.lessons[0].discussion.score,6);
  assert.equal(list.lessons[0].attendanceMax,3);
  assert.equal(list.lessons[0].result.score,6);
  await assert.rejects(f.call('student','/discussion',{lessonId:id,answer:'تعديل'}),/DISCUSSION_ALREADY_REVIEWED/);
  f.sql.prepare('UPDATE course_lessons SET closes_at=? WHERE id=?').run('2020-01-01T00:00:00Z',id);
  await assert.rejects(f.call('student','/discussion',{lessonId:id,answer:'تعديل'}),/DISCUSSION_NOT_OPEN/);
});
test("unlimited attempts retain best score, retries are idempotent, sync failure stays pending", async () => {
  const f = fixtures();
  const l = (await f.call("admin", "/lesson", f.config)).data.id;
  for (let i = 0; i < 4; i++)
    await f.call("student", "/submit", {
      lessonId: l,
      answers: [i === 1 ? 1 : 0],
      requestId: "attempt" + i,
    });
  await f.call("student", "/submit", {
    lessonId: l,
    answers: [0],
    requestId: "attempt3",
  });
  assert.equal(
    f.sql
      .prepare("SELECT COUNT(*) n,MAX(score) score FROM homework_attempts")
      .get().n,
    4,
  );
  assert.equal(
    f.sql.prepare("SELECT MAX(score) score FROM homework_attempts").get().score,
    5,
  );
  assert.equal(
    f.sql.prepare("SELECT state FROM coursework_sync").get().state,
    "pending",
  );
  const qs = (await f.call("student", "/questions", { lessonId: l })).data
    .questions;
  assert.equal("correct" in qs[0], false);
  const view = (await f.call("student", "")).data.lessons[0];
  assert.equal(view.questions, undefined);
  assert.equal(view.result.score, 5);
});
test("closed homework is blocked and a lecturer cannot access another lecturer course", async () => {
  const f = fixtures(),
    id = (
      await f.call("admin", "/lesson", {
        ...f.config,
        opensAt: new Date(Date.now() - 7200000).toISOString(),
        closesAt: new Date(Date.now() - 3600000).toISOString(),
      })
    ).data.id;
  await assert.rejects(
    f.call("student", "/submit", {
      lessonId: id,
      answers: [1],
      requestId: "one",
    }),
    /HOMEWORK_NOT_OPEN/,
  );
  await assert.rejects(
    f.call("outsider", "/report", { lessonId: id }),
    /SUBJECT_ACCESS_DENIED/,
  );
  await assert.rejects(
    f.call("student", "/review", {
      lessonId: id,
      studentKey: "student",
      score: 5,
    }),
    /FORBIDDEN/,
  );
});
test("reflection only for attendance below threshold; lecturer reviews and attendance imports do not duplicate", async () => {
  const f = fixtures(),
    id = (await f.call("admin", "/lesson", f.config)).data.id;
  await assert.rejects(
    f.call("student", "/reflection", {
      lessonId: id,
      answers: ["a", "b", "c"],
    }),
    /REFLECTION_NOT_REQUIRED/,
  );
  const input = {
    lessonId: id,
    sourceHash: "hash",
    rows: [{ studentKey: "student", percent: 57 }],
  };
  await f.call("admin", "/attendance", input);
  await f.call("admin", "/attendance", input);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) n FROM course_attendance").get().n,
    1,
  );
  await f.call("student", "/reflection", {
    lessonId: id,
    answers: ["الفكرة", "التطبيق", "سؤال"],
  });
  await f.call("teacher", "/review", {
    lessonId: id,
    studentKey: "student",
    score: 3,
    feedback: "جيد",
  });
  assert.equal(
    f.sql.prepare("SELECT score FROM attendance_reflections").get().score,
    3,
  );
  await assert.rejects(
    f.call("student", "/reflection", {
      lessonId: id,
      answers: ["a", "b", "c"],
    }),
    /REFLECTION_ALREADY_REVIEWED/,
  );
  await assert.rejects(
    f.call("admin", "/lesson", { ...f.config, week: 5 }),
    /INVALID_WEEK/,
  );
});
test("Zoom CSV parser handles quotes; overlapping reconnects are counted once", () => {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(new URL("../coursework-ui.js", import.meta.url), "utf8"),
    sandbox,
  );
  const csv = sandbox.cwParseCsv('Name,Email\r\n"A, B",a@example.com\r\n');
  assert.equal(csv[1][0], "A, B");
  assert.equal(
    sandbox.cwUnionMinutes([
      [0, 60000],
      [30000, 90000],
      [120000, 180000],
    ]),
    2.5,
  );
});
test('manual Firebase attendance unlocks reflection and agrees with lecturer report',async()=>{
 const f=fixtures();const id=(await f.call('admin','/lesson',f.config)).data.id;
 f.records.grades={g:{studentKey:'student',subjectKey:'course',w1_attend:2,updatedAt:'2026-10-06'}};
 const list=(await f.call('student','')).data;assert.equal(list.lessons[0].attendance.percent,66.67);
 const report=(await f.call('teacher','/report',{lessonId:id})).data;assert.equal(report.students[0].attendance.percent,66.67);
 await f.call('student','/reflection',{lessonId:id,answers:['one','two','three']});
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM attendance_reflections').get().n,1);
 f.sql.prepare('INSERT INTO course_attendance VALUES (?,?,?,?,?,?)').run(id,'student',95,'zoom','admin',new Date().toISOString());
 assert.equal((await f.call('student','')).data.lessons[0].attendance.percent,95);
 await assert.rejects(f.call('student','/reflection',{lessonId:id,answers:['one','two','three']}),/REFLECTION_NOT_REQUIRED/);
});
test('zero attendance needs explicit recording and stays isolated by student subject and week',()=>{
 const lesson={id:'one',subject_key:'course',week:1};
 const grade={studentKey:'student',subjectKey:'course',w1_attend:0};
 assert.equal(attendanceFromGrades(lesson,'student',{g:grade},5),null);
 assert.equal(attendanceFromGrades(lesson,'student',{g:{...grade,w1_attendEntered:true}},5).percent,0);
 assert.equal(attendanceFromGrades(lesson,'other',{g:{...grade,w1_attendEntered:true}},5),null);
 assert.equal(attendanceFromGrades({...lesson,week:2},'student',{g:{...grade,w1_attendEntered:true}},5),null);
 assert.equal(attendanceFromGrades(lesson,'student',{g:{...grade,subjectKey:'other',w1_attend:2}},5),null);
 assert.equal(attendanceFromGrades(lesson,'student',{g:{...grade,w1_attend:7}},5),null);
});
test('manual homework and discussion grades display without fabricating electronic submissions',async()=>{
 const f=fixtures(),id=(await f.call('admin','/lesson',f.config)).data.id;
 f.records.grades={g:{studentKey:'student',subjectKey:'course',w1_attend:2,w1_hw:4,w1_disc:3}};
 const lesson=(await f.call('student','')).data.lessons[0];
 assert.deepEqual(lesson.recordedGrades,{hw:4,disc:null});assert.equal(lesson.result,null);assert.equal(lesson.discussion,null);
 const report=(await f.call('teacher','/report',{lessonId:id})).data;
 assert.deepEqual(report.students[0].recordedGrades,{hw:4,disc:3});assert.equal(report.students[0].result,null);assert.equal(report.discussions.length,0);
 const context={};vm.createContext(context);vm.runInContext(readFileSync(new URL('../coursework-ui.js',import.meta.url),'utf8'),context);
 const totals=context.cwReportTotals({recordedGrades:{hw:4,disc:3},attendance:{score:2,percent:66.67}},report.lesson,null);
 assert.equal(totals.total,9);
 const rendered=context.cwStudentLessonCard({...lesson,discussionPrompt:'discussion prompt'},1);assert.match(rendered,/رصد يدوي/);assert.equal(rendered.includes('درجة المناقشة المرصودة يدويًا'),false);
 f.records.grades.g={studentKey:'student',subjectKey:'course',w1_hw:0,w1_disc:0};
 assert.deepEqual((await f.call('student','')).data.lessons[0].recordedGrades,{hw:null,disc:null});
 f.records.grades.g.w1_hwEntered=true;f.records.grades.g.w1_discEntered=true;
 assert.deepEqual((await f.call('student','')).data.lessons[0].recordedGrades,{hw:0,disc:null});
});
test('lecturer sees the enrolled student answers, grading progress, and scoped identities',async()=>{
 const f=fixtures(),id=(await f.call('admin','/lesson',{...f.config,discussionPrompt:'وضح المفهوم'})).data.id;
 await f.call('student','/submit',{lessonId:id,answers:[1],requestId:'answer-visible'});
 await f.call('student','/discussion',{lessonId:id,answer:'إجابة مناقشة تخص الطالب'});
 await f.call('teacher','/discussion-review',{lessonId:id,studentKey:'student',score:0,feedback:'ملاحظات المحاضر'});
 f.records.grades={g:{studentKey:'student',subjectKey:'course',w1_attend:2}};
 f.sql.prepare('INSERT INTO homework_attempts VALUES (?,?,?,?,?,?,?)').run('unrelated',id,'other','unrelated','[0]',0,new Date().toISOString());
 f.sql.prepare('INSERT INTO academic_discussions (lesson_id,student_key,answer,submitted_at) VALUES (?,?,?,?)').run(id,'other','إجابة خارج قائمة الطلاب',new Date().toISOString());
 const report=(await f.call('teacher','/report',{lessonId:id})).data;
 assert.equal(report.students.length,1);assert.equal(report.students[0].homeworkAttempts.length,1);assert.deepEqual(JSON.parse(report.students[0].homeworkAttempts[0].answers_json),[1]);assert.equal(report.discussions.length,1);assert.equal(report.discussions[0].answer,'إجابة مناقشة تخص الطالب');assert.equal(report.discussions[0].score,0);
 const student=(await f.call('student','')).data.lessons[0];assert.equal(student.discussion.feedback,'ملاحظات المحاضر');assert.equal(student.discussion.score,0);assert.equal(student.result.score,report.students[0].result.score);
 const context={cwReport:report};vm.createContext(context);vm.runInContext(readFileSync(new URL('../coursework-ui.js',import.meta.url),'utf8'),context);
 const rendered=context.cwHomeworkAnswers(report.students[0],report.lesson);assert.match(rendered,/إجابة الطالب: ب/);assert.match(rendered,/صحيحة/);assert.match(context.cwGradingProgress(context.cwReportTotals(report.students[0],report.lesson,report.discussions[0])),/3\/3/);
 assert.equal(context.cwStudentReportState({reflection:{score:3},attendance:{percent:0}}),'absent');assert.equal(context.cwStudentReportState({reflection:{score:3},result:{score:0},attendance:{percent:0}}),'reviewed');
 await assert.rejects(f.call('outsider','/report',{lessonId:id}),/SUBJECT_ACCESS_DENIED/);
 await assert.rejects(f.call('outsider','/discussion-review',{lessonId:id,studentKey:'student',score:3}),/SUBJECT_ACCESS_DENIED/);
});
test('student sees attendance and homework immediately but reviewed components wait for approval',async()=>{
 const f=fixtures(),id=(await f.call('admin','/lesson',{...f.config,discussionPrompt:'السؤال'})).data.id;
 f.records.grades={g:{studentKey:'student',subjectKey:'course',w1_attend:2,w1_hw:4,w1_disc:5,w1_discEntered:true}};
 await f.call('student','/discussion',{lessonId:id,answer:'إجابة للمراجعة'});
 await f.call('student','/reflection',{lessonId:id,answers:['أ','ب','ج']});
 f.sql.prepare('UPDATE academic_discussions SET score=5,feedback=? WHERE lesson_id=?').run('غير معتمد',id);
 f.sql.prepare('UPDATE attendance_reflections SET score=3,feedback=? WHERE lesson_id=?').run('غير معتمد',id);
 let lesson=(await f.call('student','')).data.lessons[0];assert.equal(lesson.attendance.score,2);assert.equal(lesson.recordedGrades.hw,4);assert.equal(lesson.recordedGrades.disc,null);assert.equal(lesson.discussion.score,null);assert.equal(lesson.reflection.score,null);assert.equal(lesson.reflection.feedback,'');
 const context={};vm.createContext(context);vm.runInContext(readFileSync(new URL('../coursework-ui.js',import.meta.url),'utf8'),context);const card=context.cwStudentLessonCard(lesson,1);assert.match(card,/4\/5/);assert.match(card,/الحضور: 2\/3/);assert.match(card,/قيد المراجعة/);assert.equal(card.includes('غير معتمد'),false);
 await f.call('teacher','/discussion-review',{lessonId:id,studentKey:'student',score:0,feedback:'معتمد'});await f.call('teacher','/review',{lessonId:id,studentKey:'student',score:0,feedback:'معتمد'});
 lesson=(await f.call('student','')).data.lessons[0];assert.equal(lesson.discussion.score,0);assert.equal(lesson.reflection.score,0);assert.equal(lesson.discussion.feedback,'معتمد');assert.equal(lesson.result,null);
 assert.match(context.cwStudentLessonCard(lesson,1),/أكمل الواجب الأساسي/);
});
test('student retry cannot synchronize another student and ledger display retains actual coursework scores',async()=>{
 const f=fixtures(),id=(await f.call('admin','/lesson',f.config)).data.id;
 f.sql.prepare("INSERT INTO coursework_sync VALUES (?,?,'pending',NULL,?)").run(id,'student','now');
 f.sql.prepare("INSERT INTO coursework_sync VALUES (?,?,'pending',NULL,?)").run(id,'other','unchanged');
 await f.call('student','/sync',{});
 assert.equal(f.sql.prepare('SELECT updated_at FROM coursework_sync WHERE student_key=?').get('other').updated_at,'unchanged');
 const context={currentUser:{role:'student'}};vm.createContext(context);vm.runInContext(readFileSync(new URL('../coursework-ui.js',import.meta.url),'utf8'),context);
 vm.runInContext("cwData={lessons:[{subject_key:'course',week:1,attendanceMax:3,result:{score:6},attendance:{score:2},discussion:{score:null},recordedGrades:{disc:null}}]}",context);
 const original={exam:20,w1_hw:0,w1_disc:6,w2_hw:4};
 const merged=context.cwMergeStudentGrade(original,'course');assert.equal(merged.w1_hw,6);assert.equal(merged.w1_attend,2);assert.equal(merged.w1_disc,null);assert.equal(merged.exam,20);assert.equal(merged.w2_hw,4);assert.equal(original.w1_hw,0);assert.equal(context.cwMergeStudentGrade(original,'other'),original);
});
test('automatic retry recovers pending grades without a student session and preserves unrelated components',async()=>{
 const {retryPendingCoursework}=await import('./src/coursework.js');const f=fixtures(),id=(await f.call('admin','/lesson',f.config)).data.id;
 await f.call('student','/submit',{lessonId:id,answers:[1],requestId:'retry-automatic'});
 assert.equal((await retryPendingCoursework({DB:f.DB},{firebaseAdminToken:async()=>{throw Error('offline')}})).synced,0);
 const previousFetch=globalThis.fetch;let saved=null;
 globalThis.fetch=async(url,options={})=>{if(url.endsWith('/settings.json'))return new Response(JSON.stringify(f.records.settings));if(options.method==='PUT'){saved=JSON.parse(options.body);return new Response('{}');}return new Response(JSON.stringify({exam:35,examEntered:true,w2_attend:3,w1_disc:4}),{headers:{etag:'test-etag'}})};
 try{const result=await retryPendingCoursework({DB:f.DB},{firebaseAdminToken:async()=>'test-service'});assert.equal(result.synced,1);assert.equal(saved.w1_hw,5);assert.equal(saved.w1_hwEntered,true);assert.equal(saved.exam,35);assert.equal(saved.w2_attend,3);assert.equal(saved.w1_disc,4);assert.equal(f.sql.prepare('SELECT state FROM coursework_sync').get().state,'synced');assert.equal((await retryPendingCoursework({DB:f.DB},{firebaseAdminToken:async()=>'test-service'})).attempted,0);}finally{globalThis.fetch=previousFetch;}
});


test('saved homework is atomically queued even when the request stops before synchronization',async()=>{
 const f=fixtures(),id=(await f.call('admin','/lesson',f.config)).data.id;
 f.sql.prepare('INSERT INTO homework_attempts VALUES (?,?,?,?,?,?,?)').run('crashed-request',id,'student','crashed-request','[1]',5,new Date().toISOString());
 assert.equal(f.sql.prepare('SELECT state FROM coursework_sync WHERE lesson_id=? AND student_key=?').get(id,'student').state,'pending');
});

test('students review only their submitted answers, including after closing',async()=>{
 const f=fixtures();await f.call('admin','/lesson',f.config);const id='course_lesson_1';
 await assert.rejects(f.call('student','/answers',{lessonId:id}),/HOMEWORK_NOT_SUBMITTED/);
 await f.call('student','/submit',{lessonId:id,answers:[1],requestId:'review-own'});
 f.sql.prepare('UPDATE course_lessons SET closes_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),id);
 const result=(await f.call('student','/answers',{lessonId:id})).data;
 assert.equal(result.score,5);assert.equal(result.questions[0].selected,1);assert.equal(result.questions[0].isCorrect,true);assert.equal('correct' in result.questions[0],false);assert.ok(result.submittedAt);
 await assert.rejects(f.call('teacher','/answers',{lessonId:id}),/FORBIDDEN/);
 f.sql.prepare('DELETE FROM homework_attempts WHERE student_key=?').run('student');
 await assert.rejects(f.call('student','/answers',{lessonId:id}),/HOMEWORK_NOT_SUBMITTED/);
});

test('complete Zoom report records unlinked students absent only in the chosen course',async()=>{const f=fixtures();f.records.enrollments.missing={studentKey:'missing',subjectKey:'course'};f.records.enrollments.outside={studentKey:'outside',subjectKey:'different'};const id=(await f.call('admin','/lesson',f.config)).data.id;await f.call('admin','/attendance',{lessonId:id,sourceHash:'full-roster',completeRoster:true,rows:[{studentKey:'student',percent:90}]});assert.equal(f.sql.prepare('SELECT percent FROM course_attendance WHERE student_key=?').get('missing').percent,0);assert.equal(f.sql.prepare('SELECT percent FROM course_attendance WHERE student_key=?').get('student').percent,90);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM course_attendance WHERE student_key=?').get('outside').n,0);});
