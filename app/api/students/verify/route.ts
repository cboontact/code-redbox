import { z } from "zod";
import { createId, ensureDatabase } from "../../../../db/bootstrap";

const inputSchema = z.object({ studentCode: z.string().trim().regex(/^\d{4,10}$/) });

export async function POST(request: Request) {
  try {
    const input = inputSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: "กรุณากรอกเลขประจำตัวนักเรียนให้ถูกต้อง" }, { status: 400 });
    }
    const db = await ensureDatabase();
    const student = await db.prepare(
      `SELECT id,student_code,prefix,first_name,last_name,level,classroom,number,advisor1,advisor2
       FROM students WHERE student_code=? AND is_active=1`,
    ).bind(input.data.studentCode).first();
    await db.prepare(
      "INSERT INTO audit_logs (id,action,resource,resource_id,actor) VALUES (?,?,?,?,?)",
    ).bind(createId("audit"), "STUDENT_LOOKUP", "student", student?.id ?? null, "student").run();
    if (!student) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return Response.json({ error: "ไม่พบข้อมูล กรุณาตรวจสอบอีกครั้ง" }, { status: 404 });
    }
    return Response.json({ student });
  } catch {
    return Response.json({ error: "ไม่สามารถตรวจสอบข้อมูลได้ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
