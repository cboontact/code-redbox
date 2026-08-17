import { DatabaseSync } from "node:sqlite";
import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

const csvPath = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !csvPath.endsWith(".csv")) {
  throw new Error("ระบุไฟล์ CSV: npm run db:import:advisors -- /path/to/file.csv");
}

const root = resolve(import.meta.dirname, "..");
const d1Directory = resolve(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const files = (await readdir(d1Directory)).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
let databaseFile = "";
for (const name of files) {
  const file = resolve(d1Directory, name);
  const candidate = new DatabaseSync(file);
  const found = candidate.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='advisors'").get();
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

function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function splitName(fullName) {
  const prefixAliases = [["ว่าที่ร้อยตรี", "ว่าที่ร้อยตรี"], ["ว่าที่ ร.ต.", "ว่าที่ร้อยตรี"], ["นางสาว", "นางสาว"], ["นาง", "นาง"], ["นาย", "นาย"]];
  const match = prefixAliases.find(([source]) => fullName.startsWith(source));
  if (!match) throw new Error(`ไม่รู้จักคำนำหน้า: ${fullName}`);
  const [sourcePrefix, prefix] = match;
  const names = clean(fullName.slice(sourcePrefix.length)).split(" ");
  if (names.length < 2) throw new Error(`ชื่อไม่ครบ: ${fullName}`);
  return { prefix, firstName: names.shift(), lastName: names.join(" ") };
}
function stableId(username) {
  return `advisor-real-${username.toLowerCase().replace(/[^a-z0-9._-]/g, "-")}`;
}

const source = (await readFile(csvPath, "utf8")).replace(/^\uFEFF/, "");
const [headers, ...rawRows] = parseCsv(source);
const required = ["ระดับชั้น", "ห้อง", "ชื่อ-นามสกุล", "Username", "เบอร์โทรศัพท์", "บทบาทพิเศษ"];
for (const column of required) if (!headers.includes(column)) throw new Error(`ไม่พบคอลัมน์ ${column}`);
const at = Object.fromEntries(headers.map((header, index) => [header, index]));
const people = new Map();
for (const row of rawRows) {
  const username = clean(row[at.Username]).toLowerCase();
  const fullName = clean(row[at["ชื่อ-นามสกุล"]]);
  const level = clean(row[at["ระดับชั้น"]]);
  const classroom = clean(row[at["ห้อง"]]);
  if (!username || !fullName || !level || !classroom) throw new Error(`ข้อมูลไม่ครบในแถว ${rawRows.indexOf(row) + 2}`);
  const name = splitName(fullName);
  const role = clean(row[at["บทบาทพิเศษ"]]);
  const record = people.get(username) ?? { id: stableId(username), username, ...name, phone: clean(row[at["เบอร์โทรศัพท์"]]), specialRole: role === "-" ? "" : role, rooms: [] };
  if (`${record.prefix}${record.firstName} ${record.lastName}` !== `${name.prefix}${name.firstName} ${name.lastName}`) throw new Error(`Username ซ้ำแต่ชื่อไม่ตรงกัน: ${username}`);
  record.rooms.push({ level, classroom });
  people.set(username, record);
}

const backups = resolve(root, ".wrangler/backups");
await mkdir(backups, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = resolve(backups, `${basename(databaseFile, ".sqlite")}-before-advisors-${stamp}.sqlite`);
await copyFile(databaseFile, backupFile);

const db = new DatabaseSync(databaseFile);
db.exec("PRAGMA foreign_keys=ON");
const columns = db.prepare("PRAGMA table_info(advisors)").all().map((item) => item.name);
if (!columns.includes("source_username")) db.exec("ALTER TABLE advisors ADD COLUMN source_username TEXT");
if (!columns.includes("special_role")) db.exec("ALTER TABLE advisors ADD COLUMN special_role TEXT");
db.exec("BEGIN IMMEDIATE");
try {
  const importedIds = [...people.values()].map((person) => person.id);
  db.prepare("DELETE FROM advisor_assignments").run();
  db.prepare("UPDATE advisors SET is_active=0,updated_at=CURRENT_TIMESTAMP").run();
  const upsert = db.prepare(`INSERT INTO advisors
    (id,prefix,first_name,last_name,email,phone,source_username,special_role,is_active,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET prefix=excluded.prefix,first_name=excluded.first_name,last_name=excluded.last_name,
    phone=excluded.phone,source_username=excluded.source_username,special_role=excluded.special_role,is_active=1,updated_at=CURRENT_TIMESTAMP`);
  const insertAssignment = db.prepare("INSERT INTO advisor_assignments (id,advisor_id,level,classroom,slot) VALUES (?,?,?,?,?)");
  const roomSlots = new Map();
  for (const person of people.values()) {
    upsert.run(person.id, person.prefix, person.firstName, person.lastName, "", person.phone, person.username, person.specialRole);
    for (const room of person.rooms) {
      const key = `${room.level}|${room.classroom}`;
      const slot = (roomSlots.get(key) ?? 0) + 1;
      roomSlots.set(key, slot);
      insertAssignment.run(`assign-real-${person.username}-${room.level.replace(".", "")}-${room.classroom}`, person.id, room.level, room.classroom, slot);
    }
  }
  if (importedIds.length) {
    db.prepare("UPDATE staff_users SET advisor_id=NULL WHERE advisor_id IS NOT NULL AND advisor_id NOT IN (SELECT id FROM advisors WHERE is_active=1)").run();
    db.prepare("DELETE FROM advisors WHERE is_active=0").run();
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  db.close();
  throw error;
}
const result = {
  advisors: db.prepare("SELECT COUNT(*) total FROM advisors WHERE is_active=1").get().total,
  assignments: db.prepare("SELECT COUNT(*) total FROM advisor_assignments").get().total,
  rooms: db.prepare("SELECT COUNT(*) total FROM (SELECT level,classroom FROM advisor_assignments GROUP BY level,classroom)").get().total,
  accountsCreated: 0,
};
db.close();
console.log("นำเข้าครูที่ปรึกษาเรียบร้อย", result);
console.log("สำรองฐานข้อมูลเดิมไว้ที่", backupFile);
