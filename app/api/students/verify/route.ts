import { z } from "zod";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { attachAdvisorData, loadRoomAdvisors } from "../../../../lib/student-advisors";

const inputSchema = z.object({ studentCode: z.string().trim().regex(/^\d{4,10}$/) });

export async function POST(request: Request) {
  try {
    const input = inputSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: "ใส่เลขประจำตัวนักเรียนให้ครบก่อนนะ" }, { status: 400 });
    }
    const db = await ensureDatabase();
    const studentRow = await db.prepare(
      `WITH ranked AS (
       SELECT s.*,ROW_NUMBER() OVER (
         PARTITION BY s.level,s.classroom
         ORDER BY CASE WHEN s.prefix IN ('นาย','เด็กชาย','ด.ช.') THEN 0 ELSE 1 END,
         s.number,s.first_name,s.last_name
       ) auto_number FROM students s WHERE s.is_active=1
       )
       SELECT s.id,s.student_code,s.prefix,s.first_name,s.last_name,s.level,s.classroom,
       s.auto_number number,s.advisor1 legacy_advisor1,s.advisor2 legacy_advisor2,
       CASE WHEN s.tracking_password_hash IS NULL THEN 0 ELSE 1 END has_tracking_password
       FROM ranked s
       WHERE s.student_code=?`,
    ).bind(input.data.studentCode).first<Record<string, unknown>>();
    await db.prepare(
      "INSERT INTO audit_logs (id,action,resource,resource_id,actor) VALUES (?,?,?,?,?)",
    ).bind(createId("audit"), "STUDENT_LOOKUP", "student", studentRow?.id ?? null, "student").run();
    if (!studentRow) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return Response.json({ error: "ยังไม่พบข้อมูลที่ตรงกัน ลองตรวจสอบเลขประจำตัวอีกครั้งนะ" }, { status: 404 });
    }
    const student = attachAdvisorData(
      studentRow,
      await loadRoomAdvisors(db, String(studentRow.level), String(studentRow.classroom)),
    );
    return Response.json({ student });
  } catch {
    return Response.json({ error: "ตรวจสอบข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งนะ" }, { status: 500 });
  }
}
