export { requireAdmin as requireStaff } from "./admin-auth";

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
