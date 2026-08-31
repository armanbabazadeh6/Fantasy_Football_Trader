export const SESSION_COOKIE = "fft_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return toHex(signature);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const signature = await hmacHex(secret, `fft:${expires}`);
  return `${expires}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expires = Number(token.slice(0, dot));
  const signature = token.slice(dot + 1);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = await hmacHex(secret, `fft:${expires}`);
  return timingSafeEqual(signature, expected);
}

export function authSecret(): string {
  return process.env.AUTH_SECRET || process.env.AUTH_PASSWORD || "";
}

export function authEnabled(): boolean {
  return Boolean(process.env.AUTH_PASSWORD);
}
