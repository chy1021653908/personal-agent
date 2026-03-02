import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/register", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value;

  if (!sessionToken && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!sessionToken && pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
