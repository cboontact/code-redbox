import { z } from "zod";
import { createId, ensureDatabase } from "../../../../../db/bootstrap";
import { getAdminSession, requireAdmin, type StaffRole } from "../../../../../lib/admin-auth";
import { hashPassword } from "../../../../../lib/password";
import { jsonError } from "../../../../../lib/security";

const roleSchema = z.enum(["SUPER_ADMIN", "INTAKE", "STUDENT_AFFAIRS", "LEVEL_HEAD", "TEACHER", "ADVISOR", "DEPUTY_DIRECTOR", "DIRECTOR"]);
const rolesSchema = z.array(roleSchema).min(1).max(8).refine((roles) => new Set(roles).size === roles.length);
const rolePriority: StaffRole[] = ["SUPER_ADMIN", "INTAKE", "STUDENT_AFFAIRS", "DEPUTY_DIRECTOR", "LEVEL_HEAD", "TEACHER", "ADVISOR", "DIRECTOR", "CASE_OFFICER"];

const updateSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  roles: rolesSchema.optional(),
  password: z.string().min(6).max(200).optional(),
  isActive: z.boolean().optional(),
  advisorId: z.string().trim().min(1).nullable().optional(),
});

function primaryRole(roles: StaffRole[]) {
  return rolePriority.find((role) => roles.includes(role)) ?? roles[0];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const session = await getAdminSession(request);
    const input = updateSchema.safeParse(await request.json());
    if (!input.success || Object.keys(input.data).length === 0) return jsonError("ไม่มีข้อมูลสำหรับบันทึก");
    const db = await ensureDatabase();
    const { id } = await context.params;
    const current = await db.prepare("SELECT id,username,role,advisor_id,is_active FROM staff_users WHERE id=?").bind(id).first<{ id: string; username: string; role: StaffRole; advisor_id: string | null; is_active: number }>();
    if (!current) return jsonError("ไม่พบบัญชีผู้ใช้", 404);
    if (current.username === "cboonta") return jsonError("บัญชีผู้ดูแลระบบสูงสุดไม่สามารถแก้ไขหรือลดสิทธิ์ได้", 403);
    if (session?.userId === id && input.data.isActive === false) return jsonError("ไม่สามารถปิดบัญชีที่กำลังใช้งานอยู่", 409);

    const currentRoleRows = await db.prepare("SELECT role FROM staff_user_roles WHERE user_id=?").bind(id).all<{ role: StaffRole }>();
    const currentRoles = currentRoleRows.results.length ? currentRoleRows.results.map((item) => item.role) : [current.role];
    const targetRoles = (input.data.roles ?? currentRoles) as StaffRole[];
    const removesSuperAdmin = currentRoles.includes("SUPER_ADMIN") && (!targetRoles.includes("SUPER_ADMIN") || input.data.isActive === false);
    if (removesSuperAdmin) {
      const count = await db.prepare(`SELECT COUNT(DISTINCT su.id) total FROM staff_users su
        JOIN staff_user_roles sur ON sur.user_id=su.id
        WHERE sur.role='SUPER_ADMIN' AND su.is_active=1`).first<{ total: number }>();
      if ((count?.total ?? 0) <= 1) return jsonError("ระบบต้องมีแอดมินระบบอย่างน้อย 1 บัญชี", 409);
    }

    const targetAdvisorId = targetRoles.includes("ADVISOR")
      ? (input.data.advisorId !== undefined ? input.data.advisorId : current.advisor_id)
      : null;
    if (targetRoles.includes("ADVISOR")) {
      if (!targetAdvisorId) return jsonError("กรุณาเลือกครูที่ปรึกษาที่ต้องการเชื่อมบัญชี");
      const advisor = await db.prepare("SELECT id FROM advisors WHERE id=? AND is_active=1").bind(targetAdvisorId).first();
      if (!advisor) return jsonError("ไม่พบข้อมูลครูที่ปรึกษา", 404);
      const linked = await db.prepare("SELECT id FROM staff_users WHERE advisor_id=? AND id<>?").bind(targetAdvisorId, id).first();
      if (linked) return jsonError("ครูที่ปรึกษาคนนี้มีบัญชีผู้ใช้งานแล้ว", 409);
    }

    const updates: string[] = [];
    const values: Array<string | number | null> = [];
    if (input.data.displayName) { updates.push("display_name=?"); values.push(input.data.displayName); }
    if (input.data.roles) { updates.push("role=?"); values.push(primaryRole(targetRoles)); }
    if (input.data.isActive !== undefined) { updates.push("is_active=?"); values.push(input.data.isActive ? 1 : 0); }
    if (input.data.password) { updates.push("password_hash=?"); values.push(await hashPassword(input.data.password)); updates.push("must_change_password=1"); }
    if (input.data.advisorId !== undefined || input.data.roles) { updates.push("advisor_id=?"); values.push(targetAdvisorId); }

    const statements: D1PreparedStatement[] = [];
    if (updates.length) statements.push(db.prepare(`UPDATE staff_users SET ${updates.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...values, id));
    if (input.data.roles) {
      statements.push(db.prepare("DELETE FROM staff_user_roles WHERE user_id=?").bind(id));
      statements.push(...targetRoles.map((role) => db.prepare("INSERT INTO staff_user_roles (user_id,role) VALUES (?,?)").bind(id, role)));
    }
    statements.push(db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)")
      .bind(createId("audit"), input.data.password ? "RESET_STAFF_PASSWORD" : "UPDATE_STAFF_USER", "staff_user", id, actor, JSON.stringify({ ...input.data, password: input.data.password ? "[REDACTED]" : undefined })));
    await db.batch(statements);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) return jsonError("ครูที่ปรึกษาคนนี้มีบัญชีผู้ใช้งานแล้ว", 409);
    return jsonError("ไม่สามารถแก้ไขบัญชีผู้ใช้ได้", 500);
  }
}
