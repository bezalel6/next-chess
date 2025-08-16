import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "./env";

export async function middleware(request: NextRequest) {
  // Create a response object that we can modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create a Supabase client with cookie handling
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Check if accessing admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Get the current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session?.user) {
      // Redirect to auth page if not authenticated
      const authUrl = new URL('/auth', request.url);
      authUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(authUrl);
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      // Redirect to home if not admin
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Refresh session if needed for other routes
  const { error } = await supabase.auth.getSession();
  
  if (error) {
    console.error("Middleware: Error getting session:", error);
  }

  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png|sounds|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};