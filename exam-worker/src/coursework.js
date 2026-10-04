const reject = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const dbUrl = "https://sulukeraacd-default-rtdb.firebaseio.com";
const safeKey = (v) => String(v).replace(/[.#$\[\]]/g, "_");
const json = async (r) => {
  try {
    return await r.json();
  } catch {
    reject("INVALID_JSON");
  }
};
export function gradeHomework(questions, answers, max) {
  const correct = questions.reduce(
    (n, q, i) =>
      n + (Number.isInteger(answers[i]) && answers[i] === q.correct ? 1 : 0),
    0,
  );
  return Math.round((correct / questions.length) * max * 100) / 100;
}
export function attendanceGrade(percent, max) {
  return percent >= 80 ? max : null;
}
function isProfessional(s) {
  return (
    s?.planType === "PROFESSIONAL" ||
    String(s?.batch || "").startsWith("PRO-") ||
    String(s?.program || "").includes("السلوك التنظيمي")
  );
}
function isCurrent(subject, semesters) {
  const term = semesters?.[subject.semesterKey],
    today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }),
    start = subject.startDate || term?.startDate,
    end = subject.endDate || term?.endDate;
  return (
    (!start || start <= today) &&
    (!end || end >= today) &&
    !["inactive", "finished", "completed", "archived"].includes(term?.status)
  );
}
async function scope(auth, ctx) {
  const role = auth.profile.role;
  if (!["admin", "lecturer", "student"].includes(role))
    reject("FORBIDDEN", 403);
  const [subjects, settings, semesters] = await Promise.all([
    ctx.firebaseRead("subjects", auth.token),
    ctx.firebaseRead("settings", auth.token),
    ctx.firebaseRead("semesters", auth.token),
  ]);
  let allowed = [];
  let students = {};
  if (role === "student") {
    if (!auth.profile.studentKey) reject("STUDENT_LINK_MISSING", 403);
    const context = await ctx.studentContext(auth);
    if (isProfessional(context.student)) reject("ACADEMIC_ONLY", 403);
    if (
      ["withdrawn", "paused", "suspended"].includes(
        context.student.accountStatus,
      )
    )
      reject("ACCOUNT_INACTIVE", 403);
    allowed = [...context.subjectKeys];
    students = { [context.studentKey]: context.student };
  } else {
    const ids = new Set(
      [auth.uid, auth.profile.username, auth.profile.id, auth.profile.userId]
        .filter(Boolean)
        .map(String),
    );
    allowed = Object.entries(subjects || {})
      .filter(([, s]) => role === "admin" || ids.has(String(s.lecturerUserId)))
      .map(([k]) => k);
    students = (await ctx.firebaseRead("students", auth.token)) || {};
  }
  allowed = allowed.filter(
    (k) => subjects?.[k] && !String(k).startsWith("professional_"),
  );
  return {
    role,
    allowed,
    subjects: subjects || {},
    students,
    settings: settings || {},
    semesters: semesters || {},
  };
}
function allowed(scope, key) {
  if (!scope.allowed.includes(key)) reject("SUBJECT_ACCESS_DENIED", 403);
}
async function lessonFor(env, id, s) {
  const l = await env.DB.prepare("SELECT * FROM course_lessons WHERE id=?")
    .bind(id)
    .first();
  if (!l) reject("LESSON_NOT_FOUND", 404);
  allowed(s, l.subject_key);
  return l;
}
async function serviceFetch(env, ctx, path, options = {}) {
  const token = await ctx.firebaseAdminToken(env),
    response = await fetch(`${dbUrl}/${path}.json`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  if (!response.ok) reject("GRADE_SYNC_UNAVAILABLE", 503);
  return response;
}
async function synchronize(env, ctx, l, studentKey, actor) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO coursework_sync VALUES (?,?,'pending',NULL,?) ON CONFLICT(lesson_id,student_key) DO UPDATE SET state='pending',updated_at=excluded.updated_at",
  )
    .bind(l.id, studentKey, now)
    .run();
  try {
    const [best, attendance, reflection] = await Promise.all([
      env.DB.prepare(
        "SELECT MAX(score) score FROM homework_attempts WHERE lesson_id=? AND student_key=?",
      )
        .bind(l.id, studentKey)
        .first(),
      env.DB.prepare(
        "SELECT percent FROM course_attendance WHERE lesson_id=? AND student_key=?",
      )
        .bind(l.id, studentKey)
        .first(),
      env.DB.prepare(
        "SELECT score FROM attendance_reflections WHERE lesson_id=? AND student_key=?",
      )
        .bind(l.id, studentKey)
        .first(),
    ]);
    const settings = await (await serviceFetch(env, ctx, "settings")).json(),
      maxAttend = Number(settings?.attend) || 5;
    const fields = {};
    if (best?.score != null) fields[`w${l.week}_hw`] = best.score;
    const attend = attendance
      ? attendanceGrade(attendance.percent, maxAttend)
      : null;
    if (attend != null || reflection?.score != null)
      fields[`w${l.week}_attend`] = Math.max(
        attend ?? 0,
        reflection?.score ?? 0,
      );
    else if (attendance) fields[`w${l.week}_attend`] = null;
    const key = safeKey(`grade_${studentKey}_${l.subject_key}`),
      legacy = safeKey(`${studentKey}_${l.subject_key}`);
    // Preserve all existing components, including older grade-key formats. Use ETags to avoid clobbering parallel grading.
    let written = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const currentResponse = await serviceFetch(env, ctx, `grades/${key}`, {
          headers: { "X-Firebase-ETag": "true" },
        }),
        current = await currentResponse.json();
      const previous =
        current ||
        (await (await serviceFetch(env, ctx, `grades/${legacy}`)).json()) ||
        {};
      const payload = {
        ...previous,
        ...fields,
        studentKey,
        subjectKey: l.subject_key,
        updatedAt: now,
        updatedBy: actor,
        updatedRole: "coursework",
      };
      const token = await ctx.firebaseAdminToken(env),
        write = await fetch(`${dbUrl}/grades/${key}.json`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "If-Match": currentResponse.headers.get("etag"),
          },
          body: JSON.stringify(payload),
        });
      if (write.status === 412) continue;
      if (!write.ok) reject("GRADE_SYNC_UNAVAILABLE", 503);
      written = true;
      break;
    }
    if (!written) reject("GRADE_SYNC_CONFLICT", 503);
    await env.DB.prepare(
      "UPDATE coursework_sync SET state='synced',error=NULL,updated_at=? WHERE lesson_id=? AND student_key=?",
    )
      .bind(now, l.id, studentKey)
      .run();
    return true;
  } catch (error) {
    await env.DB.prepare(
      "UPDATE coursework_sync SET state='pending',error=?,updated_at=? WHERE lesson_id=? AND student_key=?",
    )
      .bind(error.message, now, l.id, studentKey)
      .run();
    return false;
  }
}
export async function handleCoursework(request, env, auth, path, ctx) {
  if (!path.startsWith("/coursework")) return null;
  const s = await scope(auth, ctx),
    key = auth.profile.studentKey;
  if (path === "/coursework" && request.method === "GET") {
    const lessons = (
      await env.DB.prepare(
        "SELECT * FROM course_lessons ORDER BY subject_key,week",
      ).all()
    ).results.filter(
      (l) =>
        s.allowed.includes(l.subject_key) &&
        (s.role !== "student" || l.status === "published"),
    );
    let results = [],
      attendance = [],
      reflections = [];
    if (s.role === "student") {
      results = (
        await env.DB.prepare(
          "SELECT lesson_id,MAX(score) score,COUNT(*) attempts FROM homework_attempts WHERE student_key=? GROUP BY lesson_id",
        )
          .bind(key)
          .all()
      ).results;
      attendance = (
        await env.DB.prepare(
          "SELECT * FROM course_attendance WHERE student_key=?",
        )
          .bind(key)
          .all()
      ).results;
      reflections = (
        await env.DB.prepare(
          "SELECT * FROM attendance_reflections WHERE student_key=?",
        )
          .bind(key)
          .all()
      ).results;
    }
    return {
      data: {
        subjects: Object.entries(s.subjects)
          .filter(
            ([k, v]) => s.allowed.includes(k) && isCurrent(v, s.semesters),
          )
          .map(([key, v]) => ({ key, ...v })),
        lessons: lessons.map((l) => {
          const qs = JSON.parse(l.questions_json);
          return {
            ...l,
            questions_json: undefined,
            questions: s.role === "student" ? undefined : qs,
            questionCount: qs.length,
            result: results.find((r) => r.lesson_id === l.id) || null,
            attendance: attendance.find((r) => r.lesson_id === l.id) || null,
            reflection: reflections.find((r) => r.lesson_id === l.id) || null,
          };
        }),
        maxHomework: Number(s.settings.hw) || 5,
        maxAttendance: Number(s.settings.attend) || 5,
      },
    };
  }
  if (path === "/coursework/lesson" && request.method === "POST") {
    if (s.role !== "admin") reject("FORBIDDEN", 403);
    const b = await json(request);
    allowed(s, b.subjectKey);
    if (!Number.isInteger(b.week) || b.week < 1 || b.week > 4)
      reject("INVALID_WEEK");
    const qs = (b.questions || []).map((q) => ({
      prompt: String(q.prompt || "").trim(),
      choices: (q.choices || []).map((v) => String(v).trim()),
      correct: q.correct,
    }));
    if (
      !qs.length ||
      qs.length > 100 ||
      qs.some(
        (q) =>
          !q.prompt ||
          q.choices.length !== 4 ||
          q.choices.some((v) => !v) ||
          !Number.isInteger(q.correct) ||
          q.correct < 0 ||
          q.correct > 3,
      )
    )
      reject("INVALID_QUESTIONS");
    const opens = new Date(b.opensAt),
      closes = new Date(b.closesAt);
    if (
      !Number.isFinite(opens.getTime()) ||
      !Number.isFinite(closes.getTime()) ||
      closes <= opens
    )
      reject("INVALID_WINDOW");
    const id = safeKey(`${b.subjectKey}_lesson_${b.week}`),
      existing = await env.DB.prepare(
        "SELECT id FROM homework_attempts WHERE lesson_id=? LIMIT 1",
      )
        .bind(id)
        .first();
    const old = await env.DB.prepare(
      "SELECT questions_json FROM course_lessons WHERE id=?",
    )
      .bind(id)
      .first();
    if (existing && old?.questions_json !== JSON.stringify(qs))
      reject("QUESTIONS_LOCKED_AFTER_SUBMISSION", 409);
    const duration = Number(b.durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) reject("INVALID_DURATION");
    for (const url of [b.zoomUrl, b.recordingUrl, b.pdfUrl])
      if (url && !/^https:\/\//i.test(url)) reject("INVALID_RESOURCE_URL");
    await env.DB.prepare(
      "INSERT INTO course_lessons VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(subject_key,week) DO UPDATE SET title=excluded.title,opens_at=excluded.opens_at,closes_at=excluded.closes_at,questions_json=excluded.questions_json,status=excluded.status,zoom_url=excluded.zoom_url,recording_url=excluded.recording_url,pdf_url=excluded.pdf_url,duration_minutes=excluded.duration_minutes,updated_at=excluded.updated_at",
    )
      .bind(
        id,
        b.subjectKey,
        b.week,
        String(b.title || `المحاضرة ${b.week}`),
        opens.toISOString(),
        closes.toISOString(),
        JSON.stringify(qs),
        b.status === "published" ? "published" : "draft",
        b.zoomUrl || "",
        b.recordingUrl || "",
        b.pdfUrl || "",
        duration,
        new Date().toISOString(),
      )
      .run();
    return { data: { saved: true, id } };
  }
  if (path === "/coursework/questions" && request.method === "POST") {
    if (s.role !== "student") reject("FORBIDDEN", 403);
    const b = await json(request),
      l = await lessonFor(env, b.lessonId, s);
    if (
      l.status !== "published" ||
      Date.now() < Date.parse(l.opens_at) ||
      Date.now() > Date.parse(l.closes_at)
    )
      reject("HOMEWORK_NOT_OPEN", 403);
    return {
      data: {
        questions: JSON.parse(l.questions_json).map(({ correct, ...q }) => q),
        closesAt: l.closes_at,
      },
    };
  }
  if (path === "/coursework/submit" && request.method === "POST") {
    if (s.role !== "student") reject("FORBIDDEN", 403);
    const b = await json(request),
      l = await lessonFor(env, b.lessonId, s),
      qs = JSON.parse(l.questions_json);
    if (
      l.status !== "published" ||
      Date.now() < Date.parse(l.opens_at) ||
      Date.now() > Date.parse(l.closes_at)
    )
      reject("HOMEWORK_NOT_OPEN", 403);
    if (
      !Array.isArray(b.answers) ||
      b.answers.length !== qs.length ||
      b.answers.some((v) => !Number.isInteger(v) || v < 0 || v > 3) ||
      !String(b.requestId || "").trim()
    )
      reject("INCOMPLETE_ANSWERS");
    const score = gradeHomework(qs, b.answers, Number(s.settings.hw) || 5);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO homework_attempts VALUES (?,?,?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        l.id,
        key,
        b.requestId,
        JSON.stringify(b.answers),
        score,
        new Date().toISOString(),
      )
      .run();
    const savedAttempt = await env.DB.prepare(
      "SELECT score FROM homework_attempts WHERE lesson_id=? AND student_key=? AND request_id=?",
    ).bind(l.id, key, b.requestId).first();
    const best = await env.DB.prepare(
      "SELECT MAX(score) score FROM homework_attempts WHERE lesson_id=? AND student_key=?",
    )
      .bind(l.id, key)
      .first();
    return {
      data: {
        score: savedAttempt.score,
        bestScore: best.score,
        synced: await synchronize(env, ctx, l, key, auth.uid),
      },
    };
  }
  if (path === "/coursework/reflection" && request.method === "POST") {
    if (s.role !== "student") reject("FORBIDDEN", 403);
    const b = await json(request),
      l = await lessonFor(env, b.lessonId, s),
      a = await env.DB.prepare(
        "SELECT percent FROM course_attendance WHERE lesson_id=? AND student_key=?",
      )
        .bind(l.id, key)
        .first();
    if (!a || a.percent >= 80) reject("REFLECTION_NOT_REQUIRED", 403);
    if (
      l.status !== "published" ||
      Date.now() < Date.parse(l.opens_at) ||
      Date.now() > Date.parse(l.closes_at)
    )
      reject("HOMEWORK_NOT_OPEN", 403);
    if (
      !Array.isArray(b.answers) ||
      b.answers.length !== 3 ||
      b.answers.some(
        (v) => typeof v !== "string" || !v.trim() || v.length > 12000,
      )
    )
      reject("INCOMPLETE_ANSWERS");
    const old = await env.DB.prepare(
      "SELECT reviewed_at FROM attendance_reflections WHERE lesson_id=? AND student_key=?",
    )
      .bind(l.id, key)
      .first();
    if (old?.reviewed_at) reject("REFLECTION_ALREADY_REVIEWED", 409);
    await env.DB.prepare(
      "INSERT INTO attendance_reflections (lesson_id,student_key,answers_json,submitted_at) VALUES (?,?,?,?) ON CONFLICT(lesson_id,student_key) DO UPDATE SET answers_json=excluded.answers_json,submitted_at=excluded.submitted_at",
    )
      .bind(
        l.id,
        key,
        JSON.stringify(b.answers.map((v) => v.trim())),
        new Date().toISOString(),
      )
      .run();
    return { data: { saved: true } };
  }
  if (path === "/coursework/review" && request.method === "POST") {
    if (s.role === "student") reject("FORBIDDEN", 403);
    const b = await json(request),
      l = await lessonFor(env, b.lessonId, s),
      score = Number(b.score);
    if (
      b.score === "" ||
      b.score == null ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > (Number(s.settings.attend) || 5)
    )
      reject("INVALID_SCORE");
    const result = await env.DB.prepare(
      "UPDATE attendance_reflections SET score=?,feedback=?,reviewed_by=?,reviewed_at=? WHERE lesson_id=? AND student_key=?",
    )
      .bind(
        score,
        String(b.feedback || ""),
        auth.uid,
        new Date().toISOString(),
        l.id,
        b.studentKey,
      )
      .run();
    if (!result.meta.changes) reject("REFLECTION_NOT_FOUND", 404);
    return {
      data: {
        saved: true,
        synced: await synchronize(env, ctx, l, b.studentKey, auth.uid),
      },
    };
  }
  if (path === "/coursework/report" && request.method === "POST") {
    if (s.role === "student") reject("FORBIDDEN", 403);
    const b = await json(request),
      l = await lessonFor(env, b.lessonId, s),
      enrollments = await ctx.firebaseRead("enrollments", auth.token),
      keys = [
        ...new Set(
          Object.values(enrollments || {})
            .filter(
              (e) =>
                e.subjectKey === l.subject_key &&
                s.students[e.studentKey] &&
                s.students[e.studentKey].accountStatus !== "withdrawn",
            )
            .map((e) => e.studentKey),
        ),
      ];
    const attempts = (
        await env.DB.prepare(
          "SELECT student_key,MAX(score) score,COUNT(*) attempts FROM homework_attempts WHERE lesson_id=? GROUP BY student_key",
        )
          .bind(l.id)
          .all()
      ).results,
      attendance = (
        await env.DB.prepare(
          "SELECT * FROM course_attendance WHERE lesson_id=?",
        )
          .bind(l.id)
          .all()
      ).results,
      reflections = (
        await env.DB.prepare(
          "SELECT * FROM attendance_reflections WHERE lesson_id=?",
        )
          .bind(l.id)
          .all()
      ).results;
    return {
      data: {
        students: keys.map((key) => ({
          key,
          ...s.students[key],
          result: attempts.find((v) => v.student_key === key) || null,
          attendance: attendance.find((v) => v.student_key === key) || null,
          reflection: reflections.find((v) => v.student_key === key) || null,
        })),
        lesson: l,
      },
    };
  }
  if (path === "/coursework/attendance" && request.method === "POST") {
    if (s.role !== "admin") reject("FORBIDDEN", 403);
    const b = await json(request),
      l = await lessonFor(env, b.lessonId, s),
      enrollments = await ctx.firebaseRead("enrollments", auth.token),
      eligible = new Set(
        Object.values(enrollments || {})
          .filter((e) => e.subjectKey === l.subject_key)
          .map((e) => e.studentKey),
      );
    if (!Array.isArray(b.rows) || !b.sourceHash) reject("INVALID_IMPORT");
    const seen = new Set();
    for (const row of b.rows) {
      if (
        !eligible.has(row.studentKey) ||
        seen.has(row.studentKey) ||
        !Number.isFinite(row.percent) ||
        row.percent < 0 ||
        row.percent > 100
      )
        reject("INVALID_ATTENDANCE_ROW");
      seen.add(row.studentKey);
    }
    let pending = 0;
    for (const row of b.rows) {
      await env.DB.prepare(
        "INSERT INTO course_attendance VALUES (?,?,?,?,?,?) ON CONFLICT(lesson_id,student_key) DO UPDATE SET percent=excluded.percent,source_hash=excluded.source_hash,approved_by=excluded.approved_by,approved_at=excluded.approved_at",
      )
        .bind(
          l.id,
          row.studentKey,
          row.percent,
          b.sourceHash,
          auth.uid,
          new Date().toISOString(),
        )
        .run();
      if (!(await synchronize(env, ctx, l, row.studentKey, auth.uid)))
        pending++;
    }
    return { data: { saved: true, count: b.rows.length, pending } };
  }
  if (path === "/coursework/sync" && request.method === "POST") {
    if (s.role === "student") reject("FORBIDDEN", 403);
    const rows = (
      await env.DB.prepare(
        "SELECT * FROM coursework_sync WHERE state='pending'",
      ).all()
    ).results;
    let synced = 0;
    for (const row of rows) {
      const l = await env.DB.prepare("SELECT * FROM course_lessons WHERE id=?")
        .bind(row.lesson_id)
        .first();
      if (
        l &&
        s.allowed.includes(l.subject_key) &&
        (await synchronize(env, ctx, l, row.student_key, auth.uid))
      )
        synced++;
    }
    return { data: { synced } };
  }
  reject("NOT_FOUND", 404);
}
