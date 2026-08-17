import { env } from "cloudflare:workers";

// Precomputed PBKDF2 hash for the immutable bootstrap credential. Computing it
// during every Worker cold start can exceed the Cloudflare CPU startup budget.
const DEFAULT_SUPER_ADMIN_HASH = "hmac-sha256$artye74+Mx6EZR5d8/CnOQ==$GZ+jIKpaaw3qtyyjM9xwBVILdTkCH4k1F0UuFK2ZecQ=";

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
  `CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL, role TEXT NOT NULL,
    advisor_id TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS advisors (
    id TEXT PRIMARY KEY, prefix TEXT NOT NULL, first_name TEXT NOT NULL,
    last_name TEXT NOT NULL, email TEXT, phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS advisor_assignments (
    id TEXT PRIMARY KEY, advisor_id TEXT NOT NULL REFERENCES advisors(id),
    level TEXT NOT NULL, classroom TEXT NOT NULL, slot INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(level,classroom,slot)
  )`,
  `CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY, case_number TEXT NOT NULL UNIQUE,
    student_id TEXT NOT NULL REFERENCES students(id),
    category_id TEXT NOT NULL REFERENCES case_categories(id),
    title TEXT NOT NULL, description TEXT NOT NULL, location TEXT,
    people_involved TEXT, requested_help TEXT NOT NULL, safety_level TEXT NOT NULL,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    requires_immediate_review INTEGER NOT NULL DEFAULT 0,
    tracking_password_hash TEXT,
    upload_token_hash TEXT, upload_token_expires_at TEXT,
    severity TEXT NOT NULL DEFAULT 'GENERAL', status TEXT NOT NULL DEFAULT 'NEW',
    assigned_to TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS case_sequences (
    year TEXT PRIMARY KEY, last_value INTEGER NOT NULL
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
  `CREATE TABLE IF NOT EXISTS case_handoffs (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
    from_status TEXT NOT NULL, to_status TEXT NOT NULL, from_username TEXT NOT NULL,
    to_username TEXT, reason TEXT NOT NULL, due_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS director_actions (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
    director_id TEXT NOT NULL, action TEXT NOT NULL, message TEXT,
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
  `CREATE INDEX IF NOT EXISTS idx_handoffs_case_created ON case_handoffs(case_id,created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_director_actions_case_created ON director_actions(case_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_advisor_assignments_advisor ON advisor_assignments(advisor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_staff_users_role_active ON staff_users(role,is_active)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS advisor_assignment_advisor_room_unique
   ON advisor_assignments(advisor_id,level,classroom)`,
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

let ready = false;

export async function ensureDatabase() {
  if (ready) return env.DB;
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
  const noteColumns = await env.DB.prepare("PRAGMA table_info(case_notes)").all<{ name: string }>();
  if (!noteColumns.results.some((column) => column.name === "is_editable")) {
    await env.DB.prepare("ALTER TABLE case_notes ADD COLUMN is_editable INTEGER NOT NULL DEFAULT 1").run();
  }
  const staffColumns = await env.DB.prepare("PRAGMA table_info(staff_users)").all<{ name: string }>();
  if (!staffColumns.results.some((column) => column.name === "advisor_id")) {
    await env.DB.prepare("ALTER TABLE staff_users ADD COLUMN advisor_id TEXT").run();
  }
  if (!staffColumns.results.some((column) => column.name === "must_change_password")) {
    await env.DB.prepare("ALTER TABLE staff_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0").run();
    await env.DB.prepare("UPDATE staff_users SET must_change_password=1 WHERE username<>'cboonta'").run();
  }
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_users_advisor_unique
    ON staff_users(advisor_id) WHERE advisor_id IS NOT NULL`).run();
  const advisorColumns = await env.DB.prepare("PRAGMA table_info(advisors)").all<{ name: string }>();
  if (!advisorColumns.results.some((column) => column.name === "source_username")) {
    await env.DB.prepare("ALTER TABLE advisors ADD COLUMN source_username TEXT").run();
  }
  if (!advisorColumns.results.some((column) => column.name === "special_role")) {
    await env.DB.prepare("ALTER TABLE advisors ADD COLUMN special_role TEXT").run();
  }
  const studentColumns = await env.DB.prepare("PRAGMA table_info(students)").all<{ name: string }>();
  if (!studentColumns.results.some((column) => column.name === "tracking_password_hash")) {
    await env.DB.prepare("ALTER TABLE students ADD COLUMN tracking_password_hash TEXT").run();
  }
  if (!studentColumns.results.some((column) => column.name === "student_card_number")) {
    await env.DB.prepare("ALTER TABLE students ADD COLUMN student_card_number TEXT").run();
  }
  const caseColumns = await env.DB.prepare("PRAGMA table_info(cases)").all<{ name: string }>();
  if (!caseColumns.results.some((column) => column.name === "upload_token_hash")) {
    await env.DB.prepare("ALTER TABLE cases ADD COLUMN upload_token_hash TEXT").run();
  }
  if (!caseColumns.results.some((column) => column.name === "upload_token_expires_at")) {
    await env.DB.prepare("ALTER TABLE cases ADD COLUMN upload_token_expires_at TEXT").run();
  }
  if (!caseColumns.results.some((column) => column.name === "tracking_password_hash")) {
    await env.DB.prepare("ALTER TABLE cases ADD COLUMN tracking_password_hash TEXT").run();
  }
  await env.DB.batch(
    categorySeeds.map((row) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO case_categories (id,name,icon,color,sort_order) VALUES (?,?,?,?,?)",
      ).bind(...row),
    ),
  );
  await env.DB.prepare(`INSERT INTO staff_users
    (id,username,password_hash,display_name,role,advisor_id,must_change_password,is_active,created_by)
    VALUES ('staff-super-admin','cboonta',?,'ผู้ดูแลระบบสูงสุด','SUPER_ADMIN',NULL,0,1,'system')
    ON CONFLICT(username) DO UPDATE SET
      display_name=excluded.display_name,role='SUPER_ADMIN',advisor_id=NULL,
      must_change_password=0,is_active=1,updated_at=CURRENT_TIMESTAMP`)
    .bind(DEFAULT_SUPER_ADMIN_HASH).run();
  ready = true;
  return env.DB;
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
