import { expiredSessionCookie } from "../../../../lib/admin-auth";

export async function POST(request: Request) {
  return Response.json(
    { success: true },
    { headers: { "set-cookie": expiredSessionCookie(request), "cache-control": "no-store" } },
  );
}
