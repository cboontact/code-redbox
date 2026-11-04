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

const passwordHashIterations = 210_000;

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
