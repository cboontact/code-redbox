import { z } from "zod";
import { createId, ensureDatabase } from "../../../../db/bootstrap";
import { requireAdmin, type StaffRole } from "../../../../lib/admin-auth";
import { hashPassword } from "../../../../lib/password";
import { jsonError } from "../../../../lib/security";
import { includeAdvisorRole, resolveAdvisorAccountLink } from "../../../../lib/advisor-account";

const roleSchema = z.enum(["SUPER_ADMIN", "INTAKE", "STUDENT_AFFAIRS", "LEVEL_HEAD", "TEACHER", "ADVISOR", "DEPUTY_DIRECTOR", "DIRECTOR"]);
const rolesSchema = z.array(roleSchema).min(1).max(8).refine((roles) => new Set(roles).size === roles.length);
const rolePriority: StaffRole[] = ["SUPER_ADMIN", "INTAKE", "STUDENT_AFFAIRS", "DEPUTY_DIRECTOR", "LEVEL_HEAD", "TEACHER", "ADVISOR", "DIRECTOR", "CASE_OFFICER"];

const createSchema = z.object({
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(2).max(120),
  roles: rolesSchema,
  advisorId: z.string().trim().min(1).nullable().optional(),
  canViewStudentIdentity: z.boolean().optional().default(false),
});

function primaryRole(roles: StaffRole[]) {
  return rolePriority.find((role) => roles.includes(role)) ?? roles[0];
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = await ensureDatabase();
    const { results } = await db.prepare(`SELECT su.id,su.username,su.display_name,su.role,su.advisor_id,su.can_view_student_identity,su.is_active,
      su.created_by,su.created_at,su.updated_at,
      COALESCE((SELECT GROUP_CONCAT(sur.role,'|') FROM staff_user_roles sur WHERE sur.user_id=su.id),su.role) role_values,
      CASE WHEN a.id IS NULL THEN NULL ELSE a.prefix||a.first_name||' '||a.last_name END advisor_name
      FROM staff_users su LEFT JOIN advisors a ON a.id=su.advisor_id
      ORDER BY su.is_active DESC,su.display_name`).all<Record<string, unknown>>();
    const users = results.map((user) => {
      const assigned = new Set(String(user.role_values ?? user.role).split("|").filter(Boolean));
      assigned.delete("CASE_OFFICER");
      assigned.delete("TEACHER");
      return { ...user, roles: rolePriority.filter((role) => assigned.has(role)), role_values: undefined };
    });
    return Response.json({ users });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถโหลดบัญชีผู้ใช้ได้", 500);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const input = createSchema.safeParse(await request.json());
    if (!input.success) return jsonError("กรุณาตรวจสอบชื่อผู้ใช้ รหัสผ่าน และเลือกอย่างน้อย 1 บทบาท");
    const db = await ensureDatabase();
    const duplicate = await db.prepare("SELECT id FROM staff_users WHERE username=?").bind(input.data.username).first();
    if (duplicate) return jsonError("ชื่อผู้ใช้นี้มีอยู่แล้ว", 409);
    const id = createId("staff");
    const selectedRoles = includeAdvisorRole(input.data.roles as StaffRole[]);
    const resolvedAdvisorId = await resolveAdvisorAccountLink(db, input.data.username, input.data.advisorId);
    let advisorId: string | null = null;
    if (resolvedAdvisorId) {
      const linked = await db.prepare("SELECT id FROM staff_users WHERE advisor_id=?").bind(resolvedAdvisorId).first();
      if (!linked) advisorId = resolvedAdvisorId;
    }
    await db.batch([
      db.prepare("INSERT INTO staff_users (id,username,password_hash,display_name,role,advisor_id,can_view_student_identity,must_change_password,created_by) VALUES (?,?,?,?,?,?,?,1,?)")
        .bind(id, input.data.username, await hashPassword(input.data.password), input.data.displayName, primaryRole(selectedRoles), advisorId, input.data.canViewStudentIdentity ? 1 : 0, actor),
      ...selectedRoles.map((role) => db.prepare("INSERT INTO staff_user_roles (user_id,role) VALUES (?,?)").bind(id, role)),
      db.prepare("INSERT INTO audit_logs (id,action,resource,resource_id,actor,metadata) VALUES (?,?,?,?,?,?)")
        .bind(createId("audit"), "CREATE_STAFF_USER", "staff_user", id, actor, JSON.stringify({ username: input.data.username, roles: selectedRoles, canViewStudentIdentity: input.data.canViewStudentIdentity })),
    ]);
    return Response.json({ success: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถสร้างบัญชีผู้ใช้ได้", 500);
  }
}
