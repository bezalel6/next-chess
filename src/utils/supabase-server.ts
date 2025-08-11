import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "../env";
import type { Database } from "@/types/database";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables!");
}

// For API routes (Pages Router)
export const createSupabaseServerClient = (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return Object.entries(req.cookies).map(([name, value]) => ({ name, value: value || "" }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const cookieOptions = options ? {
            domain: options.domain,
            path: options.path,
            maxAge: options.maxAge,
            httpOnly: options.httpOnly,
            secure: options.secure,
            sameSite: options.sameSite === true ? "lax" : 
                     options.sameSite === false ? undefined : 
                     options.sameSite as "lax" | "strict" | "none" | undefined,
          } : undefined;
          const cookieStr = serializeCookie(name, value, cookieOptions);
          res.setHeader("Set-Cookie", cookieStr);
        });
      },
    },
  });
};

// For Server Components (if using App Router in the future)
export const createSupabaseServerComponentClient = async () => {
  const cookieStore = await cookies();
  
  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
};

// Helper function to serialize cookies
function serializeCookie(
  name: string,
  value: string,
  options?: {
    domain?: string;
    path?: string;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
  }
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  
  if (options?.domain) parts.push(`Domain=${options.domain}`);
  if (options?.path) parts.push(`Path=${options.path}`);
  if (options?.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  if (options?.httpOnly) parts.push("HttpOnly");
  if (options?.secure) parts.push("Secure");
  if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
  
  return parts.join("; ");
}