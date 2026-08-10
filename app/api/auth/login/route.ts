import { z } from "zod";
import { createAdminSession, sessionCookie, verifyCredentials } from "../../../../lib/admin-auth";
import { jsonError } from "../../../../lib/security";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.safeParse(await request.json());
    if (!input.success || !(await verifyCredentials(input.data.username, input.data.password))) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return jsonError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
    }
    const token = await createAdminSession(input.data.username);
    return Response.json(
      { success: true },
      { headers: { "set-cookie": sessionCookie(token, request), "cache-control": "no-store" } },
    );
  } catch {
    return jsonError("ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง", 500);
  }
}
