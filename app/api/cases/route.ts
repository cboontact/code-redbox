import { z } from "zod";
import { createId, ensureDatabase } from "../../../db/bootstrap";
import { jsonError, requireStaff } from "../../../lib/security";

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
});

function yearInBangkok() {
  return new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
}

export async function POST(request: Request) {
  try {
    const input = createSchema.safeParse(await request.json());
    if (!input.success) return jsonError("กรุณาตรวจสอบข้อมูลที่จำเป็น");
    const db = await ensureDatabase();
    const duplicate = await db.prepare(
      "SELECT resource_id FROM audit_logs WHERE action='CREATE_CASE' AND metadata=? LIMIT 1",
    ).bind(input.data.idempotencyKey).first<{ resource_id: string }>();
    if (duplicate?.resource_id) {
      const existing = await db.prepare("SELECT case_number FROM cases WHERE id=?").bind(duplicate.resource_id).first();
      return Response.json({ caseNumber: existing?.case_number, duplicate: true });
    }

    const total = await db.prepare("SELECT COUNT(*) total FROM cases WHERE strftime('%Y',created_at)=?")
      .bind(yearInBangkok()).first<{ total: number }>();
    const caseNumber = `RB-${yearInBangkok()}-${String((total?.total ?? 0) + 1).padStart(6, "0")}`;
    const id = createId("case");
    const immediate = input.data.safetyLevel === "UNSAFE" ? 1 : 0;
    await db.batch([
      db.prepare(
        `INSERT INTO cases
        (id,case_number,student_id,category_id,title,description,location,people_involved,
         requested_help,safety_level,is_anonymous,requires_immediate_review,severity,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        id, caseNumber, input.data.studentId, input.data.categoryId, input.data.title,
        input.data.description, input.data.location, input.data.peopleInvolved,
        input.data.requestedHelp, input.data.safetyLevel, input.data.isAnonymous ? 1 : 0,
        immediate, immediate ? "CONCERN" : "GENERAL", "NEW",
      ),
      db.prepare(
        "INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)",
      ).bind(createId("timeline"), id, "CREATE_CASE", "นักเรียนส่งเรื่อง", "ระบบได้รับเรื่องเรียบร้อยแล้ว", "student"),
      db.prepare(
        "INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)",
      ).bind(createId("audit"), "CREATE_CASE", "case", id, "student", input.data.idempotencyKey),
    ]);
    return Response.json({ caseNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถส่งเรื่องได้ กรุณาลองอีกครั้ง", 500);
  }
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const url = new URL(request.url);
    const trackCase = url.searchParams.get("caseNumber");
    const studentCode = url.searchParams.get("studentCode");
    if (trackCase && studentCode) {
      const item = await db.prepare(
        `SELECT c.case_number,c.title,c.status,c.created_at,cc.name category_name
         FROM cases c JOIN students s ON s.id=c.student_id
         JOIN case_categories cc ON cc.id=c.category_id
         WHERE c.case_number=? AND s.student_code=?`,
      ).bind(trackCase.toUpperCase(), studentCode).first();
      if (!item) return jsonError("ไม่พบข้อมูลที่ตรงกัน", 404);
      return Response.json({ case: item });
    }

    await requireStaff(request);
    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");
    const search = url.searchParams.get("search")?.trim();
    const clauses: string[] = ["1=1"];
    const values: string[] = [];
    if (status) { clauses.push("c.status=?"); values.push(status); }
    if (severity) { clauses.push("c.severity=?"); values.push(severity); }
    if (search) { clauses.push("(c.case_number LIKE ? OR c.title LIKE ?)"); values.push(`%${search}%`, `%${search}%`); }
    const { results } = await db.prepare(
      `SELECT c.*,cc.name category_name,
       CASE WHEN c.is_anonymous=1 THEN 'ปกปิดตัวตน'
       ELSE s.prefix||s.first_name||' '||s.last_name END reporter_name,
       s.student_code
       FROM cases c JOIN case_categories cc ON cc.id=c.category_id
       JOIN students s ON s.id=c.student_id
       WHERE ${clauses.join(" AND ")} ORDER BY c.requires_immediate_review DESC,c.created_at DESC LIMIT 100`,
    ).bind(...values).all();
    return Response.json({ cases: results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดเคสได้", 500);
  }
}
