import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const d1Directory = resolve(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");

async function findLocalDatabase() {
  const files = (await readdir(d1Directory))
    .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite")
    .map((name) => resolve(d1Directory, name));
  for (const file of files) {
    const candidate = new DatabaseSync(file);
    const table = candidate.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cases'").get();
    candidate.close();
    if (table) return file;
  }
  throw new Error("ไม่พบฐานข้อมูล D1 บนเครื่อง กรุณารัน npm run dev แล้วเปิดหน้าเว็บหนึ่งครั้งก่อน");
}

const students = [
  ["demo-stu-11001", "11001", "นาย", "ธนกฤต", "แก้วคำ", "ม.1", "1", 8, 1],
  ["demo-stu-11002", "11002", "นาย", "ภาคภูมิ", "มณีวงศ์", "ม.1", "1", 2, 1],
  ["demo-stu-11003", "11003", "นางสาว", "กัญญาณัฐ", "อินต๊ะ", "ม.1", "1", 1, 1],
  ["demo-stu-11004", "11004", "นางสาว", "ณัฐณิชา", "บุญเรือง", "ม.1", "1", 6, 1],
  ["demo-stu-12001", "12001", "นาย", "ศุภกร", "วงศ์ใหญ่", "ม.1", "2", 4, 1],
  ["demo-stu-12002", "12002", "นางสาว", "ชลธิชา", "คำแปง", "ม.1", "2", 2, 1],
  ["demo-stu-25001", "25001", "นาย", "ณัฐวุฒิ", "ปัญญา", "ม.2", "5", 19, 1],
  ["demo-stu-25002", "25002", "นางสาว", "ปวีณา", "แสงแก้ว", "ม.2", "5", 3, 1],
  ["demo-stu-33001", "33001", "นาย", "ธีรภัทร", "ใจกล้า", "ม.3", "3", 11, 1],
  ["demo-stu-33002", "33002", "นาย", "ก้องภพ", "สมบูรณ์", "ม.3", "3", 5, 1],
  ["demo-stu-33003", "33003", "นางสาว", "พิชญา", "วงศ์คำ", "ม.3", "3", 4, 1],
  ["demo-stu-41001", "41001", "นาย", "รัชชานนท์", "สุขใจ", "ม.4", "1", 7, 1],
  ["demo-stu-41002", "41002", "นางสาว", "อริสรา", "บุญมา", "ม.4", "1", 3, 1],
  ["demo-stu-41003", "41003", "นางสาว", "ธัญชนก", "จันทร์ดี", "ม.4", "1", 12, 1],
  ["demo-stu-52001", "52001", "นาย", "ภูวดล", "ไชยวงศ์", "ม.5", "2", 14, 1],
  ["demo-stu-52002", "52002", "นางสาว", "พรนภา", "ยอดคำ", "ม.5", "2", 5, 1],
  ["demo-stu-61001", "61001", "นาย", "วชิรวิทย์", "มั่นคง", "ม.6", "1", 9, 1],
  ["demo-stu-61002", "61002", "นางสาว", "มนัสวี", "ใจงาม", "ม.6", "1", 2, 1],
  ["demo-stu-61003", "61003", "นางสาว", "ชนากานต์", "แก้วตา", "ม.6", "1", 15, 0],
];

const advisors = [
  ["demo-advisor-narin", "นาย", "นรินทร์", "คำเมือง", "narin@chomthong.ac.th", "0812345601"],
  ["demo-advisor-siriporn", "นาง", "ศิริพร", "ยอดใจ", "siriporn@chomthong.ac.th", "0812345602"],
  ["demo-advisor-nanthida", "นางสาว", "นันทิดา", "แก้วกุล", "nanthida@chomthong.ac.th", "0812345603"],
  ["demo-advisor-prasert", "ว่าที่ร้อยตรี", "ประเสริฐ", "ไชยวงศ์", "prasert@chomthong.ac.th", "0812345604"],
  ["demo-advisor-malee", "นาง", "มาลี", "พรมมา", "malee@chomthong.ac.th", "0812345605"],
  ["demo-advisor-anucha", "นาย", "อนุชา", "สุขเกษม", "anucha@chomthong.ac.th", "0812345606"],
];

const assignments = [
  ["demo-assign-narin-m1-1", "demo-advisor-narin", "ม.1", "1", 1],
  ["demo-assign-siriporn-m1-1", "demo-advisor-siriporn", "ม.1", "1", 2],
  ["demo-assign-narin-m1-2", "demo-advisor-narin", "ม.1", "2", 1],
  ["demo-assign-nanthida-m1-2", "demo-advisor-nanthida", "ม.1", "2", 2],
  ["demo-assign-prasert-m3-3", "demo-advisor-prasert", "ม.3", "3", 1],
  ["demo-assign-malee-m3-3", "demo-advisor-malee", "ม.3", "3", 2],
  ["demo-assign-nanthida-m4-1", "demo-advisor-nanthida", "ม.4", "1", 1],
  ["demo-assign-anucha-m4-1", "demo-advisor-anucha", "ม.4", "1", 2],
  ["demo-assign-malee-m6-1", "demo-advisor-malee", "ม.6", "1", 1],
  ["demo-assign-anucha-m6-1", "demo-advisor-anucha", "ม.6", "1", 2],
];

const cases = [
  ["101", "demo-stu-11001", "bullying", "ถูกล้อเลียนซ้ำในห้องเรียน", "ถูกเพื่อนกลุ่มเดิมล้อเรื่องรูปร่างหลายครั้งและเริ่มไม่อยากมาโรงเรียน", "ห้อง ม.1/1", "เพื่อนร่วมชั้น 3 คน", "ขอให้ครูช่วยพูดคุยและติดตาม", "UNSURE", 0, 0, "CONCERN", "NEW", null, "2026-08-10 08:10:00"],
  ["102", "demo-stu-12002", "mental", "รู้สึกเครียดและนอนไม่หลับ", "มีความกังวลจากการเรียนต่อเนื่องสองสัปดาห์และต้องการคนรับฟัง", "บ้าน", "", "ขอพบนักจิตวิทยาหรือครูแนะแนว", "UNSURE", 1, 0, "GENERAL", "NEW", null, "2026-08-10 08:35:00"],
  ["103", "demo-stu-33001", "facility", "ไฟทางเดินอาคารสามไม่ติด", "ไฟบริเวณบันไดชั้นสองไม่ติดหลายดวง ทำให้มองเห็นไม่ชัดช่วงเย็น", "อาคาร 3 ชั้น 2", "", "ขอให้ตรวจสอบระบบไฟ", "SAFE", 0, 0, "GENERAL", "NEW", null, "2026-08-09 15:20:00"],
  ["104", "demo-stu-25002", "violence", "ถูกข่มขู่หลังเลิกเรียน", "มีนักเรียนรุ่นพี่ส่งข้อความข่มขู่และนัดให้ไปพบหลังโรงเรียนเลิก", "หน้าโรงเรียน", "นักเรียนรุ่นพี่ 2 คน", "ขอให้คุ้มครองและตรวจสอบทันที", "UNSAFE", 1, 1, "CRITICAL", "SCREENING", "ครูฝ่ายปกครอง", "2026-08-10 07:45:00"],
  ["105", "demo-stu-41002", "safety", "พบประตูทางหนีไฟถูกล็อก", "ประตูทางหนีไฟด้านหลังอาคารถูกคล้องกุญแจในเวลาเรียน", "อาคาร 4", "", "ขอให้เปิดทางหนีไฟและตรวจสอบ", "UNSAFE", 0, 1, "SERIOUS", "SCREENING", "งานอาคารสถานที่", "2026-08-09 13:10:00"],
  ["106", "demo-stu-52001", "study", "ตามบทเรียนไม่ทันหลายวิชา", "ขาดเรียนจากการพักรักษาตัวและตามเนื้อหาคณิตศาสตร์กับวิทยาศาสตร์ไม่ทัน", "ห้อง ม.5/2", "", "ขอแผนสอนเสริมและติดตามรายสัปดาห์", "SAFE", 0, 0, "CONCERN", "SCREENING", "ครูวิชาการ", "2026-08-08 10:30:00"],
  ["107", "demo-stu-11003", "bullying", "มีการเผยแพร่ภาพโดยไม่ยินยอม", "เพื่อนนำภาพในห้องเรียนไปโพสต์พร้อมข้อความล้อเลียนในกลุ่มออนไลน์", "สื่อสังคมออนไลน์", "เพื่อนร่วมชั้น", "ขอให้หยุดเผยแพร่และช่วยเก็บหลักฐาน", "UNSURE", 1, 1, "SERIOUS", "IN_PROGRESS", "ครูศิริพร", "2026-08-07 14:15:00"],
  ["108", "demo-stu-33003", "mental", "มีอาการตื่นตระหนกก่อนสอบ", "มีอาการใจสั่นและหายใจไม่ทั่วท้องก่อนเข้าห้องสอบหลายครั้ง", "ห้องสอบ", "", "ขอคำปรึกษาและแนวทางดูแล", "UNSURE", 0, 0, "CONCERN", "IN_PROGRESS", "ครูแนะแนว", "2026-08-06 09:05:00"],
  ["109", "demo-stu-61001", "suggestion", "เสนอเพิ่มจุดน้ำดื่ม", "บริเวณอาคารเรียนด้านตะวันตกมีนักเรียนจำนวนมากแต่ไม่มีจุดน้ำดื่มใกล้เคียง", "อาคาร 6", "", "ขอพิจารณาเพิ่มจุดน้ำดื่ม", "SAFE", 0, 0, "GENERAL", "IN_PROGRESS", "งานอาคารสถานที่", "2026-08-05 11:40:00"],
  ["110", "demo-stu-41001", "violence", "พบการพกอาวุธในโรงเรียน", "เห็นวัตถุคล้ายมีดอยู่ในกระเป๋านักเรียนและกังวลว่าจะเกิดอันตราย", "หลังโรงอาหาร", "นักเรียนไม่ทราบชื่อ", "ขอให้ผู้บริหารตรวจสอบเร่งด่วน", "UNSAFE", 1, 1, "CRITICAL", "DIRECTOR_REVIEW", "หัวหน้างานปกครอง", "2026-08-10 09:00:00"],
  ["111", "demo-stu-52002", "safety", "นักเรียนเป็นลมระหว่างกิจกรรม", "นักเรียนเป็นลมระหว่างกิจกรรมกลางแจ้งและจุดปฐมพยาบาลอยู่ไกล", "สนามกีฬา", "นักเรียนร่วมกิจกรรม", "ขอทบทวนมาตรการความปลอดภัย", "UNSAFE", 0, 1, "CRITICAL", "DIRECTOR_REVIEW", "งานอนามัยโรงเรียน", "2026-08-09 10:10:00"],
  ["112", "demo-stu-25001", "other", "สงสัยมีการชักชวนเล่นพนัน", "พบการส่งลิงก์และชักชวนกันในกลุ่มสนทนาของนักเรียน", "กลุ่มสนทนาออนไลน์", "นักเรียนหลายคน", "ขอให้ตรวจสอบโดยปกปิดผู้แจ้ง", "UNSURE", 1, 0, "SERIOUS", "DIRECTOR_REVIEW", "งานระบบดูแลช่วยเหลือ", "2026-08-08 16:25:00"],
  ["113", "demo-stu-33002", "study", "ขาดเรียนต่อเนื่อง", "นักเรียนขาดเรียนต่อเนื่องจากปัญหาการเดินทางและได้รับการประสานครอบครัวแล้ว", "ห้อง ม.3/3", "ผู้ปกครอง", "ขอติดตามการกลับมาเรียน", "SAFE", 0, 0, "GENERAL", "RESOLVED", "ครูประเสริฐ", "2026-08-01 08:30:00"],
  ["114", "demo-stu-11004", "facility", "พื้นห้องน้ำลื่น", "พื้นเปียกและลื่นในช่วงพัก ได้ติดป้ายเตือนและซ่อมท่อน้ำเรียบร้อยแล้ว", "ห้องน้ำอาคาร 1", "", "ขอแก้ไขจุดรั่ว", "UNSURE", 0, 0, "CONCERN", "RESOLVED", "งานอาคารสถานที่", "2026-07-29 12:00:00"],
  ["115", "demo-stu-61002", "suggestion", "ขอพื้นที่อ่านหนังสือหลังเลิกเรียน", "เสนอให้เปิดห้องสมุดเพิ่มอีกหนึ่งชั่วโมงในช่วงก่อนสอบ ซึ่งได้ทดลองดำเนินการแล้ว", "ห้องสมุด", "", "ขอพิจารณาเวลาเปิดบริการ", "SAFE", 0, 0, "GENERAL", "CLOSED", "งานห้องสมุด", "2026-07-20 14:30:00"],
  ["116", "demo-stu-41003", "other", "ทรัพย์สินสูญหายในห้องเรียน", "กระเป๋าเงินสูญหายระหว่างเปลี่ยนคาบ ตรวจสอบกล้องและส่งคืนเจ้าของแล้ว", "ห้อง ม.4/1", "นักเรียนในห้อง", "ขอช่วยตรวจสอบกล้องวงจรปิด", "UNSURE", 0, 0, "SERIOUS", "CLOSED", "ครูอนุชา", "2026-07-18 10:45:00"],
];

const statusSteps = {
  NEW: [],
  SCREENING: [["START_SCREENING", "เจ้าหน้าที่เริ่มคัดกรอง", "ตรวจสอบข้อมูลเบื้องต้นและประเมินผู้เกี่ยวข้อง"]],
  IN_PROGRESS: [["START_SCREENING", "เจ้าหน้าที่เริ่มคัดกรอง", "ตรวจสอบข้อมูลเบื้องต้นแล้ว"], ["START_ACTION", "เริ่มดำเนินการ", "มอบหมายผู้รับผิดชอบและกำหนดแนวทางช่วยเหลือ"]],
  DIRECTOR_REVIEW: [["START_SCREENING", "เจ้าหน้าที่เริ่มคัดกรอง", "ประเมินข้อมูลและความเร่งด่วนแล้ว"], ["SEND_TO_DIRECTOR", "เสนอผู้อำนวยการ", "เจ้าหน้าที่คัดกรองและส่งให้ผู้อำนวยการพิจารณา"]],
  RESOLVED: [["START_SCREENING", "เจ้าหน้าที่เริ่มคัดกรอง", "ตรวจสอบข้อมูลเบื้องต้นแล้ว"], ["START_ACTION", "เริ่มดำเนินการ", "ดำเนินการตามแผนช่วยเหลือ"], ["RESOLVE_CASE", "ดำเนินการสำเร็จ", "แก้ไขเหตุและติดตามผลเรียบร้อย"]],
  CLOSED: [["START_SCREENING", "เจ้าหน้าที่เริ่มคัดกรอง", "ตรวจสอบข้อมูลเบื้องต้นแล้ว"], ["START_ACTION", "เริ่มดำเนินการ", "ประสานหน่วยงานที่เกี่ยวข้องแล้ว"], ["RESOLVE_CASE", "ดำเนินการสำเร็จ", "ติดตามผลไม่พบปัญหาเพิ่มเติม"], ["CLOSE_CASE", "ปิดเคส", "บันทึกผลและปิดเรื่องเรียบร้อย"]],
};

const databaseFile = await findLocalDatabase();
const db = new DatabaseSync(databaseFile);
db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
try {
  const insertStudent = db.prepare(`INSERT OR IGNORE INTO students
    (id,student_code,prefix,first_name,last_name,level,classroom,number,advisor1,advisor2,is_active,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'2026-07-01 08:00:00','2026-08-10 08:00:00')`);
  for (const row of students) insertStudent.run(...row.slice(0, 8), "เชื่อมตามห้องอัตโนมัติ", null, row[8]);

  const insertAdvisor = db.prepare(`INSERT OR IGNORE INTO advisors
    (id,prefix,first_name,last_name,email,phone,is_active,created_at,updated_at)
    VALUES (?,?,?,?,?,?,1,'2026-07-01 08:00:00','2026-08-10 08:00:00')`);
  for (const row of advisors) insertAdvisor.run(...row);
  const insertAssignment = db.prepare("INSERT OR IGNORE INTO advisor_assignments (id,advisor_id,level,classroom,slot,created_at) VALUES (?,?,?,?,?,'2026-07-01 08:00:00')");
  for (const row of assignments) insertAssignment.run(...row);

  const insertCase = db.prepare(`INSERT OR IGNORE INTO cases
    (id,case_number,student_id,category_id,title,description,location,people_involved,requested_help,safety_level,is_anonymous,requires_immediate_review,severity,status,assigned_to,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertTimeline = db.prepare(`INSERT INTO case_timeline (id,case_id,action,title,description,created_by,created_at)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET action=excluded.action,title=excluded.title,
    description=excluded.description,created_by=excluded.created_by,created_at=excluded.created_at`);
  const insertNote = db.prepare("INSERT OR IGNORE INTO case_notes (id,case_id,note,created_by,created_at) VALUES (?,?,?,?,?)");
  const insertAudit = db.prepare("INSERT OR IGNORE INTO audit_logs (id,action,resource,resource_id,actor,metadata,created_at) VALUES (?,?,?,?,?,?,?)");
  for (const row of cases) {
    const [suffix, studentId, categoryId, title, description, location, people, help, safety, anonymous, immediate, severity, status, assignedTo, createdAt] = row;
    const caseId = `demo-case-${suffix}`;
    const caseNumber = `RB-2026-000${suffix}`;
    insertCase.run(caseId, caseNumber, studentId, categoryId, title, description, location, people, help, safety, anonymous, immediate, severity, status, assignedTo, createdAt, createdAt);
    insertTimeline.run(`demo-timeline-${suffix}-0`, caseId, "CREATE_CASE", "นักเรียนส่งเรื่อง", "ระบบได้รับเรื่องเรียบร้อยแล้ว", "student", createdAt);
    statusSteps[status].forEach(([action, stepTitle, stepDescription], index) => {
      const stepTime = new Date(`${createdAt.replace(" ", "T")}Z`);
      stepTime.setUTCMinutes(stepTime.getUTCMinutes() + (index + 1) * 30);
      insertTimeline.run(`demo-timeline-${suffix}-${index + 1}`, caseId, action, stepTitle, stepDescription, action === "SEND_TO_DIRECTOR" ? "cboonta" : (assignedTo || "cboonta"), stepTime.toISOString().slice(0, 19).replace("T", " "));
    });
    if (status !== "NEW") insertNote.run(`demo-note-${suffix}`, caseId, `บันทึกทดสอบ: ตรวจสอบข้อมูลและประสานผู้เกี่ยวข้องสำหรับเรื่อง “${title}” แล้ว`, "cboonta", createdAt);
    insertAudit.run(`demo-audit-${suffix}`, "CREATE_CASE", "case", caseId, "student", `demo-seed-${suffix}`, createdAt);
  }

  const directorAction = db.prepare(`INSERT INTO director_actions (id,case_id,director_id,action,message,created_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET action=excluded.action,message=excluded.message,created_at=excluded.created_at`);
  directorAction.run("demo-director-110", "demo-case-110", "director", "ACKNOWLEDGED", "รับทราบ ให้ฝ่ายปกครองตรวจสอบร่วมกับครูที่ปรึกษาและรายงานผลภายในวันนี้", "2026-08-10 10:15:00");
  directorAction.run("demo-director-113", "demo-case-113", "director", "RESOLVE", "เห็นชอบแนวทางช่วยเหลือและให้ติดตามการมาเรียนต่ออีกสองสัปดาห์", "2026-08-01 10:00:00");
  directorAction.run("demo-director-116", "demo-case-116", "director", "ORDER", "ให้ตรวจสอบกล้องวงจรปิดและสรุปมาตรการป้องกันทรัพย์สินสูญหาย", "2026-07-18 11:30:00");
  insertTimeline.run("demo-timeline-110-3", "demo-case-110", "DIRECTOR_ACKNOWLEDGED", "ผู้อำนวยการรับทราบ", "ให้ฝ่ายปกครองตรวจสอบร่วมกับครูที่ปรึกษาและรายงานผลภายในวันนี้", "director", "2026-08-10 10:15:00");
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  db.close();
  throw error;
}

const counts = Object.fromEntries(db.prepare(`SELECT 'students' name,COUNT(*) total FROM students
  UNION ALL SELECT 'advisors',COUNT(*) FROM advisors
  UNION ALL SELECT 'assignments',COUNT(*) FROM advisor_assignments
  UNION ALL SELECT 'cases',COUNT(*) FROM cases
  UNION ALL SELECT 'timeline',COUNT(*) FROM case_timeline
  UNION ALL SELECT 'notes',COUNT(*) FROM case_notes
  UNION ALL SELECT 'director_actions',COUNT(*) FROM director_actions`).all().map((row) => [row.name, row.total]));
const hasAttachment = db.prepare("SELECT 1 found FROM case_attachments WHERE case_id='demo-case-110' LIMIT 1").get();
let demoUploadToken = "";
if (!hasAttachment) {
  const caseColumns = db.prepare("PRAGMA table_info(cases)").all().map((item) => item.name);
  if (!caseColumns.includes("upload_token_hash")) db.exec("ALTER TABLE cases ADD COLUMN upload_token_hash TEXT");
  if (!caseColumns.includes("upload_token_expires_at")) db.exec("ALTER TABLE cases ADD COLUMN upload_token_expires_at TEXT");
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  demoUploadToken = Buffer.from(tokenBytes).toString("base64url");
  const tokenHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(demoUploadToken))).toString("base64url");
  db.prepare("UPDATE cases SET upload_token_hash=?,upload_token_expires_at=datetime('now','+30 minutes') WHERE id='demo-case-110'").run(tokenHash);
}
db.close();

let attachment = hasAttachment ? "มีอยู่แล้ว" : "ข้าม (เปิด npm run dev แล้วรันคำสั่งนี้ซ้ำเพื่อใส่ไฟล์จริง)";
if (!hasAttachment) {
  try {
    const image = await readFile(resolve(root, "public/images/chomthong-logo.png"));
    const form = new FormData();
    form.set("caseNumber", "RB-2026-000110");
    form.set("uploadToken", demoUploadToken);
    form.set("file", new Blob([image], { type: "image/png" }), "หลักฐานตัวอย่าง-จุดเกิดเหตุ.png");
    const response = await fetch("http://localhost:3000/api/uploads", { method: "POST", body: form, signal: AbortSignal.timeout(5000) });
    attachment = response.ok ? "อัปโหลดเข้า R2 บนเครื่องสำเร็จ" : `อัปโหลดไม่สำเร็จ (HTTP ${response.status})`;
  } catch {
    // Database records are still usable when the development server is not running.
  }
}

console.log("เพิ่มข้อมูลทดสอบบนเครื่องเรียบร้อย", counts);
console.log("ไฟล์หลักฐาน:", attachment);
console.log("ทดสอบติดตามเรื่อง: เลขนักเรียน 41001 / เคส RB-2026-000110");
