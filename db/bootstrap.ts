import { env } from "cloudflare:workers";

const statements = [
  `CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY, student_code TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL,
    first_name TEXT NOT NULL, last_name TEXT NOT NULL, level TEXT NOT NULL,
    classroom TEXT NOT NULL, number INTEGER NOT NULL, advisor1 TEXT NOT NULL,
    advisor2 TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS case_categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, icon TEXT NOT NULL,
    color TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY, case_number TEXT NOT NULL UNIQUE,
    student_id TEXT NOT NULL REFERENCES students(id),
    category_id TEXT NOT NULL REFERENCES case_categories(id),
    title TEXT NOT NULL, description TEXT NOT NULL, location TEXT,
    people_involved TEXT, requested_help TEXT NOT NULL, safety_level TEXT NOT NULL,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    requires_immediate_review INTEGER NOT NULL DEFAULT 0,
    severity TEXT NOT NULL DEFAULT 'GENERAL', status TEXT NOT NULL DEFAULT 'NEW',
    assigned_to TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS case_timeline (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
    action TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS case_notes (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
    note TEXT NOT NULL, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS case_attachments (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
    original_name TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL, file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, action TEXT NOT NULL, resource TEXT NOT NULL,
    resource_id TEXT, actor TEXT NOT NULL, metadata TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cases_status_created ON cases(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_cases_severity_created ON cases(severity, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_cases_student_created ON cases(student_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_timeline_case_created ON case_timeline(case_id, created_at DESC)`,
];

const categorySeeds = [
  ["bullying", "การกลั่นแกล้ง", "fa-user-shield", "cyan", 1],
  ["mental", "ความเครียด / สุขภาพใจ", "fa-heart", "green", 2],
  ["violence", "ความรุนแรง / คุกคาม", "fa-shield-halved", "red", 3],
  ["safety", "ความปลอดภัย", "fa-triangle-exclamation", "amber", 4],
  ["study", "การเรียน", "fa-book-open", "blue", 5],
  ["facility", "อาคาร / สถานที่", "fa-school", "orange", 6],
  ["suggestion", "ข้อเสนอแนะ", "fa-lightbulb", "green", 7],
  ["other", "อื่น ๆ", "fa-message", "slate", 8],
] as const;

const studentSeeds = [
  ["stu-12345", "12345", "นาย", "สมชาย", "ใจดี", "ม.2", "5", 12, "ครูอรทัย", "ครูสมศักดิ์"],
  ["stu-23456", "23456", "นางสาว", "พิมพ์ชนก", "แสงดาว", "ม.5", "2", 7, "ครูวราภรณ์", "ครูกิตติ"],
] as const;

let ready = false;

export async function ensureDatabase() {
  if (ready) return env.DB;
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
  await env.DB.batch(
    categorySeeds.map((row) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO case_categories (id,name,icon,color,sort_order) VALUES (?,?,?,?,?)",
      ).bind(...row),
    ),
  );
  await env.DB.batch(
    studentSeeds.map((row) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO students
        (id,student_code,prefix,first_name,last_name,level,classroom,number,advisor1,advisor2)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ).bind(...row),
    ),
  );
  ready = true;
  return env.DB;
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
