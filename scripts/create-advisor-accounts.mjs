import { DatabaseSync } from "node:sqlite";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const d1Directory = resolve(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const files = (await readdir(d1Directory)).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
let databaseFile = "";
for (const name of files) {
  const file = resolve(d1Directory, name);
  const candidate = new DatabaseSync(file);
  const found = candidate.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='staff_users'").get();
  candidate.close();
  if (found) { databaseFile = file; break; }
}
if (!databaseFile) throw new Error("ไม่พบฐานข้อมูลบนเครื่อง");

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 120_000 }, key, 256);
  return `pbkdf2$120000$${Buffer.from(salt).toString("base64")}$${Buffer.from(bits).toString("base64")}`;
}

const db = new DatabaseSync(databaseFile);
const staffColumns = db.prepare("PRAGMA table_info(staff_users)").all().map((item) => item.name);
if (!staffColumns.includes("must_change_password")) db.exec("ALTER TABLE staff_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
const advisors = db.prepare(`SELECT id,source_username,prefix||first_name||' '||last_name display_name
  FROM advisors WHERE is_active=1 ORDER BY source_username`).all();
if (advisors.some((item) => !item.source_username)) throw new Error("มีครูที่ปรึกษาที่ยังไม่มี Username");
if (new Set(advisors.map((item) => item.source_username)).size !== advisors.length) throw new Error("Username ครูซ้ำกัน");
const conflicts = db.prepare(`SELECT su.username,su.role FROM staff_users su
  JOIN advisors a ON a.source_username=su.username
  WHERE a.is_active=1 AND su.username<>'cboonta' AND (su.role<>'ADVISOR' OR su.advisor_id<>a.id)`).all();
if (conflicts.length) throw new Error(`Username ชนกับบัญชีเดิม: ${conflicts.map((item) => item.username).join(", ")}`);

const backups = resolve(root, ".wrangler/backups");
await mkdir(backups, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = resolve(backups, `${basename(databaseFile, ".sqlite")}-before-advisor-accounts-${stamp}.sqlite`);
await copyFile(databaseFile, backupFile);

const insert = db.prepare(`INSERT INTO staff_users
  (id,username,password_hash,display_name,role,advisor_id,must_change_password,is_active,created_by,created_at,updated_at)
  VALUES (?,?,?,?, 'ADVISOR',?,1,1,'cboonta',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  ON CONFLICT(username) DO UPDATE SET display_name=excluded.display_name,
  role='ADVISOR',advisor_id=excluded.advisor_id,is_active=1,updated_at=CURRENT_TIMESTAMP`);
db.exec("BEGIN IMMEDIATE");
try {
  for (const advisor of advisors) {
    if (advisor.source_username === "cboonta") continue;
    insert.run(`staff-advisor-${advisor.source_username}`, advisor.source_username, await hashPassword(advisor.source_username), advisor.display_name, advisor.id);
  }
  db.prepare(`DELETE FROM staff_users WHERE role='ADVISOR'
    AND (advisor_id IS NULL OR advisor_id NOT IN (SELECT id FROM advisors WHERE is_active=1))`).run();
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  db.close();
  throw error;
}

const result = {
  teachers: advisors.length,
  advisorAccounts: db.prepare("SELECT COUNT(*) total FROM staff_users WHERE role='ADVISOR' AND is_active=1").get().total,
  superAdminTeacher: advisors.some((item) => item.source_username === "cboonta") ? 1 : 0,
  unlinkedAdvisorAccounts: db.prepare("SELECT COUNT(*) total FROM staff_users WHERE role='ADVISOR' AND advisor_id IS NULL").get().total,
};
db.close();
console.log("สร้างบัญชีครูที่ปรึกษาเรียบร้อย", result);
console.log("สำรองฐานข้อมูลเดิมไว้ที่", backupFile);
