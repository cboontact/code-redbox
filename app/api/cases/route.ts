import { z } from "zod";
import { createId, ensureDatabase } from "../../../db/bootstrap";
import { jsonError, requireCaseSession } from "../../../lib/security";
import { hashTrackingPassword, verifyStudentIdentity } from "../../../lib/password";
import { isValidStudentIdentity, normalizeStudentIdentity } from "../../../lib/student-identity";
import { createOpaqueToken, hashOpaqueToken } from "../../../lib/opaque-token";
import { sessionCanViewStudentIdentity, sessionHasAnyRole, sessionHasRole } from "../../../lib/admin-auth";
import { findExclusiveReviewerForRoom } from "../../../lib/exclusive-review";

const SAFE_CASE_COLUMNS = `c.id,c.case_number,c.student_id,c.category_id,c.title,c.description,
  c.location,c.people_involved,c.requested_help,c.safety_level,c.is_anonymous,
  c.requires_immediate_review,c.severity,c.status,c.assigned_to,c.exclusive_reviewer_username,c.created_at,c.updated_at`;

const STAFF_CASE_ORDER = `CASE
  WHEN c.status IN ('NEW','REOPENED','SCREENING','ASSIGNED','AFFAIRS_REVIEW','DEPUTY_REVIEW') THEN 0
  WHEN c.status IN ('IN_PROGRESS','INTAKE_REVIEW','ADMIN_REVIEW','DIRECTOR_REVIEW','DIRECTOR_ORDERED','PENDING_CLOSE') THEN 1
  WHEN c.status IN ('RESOLVED','CLOSED') THEN 2
  ELSE 1 END,
  CASE c.status
    WHEN 'NEW' THEN 0 WHEN 'REOPENED' THEN 1 WHEN 'AFFAIRS_REVIEW' THEN 2 WHEN 'DEPUTY_REVIEW' THEN 3
    WHEN 'IN_PROGRESS' THEN 4 WHEN 'INTAKE_REVIEW' THEN 5 WHEN 'ADMIN_REVIEW' THEN 5 WHEN 'DIRECTOR_REVIEW' THEN 6
    WHEN 'DIRECTOR_ORDERED' THEN 7 WHEN 'PENDING_CLOSE' THEN 8 WHEN 'RESOLVED' THEN 9
    WHEN 'CLOSED' THEN 10 ELSE 11 END,
  c.requires_immediate_review DESC,c.created_at DESC`;

const createSchema = z.object({
  studentId: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(5000),
  location: z.string().trim().max(200).optional().default(""),
  peopleInvolved: z.string().trim().max(500).optional().default(""),
  requestedHelp: z.string().min(1).max(200),
  safetyLevel: z.enum(["SAFE", "UNSURE", "UNSAFE"]),
  isAnonymous: z.boolean(),
  idempotencyKey: z.string().uuid(),
  identityNumber: z.string().transform(normalizeStudentIdentity).refine(isValidStudentIdentity).optional(),
  trackingPassword: z.string().regex(/^\d{6}$/).optional(),
});

function yearInBangkok() {
  return new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
}

