import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "./env";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const isTestMode = process.env.NEXT_PUBLIC_USE_TEST_AUTH === 'true';
  const asParam = url.searchParams.get('as');
  
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

  // Get current session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error("Middleware: Error getting session:", error);
  }

  // Handle test mode with ?as=white/black parameter
  if (isTestMode && url.pathname.startsWith('/game') && asParam && (asParam === 'white' || asParam === 'black')) {
    
    // Skip if we're already on the test-auth page
    if (url.pathname === '/game/test-auth') {
      return response;
    }
    
    // For /game without an ID - create a new game and authenticate
    if (url.pathname === '/game' || url.pathname === '/game/') {
      // Generate two guest usernames
      const randomId1 = Math.random().toString(36).substring(2, 7);
      const randomId2 = Math.random().toString(36).substring(2, 7);
      const whiteUsername = `guest_${randomId1}`;
      const blackUsername = `guest_${randomId2}`;
      const targetUsername = asParam === 'white' ? whiteUsername : blackUsername;

      // Create both users and the game via API
      const createGameResponse = await fetch(`${url.origin}/api/test/create-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whiteUsername, blackUsername }),
      });

      if (createGameResponse.ok) {
        const { gameId } = await createGameResponse.json();
        
        // Redirect to test-auth page which will handle authentication client-side
        url.pathname = '/game/test-auth';
        url.searchParams.set('username', targetUsername);
        url.searchParams.set('redirect', `/game/${gameId}`);
        url.searchParams.set('as', asParam);
        return NextResponse.redirect(url);
      }
      
      // If creation failed, redirect to home
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    
    // For existing games with ?as parameter - switch authentication if needed
    const gameIdMatch = url.pathname.match(/^\/game\/([^\/]+)/);
    if (gameIdMatch) {
      const gameId = gameIdMatch[1];
      
      // Fetch game data to get player usernames
      const { data: game } = await supabase
        .from('games')
        .select('*, whitePlayer:profiles!games_white_player_id_fkey(username), blackPlayer:profiles!games_black_player_id_fkey(username)')
        .eq('id', gameId)
        .single();
      
      if (game) {
        const targetUsername = asParam === 'white' ? game.whitePlayer?.username : game.blackPlayer?.username;
        
        // Check if we need to switch authentication
        const currentUser = session?.user;
        const currentUsername = currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0];
        
        if (targetUsername && targetUsername !== currentUsername) {
          // Redirect to test-auth page for client-side authentication
          url.pathname = '/game/test-auth';
          url.searchParams.set('username', targetUsername);
          url.searchParams.set('redirect', `/game/${gameId}`);
          url.searchParams.set('as', asParam);
          return NextResponse.redirect(url);
        }
      }
    }
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