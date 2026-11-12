import { z } from "zod";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { getAdminSession } from "../../../../lib/admin-auth";
import { hashPassword, verifyPassword } from "../../../../lib/password";
import { jsonError } from "../../../../lib/security";

const schema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(200) });

// Each step reports its own failure. The error text goes to the Worker logs (never the
// password), and the reply names the step so a teacher's report points at the cause.
function failed(step: string, message: string, error: unknown) {
  console.error("change-password failed", { step, name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error) });
  return jsonError(`${message} (รหัสอ้างอิง ${step})`, 500);
}

export async function POST(request: Request) {
  let session;
  try { session = await getAdminSession(request); }
  catch (error) { return failed("session", "ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ", error); }
  if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);
  if (session.username === "cboonta") return jsonError("บัญชีผู้ดูแลระบบสูงสุดใช้รหัสที่ระบบกำหนด", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("ข้อมูลที่ส่งมาไม่ถูกต้อง"); }
  const input = schema.safeParse(body);
  if (!input.success) return jsonError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
  if (input.data.currentPassword === input.data.newPassword) return jsonError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม");

  let db: D1Database;
  let user: { id: string; password_hash: string } | null;
  try {
    db = await ensureDatabase();
    user = await db.prepare("SELECT id,password_hash FROM staff_users WHERE id=? AND is_active=1").bind(session.userId).first<{ id: string; password_hash: string }>();
  } catch (error) { return failed("lookup", "โหลดข้อมูลบัญชีไม่สำเร็จ", error); }
  if (!user) return jsonError("ไม่พบบัญชีที่ใช้งานอยู่", 404);

  let currentOk: boolean;
  try { currentOk = await verifyPassword(input.data.currentPassword, user.password_hash); }
  catch (error) { return failed("verify", "ตรวจรหัสผ่านเดิมไม่สำเร็จ", error); }
  if (!currentOk) return jsonError("รหัสผ่านเดิมไม่ถูกต้อง", 401);

  let newHash: string;
  try { newHash = await hashPassword(input.data.newPassword); }
  catch (error) { return failed("hash", "สร้างรหัสผ่านใหม่ไม่สำเร็จ", error); }

  try {
    await db.batch([
      db.prepare("UPDATE staff_users SET password_hash=?,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(newHash, user.id),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)").bind(createId("audit"), "CHANGE_OWN_PASSWORD", "staff_user", user.id, session.username, null),
    ]);
  } catch (error) { return failed("save", "บันทึกรหัสผ่านใหม่ไม่สำเร็จ", error); }
  return Response.json({ success: true });
}
