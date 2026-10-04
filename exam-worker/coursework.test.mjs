import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  handleCoursework,
  gradeHomework,
  attendanceGrade,
} from "./src/coursework.js";
import vm from "node:vm";
const fixtures = () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("./coursework.sql", import.meta.url), "utf8"));
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
  return { sql, call, config, records, ctx };
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
