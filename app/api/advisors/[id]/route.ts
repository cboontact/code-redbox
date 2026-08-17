import { z } from "zod";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { advisorAssignmentsSchema, assignmentsUseKnownRooms, prepareAdvisorAssignmentInsert, roomKey } from "../../../../lib/advisor-assignments";
import { jsonError, requireAdmin } from "../../../../lib/security";

const updateSchema = z.object({
  prefix: z.string().trim().min(1).max(30), firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().or(z.literal("")), phone: z.string().trim().max(30), assignments: advisorAssignmentsSchema,
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const input = updateSchema.safeParse(await request.json());
    if (!input.success) return jsonError("กรุณากรอกข้อมูลให้ครบถ้วน");
    const { id } = await context.params;
    const db = await ensureDatabase();
    const exists = await db.prepare("SELECT id FROM advisors WHERE id=? AND is_active=1").bind(id).first();
    if (!exists) return jsonError("ไม่พบครูที่ปรึกษา", 404);
    if (!(await assignmentsUseKnownRooms(db, input.data.assignments))) return jsonError("มีห้องเรียนที่ไม่พบในระบบ", 400);
    const current = await db.prepare(
      "SELECT id,level,classroom FROM advisor_assignments WHERE advisor_id=?",
    ).bind(id).all<{ id: string; level: string; classroom: string }>();
    const desiredKeys = new Set(input.data.assignments.map((item) => roomKey(item.level, item.classroom)));
    const currentKeys = new Set(current.results.map((item) => roomKey(item.level, item.classroom)));
    const removed = current.results.filter((item) => !desiredKeys.has(roomKey(item.level, item.classroom)));
    const added = input.data.assignments.filter((item) => !currentKeys.has(roomKey(item.level, item.classroom)));
    await db.batch([
      db.prepare("UPDATE advisors SET prefix=?,first_name=?,last_name=?,email=?,phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(input.data.prefix,input.data.firstName,input.data.lastName,input.data.email,input.data.phone,id),
      ...removed.map((item) => db.prepare("DELETE FROM advisor_assignments WHERE id=?").bind(item.id)),
      ...added.map((item) => prepareAdvisorAssignmentInsert(db, createId("assign"), id, item)),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)").bind(createId("audit"),"UPDATE_ADVISOR","advisor",id,actor,JSON.stringify(input.data.assignments)),
    ]);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) return jsonError("ครูคนนี้ถูกกำหนดให้ห้องดังกล่าวแล้ว", 409);
    return jsonError("ไม่สามารถบันทึกข้อมูลได้", 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await context.params;
    const db = await ensureDatabase();
    await db.batch([
      db.prepare("UPDATE advisors SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id),
      db.prepare("DELETE FROM advisor_assignments WHERE advisor_id=?").bind(id),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor) VALUES (?,?,?,?,?)").bind(createId("audit"),"DEACTIVATE_ADVISOR","advisor",id,actor),
    ]);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถนำครูออกได้", 500);
  }
}
