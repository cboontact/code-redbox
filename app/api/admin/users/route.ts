import { z } from "zod";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { requireAdmin } from "../../../../lib/admin-auth";
import { hashPassword } from "../../../../lib/password";
import { jsonError } from "../../../../lib/security";

const roleSchema = z.enum(["SUPER_ADMIN", "INTAKE", "CASE_OFFICER", "ADVISOR", "DIRECTOR"]);
const createSchema = z.object({
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(3).max(200),
  displayName: z.string().trim().min(2).max(120),
  role: roleSchema,
  advisorId: z.string().trim().min(1).nullable().optional(),
}).superRefine((value, context) => {
  if (value.role !== "ADVISOR" && value.password.length < 8) {
    context.addIssue({ code: "custom", path: ["password"], message: "รหัสผ่านเจ้าหน้าที่ต้องมีอย่างน้อย 8 ตัวอักษร" });
  }
});

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = await ensureDatabase();
    const { results } = await db.prepare(`SELECT su.id,su.username,su.display_name,su.role,su.advisor_id,su.is_active,
      su.created_by,su.created_at,su.updated_at,
      CASE WHEN a.id IS NULL THEN NULL ELSE a.prefix||a.first_name||' '||a.last_name END advisor_name
      FROM staff_users su LEFT JOIN advisors a ON a.id=su.advisor_id
      ORDER BY su.is_active DESC,su.role,su.display_name`).all();
    return Response.json({ users: results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดบัญชีผู้ใช้ได้", 500);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const input = createSchema.safeParse(await request.json());
    if (!input.success) return jsonError("กรุณาตรวจสอบชื่อผู้ใช้ รหัสผ่าน และบทบาท");
    const db = await ensureDatabase();
    const duplicate = await db.prepare("SELECT id FROM staff_users WHERE username=?").bind(input.data.username).first();
    if (duplicate) return jsonError("ชื่อผู้ใช้นี้มีอยู่แล้ว", 409);
    if (input.data.role === "ADVISOR") {
      if (!input.data.advisorId) return jsonError("กรุณาเลือกครูที่ปรึกษาที่ต้องการเชื่อมบัญชี");
      const advisor = await db.prepare("SELECT id FROM advisors WHERE id=? AND is_active=1").bind(input.data.advisorId).first();
      if (!advisor) return jsonError("ไม่พบข้อมูลครูที่ปรึกษา", 404);
      const linked = await db.prepare("SELECT id FROM staff_users WHERE advisor_id=?").bind(input.data.advisorId).first();
      if (linked) return jsonError("ครูที่ปรึกษาคนนี้มีบัญชีผู้ใช้งานแล้ว", 409);
    }
    const id = createId("staff");
    await db.batch([
      db.prepare("INSERT INTO staff_users (id,username,password_hash,display_name,role,advisor_id,must_change_password,created_by) VALUES (?,?,?,?,?,?,1,?)")
        .bind(id, input.data.username, await hashPassword(input.data.password), input.data.displayName, input.data.role, input.data.role === "ADVISOR" ? input.data.advisorId ?? null : null, actor),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)")
        .bind(createId("audit"), "CREATE_STAFF_USER", "staff_user", id, actor, JSON.stringify({ username: input.data.username, role: input.data.role })),
    ]);
    return Response.json({ success: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถสร้างบัญชีผู้ใช้ได้", 500);
  }
}
