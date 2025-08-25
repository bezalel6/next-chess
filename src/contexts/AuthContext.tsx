import React, { createContext, useContext, useState, useEffect } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/utils/supabase-browser";
import { useRouter } from "next/router";
import { getErrorMessage } from '@/utils/type-guards';

// Custom error classes
export class UsernameExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsernameExistsError";
  }
}

export type SignUpStatus = {
  success: boolean;
  confirmEmail: boolean;
  user?: User;
  message: string;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profileUsername: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    username: string
  ) => Promise<SignUpStatus>;
  signOut: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  checkUsernameExists: (username: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabaseBrowser()
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("[AuthContext] fetchProfile error:", error);
      }

      // If profile is not yet created (webhook delay), keep existing username if any
      if (!profile) {
        return null;
      }

      setProfileUsername(profile.username || null);
      setIsAdmin(false); // No admin system in this refactor
      return profile;
    } catch (e) {
      console.warn("[AuthContext] fetchProfile exception:", e);
      return null;
    }
  };

  // Poll for profile for a short window (handles webhook delay after signup/OAuth)
  const waitForProfile = async (userId: string, opts?: { tries?: number; intervalMs?: number }) => {
    const tries = opts?.tries ?? 12; // ~5s with 400ms interval
    const intervalMs = opts?.intervalMs ?? 400;
    for (let i = 0; i < tries; i++) {
      const profile = await fetchProfile(userId);
      if (profile?.username) return true;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  };

  const updateUserState = (session: Session | null) => {
    if (session) {
      setUser(session.user);
      setSession(session);
      // Set a provisional username from metadata to avoid UI gaps
      const metaUsername = (session.user.user_metadata as Record<string, unknown>)?.username as string || null;
      if (metaUsername && !profileUsername) {
        setProfileUsername(metaUsername);
      }
      fetchProfile(session.user.id);
    } else {
      setUser(null);
      setSession(null);
      setProfileUsername(null);
      setIsAdmin(false);
    }
  };

  const validateAndRefreshSession = async () => {
    try {
      // Get the current session
      const {
        data: { session },
        error,
      } = await supabaseBrowser().auth.getSession();

      if (error) {
        console.error("[AuthContext] Session validation error:", error);
        updateUserState(null);
        return null;
      }

      if (!session) {
        updateUserState(null);
        return null;
      }

      // Check if profile exists for this session (catches corrupted sessions)
      const { data: profile, error: profileError } = await supabaseBrowser()
        .from("profiles")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        // Do NOT force logout immediately — webhook/profile creation may lag.
        console.warn("[AuthContext] Session without profile detected - treating as transient");
        // Keep session; allow UI to use metadata.username while waitForProfile runs elsewhere.
        return session;
      }

      // Check if session is expired or about to expire (within 60 seconds)
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      const isExpiringSoon = expiresAt - now < 60000;

      if (isExpiringSoon) {
        console.log("[AuthContext] Session expiring soon, refreshing...");
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabaseBrowser().auth.refreshSession();

        if (refreshError) {
          console.error("[AuthContext] Session refresh failed:", refreshError);
          updateUserState(null);
          return null;
        }

        updateUserState(refreshedSession);
        return refreshedSession;
      }

      return session;
    } catch (error) {
      console.error("[AuthContext] Session validation exception:", error);
      updateUserState(null);
      return null;
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const initializeAuth = async () => {
      // Validate and potentially refresh the session on mount
      const session = await validateAndRefreshSession();
      updateUserState(session);

      // If we have a fresh session but no profile yet, poll briefly for it
      if (session?.user && !profileUsername) {
        waitForProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }

      // Set up periodic session validation (every 30 seconds)
      intervalId = setInterval(async () => {
        await validateAndRefreshSession();
      }, 30000);
    };

    initializeAuth();

    // Subscribe to auth changes
    const subscription = supabaseBrowser().auth.onAuthStateChange(
      async (event, session) => {
        console.log("[AuthContext] Auth state changed:", event);

        if (event === "TOKEN_REFRESHED") {
          console.log("[AuthContext] Token refreshed successfully");
          updateUserState(session);
        } else if (event === "SIGNED_OUT") {
          updateUserState(null);
        } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          updateUserState(session);
          // If we just signed in and don't yet have a profile in state, poll for it briefly
          if (session?.user && !profileUsername) {
            waitForProfile(session.user.id);
          }
        } else if (!session) {
          // Session is null, clear state
          updateUserState(null);
        }
      }
    );

    return () => {
      subscription.data.subscription.unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const signIn = async (usernameOrEmail: string, password: string) => {
    const input = usernameOrEmail.toLowerCase().trim();

    if (!input.includes("@")) {
      // Simplest secure approach: require email-based sign-in. Avoid username->email lookups.
      throw new Error("Please sign in with your email address.");
    }

    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: input,
      password,
    });

    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    username: string
  ): Promise<SignUpStatus> => {
    // Normalize email and username
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    try {
      // Use an implicit-flow client for email confirmations to support cross-device clicks.
      const sbImplicit = (await import("@/utils/supabase-browser")).supabaseBrowserImplicit();

      // Sign up with Supabase Auth (include username in user_metadata)
      const { data, error } = await sbImplicit.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            username: normalizedUsername,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        // Check for specific error types
        if (getErrorMessage(error).includes("already registered")) {
          throw new Error("Email already registered");
        }
        throw new Error(getErrorMessage(error) || "Sign up failed");
      }

      if (!data.user) {
        throw new Error("Sign up failed - no user returned");
      }

      // Do NOT create profile here. The user-management edge function (via Auth webhook)
      // will validate the username and create the profile on user.created.

      const needsEmailConfirmation = !data.session;

      if (needsEmailConfirmation) {
        return {
          success: true,
          confirmEmail: true,
          message: "Please check your email to confirm your account",
        };
      }

      // If email confirmation is disabled and session exists, profile creation should
      // still be handled by the webhook shortly after user creation.
      return {
        success: true,
        confirmEmail: false,
        user: data.user,
        message: "Account created successfully!",
      };
    } catch (error) {
      if (error instanceof UsernameExistsError) {
        throw error;
      }

      // Handle other errors
      throw new Error(getErrorMessage(error) || "Sign up failed");
    }
  };

  const signOut = async () => {
    // Clean up matchmaking queue before signing out
    if (session) {
      try {
        const { MatchmakingService } = await import("../services/matchmakingService");
        await MatchmakingService.leaveQueue(session);
        console.log("[AuthContext] Left matchmaking queue before sign out");
      } catch (error) {
        console.error("[AuthContext] Failed to leave matchmaking queue:", error);
      }
    }

    const { error } = await supabaseBrowser().auth.signOut();
    if (error) throw error;

    // Clear any cached data
    setUser(null);
    setSession(null);
    setProfileUsername(null);
    setIsAdmin(false);

    // Redirect to home page
    router.push("/");
  };

  const signInAsGuest = async () => {
    const { data, error } = await supabaseBrowser().auth.signInAnonymously();

    if (error) {
      console.error("Guest sign in error:", error);
      throw new Error(`Failed to sign in as guest: ${getErrorMessage(error)}`);
    }

    if (!data.user) {
      throw new Error("No user returned from guest sign in");
    }

    // Profile is created automatically by database trigger
    // Fetch the created profile to get the username
    const { data: profile } = await supabaseBrowser()
      .from("profiles")
      .select("username")
      .eq("id", data.user.id)
      .single();

    if (profile?.username) {
      setProfileUsername(profile.username);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
  };

  const signInWithMagicLink = async (email: string) => {
    // Use implicit flow so the redirect contains tokens in the hash and works cross-device
    const sbImplicit = (await import("@/utils/supabase-browser")).supabaseBrowserImplicit();
    const { error } = await sbImplicit.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
  };

  const checkUsernameExists = async (username: string): Promise<boolean> => {
    const response = await fetch("/api/auth/check-username", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: username.toLowerCase().trim() }),
    });

    if (!response.ok) {
      throw new Error("Failed to check username");
    }

    const data = await response.json();
    return data.exists;
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profileUsername,
        isAdmin,
        signIn,
        signUp,
        signOut,
        signInAsGuest,
        signInWithGoogle,
        signInWithMagicLink,
        checkUsernameExists,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
