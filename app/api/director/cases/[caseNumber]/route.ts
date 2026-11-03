import { z } from "zod";
import { createId, ensureDatabase } from "../../../../../db/bootstrap";
import { getAdminSession, sessionCanViewStudentIdentity, sessionHasAnyRole, sessionHasRole } from "../../../../../lib/admin-auth";
import { jsonError } from "../../../../../lib/security";
import { attachAdvisorData, loadRoomAdvisors } from "../../../../../lib/student-advisors";
import { humanizeTimelineEntry } from "../../../../../lib/case-timeline";

const actionSchema = z.object({
  action: z.enum(["CLOSE", "SEND_DIRECTOR", "SEND_AFFAIRS", "RETURN_DEPUTY"]),
  message: z.string().trim().max(2000).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    const session = await getAdminSession(request);
    if (!session || !sessionHasAnyRole(session, ["SUPER_ADMIN", "DEPUTY_DIRECTOR", "DIRECTOR"])) return jsonError("ไม่มีสิทธิ์เข้าถึง", 401);
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const statuses = sessionHasRole(session, "SUPER_ADMIN")
      ? ["DEPUTY_REVIEW", "DIRECTOR_REVIEW"]
      : [sessionHasRole(session, "DEPUTY_DIRECTOR") ? "DEPUTY_REVIEW" : null, sessionHasRole(session, "DIRECTOR") ? "DIRECTOR_REVIEW" : null].filter((value): value is string => Boolean(value));
    const placeholders = statuses.map(() => "?").join(",");
    const row = await db.prepare(`SELECT c.id,c.case_number,c.student_id,c.category_id,c.title,c.description,c.location,
      c.people_involved,c.requested_help,c.safety_level,c.is_anonymous,c.requires_immediate_review,
      c.severity,c.status,c.assigned_to,c.created_at,c.updated_at,
      cc.name category_name,s.prefix,s.first_name,s.last_name,s.student_code,s.level,s.classroom,s.number
      FROM cases c JOIN case_categories cc ON cc.id=c.category_id JOIN students s ON s.id=c.student_id
      WHERE c.case_number=? AND c.status IN (${placeholders})`).bind(caseNumber, ...statuses).first<Record<string, unknown>>();
    if (!row) return jsonError("ไม่พบเคสในคิวฝ่ายบริหาร", 404);
    const item = attachAdvisorData(row, await loadRoomAdvisors(db, String(row.level), String(row.classroom))) as Record<string, unknown>;
    if (Number(row.is_anonymous) === 1 && !sessionCanViewStudentIdentity(session)) {
      item.prefix = ""; item.first_name = "ปกปิดตัวตน"; item.last_name = ""; item.student_code = null; item.reporter_name = "ปกปิดตัวตน";
    } else {
      item.reporter_name = `${String(row.prefix ?? "")}${String(row.first_name ?? "")} ${String(row.last_name ?? "")}`.trim();
    }
    const [timeline, attachments, assignments] = await Promise.all([
      db.prepare("SELECT * FROM case_timeline WHERE case_id=? ORDER BY created_at DESC").bind(String(row.id)).all(),
      db.prepare("SELECT id,original_name,storage_key,mime_type,file_size,created_at FROM case_attachments WHERE case_id=? ORDER BY created_at DESC").bind(String(row.id)).all(),
      db.prepare("SELECT ca.id,ca.username,ca.assignment_role,ca.status,ca.completed_at,ca.created_at,su.display_name FROM case_assignments ca JOIN staff_users su ON su.id=ca.user_id WHERE ca.case_id=? ORDER BY CASE ca.assignment_role WHEN 'LEAD' THEN 0 ELSE 1 END,su.display_name").bind(String(row.id)).all(),
    ]);
    return Response.json({ case: item, timeline: timeline.results.map((entry) => humanizeTimelineEntry(entry as Record<string, unknown>)), attachments: attachments.results, assignments: assignments.results, role: session.role });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดรายละเอียดเคสได้", 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    const session = await getAdminSession(request);
    if (!session || !sessionHasAnyRole(session, ["SUPER_ADMIN", "DEPUTY_DIRECTOR", "DIRECTOR"])) return jsonError("ไม่มีสิทธิ์เข้าถึง", 401);
    const input = actionSchema.safeParse(await request.json());
    if (!input.success) return jsonError("คำสั่งไม่ถูกต้อง");
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const item = await db.prepare("SELECT id,status FROM cases WHERE case_number=?").bind(caseNumber).first<{ id: string; status: string }>();
    if (!item || !["DEPUTY_REVIEW", "DIRECTOR_REVIEW"].includes(item.status)) return jsonError("ไม่พบเคสในคิวฝ่ายบริหาร", 404);
    const isSuper = sessionHasRole(session, "SUPER_ADMIN");
    if (!isSuper && item.status === "DEPUTY_REVIEW" && !sessionHasRole(session, "DEPUTY_DIRECTOR")) return jsonError("เฉพาะรองผู้อำนวยการที่พิจารณาขั้นนี้ได้", 403);
    if (!isSuper && item.status === "DIRECTOR_REVIEW" && !sessionHasRole(session, "DIRECTOR")) return jsonError("เฉพาะผู้อำนวยการที่พิจารณาขั้นนี้ได้", 403);

    const allowed = item.status === "DEPUTY_REVIEW" ? ["CLOSE", "SEND_DIRECTOR", "SEND_AFFAIRS"] : ["CLOSE", "RETURN_DEPUTY", "SEND_AFFAIRS"];
    if (!allowed.includes(input.data.action)) return jsonError("คำสั่งนี้ไม่ตรงกับขั้นตอนปัจจุบัน", 409);
    const nextStatus = input.data.action === "CLOSE" ? "CLOSED" : input.data.action === "SEND_DIRECTOR" ? "DIRECTOR_REVIEW" : input.data.action === "RETURN_DEPUTY" ? "DEPUTY_REVIEW" : "AFFAIRS_REVIEW";
    const titles: Record<string, string> = { CLOSE: "ฝ่ายบริหารปิดเคส", SEND_DIRECTOR: "รองผู้อำนวยการส่งต่อผู้อำนวยการ", SEND_AFFAIRS: "ฝ่ายบริหารส่งทีมกิจการนักเรียนดำเนินการ", RETURN_DEPUTY: "ผู้อำนวยการส่งกลับรองผู้อำนวยการ" };
    await db.batch([
      db.prepare("UPDATE cases SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(nextStatus, item.id),
      db.prepare("UPDATE case_notes SET is_editable=0 WHERE case_id=? AND is_editable=1").bind(item.id),
      db.prepare("INSERT INTO director_actions (id,case_id,director_id,action,message) VALUES (?,?,?,?,?)").bind(createId("director"), item.id, session.username, input.data.action, input.data.message || null),
      db.prepare("INSERT INTO case_handoffs (id,case_id,from_status,to_status,from_username,to_username,reason) VALUES (?,?,?,?,?,?,?)").bind(createId("handoff"), item.id, item.status, nextStatus, session.username, null, input.data.message || "ไม่ได้ระบุรายละเอียด"),
      db.prepare("INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)").bind(createId("timeline"), item.id, `EXECUTIVE_${input.data.action}`, titles[input.data.action], input.data.message || null, session.username),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)").bind(createId("audit"), `EXECUTIVE_${input.data.action}`, "case", item.id, session.username, input.data.message || null),
    ]);
    return Response.json({ success: true, status: nextStatus });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถบันทึกคำสั่งฝ่ายบริหารได้", 500);
  }
}
