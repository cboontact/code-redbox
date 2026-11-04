import { z } from "zod";
import { env } from "cloudflare:workers";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { jsonError, requireCaseSession } from "../../../../lib/security";
import { hashPassword } from "../../../../lib/password";
import { attachAdvisorData, loadRoomAdvisors } from "../../../../lib/student-advisors";
import { sessionCanViewStudentIdentity, sessionHasAnyRole, sessionHasRole } from "../../../../lib/admin-auth";
import { describeCaseUpdate, humanizeTimelineEntry, timelineTitleForUpdate } from "../../../../lib/case-timeline";
import { isExclusiveReviewPending } from "../../../../lib/exclusive-review";

const statuses = ["NEW", "AFFAIRS_REVIEW", "IN_PROGRESS", "INTAKE_REVIEW", "DEPUTY_REVIEW", "DIRECTOR_REVIEW", "CLOSED", "REOPENED", "SCREENING", "ASSIGNED", "ADMIN_REVIEW", "DIRECTOR_ORDERED", "PENDING_CLOSE", "RESOLVED"] as const;
const updateSchema = z.object({
  status: z.enum(statuses).optional(),
  severity: z.enum(["WATCH", "MODERATE", "SEVERE", "CRITICAL"]).optional(),
  assignedTo: z.string().trim().min(1).max(120).optional(),
  assignees: z.array(z.string().trim().min(1).max(120)).min(1).max(20).optional(),
  leadAssignee: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().min(2).max(2000).optional(),
  noteId: z.string().trim().min(1).max(120).optional(),
  handoffReason: z.string().trim().max(1000).optional(),
  dueDate: z.string().date().optional(),
  resetTrackingPassword: z.string().regex(/^\d{6}$/).optional(),
});

type CaseItem = { id: string; status: string; severity: string; assigned_to: string | null; exclusive_reviewer_username: string | null; is_anonymous: number; level: string; classroom: string };

async function isAssigned(db: D1Database, caseId: string, username: string) {
  return Boolean(await db.prepare("SELECT id FROM case_assignments WHERE case_id=? AND username=? LIMIT 1").bind(caseId, username).first());
}

