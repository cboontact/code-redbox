import { z } from "zod";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { jsonError, requireAdmin } from "../../../../lib/security";
import { hashStudentIdentity } from "../../../../lib/password";
import { isValidStudentIdentity, normalizeStudentIdentity } from "../../../../lib/student-identity";

const studentSchema = z.object({
  studentCode: z.string().trim().regex(/^\d{4,10}$/),
  prefix: z.enum(["เด็กชาย", "เด็กหญิง", "นาย", "นางสาว"]),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  level: z.enum(["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"]),
  classroom: z.string().trim().regex(/^\d{1,2}$/),
  isActive: z.boolean().optional(),
  identityNumber: z.string().transform(normalizeStudentIdentity).refine(isValidStudentIdentity).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const input = studentSchema.safeParse(await request.json());
    if (!input.success) return jsonError("กรุณากรอกข้อมูลนักเรียนให้ครบถ้วน");
    const db = await ensureDatabase();
    const { id } = await context.params;
    const existing = await db.prepare("SELECT level,classroom,number,is_active FROM students WHERE id=?").bind(id).first<{ level: string; classroom: string; number: number; is_active: number }>();
    if (!existing) return jsonError("ไม่พบนักเรียน", 404);
    let number = existing.number;
    if (existing.level !== input.data.level || existing.classroom !== input.data.classroom) {
      const last = await db.prepare("SELECT COALESCE(MAX(number),0) number FROM students WHERE level=? AND classroom=?").bind(input.data.level, input.data.classroom).first<{ number: number }>();
      number = Number(last?.number ?? 0) + 1;
    }
    const identityHash = input.data.identityNumber ? await hashStudentIdentity(input.data.identityNumber) : null;
    await db.batch([
      db.prepare(`UPDATE students SET student_code=?,prefix=?,first_name=?,last_name=?,level=?,classroom=?,number=?,is_active=?,identity_number_hash=COALESCE(?,identity_number_hash),updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(input.data.studentCode, input.data.prefix, input.data.firstName, input.data.lastName, input.data.level, input.data.classroom, number, input.data.isActive === undefined ? existing.is_active : (input.data.isActive ? 1 : 0), identityHash, id),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)")
        .bind(createId("audit"), "UPDATE_STUDENT", "student", id, actor, JSON.stringify({ ...input.data, identityNumber: input.data.identityNumber ? "[REDACTED]" : undefined })),
    ]);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) return jsonError("รหัสนักเรียนนี้มีอยู่ในระบบแล้ว", 409);
    return jsonError("ไม่สามารถแก้ไขข้อมูลนักเรียนได้", 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const db = await ensureDatabase();
    const { id } = await context.params;
    const existing = await db.prepare("SELECT id FROM students WHERE id=?").bind(id).first<{ id: string }>();
    if (!existing) return jsonError("ไม่พบนักเรียน", 404);
    await db.batch([
      db.prepare("UPDATE students SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)")
        .bind(createId("audit"), "DEACTIVATE_STUDENT", "student", id, actor, null),
    ]);
    return Response.json({ success: true, isActive: false });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถเปลี่ยนสถานะนักเรียนได้", 500);
  }
}
