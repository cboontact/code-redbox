import { getAdminSession } from "../../../../lib/admin-auth";
import { jsonError } from "../../../../lib/security";

export async function GET(request: Request) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);
    return Response.json({ user: session }, { headers: { "cache-control": "no-store" } });
  } catch {
    return jsonError("ไม่สามารถตรวจสอบบัญชีได้", 500);
  }
}
