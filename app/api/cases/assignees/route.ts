import { ensureDatabase } from "../../../../db/bootstrap";
import { requireCaseSession } from "../../../../lib/admin-auth";
import { jsonError } from "../../../../lib/security";

export async function GET(request: Request) {
  try {
    const session = await requireCaseSession(request);
    if (!["SUPER_ADMIN", "INTAKE"].includes(session.role)) return jsonError("ไม่มีสิทธิ์ดูรายชื่อผู้รับผิดชอบ", 403);
    const db = await ensureDatabase();
    const { results } = await db.prepare(`SELECT username,display_name
      FROM staff_users
      WHERE role='CASE_OFFICER' AND is_active=1
      ORDER BY display_name,username`).all();
    return Response.json({ assignees: results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดรายชื่อผู้รับผิดชอบได้", 500);
  }
}
