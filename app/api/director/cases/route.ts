import { ensureDatabase } from "../../../../db/bootstrap";
import { getAdminSession, sessionHasAnyRole, sessionHasRole } from "../../../../lib/admin-auth";
import { jsonError } from "../../../../lib/security";

export async function GET(request: Request) {
  try {
    const session = await getAdminSession(request);
    if (!session || !sessionHasAnyRole(session, ["SUPER_ADMIN", "DEPUTY_DIRECTOR", "DIRECTOR"])) return jsonError("ไม่มีสิทธิ์เข้าถึง", 401);
    const db = await ensureDatabase();
    const statuses = sessionHasRole(session, "SUPER_ADMIN")
      ? ["DEPUTY_REVIEW", "DIRECTOR_REVIEW"]
      : [sessionHasRole(session, "DEPUTY_DIRECTOR") ? "DEPUTY_REVIEW" : null, sessionHasRole(session, "DIRECTOR") ? "DIRECTOR_REVIEW" : null].filter((value): value is string => Boolean(value));
    const placeholders = statuses.map(() => "?").join(",");
    const { results } = await db.prepare(`SELECT c.id,c.case_number,c.title,c.description,c.severity,c.status,c.assigned_to,c.created_at,c.updated_at,
      cc.name category_name,s.prefix||s.first_name||' '||s.last_name reporter_name,s.level,s.classroom
      FROM cases c JOIN case_categories cc ON cc.id=c.category_id JOIN students s ON s.id=c.student_id
      WHERE c.status IN (${placeholders})
      ORDER BY CASE c.severity WHEN 'CRITICAL' THEN 1 WHEN 'SEVERE' THEN 2 WHEN 'MODERATE' THEN 3 ELSE 4 END,c.created_at DESC`).bind(...statuses).all();
    return Response.json({ cases: results, role: session.role, roles: session.roles });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดเคสฝ่ายบริหารได้", 500);
  }
}
