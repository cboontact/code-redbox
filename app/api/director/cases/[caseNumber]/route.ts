import { z } from "zod";
import { createId, ensureDatabase } from "../../../../../db/bootstrap";
import { jsonError, requireDirector } from "../../../../../lib/security";
import { attachAdvisorData, loadRoomAdvisors } from "../../../../../lib/student-advisors";
import { humanizeTimelineDescription } from "../../../../../lib/case-timeline";

const actionSchema = z.object({
  action: z.enum(["ACKNOWLEDGED", "ORDER", "RETURN_TO_ADMIN", "RESOLVE"]),
  message: z.string().trim().max(2000).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    await requireDirector(request);
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const item = await db.prepare(
      `SELECT c.id,c.case_number,c.student_id,c.category_id,c.title,c.description,c.location,
       c.people_involved,c.requested_help,c.safety_level,c.is_anonymous,c.requires_immediate_review,
       c.severity,c.status,c.assigned_to,c.created_at,c.updated_at,cc.name category_name,
       CASE WHEN c.is_anonymous=1 THEN 'ปกปิดตัวตน'
       ELSE s.prefix||s.first_name||' '||s.last_name END reporter_name,
       s.student_code,s.prefix,s.first_name,s.last_name,s.level,s.classroom,
       s.advisor1 legacy_advisor1,s.advisor2 legacy_advisor2
       FROM cases c JOIN case_categories cc ON cc.id=c.category_id
       JOIN students s ON s.id=c.student_id
       WHERE c.case_number=? AND c.status='DIRECTOR_REVIEW'`,
    ).bind(caseNumber).first();
    if (!item) return jsonError("ไม่พบเคสที่เสนอถึงผู้อำนวยการ", 404);
    const caseWithAdvisors = attachAdvisorData(
      item as Record<string, unknown>,
      await loadRoomAdvisors(db, String(item.level), String(item.classroom)),
    );
    const timeline = await db.prepare("SELECT * FROM case_timeline WHERE case_id=? ORDER BY created_at DESC").bind(item.id).all();
    const actions = await db.prepare("SELECT * FROM director_actions WHERE case_id=? ORDER BY created_at DESC").bind(item.id).all();
    const attachments = await db.prepare("SELECT id,original_name,storage_key,mime_type,file_size,created_at FROM case_attachments WHERE case_id=? ORDER BY created_at DESC").bind(item.id).all();
    const readableTimeline = timeline.results.map((entry) => ({
      ...entry,
      description: humanizeTimelineDescription((entry as Record<string, unknown>).description),
    }));
    return Response.json({ case: caseWithAdvisors, timeline: readableTimeline, actions: actions.results, attachments: attachments.results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดรายละเอียดเคสได้", 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    const director = await requireDirector(request);
    const input = actionSchema.safeParse(await request.json());
    if (!input.success) return jsonError("ข้อมูลคำสั่งไม่ถูกต้อง");
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const item = await db.prepare("SELECT id FROM cases WHERE case_number=? AND status='DIRECTOR_REVIEW'").bind(caseNumber).first<{ id: string }>();
    if (!item) return jsonError("ไม่พบเคสที่เสนอถึงผู้อำนวยการ", 404);
    const nextStatus = input.data.action === "RETURN_TO_ADMIN" ? "ADMIN_REVIEW" : input.data.action === "RESOLVE" ? "PENDING_CLOSE" : input.data.action === "ORDER" ? "DIRECTOR_ORDERED" : "DIRECTOR_REVIEW";
    const title = input.data.action === "ACKNOWLEDGED" ? "ผู้อำนวยการรับทราบ" : input.data.action === "ORDER" ? "ผู้อำนวยการสั่งการ" : input.data.action === "RETURN_TO_ADMIN" ? "ผู้อำนวยการส่งกลับให้คัดกรอง" : "ผู้อำนวยการให้ปิดการดำเนินการ";
    await db.batch([
      db.prepare("INSERT INTO director_actions (id,case_id,director_id,action,message) VALUES (?,?,?,?,?)").bind(createId("director"), item.id, director, input.data.action, input.data.message || null),
      db.prepare("INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)").bind(createId("timeline"), item.id, `DIRECTOR_${input.data.action}`, title, input.data.message || null, director),
      ...(nextStatus !== "DIRECTOR_REVIEW" ? [db.prepare("INSERT INTO case_handoffs (id,case_id,from_status,to_status,from_username,to_username,reason) VALUES (?,?,?,?,?,?,?)").bind(createId("handoff"), item.id, "DIRECTOR_REVIEW", nextStatus, director, null, input.data.message || "ไม่ได้ระบุรายละเอียด")] : []),
      db.prepare("UPDATE cases SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(nextStatus, item.id),
      ...(nextStatus !== "DIRECTOR_REVIEW" ? [db.prepare("UPDATE case_notes SET is_editable=0 WHERE case_id=? AND is_editable=1").bind(item.id)] : []),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)").bind(createId("audit"), `DIRECTOR_${input.data.action}`, "case", item.id, director, input.data.message || null),
    ]);
    return Response.json({ success: true, status: nextStatus });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถบันทึกคำสั่งได้", 500);
  }
}
