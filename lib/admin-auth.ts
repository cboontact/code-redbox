import { env } from "cloudflare:workers";

const COOKIE_NAME = "redbox_admin_session";
const SESSION_AGE_SECONDS = 8 * 60 * 60;

type SessionPayload = { username: string; exp: number };

function runtimeEnv() {
  return env as unknown as {
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
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

export async function verifyCredentials(username: string, password: string) {
  const config = runtimeEnv();
  if (!config.ADMIN_USERNAME || !config.ADMIN_PASSWORD) return false;
  const [usernameMatches, passwordMatches] = await Promise.all([
    safeEqual(username, config.ADMIN_USERNAME),
    safeEqual(password, config.ADMIN_PASSWORD),
  ]);
  return usernameMatches && passwordMatches;
}

export async function createAdminSession(username: string) {
  const payload = textToBase64Url(JSON.stringify({ username, exp: Date.now() + SESSION_AGE_SECONDS * 1000 } satisfies SessionPayload));
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
    return parsed.exp > Date.now() && parsed.username ? parsed : null;
  } catch {
    return null;
  }
}

export async function requireAdmin(request: Request) {
  const session = await getAdminSession(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });
  return session.username;
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_AGE_SECONDS}${secure}`;
}

export function expiredSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
