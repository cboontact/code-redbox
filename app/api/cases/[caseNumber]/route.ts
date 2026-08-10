import { z } from "zod";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { jsonError, requireStaff } from "../../../../lib/security";

const updateSchema = z.object({
  status: z.enum(["NEW", "SCREENING", "IN_PROGRESS", "DIRECTOR_REVIEW", "RESOLVED", "CLOSED"]).optional(),
  severity: z.enum(["GENERAL", "CONCERN", "SERIOUS", "CRITICAL"]).optional(),
  assignedTo: z.string().trim().max(120).optional(),
  note: z.string().trim().min(2).max(2000).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    requireStaff(request);
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const item = await db.prepare(
      `SELECT c.*,cc.name category_name,s.student_code,s.prefix,s.first_name,s.last_name,
       s.level,s.classroom,s.number,s.advisor1,s.advisor2
       FROM cases c JOIN case_categories cc ON cc.id=c.category_id
       JOIN students s ON s.id=c.student_id WHERE c.case_number=?`,
    ).bind(caseNumber).first();
    if (!item) return jsonError("ไม่พบเคส", 404);
    const timeline = await db.prepare(
      "SELECT * FROM case_timeline WHERE case_id=? ORDER BY created_at DESC",
    ).bind(item.id).all();
    const notes = await db.prepare(
      "SELECT * FROM case_notes WHERE case_id=? ORDER BY created_at DESC",
    ).bind(item.id).all();
    return Response.json({ case: item, timeline: timeline.results, notes: notes.results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดรายละเอียดเคสได้", 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ caseNumber: string }> }) {
  try {
    const actor = requireStaff(request);
    const input = updateSchema.safeParse(await request.json());
    if (!input.success || Object.keys(input.data).length === 0) return jsonError("ไม่มีข้อมูลสำหรับบันทึก");
    const db = await ensureDatabase();
    const { caseNumber } = await context.params;
    const item = await db.prepare("SELECT id FROM cases WHERE case_number=?").bind(caseNumber).first<{ id: string }>();
    if (!item) return jsonError("ไม่พบเคส", 404);
    const updates: string[] = [];
    const values: string[] = [];
    if (input.data.status) { updates.push("status=?"); values.push(input.data.status); }
    if (input.data.severity) { updates.push("severity=?"); values.push(input.data.severity); }
    if (input.data.assignedTo !== undefined) { updates.push("assigned_to=?"); values.push(input.data.assignedTo); }
    const batch: D1PreparedStatement[] = [];
    if (updates.length) {
      batch.push(db.prepare(`UPDATE cases SET ${updates.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...values, item.id));
      batch.push(db.prepare(
        "INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)",
      ).bind(createId("timeline"), item.id, "UPDATE_CASE", "อัปเดตเคส", JSON.stringify(input.data), actor));
    }
    if (input.data.note) {
      batch.push(db.prepare(
        "INSERT INTO case_notes (id,case_id,note,created_by) VALUES (?,?,?,?)",
      ).bind(createId("note"), item.id, input.data.note, actor));
      batch.push(db.prepare(
        "INSERT INTO case_timeline (id,case_id,action,title,description,created_by) VALUES (?,?,?,?,?,?)",
      ).bind(createId("timeline"), item.id, "ADD_NOTE", "เพิ่มบันทึกภายใน", null, actor));
    }
    batch.push(db.prepare(
      "INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)",
    ).bind(createId("audit"), "UPDATE_CASE", "case", item.id, actor, JSON.stringify(input.data)));
    await db.batch(batch);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง", 500);
  }
}
