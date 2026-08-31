import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  authEnabled,
  authSecret,
  createSessionToken,
  timingSafeEqual,
} from "@/lib/session";

export const dynamic = "force-dynamic";

const globalForLimiter = globalThis as unknown as {
  __fftLoginLimiter?: ReturnType<typeof createRateLimiter>;
};
const limiter =
  globalForLimiter.__fftLoginLimiter ?? createRateLimiter(5, 60 * 1000);
globalForLimiter.__fftLoginLimiter = limiter;

export async function POST(req: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.json(
      { ok: false, error: "No password is configured." },
      { status: 501 }
    );
  }
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local";
  if (!limiter.hit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }
  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
  }
  if (!password || !timingSafeEqual(password, process.env.AUTH_PASSWORD ?? "")) {
    return NextResponse.json(
      { ok: false, error: "Wrong password." },
      { status: 401 }
    );
  }
  const token = await createSessionToken(authSecret());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
