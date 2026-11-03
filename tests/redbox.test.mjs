import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("contains the student, tracking, admin, and director product routes", async () => {
  const [home, report, track, admin, students, advisors, director] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/report/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/track/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/students/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/advisors/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/director/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /view="home"/);
  assert.match(report, /view="report"/);
  assert.match(track, /view="track"/);
  assert.match(admin, /view="admin"/);
  assert.match(students, /AdminStudents/);
  assert.match(advisors, /AdminAdvisors/);
  assert.match(director, /DirectorDashboard/);
});

test("keeps the admin sidebar across management pages", async () => {
  const [layout, frame] = await Promise.all([
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminFrame.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /AdminFrame/);
  assert.match(frame, /\/admin\/students/);
  assert.match(frame, /\/admin\/advisors/);
});

test("links every room advisor and auto-orders male students before female students", async () => {
  const [studentsApi, verifyApi, advisorLinks, studentsUi, reportUi] = await Promise.all([
    readFile(new URL("../app/api/students/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/students/verify/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/student-advisors.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminStudents.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of [studentsApi, verifyApi]) {
    assert.match(source, /ROW_NUMBER\(\) OVER/);
    assert.match(source, /'นาย','เด็กชาย','ด\.ช\.'/);
    assert.match(source, /attachAdvisorData/);
  }
  assert.match(advisorLinks, /FROM advisor_assignments/);
  assert.match(advisorLinks, /advisor_names/);
  assert.match(studentsUi, /student\.advisors\.map/);
  assert.match(reportUi, /student\.advisor_names\.join/);
});

test("supports adding, editing, and safely deactivating students", async () => {
  const [studentsApi, studentApi, studentsUi] = await Promise.all([
    readFile(new URL("../app/api/students/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/students/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminStudents.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(studentsApi, /export async function POST/);
  assert.match(studentApi, /export async function PATCH/);
  assert.match(studentApi, /export async function DELETE/);
  assert.match(studentApi, /DEACTIVATE_STUDENT/);
  assert.match(studentApi, /is_active=0/);
  assert.match(studentsUi, /isActive: true/);
  assert.match(studentsUi, /เพิ่มนักเรียน/);
  assert.match(studentsUi, /แก้ไขข้อมูลนักเรียน/);
  assert.match(studentsUi, /role="dialog"/);
  assert.match(studentsUi, /role="alertdialog"/);
  assert.match(studentsUi, /ลบจากรายการใช้งานโดยเก็บประวัติเดิม/);
});

test("supports many teachers per room and many rooms per teacher without replacing assignments", async () => {
  const [createApi, updateApi, assignmentHelpers, advisorsUi, schema, migration] = await Promise.all([
    readFile(new URL("../app/api/advisors/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/advisors/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/advisor-assignments.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminAdvisors.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_wandering_shinobi_shaw.sql", import.meta.url), "utf8"),
  ]);
  for (const source of [createApi, updateApi]) {
    assert.doesNotMatch(source, /INSERT OR REPLACE|\.max\(2\)/);
    assert.match(source, /prepareAdvisorAssignmentInsert/);
  }
  assert.match(assignmentHelpers, /COALESCE\(MAX\(slot\),0\)\+1/);
  assert.match(schema, /advisor_assignment_advisor_room_unique/);
  assert.match(migration, /advisor_assignment_advisor_room_unique/);
  assert.match(advisorsUi, /ครูหนึ่งคนดูแลได้หลายห้อง/);
  assert.match(advisorsUi, /แต่ละห้องมีครูที่ปรึกษาได้หลายคน/);
  assert.match(advisorsUi, /ครูที่ปรึกษาทั้งหมด/);
  assert.match(advisorsUi, /เพิ่มครูที่ปรึกษา/);
  assert.match(advisorsUi, /ค้นหาชื่อ อีเมล โทรศัพท์ หรือห้อง/);
  assert.match(advisorsUi, /ทุกระดับชั้น/);
  assert.match(advisorsUi, /ทุกห้อง/);
  assert.doesNotMatch(advisorsUi, /ครูที่ปรึกษาคนที่ 1|ครูที่ปรึกษาคนที่ 2|ได้ 2 คน/);
});

test("does not ship unfinished menu copy", async () => {
  const app = await readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /กำลังจัดเตรียม|coming soon|TODO|FIXME/i);
  assert.match(app, /\/admin\/students/);
  assert.match(app, /เสนอผู้อำนวยการ/);
});

test("renders workflow transitions above the case drawer", async () => {
  const [modal, styles] = await Promise.all([
    readFile(new URL("../components/WorkflowTransitionModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(modal, /createPortal/);
  assert.match(modal, /document\.body/);
  assert.match(styles, /\.modal-backdrop\s*\{[^}]*position:fixed/);
  assert.match(styles, /\.modal-backdrop\s*\{[^}]*z-index:1000/);
});

test("routes intake screening to student affairs before team assignment", async () => {
  const [dashboard, modal, caseApi] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/WorkflowTransitionModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /ส่งทีมกิจการนักเรียน/);
  assert.match(dashboard, /TeamAssigneePicker/);
  assert.match(dashboard, /อนุมัติและมอบหมาย/);
  assert.match(dashboard, /assignees: pendingTeam/);
  assert.match(dashboard, /leadAssignee/);
  assert.match(modal, /ข้อความนี้เป็นบันทึกภายใน/);
  assert.match(modal, /นักเรียนไม่เห็นข้อความนี้/);
  assert.match(caseApi, /case_assignments/);
  assert.match(caseApi, /AFFAIRS_REVIEW>IN_PROGRESS/);
  assert.match(caseApi, /ASSIGN_CASE_TEAM/);
});

test("shows explicit team completion, intake review, and case closing actions", async () => {
  const [dashboard, modal] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/WorkflowTransitionModal.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /ทีมดำเนินการเรียบร้อย ส่งผลกลับเจ้าหน้าที่/);
  assert.match(dashboard, /ผู้รับผิดชอบหลักเป็นผู้ส่งผลกลับเจ้าหน้าที่/);
  assert.match(dashboard, /ส่งกลับทีมเดิมดำเนินการต่อ/);
  assert.match(dashboard, /ตรวจผลแล้ว ปิดเคส/);
  assert.match(dashboard, /ยืนยันปิดเคส/);
  assert.match(modal, /สรุปผลก่อนปิดเคส/);
});

test("makes the current status lead to a clear next action instead of a status menu", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const step of ["รับเรื่อง", "คัดกรอง", "ดำเนินการ", "ตรวจผล", "ปิดเคส"]) {
    assert.match(dashboard, new RegExp(step));
  }
  assert.match(dashboard, /case-workflow-actions/);
  assert.match(dashboard, /scrollIntoView/);
  assert.match(dashboard, /คัดกรองและมอบหมายผู้รับผิดชอบ/);
  assert.doesNotMatch(dashboard, /เปลี่ยนไปขั้นตอนถัดไป/);
  assert.match(styles, /\.case-workflow-progress/);
  assert.match(styles, /\.status-jump-button/);
});

test("orders the staff case queue by pending, active, then completed work", async () => {
  const [casesApi, dashboard] = await Promise.all([
    readFile(new URL("../app/api/cases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(casesApi, /'NEW','REOPENED','SCREENING','ASSIGNED','AFFAIRS_REVIEW','DEPUTY_REVIEW'\) THEN 0/);
  assert.match(casesApi, /'IN_PROGRESS','INTAKE_REVIEW','ADMIN_REVIEW','DIRECTOR_REVIEW','DIRECTOR_ORDERED','PENDING_CLOSE'\) THEN 1/);
  assert.match(casesApi, /'RESOLVED','CLOSED'\) THEN 2/);
  assert.match(casesApi, /c\.requires_immediate_review DESC,c\.created_at DESC/);
  assert.match(dashboard, /ยังไม่ได้ดำเนินการ → กำลังดำเนินการ → เสร็จสิ้น/);
});

test("offers searchable active teachers for multi-person assignment", async () => {
  const [app, api, caseApi] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/assignees/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /AssigneeCombobox/);
  assert.match(app, /TeamAssigneePicker/);
  assert.match(app, /พิมพ์ชื่อครูหรือเจ้าหน้าที่/);
  assert.match(app, /role="combobox"/);
  assert.match(api, /'SUPER_ADMIN','STUDENT_AFFAIRS','LEVEL_HEAD','TEACHER','ADVISOR','CASE_OFFICER'/);
  assert.match(api, /is_active=1/);
  assert.match(caseApi, /role IN \('SUPER_ADMIN','STUDENT_AFFAIRS','LEVEL_HEAD','TEACHER','ADVISOR','CASE_OFFICER'\)/);
  assert.match(caseApi, /assignment_role/);
});

test("allows only the highest-level admin to permanently delete a case", async () => {
  const [app, caseApi] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /ยืนยันการลบเคส/);
  assert.match(app, /เครื่องมือผู้ดูแลระบบ/);
  assert.ok(app.indexOf("เครื่องมือผู้ดูแลระบบ") > app.indexOf('className="timeline-card"'));
  assert.doesNotMatch(app, /tracking-admin-card/);
  assert.match(app, /currentRole === "SUPER_ADMIN"/);
  assert.match(caseApi, /export async function DELETE/);
  assert.match(caseApi, /!sessionHasRole\(session, "SUPER_ADMIN"\)/);
  for (const table of ["director_actions", "case_handoffs", "case_attachments", "case_notes", "case_timeline", "cases"]) {
    assert.match(caseApi, new RegExp(`DELETE FROM ${table}`));
  }
  assert.match(caseApi, /env\.EVIDENCE\.delete/);
  assert.match(caseApi, /"DELETE_CASE"/);
});

test("does not seed fake students, advisors, or generic staff into production", async () => {
  const [bootstrap, auth] = await Promise.all([
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(bootstrap, /studentSeeds|advisorSeeds|staff-intake|advisor123/);
  assert.match(bootstrap, /staff-super-admin/);
  assert.match(bootstrap, /categorySeeds/);
  assert.doesNotMatch(bootstrap, /password_hash=excluded\.password_hash/);
  assert.doesNotMatch(auth, /ADMIN_PASSWORD|DIRECTOR_PASSWORD|legacy-super_admin|legacy-director/);
});

test("uses D1 and private R2 bindings", async () => {
  const hosting = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, "EVIDENCE");
});

test("ships the school logo and social card", async () => {
  const [logo, social] = await Promise.all([
    readFile(new URL("../public/images/chomthong-logo.png", import.meta.url)),
    readFile(new URL("../public/og.png", import.meta.url)),
  ]);
  assert.ok(logo.byteLength > 1000);
  assert.ok(social.byteLength > 1000);
});

test("provides an idempotent local demo dataset covering the real workflow", async () => {
  const [seed, packageJson] = await Promise.all([
    readFile(new URL("../scripts/seed-demo.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  for (const status of ["NEW", "SCREENING", "IN_PROGRESS", "DIRECTOR_REVIEW", "RESOLVED", "CLOSED"]) {
    assert.match(seed, new RegExp(`\\"${status}\\"`));
  }
  for (const severity of ["GENERAL", "CONCERN", "SERIOUS", "CRITICAL"]) {
    assert.match(seed, new RegExp(`\\"${severity}\\"`));
  }
  for (const category of ["bullying", "mental", "violence", "safety", "study", "facility", "suggestion", "other"]) {
    assert.match(seed, new RegExp(`\\"${category}\\"`));
  }
  assert.match(seed, /INSERT OR IGNORE/);
  assert.match(seed, /case_timeline/);
  assert.match(seed, /case_notes/);
  assert.match(seed, /director_actions/);
  assert.match(seed, /api\/uploads/);
  assert.match(packageJson, /db:seed:demo/);
});

test("shows Font Awesome icons inside case status and severity badges", async () => {
  const [badges, dashboard, director] = await Promise.all([
    readFile(new URL("../components/CaseBadge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DirectorDashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(badges, /FontAwesomeIcon/);
  assert.match(badges, /severityIcons/);
  assert.match(badges, /statusIcons/);
  assert.match(dashboard, /SeverityBadge/);
  assert.match(dashboard, /StatusBadge/);
  assert.match(director, /SeverityBadge/);
});

test("uses Font Awesome icons to structure important case-detail headings", async () => {
  const dashboard = await readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /drawer-kicker/);
  assert.match(dashboard, /case-title/);
  assert.match(dashboard, /section-title/);
  assert.match(dashboard, /reviewIcons/);
});

test("previews private evidence inline without forcing a download", async () => {
  const [preview, uploads, dashboard, director] = await Promise.all([
    readFile(new URL("../components/EvidencePreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DirectorDashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(preview, /role="dialog"/);
  assert.match(preview, /<iframe/);
  assert.match(preview, /<img/);
  assert.match(preview, /preview=1/);
  assert.match(uploads, /preview \? "inline" : "attachment"/);
  assert.match(dashboard, /setPreviewFile\(file\)/);
  assert.match(director, /setPreviewFile\(file\)/);
});

test("allows staff to edit an existing internal note and collapses the editor after saving", async () => {
  const [dashboard, caseRoute] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /editingNoteId/);
  assert.match(dashboard, /แก้ไขบันทึกของ/);
  assert.match(dashboard, /noteId: editingNoteId/);
  assert.match(dashboard, /setNoteEditorOpen\(false\)/);
  assert.match(caseRoute, /UPDATE case_notes SET note=\?/);
  assert.match(caseRoute, /WHERE id=\? AND case_id=\?/);
  assert.match(caseRoute, /แก้ไขบันทึกภายใน/);
  assert.match(dashboard, /item\.is_editable/);
  assert.match(caseRoute, /UPDATE case_notes SET is_editable=0/);
  assert.match(caseRoute, /AND is_editable=1/);
});

test("supports role-based staff accounts and ordered case handoffs", async () => {
  const [auth, usersApi, updateUserApi, caseApi, usersUi, frame, bootstrap] = await Promise.all([
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminUsers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminFrame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
  ]);
  for (const role of ["SUPER_ADMIN", "INTAKE", "STUDENT_AFFAIRS", "LEVEL_HEAD", "TEACHER", "ADVISOR", "DEPUTY_DIRECTOR", "DIRECTOR"]) assert.match(auth, new RegExp(role));
  assert.match(usersApi, /hashPassword/);
  assert.doesNotMatch(usersApi, /SELECT.*password_hash.*FROM staff_users ORDER BY/);
  assert.match(caseApi, /NEW>AFFAIRS_REVIEW/);
  assert.match(caseApi, /INTAKE_REVIEW>CLOSED/);
  assert.match(caseApi, /ไม่มีสิทธิ์ส่งเคสข้ามขั้นตอนนี้/);
  assert.match(caseApi, /case_handoffs/);
  assert.match(caseApi, /handoffReason/);
  assert.match(usersUi, /จัดการผู้ใช้งาน/);
  assert.match(usersUi, /กำหนดบทบาท/);
  assert.match(usersUi, /กำลังปรับบทบาทของบัญชี/);
  assert.match(usersUi, /สิทธิ์ระดับสูงสุด/);
  assert.match(updateUserApi, /await requireAdmin\(request\)/);
  assert.match(updateUserApi, /ระบบต้องมีแอดมินระบบอย่างน้อย 1 บัญชี/);
  assert.match(frame, /superAdminOnly/);
  assert.match(bootstrap, /advisor_id/);
});

test("shows directly assigned cases to advisor accounts even outside their advisory rooms", async () => {
  const [casesApi, caseApi] = await Promise.all([
    readFile(new URL("../app/api/cases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(casesApi, /visibility\.push\("c\.assigned_to=\?"\)/);
  assert.match(casesApi, /case_assignments ca/);
  assert.match(casesApi, /visibility\.join\(" OR "\)/);
  assert.match(caseApi, /const directlyAssigned = String\(caseRow\.assigned_to \?\? ""\) === session\.username \|\| participant/);
  assert.match(caseApi, /!directlyAssigned && !affairsQueue && !roomAccess/);
  assert.match(caseApi, /const isLead = item\.assigned_to === actor/);
});

test("lets student affairs assign multiple teachers with one lead", async () => {
  const [dashboard, caseApi, assigneesApi, transitionModal] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/assignees/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/WorkflowTransitionModal.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /pendingTeam/);
  assert.match(dashboard, /ผู้รับผิดชอบหลัก/);
  assert.match(dashboard, /เลือกได้หลายคน/);
  assert.match(caseApi, /assignees: z\.array/);
  assert.match(caseApi, /case_assignments/);
  assert.match(caseApi, /ASSIGN_CASE_TEAM/);
  assert.doesNotMatch(assigneesApi, /ไม่มีสิทธิ์ดูรายชื่อผู้รับผิดชอบ/);
  assert.match(transitionModal, /นักเรียนไม่เห็นข้อความนี้/);
});

test("separates intake screening from student-affairs approval", async () => {
  const [dashboard, caseApi] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /ส่งทีมกิจการนักเรียน/);
  assert.match(dashboard, /ไม่อนุมัติ ส่งกลับเจ้าหน้าที่/);
  assert.match(caseApi, /NEW>AFFAIRS_REVIEW/);
  assert.match(caseApi, /AFFAIRS_REVIEW>INTAKE_REVIEW/);
  assert.match(caseApi, /เคสรุนแรงหรือวิกฤตต้องส่งรองผู้อำนวยการ/);
});

test("requires the lead teacher to return completed work to intake", async () => {
  const [dashboard, caseApi] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /selected\.case\.status === "IN_PROGRESS" && isCurrentAssignee/);
  assert.match(dashboard, /ส่งผลกลับเจ้าหน้าที่/);
  assert.doesNotMatch(dashboard, /ปิดเคสของฉัน/);
  assert.match(caseApi, /requestedStatus !== "INTAKE_REVIEW" \|\| isLead/);
});

test("groups and orders statuses from pending work through completion", async () => {
  const [dashboard, casesApi, styles] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const label of ["ยังไม่ได้ดำเนินการ", "กำลังดำเนินการ", "เสร็จสิ้น"]) assert.match(dashboard, new RegExp(label));
  assert.match(dashboard, /<optgroup label=\{group\.label\}/);
  assert.match(dashboard, /case-group-row/);
  assert.match(casesApi, /WHEN 'NEW' THEN 0/);
  assert.match(casesApi, /WHEN 'CLOSED' THEN 10/);
  assert.match(styles, /\.case-group-row\.pending/);
});

test("shows each reporter's room and linked advisors in staff and director case details", async () => {
  const [dashboard, director, directorApi, staffApi] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DirectorDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/director/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  for (const source of [dashboard, director]) {
    assert.match(source, /ชั้น \/ ห้อง/);
    assert.match(source, /ครูที่ปรึกษา/);
    assert.match(source, /advisor_names/);
  }
  for (const source of [directorApi, staffApi]) {
    assert.match(source, /loadRoomAdvisors/);
    assert.match(source, /attachAdvisorData/);
  }
});

test("renders timeline updates as readable Thai instead of raw JSON", async () => {
  const [timelineHelper, staffApi, directorApi, styles] = await Promise.all([
    readFile(new URL("../lib/case-timeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/director/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(timelineHelper, /เริ่มคัดกรองเคส/);
  assert.match(timelineHelper, /รายละเอียด:/);
  assert.match(timelineHelper, /กำหนดติดตาม:/);
  assert.match(timelineHelper, /JSON\.parse/);
  assert.match(timelineHelper, /humanizeTimelineEntry/);
  assert.match(timelineHelper, /lines\[0\]\.trim\(\) === title\.trim\(\)/);
  assert.doesNotMatch(staffApi, /: JSON\.stringify\(input\.data\)/);
  assert.match(staffApi, /humanizeTimelineEntry/);
  assert.match(directorApi, /humanizeTimelineEntry/);
  assert.match(styles, /white-space:pre-wrap/);
});

test("lets intake and executives close cases at their decision points", async () => {
  const [dashboard, caseApi, directorApi] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/director/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /onClick=\{\(\) => setTransitionTarget\("CLOSED"\)\}/);
  assert.match(caseApi, /INTAKE_REVIEW>CLOSED/);
  assert.match(caseApi, /NEW>CLOSED/);
  assert.match(directorApi, /input\.data\.action === "CLOSE" \? "CLOSED"/);
});

test("keeps the super-admin close override while allowing optional workflow messages", async () => {
  const [dashboard, caseApi, transitionModal] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/WorkflowTransitionModal.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /currentRole === "SUPER_ADMIN"/);
  assert.match(dashboard, /ปิดเคสทันที/);
  assert.match(dashboard, /setTransitionTarget\("CLOSED"\)/);
  assert.match(caseApi, /const isSuper = sessionHasRole\(session, "SUPER_ADMIN"\)/);
  assert.match(caseApi, /const permitted = isSuper/);
  assert.doesNotMatch(caseApi, /!input\.data\.handoffReason/);
  assert.match(transitionModal, /สรุปผลก่อนปิดเคส \(ถ้ามี\)/);
  assert.doesNotMatch(transitionModal, /required placeholder/);
  assert.doesNotMatch(transitionModal, /reason\.trim\(\)\.length < 2/);
});

test("allows director actions without typing an accompanying message", async () => {
  const [director, directorApi] = await Promise.all([
    readFile(new URL("../components/DirectorDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/director/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(director, /เว้นว่างได้/);
  assert.doesNotMatch(director, /message\.trim\(\)\.length < 2/);
  assert.match(directorApi, /message: z\.string\(\)\.trim\(\)\.max\(2000\)\.optional\(\)/);
  assert.doesNotMatch(directorApi, /กรุณาระบุคำสั่งและรายละเอียดให้ครบ/);
});

test("uses a new private hashed tracking password for every submitted case", async () => {
  const [dashboard, casesApi] = await Promise.all([
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/route.ts", import.meta.url), "utf8"),
  ]);
  const tracking = dashboard.slice(dashboard.indexOf("function Tracking"), dashboard.indexOf("function AdminDashboard"));
  assert.match(tracking, /studentCode=/);
  assert.match(tracking, /trackingPassword=/);
  assert.doesNotMatch(tracking, /setCaseNumber/);
  assert.match(tracking, /เรื่องที่ส่งไว้/);
  assert.match(casesApi, /WHERE s\.student_code=\? ORDER BY c\.created_at DESC/);
  assert.match(casesApi, /verifyPassword/);
  assert.match(casesApi, /hashPassword/);
  assert.match(casesApi, /c\.tracking_password_hash/);
  assert.match(casesApi, /INSERT INTO cases/);
  assert.match(dashboard, /รีเซ็ตรหัสติดตาม/);
  assert.match(dashboard, /resetTrackingPassword/);
  assert.match(casesApi, /SELECT c\.case_number,c\.status,c\.created_at,c\.tracking_password_hash,cc\.name category_name/);
  assert.doesNotMatch(casesApi, /SELECT c\.case_number,c\.title,c\.status/);
});

test("never returns password or upload token hashes in staff case responses", async () => {
  const routes = await Promise.all([
    "../app/api/cases/route.ts",
    "../app/api/cases/[caseNumber]/route.ts",
    "../app/api/director/cases/route.ts",
    "../app/api/director/cases/[caseNumber]/route.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const source of routes) assert.doesNotMatch(source, /SELECT c\.\*/);
  assert.match(routes[0], /SAFE_CASE_COLUMNS/);
});

test("protects evidence uploads with expiring opaque tokens and case-level access", async () => {
  const [casesApi, uploads, report] = await Promise.all([
    readFile(new URL("../app/api/cases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(casesApi, /createOpaqueToken/);
  assert.match(casesApi, /upload_token_expires_at/);
  assert.match(uploads, /uploadToken/);
  assert.match(uploads, /safeTokenEqual/);
  assert.match(uploads, /advisor_assignments/);
  assert.match(report, /upload\.set\("uploadToken"/);
});

test("forces initial staff passwords to be changed without resetting changed passwords", async () => {
  const [auth, frame, changePassword, accountScript, usersApi] = await Promise.all([
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminFrame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/change-password/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/create-advisor-accounts.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /mustChangePassword/);
  assert.match(auth, /Password change required/);
  assert.match(frame, /ตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน/);
  assert.match(changePassword, /must_change_password=0/);
  assert.doesNotMatch(accountScript, /ON CONFLICT\(username\) DO UPDATE SET password_hash/);
  assert.match(usersApi, /!value\.roles\.includes\("ADVISOR"\)/);
});

test("supports multiple roles on one staff account with one login", async () => {
  const [auth, usersApi, updateUserApi, usersUi, schema, migration] = await Promise.all([
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminUsers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0006_lyrical_white_queen.sql", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /roles: StaffRole\[\]/);
  assert.match(auth, /sessionHasAnyRole/);
  assert.match(usersApi, /roles: rolesSchema/);
  assert.match(updateUserApi, /DELETE FROM staff_user_roles/);
  assert.match(usersUi, /เลือกได้หลายรายการ/);
  assert.match(usersUi, /form\.roles\.includes/);
  assert.match(schema, /staffUserRoles/);
  assert.match(migration, /CREATE TABLE `staff_user_roles`/);
});

test("shows role tabs and grants anonymous student identity access per user", async () => {
  const [auth, usersApi, updateUserApi, usersUi, casesApi, caseDetailApi, directorApi, directorDetailApi, schema, migration] = await Promise.all([
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminUsers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/director/cases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/director/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0008_student_identity_permission.sql", import.meta.url), "utf8"),
  ]);
  assert.match(usersUi, /role="tablist"/);
  assert.match(usersUi, /ดูตัวตนนักเรียน/);
  assert.match(usersUi, /เชื่อมข้อมูลครูที่ปรึกษาแล้ว/);
  assert.match(usersUi, /accountName === advisorName/);
  assert.match(usersUi, /ยืนยันลบบัญชี/);
  assert.match(usersUi, /แก้ไขข้อมูลและสิทธิ์/);
  assert.match(updateUserApi, /export async function DELETE/);
  assert.match(updateUserApi, /DELETE_STAFF_USER/);
  assert.match(updateUserApi, /มีประวัติเกี่ยวข้องกับเคส/);
  assert.match(usersUi, /IDENTITY_ACCESS/);
  assert.match(usersUi, /canViewStudentIdentity/);
  assert.match(usersApi, /can_view_student_identity/);
  assert.match(updateUserApi, /can_view_student_identity=\?/);
  assert.match(auth, /sessionCanViewStudentIdentity/);
  assert.match(auth, /canViewStudentIdentity/);
  for (const route of [casesApi, caseDetailApi, directorApi, directorDetailApi]) assert.match(route, /sessionCanViewStudentIdentity/);
  assert.match(schema, /canViewStudentIdentity/);
  assert.match(migration, /can_view_student_identity/);
});

test("routes students from cboonta advisory rooms into an owner-only first review", async () => {
  const [casesApi, caseDetailApi, uploadsApi, exclusiveReview, dashboard, schema, migration] = await Promise.all([
    readFile(new URL("../app/api/cases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseNumber]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/exclusive-review.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/RedBoxApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0009_owner_advisor_exclusive_review.sql", import.meta.url), "utf8"),
  ]);
  assert.match(exclusiveReview, /OWNER_REVIEW_USERNAME = "cboonta"/);
  assert.match(exclusiveReview, /advisor_assignments/);
  assert.match(exclusiveReview, /source_username=su\.username/);
  assert.match(casesApi, /findExclusiveReviewerForRoom/);
  assert.match(casesApi, /exclusive_reviewer_username/);
  assert.match(casesApi, /c\.exclusive_reviewer_username=\?/);
  assert.match(caseDetailApi, /isExclusiveReviewPending/);
  assert.match(caseDetailApi, /exclusive_reviewer_username !== session\.username/);
  assert.match(uploadsApi, /isExclusiveReviewPending/);
  assert.match(dashboard, /รอคุณพิจารณาเท่านั้น/);
  assert.match(dashboard, /selected\.case\.reporter_name/);
  assert.match(schema, /exclusiveReviewerUsername/);
  assert.match(migration, /UPDATE `cases` SET `exclusive_reviewer_username`='cboonta'/);
});

test("allocates case numbers atomically for concurrent Cloudflare requests", async () => {
  const [casesApi, bootstrap] = await Promise.all([
    readFile(new URL("../app/api/cases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
  ]);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS case_sequences/);
  assert.match(casesApi, /ON CONFLICT\(year\) DO UPDATE/);
  assert.match(casesApi, /RETURNING last_value/);
  assert.doesNotMatch(casesApi, /SELECT COUNT\(\*\) total FROM cases/);
});

test("adds production security and no-store headers at the Cloudflare Worker boundary", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  for (const header of ["x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "strict-transport-security"]) {
    assert.match(worker, new RegExp(header));
  }
  assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /private, no-store/);
});
