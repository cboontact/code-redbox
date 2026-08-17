import { z } from "zod";
import { createId, ensureDatabase } from "../../../db/bootstrap";
import { advisorRoomKey, attachAdvisorData, loadAdvisorMap } from "../../../lib/student-advisors";
import { jsonError, requireAdmin } from "../../../lib/security";

const studentSchema = z.object({
  studentCode: z.string().trim().regex(/^\d{4,10}$/),
  prefix: z.enum(["เด็กชาย", "เด็กหญิง", "นาย", "นางสาว"]),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  level: z.enum(["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"]),
  classroom: z.string().trim().regex(/^\d{1,2}$/),
});

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const input = studentSchema.safeParse(await request.json());
    if (!input.success) return jsonError("กรุณากรอกข้อมูลนักเรียนให้ครบถ้วน");
    const db = await ensureDatabase();
    const last = await db.prepare("SELECT COALESCE(MAX(number),0) number FROM students WHERE level=? AND classroom=?").bind(input.data.level, input.data.classroom).first<{ number: number }>();
    const id = createId("student");
    await db.batch([
      db.prepare(`INSERT INTO students (id,student_code,prefix,first_name,last_name,level,classroom,number,advisor1,advisor2)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, input.data.studentCode, input.data.prefix, input.data.firstName, input.data.lastName, input.data.level, input.data.classroom, Number(last?.number ?? 0) + 1, "เชื่อมตามห้องอัตโนมัติ", null),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)")
        .bind(createId("audit"), "CREATE_STUDENT", "student", id, actor, JSON.stringify(input.data)),
    ]);
    return Response.json({ success: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) return jsonError("รหัสนักเรียนนี้มีอยู่ในระบบแล้ว", 409);
    return jsonError("ไม่สามารถเพิ่มนักเรียนได้", 500);
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = await ensureDatabase();
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const requestedPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = 50;
    const offset = (page - 1) * pageSize;
    const like = `%${search}%`;
    const totalRow = await db.prepare(
      `SELECT COUNT(*) total FROM students
       WHERE (?='' OR student_code LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`,
    ).bind(search, like, like, like).first<{ total: number }>();
    const total = Number(totalRow?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const safeOffset = (safePage - 1) * pageSize;
    const [studentRows, advisorMap] = await Promise.all([db.prepare(
      `WITH ranked AS (
       SELECT s.*,ROW_NUMBER() OVER (
         PARTITION BY s.level,s.classroom
         ORDER BY CASE WHEN s.prefix IN ('นาย','เด็กชาย','ด.ช.') THEN 0 ELSE 1 END,
         s.number,s.first_name,s.last_name
       ) auto_number FROM students s
       )
       SELECT s.id,s.student_code,s.prefix,s.first_name,s.last_name,s.level,s.classroom,
       s.auto_number number,s.advisor1 legacy_advisor1,s.advisor2 legacy_advisor2,
       s.is_active,COUNT(c.id) case_count
       FROM ranked s
       LEFT JOIN cases c ON c.student_id=s.id
       WHERE (?='' OR s.student_code LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)
       GROUP BY s.id ORDER BY s.level,s.classroom,s.auto_number LIMIT ? OFFSET ?`,
    ).bind(search, like, like, like, pageSize, safePage === page ? offset : safeOffset).all<Record<string, unknown>>(), loadAdvisorMap(db)]);
    const students = studentRows.results.map((student) => attachAdvisorData(
      student,
      advisorMap.get(advisorRoomKey(String(student.level), String(student.classroom))) ?? [],
    ));
    return Response.json({ students, total, page: safePage, pageSize, totalPages });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดรายชื่อนักเรียนได้", 500);
  }
}
