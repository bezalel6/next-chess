import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useRouter } from 'next/router';

// Custom error classes
export class UsernameExistsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UsernameExistsError';
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
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, username: string) => Promise<SignUpStatus>;
    signOut: () => Promise<void>;
    signInAsGuest: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithMagicLink: (email: string) => Promise<void>;
    checkUsernameExists: (username: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileUsername, setProfileUsername] = useState<string | null>(null);
    const router = useRouter();

    const fetchProfile = async (userId: string) => {
        const { data: profile } = await supabaseBrowser()
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();
        
        setProfileUsername(profile?.username || null);
    };

    const updateUserState = (session: Session | null) => {
        if (session) {
            setUser(session.user);
            setSession(session);
            fetchProfile(session.user.id);
        } else {
            setUser(null);
            setSession(null);
            setProfileUsername(null);
        }
    };

    useEffect(() => {
        // Check if we have a session from localStorage
        supabaseBrowser().auth.getSession().then(({ data: { session } }) => {
            updateUserState(session);
            setLoading(false);
        });

        // Subscribe to auth changes
        const subscription = supabaseBrowser().auth.onAuthStateChange((event, session) => {
            updateUserState(session);
        });

        return () => {
            subscription.data.subscription.unsubscribe();
        };
    }, []);

    const signIn = async (usernameOrEmail: string, password: string) => {
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
        
        const { error } = await supabaseBrowser().auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
    };

    const signUp = async (email: string, password: string, username: string): Promise<SignUpStatus> => {
        // Normalize email and username
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();
        
        try {
            // First, call our API to check if username exists and create user
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: normalizedEmail,
                    password,
                    username: normalizedUsername,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Check if the error is due to duplicate username
                if (data.code === 'USERNAME_EXISTS') {
                    throw new UsernameExistsError('Username already exists');
                }
                throw new Error(data.error || 'Sign up failed');
            }

            // If email confirmation is required
            if (data.confirmEmail) {
                return {
                    success: true,
                    confirmEmail: true,
                    message: 'Please check your email to confirm your account'
                };
            }

            // Auto sign in after successful signup (when email confirmation is not required)
            const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
                email: normalizedEmail,
                password,
            });

            if (signInError) {
                // User was created but couldn't sign in automatically
                return {
                    success: true,
                    confirmEmail: false,
                    message: 'Account created. Please sign in.'
                };
            }

            return {
                success: true,
                confirmEmail: false,
                user: data.user,
                message: 'Account created successfully!'
            };
        } catch (error: any) {
            if (error instanceof UsernameExistsError) {
                throw error;
            }
            
            // Handle other errors
            throw new Error(error.message || 'Sign up failed');
        }
    };

    const signOut = async () => {
        const { error } = await supabaseBrowser().auth.signOut();
        if (error) throw error;
        
        // Clear any cached data
        setUser(null);
        setSession(null);
        setProfileUsername(null);
        
        // Redirect to home page
        router.push('/');
    };

    const signInAsGuest = async () => {
        const { data, error } = await supabaseBrowser().auth.signInAnonymously();
        
        if (error) {
            console.error('Guest sign in error:', error);
            throw new Error(`Failed to sign in as guest: ${error.message}`);
        }
        
        if (!data.user) {
            throw new Error('No user returned from guest sign in');
        }
        
        // Generate a unique guest username
        const guestUsername = `guest_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create or update the profile with the guest username
        const { error: profileError } = await supabaseBrowser()
            .from('profiles')
            .upsert({
                id: data.user.id,
                username: guestUsername,
            });
        
        if (profileError) {
            console.error('Failed to create guest profile:', profileError);
        }
        
        // Update local profile username
        setProfileUsername(guestUsername);
    };

    const signInWithGoogle = async () => {
        const { error } = await supabaseBrowser().auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`
            }
        });
        
        if (error) throw error;
    };

    const signInWithMagicLink = async (email: string) => {
        const { error } = await supabaseBrowser().auth.signInWithOtp({
            email: email.toLowerCase().trim(),
            options: {
                shouldCreateUser: false,
            }
        });
        
        if (error) throw error;
    };

    const checkUsernameExists = async (username: string): Promise<boolean> => {
        const response = await fetch('/api/auth/check-username', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: username.toLowerCase().trim() }),
        });

        if (!response.ok) {
            throw new Error('Failed to check username');
        }

        const data = await response.json();
        return data.exists;
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            loading,
            profileUsername,
            signIn,
            signUp,
            signOut,
            signInAsGuest,
            signInWithGoogle,
            signInWithMagicLink,
            checkUsernameExists
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}