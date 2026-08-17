import { z } from "zod";
import { createStaffSession, sessionCookie, verifyCredentials } from "../../../../lib/admin-auth";
import { jsonError } from "../../../../lib/security";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
  role: z.enum(["ADMIN", "DIRECTOR"]),
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.safeParse(await request.json());
    if (!input.success) return jsonError("ข้อมูลเข้าสู่ระบบไม่ถูกต้อง", 400);
    const user = await verifyCredentials(input.data.username, input.data.password, input.data.role);
    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return jsonError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
    }
    const token = await createStaffSession(user);
    return Response.json(
      { success: true, role: user.role },
      { headers: { "set-cookie": sessionCookie(token, request), "cache-control": "no-store" } },
    );
  } catch {
    return jsonError("ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง", 500);
  }
}
