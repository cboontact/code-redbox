import { ensureDatabase } from "../../../../db/bootstrap";
import { requireCaseSession } from "../../../../lib/admin-auth";
import { jsonError } from "../../../../lib/security";

export async function GET(request: Request) {
  try {
    await requireCaseSession(request);
    const db = await ensureDatabase();
    const { results } = await db.prepare(`SELECT su.username,su.display_name,
      CASE WHEN EXISTS (SELECT 1 FROM staff_user_roles sur WHERE sur.user_id=su.id AND sur.role='ADVISOR') THEN 'ADVISOR' ELSE 'CASE_OFFICER' END role
      FROM staff_users su
      WHERE su.is_active=1 AND EXISTS (
        SELECT 1 FROM staff_user_roles sur WHERE sur.user_id=su.id AND sur.role IN ('CASE_OFFICER','ADVISOR')
      )
      ORDER BY CASE role WHEN 'ADVISOR' THEN 0 ELSE 1 END,su.display_name,su.username`).all();
    return Response.json({ assignees: results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดรายชื่อผู้รับผิดชอบได้", 500);
  }
}
