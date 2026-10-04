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
  return { sql, call, config, records };
};
test("homework score and attendance boundaries", () => {
  assert.equal(gradeHomework([{ correct: 0 }, { correct: 1 }], [0, 2], 5), 2.5);
  assert.equal(attendanceGrade(79.99, 5), null);
  assert.equal(attendanceGrade(80, 5), 5);
  assert.equal(attendanceGrade(97, 5), 5);
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
    score: 4,
    feedback: "جيد",
  });
  assert.equal(
    f.sql.prepare("SELECT score FROM attendance_reflections").get().score,
    4,
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
