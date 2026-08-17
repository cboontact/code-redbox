import { z } from "zod";
import { createId, ensureDatabase } from "../../../../../db/bootstrap";
import { getAdminSession, requireAdmin } from "../../../../../lib/admin-auth";
import { hashPassword } from "../../../../../lib/password";
import { jsonError } from "../../../../../lib/security";

const updateSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["SUPER_ADMIN", "INTAKE", "CASE_OFFICER", "ADVISOR", "DIRECTOR"]).optional(),
  password: z.string().min(6).max(200).optional(),
  isActive: z.boolean().optional(),
  advisorId: z.string().trim().min(1).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const session = await getAdminSession(request);
    const input = updateSchema.safeParse(await request.json());
    if (!input.success || Object.keys(input.data).length === 0) return jsonError("ไม่มีข้อมูลสำหรับบันทึก");
    const db = await ensureDatabase();
    const { id } = await context.params;
    const current = await db.prepare("SELECT id,username,role,advisor_id,is_active FROM staff_users WHERE id=?").bind(id).first<{ id: string; username: string; role: string; advisor_id: string | null; is_active: number }>();
    if (!current) return jsonError("ไม่พบบัญชีผู้ใช้", 404);
    if (current.username === "cboonta") return jsonError("บัญชีผู้ดูแลระบบสูงสุดไม่สามารถแก้ไขหรือลดสิทธิ์ได้", 403);
    if (session?.userId === id && input.data.isActive === false) return jsonError("ไม่สามารถปิดบัญชีที่กำลังใช้งานอยู่", 409);
    const removesSuperAdmin = current.role === "SUPER_ADMIN" && (input.data.role && input.data.role !== "SUPER_ADMIN" || input.data.isActive === false);
    if (removesSuperAdmin) {
      const count = await db.prepare("SELECT COUNT(*) total FROM staff_users WHERE role='SUPER_ADMIN' AND is_active=1").first<{ total: number }>();
      if ((count?.total ?? 0) <= 1) return jsonError("ระบบต้องมีแอดมินระบบอย่างน้อย 1 บัญชี", 409);
    }
    const targetRole = input.data.role ?? current.role;
    const targetAdvisorId = targetRole === "ADVISOR" ? (input.data.advisorId !== undefined ? input.data.advisorId : current.advisor_id) : null;
    if (targetRole === "ADVISOR") {
      if (!targetAdvisorId) return jsonError("กรุณาเลือกครูที่ปรึกษาที่ต้องการเชื่อมบัญชี");
      const advisor = await db.prepare("SELECT id FROM advisors WHERE id=? AND is_active=1").bind(targetAdvisorId).first();
      if (!advisor) return jsonError("ไม่พบข้อมูลครูที่ปรึกษา", 404);
      const linked = await db.prepare("SELECT id FROM staff_users WHERE advisor_id=? AND id<>?").bind(targetAdvisorId, id).first();
      if (linked) return jsonError("ครูที่ปรึกษาคนนี้มีบัญชีผู้ใช้งานแล้ว", 409);
    }
    const updates: string[] = [];
    const values: Array<string | number | null> = [];
    if (input.data.displayName) { updates.push("display_name=?"); values.push(input.data.displayName); }
    if (input.data.role) { updates.push("role=?"); values.push(input.data.role); }
    if (input.data.isActive !== undefined) { updates.push("is_active=?"); values.push(input.data.isActive ? 1 : 0); }
    if (input.data.password) { updates.push("password_hash=?"); values.push(await hashPassword(input.data.password)); updates.push("must_change_password=1"); }
    if (input.data.advisorId !== undefined || input.data.role) { updates.push("advisor_id=?"); values.push(targetAdvisorId); }
    await db.batch([
      db.prepare(`UPDATE staff_users SET ${updates.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...values, id),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)")
        .bind(createId("audit"), input.data.password ? "RESET_STAFF_PASSWORD" : "UPDATE_STAFF_USER", "staff_user", id, actor, JSON.stringify({ ...input.data, password: input.data.password ? "[REDACTED]" : undefined })),
    ]);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) return jsonError("ครูที่ปรึกษาคนนี้มีบัญชีผู้ใช้งานแล้ว", 409);
    return jsonError("ไม่สามารถแก้ไขบัญชีผู้ใช้ได้", 500);
  }
}