export async function GET(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    const session = await requireCaseSession(request);
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const caseRow = await db.prepare(`SELECT c.id,c.case_number,c.student_id,c.category_id,c.title,c.description,c.location,
      c.people_involved,c.requested_help,c.safety_level,c.is_anonymous,c.requires_immediate_review,
      c.severity,c.status,c.assigned_to,c.exclusive_reviewer_username,assignee.display_name assigned_name,c.created_at,c.updated_at,
      cc.name category_name,s.student_code,s.prefix,s.first_name,s.last_name,
      s.level,s.classroom,s.number,s.advisor1 legacy_advisor1,s.advisor2 legacy_advisor2
      FROM cases c JOIN case_categories cc ON cc.id=c.category_id
      JOIN students s ON s.id=c.student_id LEFT JOIN staff_users assignee ON assignee.username=c.assigned_to
      WHERE c.case_number=?`).bind(caseNumber).first<Record<string, unknown>>();
    if (!caseRow) return jsonError("ไม่พบเคส", 404);
    if (isExclusiveReviewPending(caseRow) && caseRow.exclusive_reviewer_username !== session.username) return jsonError("ไม่พบเคส", 404);

    const caseId = String(caseRow.id);
    const participant = await isAssigned(db, caseId, session.username);
    const directlyAssigned = String(caseRow.assigned_to ?? "") === session.username || participant;
    const affairsQueue = sessionHasRole(session, "STUDENT_AFFAIRS") && caseRow.status === "AFFAIRS_REVIEW";
    const roomAccess = sessionHasRole(session, "ADVISOR") && session.advisorId
      ? await db.prepare("SELECT id FROM advisor_assignments WHERE advisor_id=? AND level=? AND classroom=? LIMIT 1").bind(session.advisorId, String(caseRow.level), String(caseRow.classroom)).first()
      : null;
    if (!sessionHasAnyRole(session, ["SUPER_ADMIN", "INTAKE"]) && !directlyAssigned && !affairsQueue && !roomAccess) return jsonError("ไม่มีสิทธิ์เปิดเคสนี้", 403);

    const item = attachAdvisorData(caseRow, await loadRoomAdvisors(db, String(caseRow.level), String(caseRow.classroom))) as Record<string, unknown>;
    const canRevealIdentity = sessionCanViewStudentIdentity(session);
    if (Number(caseRow.is_anonymous) === 1 && !canRevealIdentity) {
      item.prefix = ""; item.first_name = "ปกปิดตัวตน"; item.last_name = ""; item.student_code = null; item.reporter_name = "ปกปิดตัวตน";
    } else {
      item.reporter_name = `${String(caseRow.prefix ?? "")}${String(caseRow.first_name ?? "")} ${String(caseRow.last_name ?? "")}`.trim();
    }

    const [timeline, notes, attachments, assignments] = await Promise.all([
      db.prepare("SELECT * FROM case_timeline WHERE case_id=? ORDER BY created_at DESC").bind(caseId).all(),
      db.prepare("SELECT * FROM case_notes WHERE case_id=? ORDER BY created_at DESC").bind(caseId).all(),
      db.prepare("SELECT id,original_name,storage_key,mime_type,file_size,created_at FROM case_attachments WHERE case_id=? ORDER BY created_at DESC").bind(caseId).all(),
      db.prepare(`SELECT ca.id,ca.username,ca.assignment_role,ca.status,ca.completed_at,ca.created_at,
        su.display_name,COALESCE((SELECT GROUP_CONCAT(sur.role,'|') FROM staff_user_roles sur WHERE sur.user_id=su.id),'') role_values
        FROM case_assignments ca JOIN staff_users su ON su.id=ca.user_id WHERE ca.case_id=?
        ORDER BY CASE ca.assignment_role WHEN 'LEAD' THEN 0 ELSE 1 END,su.display_name`).bind(caseId).all(),
    ]);
    return Response.json({ case: item, timeline: timeline.results.map((entry) => humanizeTimelineEntry(entry as Record<string, unknown>)), notes: notes.results, attachments: attachments.results, assignments: assignments.results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดรายละเอียดเคสได้", 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    const session = await requireCaseSession(request);
    const actor = session.username;
    const input = updateSchema.safeParse(await request.json());
    if (!input.success) return jsonError("ข้อมูลการดำเนินการไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง");
    if (Object.keys(input.data).length === 0) return jsonError("ไม่มีข้อมูลสำหรับบันทึก");
    if (input.data.noteId && !input.data.note) return jsonError("กรุณาระบุข้อความบันทึกที่ต้องการแก้ไข");
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const item = await db.prepare("SELECT c.id,c.status,c.severity,c.assigned_to,c.exclusive_reviewer_username,c.is_anonymous,s.level,s.classroom FROM cases c JOIN students s ON s.id=c.student_id WHERE c.case_number=?").bind(caseNumber).first<CaseItem>();
    if (!item) return jsonError("ไม่พบเคส", 404);
    if (isExclusiveReviewPending(item) && item.exclusive_reviewer_username !== session.username) return jsonError("ไม่พบเคส", 404);

    const isSuper = sessionHasRole(session, "SUPER_ADMIN");
    const isIntake = sessionHasRole(session, "INTAKE");
    const isAffairs = sessionHasRole(session, "STUDENT_AFFAIRS");
    const participant = await isAssigned(db, item.id, actor);
    const isLead = item.assigned_to === actor;
    const roomAccess = sessionHasRole(session, "ADVISOR") && session.advisorId
      ? await db.prepare("SELECT id FROM advisor_assignments WHERE advisor_id=? AND level=? AND classroom=? LIMIT 1").bind(session.advisorId, item.level, item.classroom).first()
      : null;
    if (!(isSuper || isIntake || participant || isLead || roomAccess || (isAffairs && item.status === "AFFAIRS_REVIEW"))) return jsonError("ไม่มีสิทธิ์แก้ไขเคสนี้", 403);
    if (input.data.note && !(isSuper || isIntake || participant || isLead || (isAffairs && item.status === "AFFAIRS_REVIEW"))) return jsonError("ต้องได้รับมอบหมายก่อนจึงจะเพิ่มบันทึกภายในได้", 403);
    if (input.data.resetTrackingPassword && !isSuper) return jsonError("เฉพาะแอดมินระบบเท่านั้นที่รีเซ็ตรหัสติดตามได้", 403);
    if (input.data.severity !== undefined && !isSuper && !isIntake) return jsonError("เฉพาะเจ้าหน้าที่รับเรื่องที่ปรับระดับความรุนแรงได้", 403);
    if (input.data.severity !== undefined && !["NEW", "REOPENED"].includes(item.status)) return jsonError("ระดับความสำคัญถูกยืนยันแล้วหลังส่งต่อเคส จึงไม่สามารถแก้ไขได้", 409);
    if (input.data.assignedTo !== undefined && !isSuper && !(isIntake && ["SCREENING", "ASSIGNED"].includes(item.status))) {
      return jsonError("ไม่สามารถเปลี่ยนผู้รับผิดชอบนอกขั้นตอนมอบหมายได้", 403);
    }

    const requestedStatus = input.data.status;
    if (requestedStatus && requestedStatus !== item.status) {
      const edge = `${item.status}>${requestedStatus}`;
      const intakeEdges = new Set(["NEW>AFFAIRS_REVIEW", "NEW>DEPUTY_REVIEW", "NEW>CLOSED", "REOPENED>AFFAIRS_REVIEW", "REOPENED>DEPUTY_REVIEW", "REOPENED>CLOSED", "INTAKE_REVIEW>CLOSED", "INTAKE_REVIEW>IN_PROGRESS", "SCREENING>AFFAIRS_REVIEW", "SCREENING>ASSIGNED", "ASSIGNED>IN_PROGRESS", "ADMIN_REVIEW>CLOSED", "ADMIN_REVIEW>DIRECTOR_REVIEW", "PENDING_CLOSE>CLOSED", "RESOLVED>CLOSED", "CLOSED>REOPENED"]);
      const affairsEdges = new Set(["AFFAIRS_REVIEW>IN_PROGRESS", "AFFAIRS_REVIEW>INTAKE_REVIEW"]);
      const teamEdges = new Set(["IN_PROGRESS>INTAKE_REVIEW", "DIRECTOR_ORDERED>IN_PROGRESS"]);
      const permitted = isSuper || (isIntake && intakeEdges.has(edge)) || (isAffairs && affairsEdges.has(edge)) || ((participant || isLead) && teamEdges.has(edge) && (requestedStatus !== "INTAKE_REVIEW" || isLead));
      if (!permitted) return jsonError("ไม่มีสิทธิ์ส่งเคสข้ามขั้นตอนนี้", 403);
      if (["SEVERE", "CRITICAL"].includes(input.data.severity ?? item.severity) && ["NEW", "REOPENED"].includes(item.status) && requestedStatus === "AFFAIRS_REVIEW" && !isSuper) return jsonError("เคสรุนแรงหรือวิกฤตต้องส่งรองผู้อำนวยการ", 409);
    }

    let assigneeRows: Array<{ id: string; username: string; display_name: string }> = [];
    if (input.data.assignees) {
      if (!isSuper && !(isAffairs && item.status === "AFFAIRS_REVIEW")) return jsonError("เฉพาะทีมกิจการนักเรียนที่มอบหมายทีมครูได้", 403);
      const unique = [...new Set(input.data.assignees)];
      const lead = input.data.leadAssignee ?? unique[0];
      if (!unique.includes(lead)) return jsonError("ผู้รับผิดชอบหลักต้องอยู่ในทีมที่เลือก");
      const placeholders = unique.map(() => "?").join(",");
      const result = await db.prepare(`SELECT su.id,su.username,su.display_name FROM staff_users su
        WHERE su.is_active=1 AND su.username IN (${placeholders}) AND EXISTS (
        SELECT 1 FROM staff_user_roles sur WHERE sur.user_id=su.id AND sur.role IN ('SUPER_ADMIN','STUDENT_AFFAIRS','LEVEL_HEAD','TEACHER','ADVISOR','CASE_OFFICER'))`).bind(...unique).all<{ id: string; username: string; display_name: string }>();
      assigneeRows = result.results;
      if (assigneeRows.length !== unique.length) return jsonError("มีรายชื่อผู้รับผิดชอบที่ไม่พร้อมใช้งาน", 400);
      input.data.leadAssignee = lead;
    }
    if (requestedStatus === "IN_PROGRESS" && item.status === "AFFAIRS_REVIEW" && !input.data.assignees?.length) return jsonError("กรุณาเลือกทีมผู้ดำเนินการอย่างน้อยหนึ่งคน", 400);
    if (requestedStatus === "IN_PROGRESS" && item.status === "INTAKE_REVIEW") {
      const existing = await db.prepare("SELECT COUNT(*) total FROM case_assignments WHERE case_id=?").bind(item.id).first<{ total: number }>();
      if (!existing?.total) return jsonError("ไม่พบทีมเดิมสำหรับส่งกลับดำเนินการ", 409);
    }

    const batch: D1PreparedStatement[] = [];
    if (input.data.resetTrackingPassword) {
      batch.push(db.prepare("UPDATE cases SET tracking_password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(await hashPassword(input.data.resetTrackingPassword), item.id));
      batch.push(db.prepare("INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)").bind(createId("timeline"), item.id, "RESET_TRACKING_PASSWORD", "รีเซ็ตรหัสติดตาม", "แอดมินระบบตั้งรหัสติดตามใหม่", actor));
    }
    if (input.data.note) {
      if (input.data.noteId) {
        const existingNote = await db.prepare("SELECT id FROM case_notes WHERE id=? AND case_id=? AND is_editable=1").bind(input.data.noteId, item.id).first();
        if (!existingNote) return jsonError("บันทึกนี้แก้ไขไม่ได้ เนื่องจากเคสไปยังขั้นตอนถัดไปแล้ว", 409);
        batch.push(db.prepare("UPDATE case_notes SET note=? WHERE id=? AND case_id=?").bind(input.data.note, input.data.noteId, item.id));
        batch.push(db.prepare("INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)").bind(createId("timeline"), item.id, "EDIT_NOTE", "แก้ไขบันทึกภายใน", null, actor));
      } else {
        batch.push(db.prepare("INSERT INTO case_notes (id,case_id,note,created_by) VALUES (?,?,?,?)").bind(createId("note"), item.id, input.data.note, actor));
        batch.push(db.prepare("INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)").bind(createId("timeline"), item.id, "ADD_NOTE", "เพิ่มบันทึกภายใน", null, actor));
      }
    }
    if (input.data.assignees) {
      const lead = input.data.leadAssignee!;
      batch.push(db.prepare("DELETE FROM case_assignments WHERE case_id=?").bind(item.id));
      for (const row of assigneeRows) batch.push(db.prepare("INSERT INTO case_assignments (id,case_id,user_id,username,assignment_role,status,assigned_by) VALUES (?,?,?,?,?,'ASSIGNED',?)").bind(createId("assignment"), item.id, row.id, row.username, row.username === lead ? "LEAD" : "MEMBER", actor));
    }

    const updates: string[] = [];
    const values: string[] = [];
    if (requestedStatus) { updates.push("status=?"); values.push(requestedStatus); }
    if (input.data.severity) { updates.push("severity=?"); values.push(input.data.severity); }
    if (input.data.assignees) { updates.push("assigned_to=?"); values.push(input.data.leadAssignee!); }
    else if (input.data.assignedTo !== undefined) { updates.push("assigned_to=?"); values.push(input.data.assignedTo); }
    if (updates.length) {
      batch.push(db.prepare(`UPDATE cases SET ${updates.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...values, item.id));
      if (requestedStatus && requestedStatus !== item.status) {
        batch.push(db.prepare("UPDATE case_notes SET is_editable=0 WHERE case_id=? AND is_editable=1").bind(item.id));
        batch.push(db.prepare("INSERT INTO case_handoffs (id,case_id,from_status,to_status,from_username,to_username,reason,due_date) VALUES (?,?,?,?,?,?,?,?)").bind(createId("handoff"), item.id, item.status, requestedStatus, actor, input.data.leadAssignee ?? input.data.assignedTo ?? item.assigned_to, input.data.handoffReason || "ไม่ได้ระบุรายละเอียด", input.data.dueDate ?? null));
      }
      const teamNames = assigneeRows.map((row) => row.display_name).join(", ");
      const title = input.data.assignees ? "อนุมัติและมอบหมายทีมดำเนินการ" : timelineTitleForUpdate(input.data);
      const description = input.data.assignees ? `ผู้รับผิดชอบหลัก: ${assigneeRows.find((row) => row.username === input.data.leadAssignee)?.display_name ?? input.data.leadAssignee}\nทีมดำเนินการ: ${teamNames}${input.data.handoffReason ? `\nรายละเอียด: ${input.data.handoffReason}` : ""}` : describeCaseUpdate(input.data);
      batch.push(db.prepare("INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)").bind(createId("timeline"), item.id, input.data.assignees ? "ASSIGN_TEAM" : "UPDATE_CASE", title, description, actor));
    }
    batch.push(db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)").bind(createId("audit"), input.data.resetTrackingPassword ? "RESET_TRACKING_PASSWORD" : input.data.assignees ? "ASSIGN_CASE_TEAM" : "UPDATE_CASE", "case", item.id, actor, JSON.stringify({ ...input.data, resetTrackingPassword: input.data.resetTrackingPassword ? "[REDACTED]" : undefined })));
    await db.batch(batch);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง", 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    const session = await requireCaseSession(request);
    if (!sessionHasRole(session, "SUPER_ADMIN")) return jsonError("เฉพาะผู้ดูแลระบบระดับสูงสุดเท่านั้นที่ลบเคสได้", 403);
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const item = await db.prepare("SELECT id,case_number,title,status,exclusive_reviewer_username FROM cases WHERE case_number=?").bind(caseNumber).first<{ id: string; case_number: string; title: string; status: string; exclusive_reviewer_username: string | null }>();
    if (!item) return jsonError("ไม่พบเคส", 404);
    if (isExclusiveReviewPending(item) && item.exclusive_reviewer_username !== session.username) return jsonError("ไม่พบเคส", 404);
    const attachments = await db.prepare("SELECT storage_key FROM case_attachments WHERE case_id=?").bind(item.id).all<{ storage_key: string }>();
    await db.batch([
      db.prepare("DELETE FROM director_actions WHERE case_id=?").bind(item.id), db.prepare("DELETE FROM case_handoffs WHERE case_id=?").bind(item.id),
      db.prepare("DELETE FROM case_assignments WHERE case_id=?").bind(item.id), db.prepare("DELETE FROM case_attachments WHERE case_id=?").bind(item.id),
      db.prepare("DELETE FROM case_notes WHERE case_id=?").bind(item.id), db.prepare("DELETE FROM case_timeline WHERE case_id=?").bind(item.id),
      db.prepare("DELETE FROM cases WHERE id=?").bind(item.id),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)").bind(createId("audit"), "DELETE_CASE", "case", item.id, session.username, JSON.stringify({ caseNumber: item.case_number, title: item.title })),
    ]);
    const keys = attachments.results.map((attachment) => attachment.storage_key);
    if (keys.length) await env.EVIDENCE.delete(keys).catch(() => undefined);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถลบเคสได้ กรุณาลองอีกครั้ง", 500);
  }
}
