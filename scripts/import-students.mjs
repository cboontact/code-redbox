import { DatabaseSync } from "node:sqlite";
import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createHmac } from "node:crypto";

const csvPath = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !csvPath.endsWith(".csv")) {
  throw new Error("ระบุไฟล์ CSV: npm run db:import:students -- /path/to/file.csv");
}

const root = resolve(import.meta.dirname, "..");
const d1Directory = resolve(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const files = (await readdir(d1Directory)).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
let databaseFile = "";
for (const name of files) {
  const file = resolve(d1Directory, name);
  const candidate = new DatabaseSync(file);
  const found = candidate.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='students'").get();
  candidate.close();
  if (found) { databaseFile = file; break; }
}
if (!databaseFile) throw new Error("ไม่พบฐานข้อมูลบนเครื่อง กรุณาเปิดเว็บไซต์บนเครื่องอย่างน้อยหนึ่งครั้ง");

function parseCsv(source) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const source = (await readFile(csvPath, "utf8")).replace(/^\uFEFF/, "");
const [headers, ...rawRows] = parseCsv(source);
const required = ["เลขที่", "เลขประจำตัว", "เลขบัตรนักเรียน", "คำนำหน้า", "ชื่อ", "นามสกุล", "ระดับชั้น", "ห้อง"];
for (const column of required) if (!headers.includes(column)) throw new Error(`ไม่พบคอลัมน์ ${column}`);
const at = Object.fromEntries(headers.map((header, index) => [header, index]));
const identityHeader = ["เลขประจำตัวประชาชน", "เลขประชาชน", "เลขประจำตัวบุคคล", "รหัส G"].find((header) => headers.includes(header));
const identityPepper = process.env.STUDENT_IDENTITY_PEPPER ?? process.env.SESSION_SECRET ?? "";
if (identityHeader && identityPepper.length < 32) throw new Error("ไฟล์มีเลขประจำตัวบุคคล กรุณากำหนด STUDENT_IDENTITY_PEPPER อย่างน้อย 32 ตัวอักษรก่อนนำเข้า");
const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";
const normalizeIdentity = (value) => clean(value).toUpperCase().replace(/[๐-๙]/g, (digit) => String(thaiDigits.indexOf(digit))).replace(/[\s-]/g, "");
const validIdentity = (value) => {
  if (/^G\d{12}$/.test(value)) return true;
  if (!/^[0-8]\d{12}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === digits[12];
};
const identityHash = (value) => `student-identity-hmac-sha256$${createHmac("sha256", identityPepper).update(`student-identity-v1:${value}`).digest("base64")}`;
const allowedPrefixes = new Set(["เด็กชาย", "เด็กหญิง", "นาย", "นางสาว"]);
const students = [];
const seenCodes = new Set();
for (let index = 0; index < rawRows.length; index += 1) {
  const row = rawRows[index];
  const studentCode = clean(row[at["เลขประจำตัว"]]);
  const prefix = clean(row[at["คำนำหน้า"]]);
  const levelNumber = clean(row[at["ระดับชั้น"]]);
  const classroom = clean(row[at["ห้อง"]]);
  const firstName = clean(row[at["ชื่อ"]]);
  const lastName = clean(row[at["นามสกุล"]]);
  if (!/^\d{4,10}$/.test(studentCode) || !allowedPrefixes.has(prefix) || !/^[1-6]$/.test(levelNumber) || !/^\d{1,2}$/.test(classroom) || !firstName || !lastName) {
    throw new Error(`ข้อมูลไม่ถูกต้องในแถว ${index + 2}`);
  }
  if (seenCodes.has(studentCode)) throw new Error(`เลขประจำตัวซ้ำ: ${studentCode}`);
  seenCodes.add(studentCode);
  const card = clean(row[at["เลขบัตรนักเรียน"]]);
  const identity = identityHeader ? normalizeIdentity(row[at[identityHeader]]) : "";
  if (identityHeader && !validIdentity(identity)) throw new Error(`เลขประจำตัวบุคคลหรือรหัส G ไม่ถูกต้องในแถว ${index + 2}`);
  students.push({
    id: `student-real-${studentCode}`,
    studentCode,
    studentCardNumber: !card || card.toUpperCase() === "NO RFID" ? null : card,
    identityNumberHash: identity ? identityHash(identity) : null,
    prefix,
    firstName,
    lastName,
    level: `ม.${levelNumber}`,
    classroom,
    sourceNumber: Number(clean(row[at["เลขที่"]])) || index + 1,
    number: 0,
  });
}

const rooms = new Map();
for (const student of students) {
  const key = `${student.level}|${student.classroom}`;
  const room = rooms.get(key) ?? [];
  room.push(student);
  rooms.set(key, room);
}
const isMale = (prefix) => prefix === "เด็กชาย" || prefix === "นาย";
for (const room of rooms.values()) {
  room.sort((left, right) => Number(isMale(right.prefix)) - Number(isMale(left.prefix)) || left.sourceNumber - right.sourceNumber || left.firstName.localeCompare(right.firstName, "th"));
  room.forEach((student, index) => { student.number = index + 1; });
}

const backups = resolve(root, ".wrangler/backups");
await mkdir(backups, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = resolve(backups, `${basename(databaseFile, ".sqlite")}-before-students-${stamp}.sqlite`);
await copyFile(databaseFile, backupFile);

const db = new DatabaseSync(databaseFile);
db.exec("PRAGMA foreign_keys=ON");
const columns = db.prepare("PRAGMA table_info(students)").all().map((item) => item.name);
if (!columns.includes("student_card_number")) db.exec("ALTER TABLE students ADD COLUMN student_card_number TEXT");
if (!columns.includes("identity_number_hash")) db.exec("ALTER TABLE students ADD COLUMN identity_number_hash TEXT");
db.exec("BEGIN IMMEDIATE");
try {
  const demoCases = "SELECT id FROM cases WHERE id LIKE 'demo-case-%'";
  db.prepare(`DELETE FROM case_attachments WHERE case_id IN (${demoCases})`).run();
  db.prepare(`DELETE FROM director_actions WHERE case_id IN (${demoCases})`).run();
  db.prepare(`DELETE FROM case_handoffs WHERE case_id IN (${demoCases})`).run();
  db.prepare(`DELETE FROM case_notes WHERE case_id IN (${demoCases})`).run();
  db.prepare(`DELETE FROM case_timeline WHERE case_id IN (${demoCases})`).run();
  db.prepare("DELETE FROM audit_logs WHERE resource_id LIKE 'demo-case-%' OR resource_id LIKE 'demo-stu-%'").run();
  db.prepare("DELETE FROM cases WHERE id LIKE 'demo-case-%'").run();
  db.prepare("UPDATE students SET is_active=0,updated_at=CURRENT_TIMESTAMP").run();
  const upsert = db.prepare(`INSERT INTO students
    (id,student_code,student_card_number,identity_number_hash,prefix,first_name,last_name,level,classroom,number,advisor1,advisor2,is_active,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(student_code) DO UPDATE SET student_card_number=excluded.student_card_number,prefix=excluded.prefix,
    first_name=excluded.first_name,last_name=excluded.last_name,level=excluded.level,classroom=excluded.classroom,
    number=excluded.number,advisor1=excluded.advisor1,advisor2=NULL,identity_number_hash=COALESCE(excluded.identity_number_hash,students.identity_number_hash),is_active=1,updated_at=CURRENT_TIMESTAMP`);
  for (const student of students) {
    upsert.run(student.id, student.studentCode, student.studentCardNumber, student.identityNumberHash, student.prefix, student.firstName, student.lastName, student.level, student.classroom, student.number, "เชื่อมตามห้องอัตโนมัติ");
  }
  db.prepare("DELETE FROM students WHERE is_active=0 AND id NOT IN (SELECT DISTINCT student_id FROM cases)").run();
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  db.close();
  throw error;
}

const result = {
  activeStudents: db.prepare("SELECT COUNT(*) total FROM students WHERE is_active=1").get().total,
  rooms: db.prepare("SELECT COUNT(*) total FROM (SELECT level,classroom FROM students WHERE is_active=1 GROUP BY level,classroom)").get().total,
  withCard: db.prepare("SELECT COUNT(*) total FROM students WHERE is_active=1 AND student_card_number IS NOT NULL").get().total,
  withIdentity: db.prepare("SELECT COUNT(*) total FROM students WHERE is_active=1 AND identity_number_hash IS NOT NULL").get().total,
  historicalStudents: db.prepare("SELECT COUNT(*) total FROM students WHERE is_active=0").get().total,
};
db.close();
console.log("นำเข้ารายชื่อนักเรียนเรียบร้อย", result);
console.log("สำรองฐานข้อมูลเดิมไว้ที่", backupFile);
