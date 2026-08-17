export { requireCaseStaff as requireStaff } from "./admin-auth";
export { requireCaseSession } from "./admin-auth";
export { requireAdmin } from "./admin-auth";
export { requireDirector } from "./admin-auth";
export { requireAnyStaff } from "./admin-auth";

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
