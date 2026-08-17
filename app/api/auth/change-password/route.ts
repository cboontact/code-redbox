import { z } from "zod";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { getAdminSession } from "../../../../lib/admin-auth";
import { hashPassword, verifyPassword } from "../../../../lib/password";
import { jsonError } from "../../../../lib/security";

const schema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(200) });

export async function POST(request: Request) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);
    if (session.username === "cboonta") return jsonError("บัญชีผู้ดูแลระบบสูงสุดใช้รหัสที่ระบบกำหนด", 403);
    const input = schema.safeParse(await request.json());
    if (!input.success) return jsonError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
    if (input.data.currentPassword === input.data.newPassword) return jsonError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม");
    const db = await ensureDatabase();
    const user = await db.prepare("SELECT id,password_hash FROM staff_users WHERE id=? AND is_active=1").bind(session.userId).first<{ id: string; password_hash: string }>();
    if (!user || !(await verifyPassword(input.data.currentPassword, user.password_hash))) return jsonError("รหัสผ่านเดิมไม่ถูกต้อง", 401);
    await db.batch([
      db.prepare("UPDATE staff_users SET password_hash=?,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(await hashPassword(input.data.newPassword), user.id),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)").bind(createId("audit"), "CHANGE_OWN_PASSWORD", "staff_user", user.id, session.username, null),
    ]);
    return Response.json({ success: true });
  } catch { return jsonError("ไม่สามารถเปลี่ยนรหัสผ่านได้", 500); }
}
