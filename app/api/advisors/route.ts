import { z } from "zod";
import { createId, ensureDatabase } from "../../../db/bootstrap";
import { advisorAssignmentsSchema, assignmentsUseKnownRooms, prepareAdvisorAssignmentInsert } from "../../../lib/advisor-assignments";
import { jsonError, requireAdmin } from "../../../lib/security";

const advisorSchema = z.object({
  prefix: z.string().trim().min(1).max(30), firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().or(z.literal("")), phone: z.string().trim().max(30), assignments: advisorAssignmentsSchema,
});

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = await ensureDatabase();
    const [advisors, assignments, rooms] = await Promise.all([
      db.prepare(`SELECT a.*,su.id account_user_id,su.username account_username,
        su.display_name account_display_name,su.is_active account_is_active
        FROM advisors a LEFT JOIN staff_users su ON su.advisor_id=a.id
        WHERE a.is_active=1 ORDER BY a.first_name,a.last_name`).all(),
      db.prepare(`SELECT aa.*,a.prefix||a.first_name||' '||a.last_name advisor_name,
        (SELECT COUNT(*) FROM students s WHERE s.level=aa.level AND s.classroom=aa.classroom AND s.is_active=1) student_count
        FROM advisor_assignments aa JOIN advisors a ON a.id=aa.advisor_id
        WHERE a.is_active=1 ORDER BY aa.level,aa.classroom,aa.slot`).all(),
      db.prepare("SELECT level,classroom,COUNT(*) student_count FROM students WHERE is_active=1 GROUP BY level,classroom ORDER BY level,classroom").all(),
    ]);
    return Response.json({ advisors: advisors.results, assignments: assignments.results, rooms: rooms.results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดข้อมูลครูที่ปรึกษาได้", 500);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const input = advisorSchema.safeParse(await request.json());
    if (!input.success) return jsonError("กรุณากรอกข้อมูลครูที่ปรึกษาให้ครบถ้วน");
    const db = await ensureDatabase();
    if (!(await assignmentsUseKnownRooms(db, input.data.assignments))) return jsonError("มีห้องเรียนที่ไม่พบในระบบ", 400);
    const id = createId("advisor");
    const statements = [
      db.prepare("INSERT INTO advisors (id,prefix,first_name,last_name,email,phone) VALUES (?,?,?,?,?,?)").bind(id,input.data.prefix,input.data.firstName,input.data.lastName,input.data.email,input.data.phone),
      ...input.data.assignments.map((item) => prepareAdvisorAssignmentInsert(db, createId("assign"), id, item)),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)").bind(createId("audit"),"CREATE_ADVISOR","advisor",id,actor,JSON.stringify(input.data.assignments)),
    ];
    await db.batch(statements);
    return Response.json({ success: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) return jsonError("ครูคนนี้ถูกกำหนดให้ห้องดังกล่าวแล้ว", 409);
    return jsonError("ไม่สามารถเพิ่มครูที่ปรึกษาได้", 500);
  }
}
