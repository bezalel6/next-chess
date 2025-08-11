import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/utils/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
    username: string | null;
}

// Define possible signup status responses
export type SignUpStatus = {
    success: boolean;
    confirmEmail: boolean;
    user: User | null;
    message: string;
};

// Custom error for username already taken
export class UsernameExistsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UsernameExistsError";
    }
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    profile: UserProfile | null;
    signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
    signUp: (email: string, password: string, username: string, captchaToken?: string) => Promise<SignUpStatus>;
    signOut: () => Promise<void>;
    signInAsGuest: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    isGuest: boolean;
    updateUsername: (username: string) => Promise<void>;
    checkUsernameExists: (username: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    // Check if username already exists (case-insensitive)
    const checkUsernameExists = async (username: string): Promise<boolean> => {
        const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .ilike('username', username)
            .limit(1);

        if (error) throw error;
        return !!(data && data.length > 0);
    };

    // Generate unique guest username
    const generateUniqueUsername = async (prefix = 'user_'): Promise<string> => {
        let username = `${prefix}${Math.random().toString(36).substring(2, 8)}`;
        let exists = await checkUsernameExists(username);

        let attempts = 0;
        while (exists && attempts < 5) {
            username = `${prefix}${Math.random().toString(36).substring(2, 10)}`;
            exists = await checkUsernameExists(username);
            attempts++;
        }

        return username;
    };

    // Function to fetch or create user profile
    const fetchProfile = async (userId: string, createUsername?: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', userId)
                .single();

            if (error) {
                // If profile doesn't exist, create it
                if (error.code === 'PGRST116') {
                    const username = createUsername || await generateUniqueUsername();

                    // First check if profile exists again to avoid race conditions
                    const { data: existingProfile } = await supabase
                        .from('profiles')
                        .select('username')
                        .eq('id', userId)
                        .maybeSingle();

                    if (existingProfile) {
                        setProfile({ username: existingProfile.username });
                        return existingProfile;
                    }

                    const { error: insertError, data: insertedData } = await supabase
                        .from('profiles')
                        .insert({ id: userId, username })
                        .select('username')
                        .single();

                    if (insertError) {
                        // If insert fails due to duplicate key, the profile was likely created
                        // in a race condition - try to fetch it again
                        if (insertError.code === '23505') {
                            const { data: existingProfile, error: fetchError } = await supabase
                                .from('profiles')
                                .select('username')
                                .eq('id', userId)
                                .single();

                            if (!fetchError && existingProfile) {
                                setProfile({ username: existingProfile.username });
                                return existingProfile;
                            }
                        }
                        throw insertError;
                    }

                    setProfile({ username });
                    return insertedData || { username };
                }
                throw error;
            }

            setProfile({ username: data.username });
            return data;
        } catch (error) {
            console.error('Error in fetchProfile:', error);
            throw error;
        }
    };

    // Handle session and user state update
    const updateUserState = (session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
            setIsGuest(session.user.app_metadata.provider === 'anonymous');
            fetchProfile(session.user.id).catch(console.error);
        } else {
            setIsGuest(false);
            setProfile(null);
        }

        setIsLoading(false);
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            updateUserState(session);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            updateUserState(session);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (usernameOrEmail: string, password: string, captchaToken?: string) => {
        let email = usernameOrEmail.toLowerCase().trim();
        
        // Check if the input looks like a username (no @ symbol)
        if (!email.includes('@')) {
            // Call API to get email by username
            const response = await fetch('/api/auth/get-email-by-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: email }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Username not found');
            }
            
            const data = await response.json();
            email = data.email.toLowerCase();
        }
        
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
            options: captchaToken ? {
                captchaToken
            } : undefined
        });
        if (error) throw error;
    };

    const signUp = async (email: string, password: string, username: string, captchaToken?: string): Promise<SignUpStatus> => {
        // Normalize email and username
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();
        
        // First check if username is already taken
        const usernameExists = await checkUsernameExists(normalizedUsername);
        if (usernameExists) {
            throw new UsernameExistsError("Username already taken. Please choose another username.");
        }

        // Create the user with username in metadata
        const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
                data: { username: normalizedUsername },
                ...(captchaToken ? { captchaToken } : {})
            }
        });

        if (error) throw error;
        await supabase
            .from('profiles')
            .insert({ id: data.user.id, username: normalizedUsername })
            .select('username')
            .single();

        // Check if email confirmation is required
        const confirmEmail = data?.user?.identities?.length === 0 ||
            data?.user?.confirmed_at === null ||
            (!!data.user.confirmation_sent_at && !data?.user?.confirmed_at);

        return {
            success: true,
            confirmEmail,
            user: data?.user || null,
            message: confirmEmail
                ? "Please check your email for a confirmation link to complete the signup process."
                : "Account created successfully. You can now sign in."
        };
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setProfile(null);
    };

    const signInAsGuest = async () => {
        const randomUsername = await generateUniqueUsername('guest_');

        const { data, error } = await supabase.auth.signInAnonymously({
            options: {
                data: { username: randomUsername }
            }
        });

        if (error) throw error;

        // Ensure profile exists
        await fetchProfile(data.user.id, randomUsername);
    };

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        });

        if (error) throw error;
    };

    const updateUsername = async (username: string) => {
        if (!user) throw new Error("User not authenticated");

        const normalizedUsername = username.toLowerCase().trim();
        
        // Skip check if username isn't changing (case-insensitive)
        if (normalizedUsername !== profile?.username?.toLowerCase()) {
            const usernameExists = await checkUsernameExists(normalizedUsername);
            if (usernameExists) {
                throw new UsernameExistsError("Username already taken. Please choose another username.");
            }
        }

        const { error } = await supabase
            .from('profiles')
            .update({ username: normalizedUsername })
            .eq('id', user.id);

        if (error) throw error;

        setProfile(prev => ({ ...prev!, username: normalizedUsername }));
    };

    const value = {
        user,
        session,
        isLoading,
        profile,
        signIn,
        signUp,
        signOut,
        signInAsGuest,
        signInWithGoogle,
        isGuest,
        updateUsername,
        checkUsernameExists
    } satisfies AuthContextType;

    return (
        <AuthContext.Provider value={value}>
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