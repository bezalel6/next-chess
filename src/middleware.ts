import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Only gate /admin by checking presence of Supabase auth cookie to avoid bundling supabase-js in Edge
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const hasAuthCookie = request.cookies.getAll().some(c => c.name.endsWith('-auth-token'));
    if (!hasAuthCookie) {
      const authUrl = new URL('/auth', request.url);
      authUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(authUrl);
    }
  }

  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: ["/admin/:path*"],
};
