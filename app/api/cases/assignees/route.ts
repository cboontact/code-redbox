import { ensureDatabase } from "../../../../db/bootstrap";
import { requireCaseSession } from "../../../../lib/admin-auth";
import { jsonError } from "../../../../lib/security";

export async function GET(request: Request) {
  try {
    await requireCaseSession(request);
    const db = await ensureDatabase();
    const { results } = await db.prepare(`SELECT su.username,su.display_name,
      CASE
        WHEN EXISTS (SELECT 1 FROM staff_user_roles sur WHERE sur.user_id=su.id AND sur.role='LEVEL_HEAD') THEN 'LEVEL_HEAD'
        WHEN EXISTS (SELECT 1 FROM staff_user_roles sur WHERE sur.user_id=su.id AND sur.role='STUDENT_AFFAIRS') THEN 'STUDENT_AFFAIRS'
        WHEN EXISTS (SELECT 1 FROM staff_user_roles sur WHERE sur.user_id=su.id AND sur.role='SUPER_ADMIN') THEN 'SUPER_ADMIN'
        WHEN su.advisor_id IS NOT NULL THEN 'ADVISOR'
        ELSE 'STAFF' END role
      FROM staff_users su
      WHERE su.is_active=1
      ORDER BY CASE role WHEN 'LEVEL_HEAD' THEN 0 WHEN 'STUDENT_AFFAIRS' THEN 1 WHEN 'ADVISOR' THEN 2 WHEN 'STAFF' THEN 3 WHEN 'SUPER_ADMIN' THEN 4 ELSE 5 END,su.display_name,su.username`).all();
    return Response.json({ assignees: results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดรายชื่อผู้รับผิดชอบได้", 500);
  }
}
