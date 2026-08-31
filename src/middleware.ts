import { NextRequest, NextResponse } from "next/server";
import {
  authEnabled,
  authSecret,
  verifySessionToken,
} from "@/lib/session";

export async function middleware(req: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.next();
  }
  const token = req.cookies.get("fft_session")?.value;
  if (await verifySessionToken(token, authSecret())) {
    return NextResponse.next();
  }
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401 }
    );
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (req.nextUrl.pathname !== "/") {
    url.searchParams.set("next", req.nextUrl.pathname);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|banner\\.svg|login|api/health|api/cron|api/auth).*)",
  ],
};
