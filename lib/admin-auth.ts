import { env } from "cloudflare:workers";
import { ensureDatabase } from "../db/bootstrap";
import { verifyPassword } from "./password";

const COOKIE_NAME = "redbox_admin_session";
const SESSION_AGE_SECONDS = 8 * 60 * 60;

export type StaffRole = "SUPER_ADMIN" | "INTAKE" | "STUDENT_AFFAIRS" | "LEVEL_HEAD" | "TEACHER" | "ADVISOR" | "DEPUTY_DIRECTOR" | "DIRECTOR" | "CASE_OFFICER";
export type SessionPayload = { userId: string; username: string; displayName: string; role: StaffRole; roles: StaffRole[]; advisorId?: string | null; canViewStudentIdentity?: boolean; mustChangePassword?: boolean; exp: number };

const rolePriority: StaffRole[] = ["SUPER_ADMIN", "INTAKE", "STUDENT_AFFAIRS", "DEPUTY_DIRECTOR", "LEVEL_HEAD", "TEACHER", "ADVISOR", "DIRECTOR", "CASE_OFFICER"];

function normalizeRoles(values: string[], legacyRole?: string): StaffRole[] {
  const allowed = new Set<StaffRole>(rolePriority);
  const roles = values.filter((value): value is StaffRole => allowed.has(value as StaffRole));
  if (legacyRole && allowed.has(legacyRole as StaffRole) && !roles.includes(legacyRole as StaffRole)) roles.push(legacyRole as StaffRole);
  return rolePriority.filter((role) => roles.includes(role));
}

function effectiveRole(roles: StaffRole[], requestedPortal: "ADMIN" | "DIRECTOR"): StaffRole | null {
  if (roles.includes("SUPER_ADMIN")) return "SUPER_ADMIN";
  if (requestedPortal === "DIRECTOR") return roles.includes("DEPUTY_DIRECTOR") ? "DEPUTY_DIRECTOR" : roles.includes("DIRECTOR") ? "DIRECTOR" : null;
  return rolePriority.find((role) => roles.includes(role)) ?? null;
}

export function sessionHasRole(session: Pick<SessionPayload, "role" | "roles">, role: StaffRole) {
  return session.role === "SUPER_ADMIN" || session.roles.includes("SUPER_ADMIN") || session.roles.includes(role) || session.role === role;
}

export function sessionHasAnyRole(session: Pick<SessionPayload, "role" | "roles">, roles: StaffRole[]) {
  return roles.some((role) => sessionHasRole(session, role));
}

export function sessionCanViewStudentIdentity(session: Pick<SessionPayload, "role" | "roles" | "canViewStudentIdentity">) {
  return sessionHasRole(session, "SUPER_ADMIN") || Boolean(session.canViewStudentIdentity);
}

function runtimeEnv() {
  return env as unknown as {
    SESSION_SECRET?: string;
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function hmac(value: string) {
  const secret = runtimeEnv().SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function safeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function verifyCredentials(username: string, password: string, requestedPortal: "ADMIN" | "DIRECTOR") {
  const db = await ensureDatabase();
  const user = await db.prepare(
    "SELECT id,username,password_hash,display_name,role,advisor_id,can_view_student_identity,is_active,must_change_password FROM staff_users WHERE username=?",
  ).bind(username).first<{ id: string; username: string; password_hash: string; display_name: string; role: StaffRole; advisor_id: string | null; can_view_student_identity: number; is_active: number; must_change_password: number }>();
  if (user) {
    const roleRows = await db.prepare("SELECT role FROM staff_user_roles WHERE user_id=? ORDER BY role").bind(user.id).all<{ role: string }>();
    const roles = normalizeRoles(roleRows.results.map((item) => item.role), user.role);
    const role = effectiveRole(roles, requestedPortal);
    if (!user.is_active || !role || !(await verifyPassword(password, user.password_hash))) return false;
    return { userId: user.id, username: user.username, displayName: user.display_name, role, roles, advisorId: user.advisor_id, canViewStudentIdentity: Boolean(user.can_view_student_identity), mustChangePassword: Boolean(user.must_change_password) };
  }
  return false;
}

export async function createStaffSession(user: Omit<SessionPayload, "exp">) {
  const payload = textToBase64Url(JSON.stringify({ ...user, exp: Date.now() + SESSION_AGE_SECONDS * 1000 } satisfies SessionPayload));
  return `${payload}.${await hmac(payload)}`;
}

export async function getAdminSession(request: Request): Promise<SessionPayload | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !(await safeEqual(signature, await hmac(payload)))) return null;
  try {
    const parsed = JSON.parse(base64UrlToText(payload)) as SessionPayload;
    const valid = parsed.exp > Date.now() && parsed.username && rolePriority.includes(parsed.role);
    if (!valid) return null;
    const db = await ensureDatabase();
    const active = await db.prepare("SELECT id,display_name,role,advisor_id,can_view_student_identity,must_change_password FROM staff_users WHERE id=? AND is_active=1").bind(parsed.userId).first<{ id: string; display_name: string; role: string; advisor_id: string | null; can_view_student_identity: number; must_change_password: number }>();
    if (!active) return null;
    const roleRows = await db.prepare("SELECT role FROM staff_user_roles WHERE user_id=? ORDER BY role").bind(parsed.userId).all<{ role: string }>();
    parsed.roles = normalizeRoles(roleRows.results.map((item) => item.role), active.role);
    if (!sessionHasRole(parsed, parsed.role)) return null;
    parsed.displayName = active.display_name;
    parsed.advisorId = active.advisor_id;
    parsed.canViewStudentIdentity = Boolean(active.can_view_student_identity);
    parsed.mustChangePassword = Boolean(active.must_change_password);
    return parsed;
  } catch {
    return null;
  }
}

export async function requireAdmin(request: Request) {
  const session = await getAdminSession(request);
  if (!session || !sessionHasRole(session, "SUPER_ADMIN")) throw new Response("Forbidden", { status: session ? 403 : 401 });
  if (session.mustChangePassword) throw new Response("Password change required", { status: 428 });
  return session.username;
}

export async function requireCaseStaff(request: Request) {
  const session = await getAdminSession(request);
  if (!session) throw new Response("Forbidden", { status: 401 });
  if (session.mustChangePassword) throw new Response("Password change required", { status: 428 });
  return session.username;
}

export async function requireCaseSession(request: Request) {
  const session = await getAdminSession(request);
  if (!session) throw new Response("Forbidden", { status: 401 });
  if (session.mustChangePassword) throw new Response("Password change required", { status: 428 });
  return session;
}

export async function requireDirector(request: Request) {
  const session = await getAdminSession(request);
  if (!session || !sessionHasAnyRole(session, ["DEPUTY_DIRECTOR", "DIRECTOR", "SUPER_ADMIN"])) throw new Response("Unauthorized", { status: 401 });
  if (session.mustChangePassword) throw new Response("Password change required", { status: 428 });
  return session.username;
}

export async function requireAnyStaff(request: Request) {
  const session = await getAdminSession(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });
  if (session.mustChangePassword) throw new Response("Password change required", { status: 428 });
  return session;
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_AGE_SECONDS}${secure}`;
}

export function expiredSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
