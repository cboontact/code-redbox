import { z } from "zod";
import { ensureDatabase } from "../../../../db/bootstrap";
import { verifyStudentIdentity, verifyTrackingPassword } from "../../../../lib/password";
import { isValidStudentIdentity, normalizeStudentIdentity } from "../../../../lib/student-identity";
import { jsonError } from "../../../../lib/security";

const trackSchema = z.object({
  studentCode: z.string().trim().regex(/^\d{4,10}$/),
  credential: z.string().trim().min(1).max(20),
});

function publicCase(candidate: Record<string, unknown>) {
  return {
    case_number: candidate.case_number,
    status: candidate.status,
    created_at: candidate.created_at,
    category_name: candidate.category_name,
  };
}

export async function POST(request: Request) {
  try {
    const input = trackSchema.safeParse(await request.json());
    if (!input.success) return jsonError("เลขประจำตัวนักเรียนหรือเลขประจำตัวบุคคลไม่ถูกต้อง", 401);
    const db = await ensureDatabase();
    const student = await db.prepare(
      "SELECT id,identity_number_hash FROM students WHERE student_code=? AND is_active=1",
    ).bind(input.data.studentCode).first<{ id: string; identity_number_hash: string | null }>();
    const credential = normalizeStudentIdentity(input.data.credential);
    if (!student || (student.identity_number_hash && (!isValidStudentIdentity(credential) || !await verifyStudentIdentity(credential, student.identity_number_hash)))) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return jsonError("เลขประจำตัวนักเรียนหรือเลขประจำตัวบุคคลไม่ถูกต้อง", 401);
    }
    const { results: candidates } = await db.prepare(
      `SELECT c.case_number,c.status,c.created_at,c.tracking_password_hash,cc.name category_name
       FROM cases c JOIN case_categories cc ON cc.id=c.category_id
       WHERE c.student_id=? ORDER BY c.created_at DESC LIMIT 20`,
    ).bind(student.id).all();
    if (student.identity_number_hash) return Response.json({ cases: (candidates as Array<Record<string, unknown>>).map(publicCase) });
    if (!/^\d{6}$/.test(credential)) return jsonError("เลขประจำตัวนักเรียนหรือรหัสติดตามไม่ถูกต้อง", 401);
    const cases = [];
    for (const candidate of candidates as Array<Record<string, unknown>>) {
      if (typeof candidate.tracking_password_hash === "string" && await verifyTrackingPassword(credential, candidate.tracking_password_hash)) {
        cases.push(publicCase(candidate));
      }
    }
    if (!cases.length) return jsonError("เลขประจำตัวนักเรียนหรือรหัสติดตามไม่ถูกต้อง", 401);
    return Response.json({ cases });
  } catch {
    return jsonError("ค้นหาข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งนะ", 500);
  }
}
