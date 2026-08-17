import { z } from "zod";
import { ensureDatabase } from "../../../../db/bootstrap";
import { requireAdmin } from "../../../../lib/admin-auth";
import { hashPassword } from "../../../../lib/password";
import { jsonError } from "../../../../lib/security";

const student = z.object({ id: z.string(), studentCode: z.string(), studentCardNumber: z.string().nullable(), prefix: z.string(), firstName: z.string(), lastName: z.string(), level: z.string(), classroom: z.string(), number: z.number().int().positive() });
const advisor = z.object({ id: z.string(), prefix: z.string(), firstName: z.string(), lastName: z.string(), email: z.string(), phone: z.string(), sourceUsername: z.string(), specialRole: z.string() });
const assignment = z.object({ id: z.string(), advisorId: z.string(), level: z.string(), classroom: z.string(), slot: z.number().int().positive() });
const user = z.object({ id: z.string(), username: z.string(), password: z.string().min(3), displayName: z.string(), role: z.enum(["INTAKE", "CASE_OFFICER", "ADVISOR", "DIRECTOR"]), advisorId: z.string().nullable() });
const importSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("students"), items: z.array(student).min(1).max(100) }),
  z.object({ type: z.literal("advisors"), advisors: z.array(advisor).max(150), assignments: z.array(assignment).max(300) }),
  z.object({ type: z.literal("users"), items: z.array(user).max(150) }),
]);

async function runChunks(db: D1Database, statements: D1PreparedStatement[]) {
  for (let index = 0; index < statements.length; index += 75) await db.batch(statements.slice(index, index + 75));
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const input = importSchema.safeParse(await request.json());
    if (!input.success) return jsonError("ชุดข้อมูลนำเข้าไม่ถูกต้อง", 400);
    const db = await ensureDatabase();
    if (input.data.type === "students") {
      await runChunks(db, input.data.items.map((item) => db.prepare(`INSERT INTO students
        (id,student_code,student_card_number,prefix,first_name,last_name,level,classroom,number,advisor1,advisor2,is_active)
        VALUES (?,?,?,?,?,?,?,?,?,'เชื่อมตามห้องอัตโนมัติ',NULL,1)
        ON CONFLICT(student_code) DO UPDATE SET student_card_number=excluded.student_card_number,prefix=excluded.prefix,
        first_name=excluded.first_name,last_name=excluded.last_name,level=excluded.level,classroom=excluded.classroom,
        number=excluded.number,advisor1=excluded.advisor1,advisor2=NULL,is_active=1,updated_at=CURRENT_TIMESTAMP`)
        .bind(item.id,item.studentCode,item.studentCardNumber,item.prefix,item.firstName,item.lastName,item.level,item.classroom,item.number)));
      return Response.json({ success: true, imported: input.data.items.length });
    }
    if (input.data.type === "advisors") {
      await runChunks(db, input.data.advisors.map((item) => db.prepare(`INSERT INTO advisors
        (id,prefix,first_name,last_name,email,phone,source_username,special_role,is_active) VALUES (?,?,?,?,?,?,?,?,1)
        ON CONFLICT(id) DO UPDATE SET prefix=excluded.prefix,first_name=excluded.first_name,last_name=excluded.last_name,
        email=excluded.email,phone=excluded.phone,source_username=excluded.source_username,special_role=excluded.special_role,is_active=1,updated_at=CURRENT_TIMESTAMP`)
        .bind(item.id,item.prefix,item.firstName,item.lastName,item.email,item.phone,item.sourceUsername,item.specialRole)));
      await runChunks(db, input.data.assignments.map((item) => db.prepare(`INSERT INTO advisor_assignments
        (id,advisor_id,level,classroom,slot) VALUES (?,?,?,?,?) ON CONFLICT(advisor_id,level,classroom) DO UPDATE SET slot=excluded.slot`)
        .bind(item.id,item.advisorId,item.level,item.classroom,item.slot)));
      return Response.json({ success: true, imported: input.data.advisors.length, assignments: input.data.assignments.length });
    }
    const statements = await Promise.all(input.data.items.map(async (item) => db.prepare(`INSERT INTO staff_users
      (id,username,password_hash,display_name,role,advisor_id,must_change_password,is_active,created_by)
      VALUES (?,?,?,?,?,?,1,1,?) ON CONFLICT(username) DO UPDATE SET display_name=excluded.display_name,
      role=excluded.role,advisor_id=excluded.advisor_id,is_active=1,updated_at=CURRENT_TIMESTAMP`)
      .bind(item.id,item.username,await hashPassword(item.password),item.displayName,item.role,item.advisorId,actor)));
    await runChunks(db, statements);
    return Response.json({ success: true, imported: input.data.items.length });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return jsonError("ไม่สามารถนำเข้าข้อมูลได้", 500);
  }
}
