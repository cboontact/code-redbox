import { z } from "zod";
import { env } from "cloudflare:workers";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { jsonError, requireCaseSession } from "../../../../lib/security";
import { hashPassword } from "../../../../lib/password";
import { attachAdvisorData, loadRoomAdvisors } from "../../../../lib/student-advisors";
import { sessionHasAnyRole, sessionHasRole } from "../../../../lib/admin-auth";
import { describeCaseUpdate, humanizeTimelineDescription, timelineTitleForUpdate } from "../../../../lib/case-timeline";

const updateSchema = z.object({
  status: z.enum(["NEW", "SCREENING", "ASSIGNED", "IN_PROGRESS", "ADMIN_REVIEW", "DIRECTOR_REVIEW", "DIRECTOR_ORDERED", "PENDING_CLOSE", "RESOLVED", "CLOSED", "REOPENED"]).optional(),
  severity: z.enum(["GENERAL", "CONCERN", "SERIOUS", "CRITICAL"]).optional(),
  assignedTo: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().min(2).max(2000).optional(),
  noteId: z.string().trim().min(1).max(120).optional(),
  handoffReason: z.string().trim().min(2).max(1000).optional(),
  dueDate: z.string().date().optional(),
  resetTrackingPassword: z.string().regex(/^\d{6}$/).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    const session = await requireCaseSession(request);
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const caseRow = await db.prepare(
      `SELECT c.id,c.case_number,c.student_id,c.category_id,c.title,c.description,c.location,
       c.people_involved,c.requested_help,c.safety_level,c.is_anonymous,c.requires_immediate_review,
       c.severity,c.status,c.assigned_to,assignee.display_name assigned_name,c.created_at,c.updated_at,
       cc.name category_name,s.student_code,s.prefix,s.first_name,s.last_name,
       s.level,s.classroom,s.number,s.advisor1 legacy_advisor1,s.advisor2 legacy_advisor2
       FROM cases c JOIN case_categories cc ON cc.id=c.category_id
       JOIN students s ON s.id=c.student_id
       LEFT JOIN staff_users assignee ON assignee.username=c.assigned_to
       WHERE c.case_number=?`,
    ).bind(caseNumber).first<Record<string, unknown>>();
    if (!caseRow) return jsonError("ไม่พบเคส", 404);
    if (!sessionHasAnyRole(session, ["SUPER_ADMIN", "INTAKE"])) {
      const directlyAssigned = String(caseRow.assigned_to ?? "") === session.username;
      const roomAccess = sessionHasRole(session, "ADVISOR") && session.advisorId
        ? await db.prepare("SELECT id FROM advisor_assignments WHERE advisor_id=? AND level=? AND classroom=? LIMIT 1")
          .bind(session.advisorId, String(caseRow.level), String(caseRow.classroom)).first()
        : null;
      if (!directlyAssigned && !roomAccess) return jsonError("ไม่มีสิทธิ์เปิดเคสนี้", 403);
    }
    const item = attachAdvisorData(
      caseRow,
      await loadRoomAdvisors(db, String(caseRow.level), String(caseRow.classroom)),
    );
    const timeline = await db.prepare(
      "SELECT * FROM case_timeline WHERE case_id=? ORDER BY created_at DESC",
    ).bind(String(item.id)).all();
    const notes = await db.prepare(
      "SELECT * FROM case_notes WHERE case_id=? ORDER BY created_at DESC",
    ).bind(String(item.id)).all();
    const attachments = await db.prepare(
      "SELECT id,original_name,storage_key,mime_type,file_size,created_at FROM case_attachments WHERE case_id=? ORDER BY created_at DESC",
    ).bind(String(item.id)).all();
    const readableTimeline = timeline.results.map((entry) => ({
      ...entry,
      description: humanizeTimelineDescription((entry as Record<string, unknown>).description),
    }));
    return Response.json({ case: item, timeline: readableTimeline, notes: notes.results, attachments: attachments.results });
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
    if (!input.success || Object.keys(input.data).length === 0) return jsonError("ไม่มีข้อมูลสำหรับบันทึก");
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const item = await db.prepare(
      "SELECT c.id,c.status,c.assigned_to,s.level,s.classroom FROM cases c JOIN students s ON s.id=c.student_id WHERE c.case_number=?",
    ).bind(caseNumber).first<{ id: string; status: string; assigned_to: string | null; level: string; classroom: string }>();
    if (!item) return jsonError("ไม่พบเคส", 404);
    const isSuperAdmin = sessionHasRole(session, "SUPER_ADMIN");
    const isIntake = sessionHasRole(session, "INTAKE");
    const directlyAssigned = item.assigned_to === session.username;
    const reassignmentStatuses = ["ASSIGNED", "IN_PROGRESS", "DIRECTOR_ORDERED"];
    const isReassignment = input.data.assignedTo !== undefined && input.data.assignedTo !== item.assigned_to;
    if (input.data.resetTrackingPassword && !isSuperAdmin) return jsonError("เฉพาะแอดมินระบบเท่านั้นที่รีเซ็ตรหัสติดตามได้", 403);
    if (!isSuperAdmin && !isIntake) {
      if (input.data.severity !== undefined) return jsonError("ผู้รับผิดชอบไม่มีสิทธิ์เปลี่ยนระดับความสำคัญ", 403);
      const roomAccess = sessionHasRole(session, "ADVISOR") && session.advisorId
        ? await db.prepare("SELECT id FROM advisor_assignments WHERE advisor_id=? AND level=? AND classroom=? LIMIT 1")
          .bind(session.advisorId, item.level, item.classroom).first()
        : null;
      if (!directlyAssigned && !roomAccess) return jsonError("ไม่มีสิทธิ์แก้ไขเคสนี้", 403);
      if (input.data.status && !directlyAssigned) return jsonError("เฉพาะครูที่ได้รับมอบหมายเท่านั้นที่เปลี่ยนสถานะเคสได้", 403);
      if (isReassignment && (!directlyAssigned || !reassignmentStatuses.includes(item.status))) {
        return jsonError("ส่งต่อผู้รับผิดชอบได้เฉพาะผู้รับเคสปัจจุบันและเคสที่กำลังดำเนินงาน", 403);
      }
      if (isReassignment && input.data.status && input.data.status !== item.status) {
        return jsonError("กรุณาส่งต่อผู้รับผิดชอบแยกจากการเปลี่ยนขั้นตอนเคส", 409);
      }
    }
    if (input.data.assignedTo) {
      const assignee = await db.prepare(`SELECT username FROM staff_users
        WHERE username=? AND is_active=1
        AND (EXISTS (SELECT 1 FROM staff_user_roles sur WHERE sur.user_id=staff_users.id AND sur.role IN ('CASE_OFFICER','ADVISOR'))
          OR (username=? AND EXISTS (SELECT 1 FROM staff_user_roles sur WHERE sur.user_id=staff_users.id AND sur.role='SUPER_ADMIN')))`)
        .bind(input.data.assignedTo, session.username).first();
      if (!assignee) return jsonError("ไม่พบบัญชีผู้รับผิดชอบเคสที่เปิดใช้งาน", 400);
    }
    if (input.data.status === "ASSIGNED" && !(input.data.assignedTo || item.assigned_to)) return jsonError("กรุณามอบหมายผู้รับผิดชอบก่อนส่งต่อ", 400);
    if (isReassignment && !input.data.handoffReason) return jsonError("กรุณาระบุเหตุผลหรือคำสั่งสำหรับผู้รับช่วงต่อ", 400);
    if (input.data.status && input.data.status !== item.status) {
      if (!input.data.handoffReason) return jsonError("กรุณาระบุเหตุผลหรือคำสั่งในการส่งต่อ", 400);
      const transitions: Record<string, string[]> = {
        NEW: ["SCREENING"], SCREENING: ["ASSIGNED"], ASSIGNED: ["IN_PROGRESS"],
        IN_PROGRESS: ["ADMIN_REVIEW"], ADMIN_REVIEW: ["DIRECTOR_REVIEW", "PENDING_CLOSE"],
        DIRECTOR_ORDERED: ["IN_PROGRESS"], PENDING_CLOSE: ["CLOSED"], RESOLVED: ["CLOSED"],
        CLOSED: ["REOPENED"], REOPENED: ["SCREENING"],
      };
      const roleTransitions: Record<string, string[]> = {
        INTAKE: ["NEW>SCREENING", "SCREENING>ASSIGNED", "ADMIN_REVIEW>DIRECTOR_REVIEW", "ADMIN_REVIEW>PENDING_CLOSE", "PENDING_CLOSE>CLOSED", "RESOLVED>CLOSED", "REOPENED>SCREENING"],
        CASE_OFFICER: ["ASSIGNED>IN_PROGRESS", "IN_PROGRESS>ADMIN_REVIEW", "DIRECTOR_ORDERED>IN_PROGRESS"],
        ADVISOR: ["ASSIGNED>IN_PROGRESS", "IN_PROGRESS>ADMIN_REVIEW", "DIRECTOR_ORDERED>IN_PROGRESS"],
      };
      const edge = `${item.status}>${input.data.status}`;
      const validStep = transitions[item.status]?.includes(input.data.status);
      const directSuperAdminClose =
        isSuperAdmin &&
        input.data.status === "CLOSED" &&
        item.status !== "CLOSED";
      const permitted = directSuperAdminClose || (validStep && (
        isSuperAdmin || Object.entries(roleTransitions).some(([role, edges]) =>
          sessionHasRole(session, role as "INTAKE" | "CASE_OFFICER" | "ADVISOR") && edges.includes(edge),
        )
      ));
      if (!permitted) return jsonError("ไม่มีสิทธิ์ส่งเคสข้ามขั้นตอนนี้", 403);
    }
    if (input.data.noteId && input.data.status && input.data.status !== item.status) {
      return jsonError("ไม่สามารถแก้ไขบันทึกพร้อมกับเลื่อนเคสไปขั้นตอนถัดไปได้", 409);
    }
    const updates: string[] = [];
    const values: string[] = [];
    if (input.data.status) { updates.push("status=?"); values.push(input.data.status); }
    if (input.data.severity) { updates.push("severity=?"); values.push(input.data.severity); }
    if (input.data.assignedTo !== undefined) { updates.push("assigned_to=?"); values.push(input.data.assignedTo); }
    const batch: D1PreparedStatement[] = [];
    if (input.data.resetTrackingPassword) {
      batch.push(db.prepare("UPDATE cases SET tracking_password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(await hashPassword(input.data.resetTrackingPassword), item.id));
      batch.push(db.prepare(
        "INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)",
      ).bind(createId("timeline"), item.id, "RESET_TRACKING_PASSWORD", "รีเซ็ตรหัสติดตาม", "แอดมินระบบตั้งรหัสติดตามใหม่", actor));
    }
    if (updates.length) {
      const sendingToDirector = input.data.status === "DIRECTOR_REVIEW";
      batch.push(db.prepare(`UPDATE cases SET ${updates.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...values, item.id));
      if (input.data.status && input.data.status !== item.status) {
        batch.push(db.prepare("UPDATE case_notes SET is_editable=0 WHERE case_id=? AND is_editable=1").bind(item.id));
      }
      if ((input.data.status && input.data.status !== item.status) || isReassignment) {
        const toStatus = input.data.status && input.data.status !== item.status ? input.data.status : item.status;
        batch.push(db.prepare(
          "INSERT INTO case_handoffs (id,case_id,from_status,to_status,from_username,to_username,reason,due_date) VALUES (?,?,?,?,?,?,?,?)",
        ).bind(createId("handoff"), item.id, item.status, toStatus, actor, input.data.assignedTo ?? item.assigned_to, input.data.handoffReason, input.data.dueDate ?? null));
      }
      const timelineAction = isReassignment ? "REASSIGN_CASE" : sendingToDirector ? "SEND_TO_DIRECTOR" : "UPDATE_CASE";
      const timelineTitle = isReassignment ? "ส่งต่อผู้รับผิดชอบ" : sendingToDirector ? "เสนอผู้อำนวยการ" : timelineTitleForUpdate(input.data);
      const timelineDescription = isReassignment
        ? `${item.assigned_to ?? "ยังไม่ได้มอบหมาย"} → ${input.data.assignedTo}: ${input.data.handoffReason}`
        : describeCaseUpdate(input.data);
      batch.push(db.prepare(
        "INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)",
      ).bind(createId("timeline"), item.id, timelineAction, timelineTitle, timelineDescription, actor));
    }
    if (input.data.note) {
      if (input.data.noteId) {
        const existingNote = await db.prepare(
          "SELECT id FROM case_notes WHERE id=? AND case_id=? AND is_editable=1",
        ).bind(input.data.noteId, item.id).first<{ id: string }>();
        if (!existingNote) return jsonError("บันทึกนี้แก้ไขไม่ได้ เนื่องจากเคสไปยังขั้นตอนถัดไปแล้ว", 409);
        batch.push(db.prepare(
          "UPDATE case_notes SET note=? WHERE id=? AND case_id=?",
        ).bind(input.data.note, input.data.noteId, item.id));
        batch.push(db.prepare(
          "INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)",
        ).bind(createId("timeline"), item.id, "EDIT_NOTE", "แก้ไขบันทึกภายใน", null, actor));
      } else {
        batch.push(db.prepare(
          "INSERT INTO case_notes (id,case_id,note,created_by) VALUES (?,?,?,?)",
        ).bind(createId("note"), item.id, input.data.note, actor));
        batch.push(db.prepare(
          "INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)",
        ).bind(createId("timeline"), item.id, "ADD_NOTE", "เพิ่มบันทึกภายใน", null, actor));
      }
    }
    batch.push(db.prepare(
      "INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)",
    ).bind(createId("audit"), input.data.resetTrackingPassword ? "RESET_TRACKING_PASSWORD" : isReassignment ? "REASSIGN_CASE" : input.data.status === "DIRECTOR_REVIEW" ? "SEND_TO_DIRECTOR" : "UPDATE_CASE", "case", item.id, actor, JSON.stringify({ ...input.data, resetTrackingPassword: input.data.resetTrackingPassword ? "[REDACTED]" : undefined })));
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
    const item = await db.prepare("SELECT id,case_number,title FROM cases WHERE case_number=?")
      .bind(caseNumber).first<{ id: string; case_number: string; title: string }>();
    if (!item) return jsonError("ไม่พบเคส", 404);
    const attachments = await db.prepare("SELECT storage_key FROM case_attachments WHERE case_id=?")
      .bind(item.id).all<{ storage_key: string }>();
    await db.batch([
      db.prepare("DELETE FROM director_actions WHERE case_id=?").bind(item.id),
      db.prepare("DELETE FROM case_handoffs WHERE case_id=?").bind(item.id),
      db.prepare("DELETE FROM case_attachments WHERE case_id=?").bind(item.id),
      db.prepare("DELETE FROM case_notes WHERE case_id=?").bind(item.id),
      db.prepare("DELETE FROM case_timeline WHERE case_id=?").bind(item.id),
      db.prepare("DELETE FROM cases WHERE id=?").bind(item.id),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)")
        .bind(createId("audit"), "DELETE_CASE", "case", item.id, session.username, JSON.stringify({ caseNumber: item.case_number, title: item.title })),
    ]);
    const keys = attachments.results.map((attachment) => attachment.storage_key);
    if (keys.length) await env.EVIDENCE.delete(keys).catch(() => undefined);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถลบเคสได้ กรุณาลองอีกครั้ง", 500);
  }
}
