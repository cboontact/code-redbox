import { ensureDatabase } from "../../../../db/bootstrap";
import { jsonError, requireDirector } from "../../../../lib/security";

export async function GET(request: Request) {
  try {
    await requireDirector(request);
    const db = await ensureDatabase();
    const { results } = await db.prepare(
      `SELECT c.id,c.case_number,c.student_id,c.category_id,c.title,c.description,c.location,
       c.people_involved,c.requested_help,c.safety_level,c.is_anonymous,c.requires_immediate_review,
       c.severity,c.status,c.assigned_to,c.created_at,c.updated_at,cc.name category_name,
       CASE WHEN c.is_anonymous=1 THEN 'ปกปิดตัวตน'
       ELSE s.prefix||s.first_name||' '||s.last_name END reporter_name,
       s.level,s.classroom
       FROM cases c JOIN case_categories cc ON cc.id=c.category_id
       JOIN students s ON s.id=c.student_id
       WHERE c.status='DIRECTOR_REVIEW'
       ORDER BY CASE c.severity WHEN 'CRITICAL' THEN 1 WHEN 'SERIOUS' THEN 2 ELSE 3 END,c.created_at DESC`,
    ).all();
    return Response.json({ cases: results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดเคสสำหรับผู้อำนวยการได้", 500);
  }
}