export async function POST(request: Request) {
  try {
    const input = createSchema.safeParse(await request.json());
    if (!input.success) return jsonError("ตรวจข้อมูลที่จำเป็นให้ครบก่อนส่งเรื่องนะ");
    const db = await ensureDatabase();
    const studentAccess = await db.prepare("SELECT id,level,classroom,identity_number_hash FROM students WHERE id=? AND is_active=1").bind(input.data.studentId).first<{ id: string; level: string; classroom: string; identity_number_hash: string | null }>();
    if (!studentAccess) return jsonError("ไม่พบข้อมูลนักเรียน", 404);
    if (studentAccess.identity_number_hash && (!input.data.identityNumber || !await verifyStudentIdentity(input.data.identityNumber, studentAccess.identity_number_hash))) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return jsonError("เลขประจำตัวบุคคลไม่ตรงกับข้อมูลนักเรียน", 401);
    }
    if (!studentAccess.identity_number_hash && !input.data.trackingPassword) return jsonError("กรุณาตั้งรหัสติดตาม 6 หลักสำหรับเรื่องนี้");
    const category = await db.prepare("SELECT id FROM case_categories WHERE id=? AND is_active=1").bind(input.data.categoryId).first();
    if (!category) return jsonError("ไม่พบประเภทเรื่องที่เลือก กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง", 409);
    const duplicate = await db.prepare(
      "SELECT resource_id FROM audit_logs WHERE action='CREATE_CASE' AND metadata=? LIMIT 1",
    ).bind(input.data.idempotencyKey).first<{ resource_id: string }>();
    if (duplicate?.resource_id) {
      const existing = await db.prepare("SELECT case_number FROM cases WHERE id=?").bind(duplicate.resource_id).first();
      const uploadToken = createOpaqueToken();
      await db.prepare("UPDATE cases SET upload_token_hash=?,upload_token_expires_at=datetime('now','+30 minutes') WHERE id=?")
        .bind(await hashOpaqueToken(uploadToken), duplicate.resource_id).run();
      return Response.json({ caseNumber: existing?.case_number, uploadToken, duplicate: true });
    }

    const year = yearInBangkok();
    const sequence = await db.prepare(`INSERT INTO case_sequences (year,last_value)
      VALUES (?,(SELECT COALESCE(MAX(CAST(substr(case_number,9) AS INTEGER)),0)+1 FROM cases WHERE case_number LIKE ?))
      ON CONFLICT(year) DO UPDATE SET last_value=case_sequences.last_value+1
      RETURNING last_value`).bind(year, `RB-${year}-%`).first<{ last_value: number }>();
    if (!sequence?.last_value) return jsonError("ไม่สามารถออกหมายเลขเคสได้", 500);
    const caseNumber = `RB-${year}-${String(sequence.last_value).padStart(6, "0")}`;
    const id = createId("case");
    const uploadToken = createOpaqueToken();
    const legacyTrackingHash = studentAccess.identity_number_hash ? null : await hashTrackingPassword(input.data.trackingPassword!);
    const immediate = input.data.safetyLevel === "UNSAFE" ? 1 : 0;
    const exclusiveReviewer = await findExclusiveReviewerForRoom(db, studentAccess.level, studentAccess.classroom);
    const statements: D1PreparedStatement[] = [
      db.prepare(
        `INSERT INTO cases
        (id,case_number,student_id,category_id,title,description,location,people_involved,
         requested_help,safety_level,is_anonymous,requires_immediate_review,severity,status,exclusive_reviewer_username,tracking_password_hash,
         upload_token_hash,upload_token_expires_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','+30 minutes'))`,
      ).bind(
        id, caseNumber, input.data.studentId, input.data.categoryId, input.data.title,
        input.data.description, input.data.location, input.data.peopleInvolved,
        input.data.requestedHelp, input.data.safetyLevel, input.data.isAnonymous ? 1 : 0,
        immediate, immediate ? "MODERATE" : "WATCH", "NEW", exclusiveReviewer, legacyTrackingHash,
        await hashOpaqueToken(uploadToken),
      ),
      db.prepare(
        "INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)",
      ).bind(createId("timeline"), id, "CREATE_CASE", "นักเรียนส่งเรื่อง", "ระบบได้รับเรื่องเรียบร้อยแล้ว", "student"),
      db.prepare(
        "INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)",
      ).bind(createId("audit"), "CREATE_CASE", "case", id, "student", input.data.idempotencyKey),
    ];
    if (exclusiveReviewer) {
      statements.splice(2, 0, db.prepare(
        "INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)",
      ).bind(createId("timeline"), id, "EXCLUSIVE_ADVISOR_REVIEW", "ส่งให้ครูที่ปรึกษาเฉพาะพิจารณา", "เคสนี้รอครูที่ปรึกษาผู้รับผิดชอบพิจารณาก่อนเข้าสู่กระบวนการปกติ", "system"));
    }
    await db.batch(statements);
    return Response.json({ caseNumber, uploadToken }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Case list/create request failed", error);
    return jsonError("ส่งเรื่องไม่สำเร็จ ลองใหม่อีกครั้งนะ", 500);
  }
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const url = new URL(request.url);
    const session = await requireCaseSession(request);
    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");
    const search = url.searchParams.get("search")?.trim();
    const clauses: string[] = ["1=1"];
    const values: string[] = [];
    clauses.push("(c.exclusive_reviewer_username IS NULL OR c.status NOT IN ('NEW','REOPENED') OR c.exclusive_reviewer_username=?)");
    values.push(session.username);
    if (!sessionHasAnyRole(session, ["SUPER_ADMIN", "INTAKE"])) {
      const visibility: string[] = [];
      if (sessionHasRole(session, "STUDENT_AFFAIRS")) {
        visibility.push("c.status='AFFAIRS_REVIEW'");
      }
      visibility.push("c.assigned_to=?");
      values.push(session.username);
      visibility.push("EXISTS (SELECT 1 FROM case_assignments ca WHERE ca.case_id=c.id AND ca.username=?)");
      values.push(session.username);
      if (sessionHasRole(session, "ADVISOR") && session.advisorId) {
        visibility.push(`EXISTS (
          SELECT 1 FROM advisor_assignments aa
          WHERE aa.advisor_id=? AND aa.level=s.level AND aa.classroom=s.classroom
        )`);
        values.push(session.advisorId);
      }
      if (!visibility.length) return Response.json({ cases: [] });
      clauses.push(`(${visibility.join(" OR ")})`);
    }
    if (status) { clauses.push("c.status=?"); values.push(status); }
    if (severity) { clauses.push("c.severity=?"); values.push(severity); }
    if (search) { clauses.push("(c.case_number LIKE ? OR c.title LIKE ?)"); values.push(`%${search}%`, `%${search}%`); }
    const revealAnonymous = sessionCanViewStudentIdentity(session);
    const { results } = await db.prepare(
      `SELECT ${SAFE_CASE_COLUMNS},cc.name category_name,
       CASE WHEN c.is_anonymous=1 AND ${revealAnonymous ? "0" : "1"}=1 THEN 'ปกปิดตัวตน'
       ELSE s.prefix||s.first_name||' '||s.last_name END reporter_name,
       s.student_code,s.level,s.classroom
       FROM cases c JOIN case_categories cc ON cc.id=c.category_id
       JOIN students s ON s.id=c.student_id
       WHERE ${clauses.join(" AND ")} ORDER BY ${STAFF_CASE_ORDER} LIMIT 100`,
    ).bind(...values).all();
    return Response.json({ cases: results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดเคสได้", 500);
  }
}
