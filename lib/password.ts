import { env } from "cloudflare:workers";

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function sessionSecret() {
  const secret = (env as unknown as { SESSION_SECRET?: string }).SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is not configured");
  return secret;
}

function studentIdentitySecret() {
  const identitySecret = (env as unknown as { STUDENT_IDENTITY_PEPPER?: string }).STUDENT_IDENTITY_PEPPER;
  return identitySecret && identitySecret.length >= 32 ? identitySecret : sessionSecret();
}

async function hmac(password: string, saltText: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${saltText}:${password}`)));
}

async function identityHmac(identity: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(studentIdentitySecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`student-identity-v1:${identity}`)));
}

// Cloudflare's production runtime refuses PBKDF2 above its iteration cap (documented as 100,000)
// and throws NotSupportedError; the local dev runtime does not, so higher values pass every
// local test and then fail for real users. Keep this at or below the cap. The server-side
// pepper in pbkdf2() below is what keeps a stolen database from being cracked offline.
// verifyPassword still accepts stored hashes of 100,000 to 1,000,000 iterations.
const passwordHashIterations = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number, length: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${sessionSecret()}:${password}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    length * 8,
  ));
}

function equal(left: Uint8Array, right: Uint8Array) {
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${passwordHashIterations}$${encode(salt)}$${encode(await pbkdf2(password, salt, passwordHashIterations, 32))}`;
}

// Tracking codes are short-lived, server-peppered secrets rather than staff
// passwords. HMAC keeps them non-reversible without spending the Worker's CPU
// budget on PBKDF2 for every student submission.
export async function hashTrackingPassword(password: string) {
  const saltText = encode(crypto.getRandomValues(new Uint8Array(16)));
  return `tracking-hmac-sha256$${saltText}$${encode(await hmac(password, saltText))}`;
}

export async function verifyTrackingPassword(password: string, stored: string) {
  const fields = stored.split("$");
  if (fields[0] === "tracking-hmac-sha256" && fields.length === 3) {
    return equal(await hmac(password, fields[1]), decode(fields[2]));
  }
  // Cases created before this fix used the general password formats.
  return verifyPassword(password, stored);
}

// A student's person number is never stored in plaintext. This deterministic,
// domain-separated HMAC lets the server compare it with the registry value
// without exposing the original number in D1 or API responses.
export async function hashStudentIdentity(identity: string) {
  return `student-identity-hmac-sha256$${encode(await identityHmac(identity))}`;
}

export async function verifyStudentIdentity(identity: string, stored: string) {
  const fields = stored.split("$");
  return fields[0] === "student-identity-hmac-sha256" && fields.length === 2
    && equal(await identityHmac(identity), decode(fields[1]));
}

export async function verifyPassword(password: string, stored: string) {
  const fields = stored.split("$");
  if (fields[0] === "pbkdf2-sha256" && fields.length === 4) {
    const iterations = Number(fields[1]);
    if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
    const salt = decode(fields[2]);
    const expected = decode(fields[3]);
    return expected.length === 32 && equal(await pbkdf2(password, salt, iterations, expected.length), expected);
  }

  // Credentials created before the PBKDF2 upgrade remain readable. They are
  // replaced with the stronger format whenever a password is changed or reset.
  if (fields[0] === "hmac-sha256" && fields.length === 3) {
    return equal(await hmac(password, fields[1]), decode(fields[2]));
  }

  // Old local imports used unpeppered PBKDF2 and also remain readable.
  const [algorithm, iterationsText, saltText, expectedText] = fields;
  if (algorithm !== "pbkdf2" || !iterationsText || !saltText || !expectedText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) return false;
  const salt = decode(saltText);
  const expected = decode(expectedText);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, expected.length * 8));
  return equal(bits, expected);
}
