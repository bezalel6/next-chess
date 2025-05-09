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
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, username: string) => Promise<SignUpStatus>;
    signOut: () => Promise<void>;
    signInAsGuest: () => Promise<void>;
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

    // Function to fetch user profile
    const fetchProfile = async (userId: string) => {
        // Try to get the existing profile
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Profile not found, try to create one with a default username
                console.log('Profile not found, creating one...');
                const username = `user_${Math.random().toString(36).substring(2, 8)}`;
                try {
                    await supabase
                        .from('profiles')
                        .insert({
                            id: userId,
                            username
                        });
                    // After creating, set the new profile
                    setProfile({ username });
                } catch (insertError) {
                    console.error('Error creating profile:', insertError);
                }
            } else {
                console.error('Error fetching profile:', error);
            }
            return;
        }

        setProfile({
            username: data?.username
        });
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            
            // Check if user is anonymous
            if (session?.user) {
                setIsGuest(session.user.app_metadata.provider === 'anonymous');
                fetchProfile(session.user.id);
            }
            
            setIsLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            
            // Check if user is anonymous
            if (session?.user) {
                setIsGuest(session.user.app_metadata.provider === 'anonymous');
                fetchProfile(session.user.id);
            } else {
                setIsGuest(false);
                setProfile(null);
            }
            
            setIsLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
    };

    // Check if username already exists
    const checkUsernameExists = async (username: string): Promise<boolean> => {
        const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username)
            .limit(1);
            
        if (error) {
            console.error('Error checking username:', error);
            throw error;
        }
        
        return data && data.length > 0;
    };

    const signUp = async (email: string, password: string, username: string): Promise<SignUpStatus> => {
        // First check if username is already taken
        const usernameExists = await checkUsernameExists(username);
        if (usernameExists) {
            throw new UsernameExistsError("Username already taken. Please choose another username.");
        }
        
        // Create the user with username in metadata
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        });
        console.log("sign up:",data)
        if (error) throw error;
        
        // Check if email confirmation is required
        const confirmEmail = data?.user?.identities?.length === 0 || 
                            data?.user?.confirmed_at === null||
                            (!!data.user.confirmation_sent_at&&!data?.user?.confirmed_at );

        
        // Return meaningful status
        if (confirmEmail) {
            return {
                success: true,
                confirmEmail: true,
                user: data?.user || null,
                message: "Please check your email for a confirmation link to complete the signup process."
            };
        } else {
            // Auto-confirmed or already confirmed
            return {
                success: true,
                confirmEmail: false,
                user: data?.user || null,
                message: "Account created successfully. You can now sign in."
            };
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setProfile(null);
    };

    const signInAsGuest = async () => {
        // Generate a random username and ensure it's unique
        let randomUsername = `guest_${Math.random().toString(36).substring(2, 10)}`;
        let exists = await checkUsernameExists(randomUsername);
        
        // If by rare chance the random username exists, try again
        let attempts = 0;
        while (exists && attempts < 5) {
            randomUsername = `guest_${Math.random().toString(36).substring(2, 10)}`;
            exists = await checkUsernameExists(randomUsername);
            attempts++;
        }
        
        // Sign in anonymously with username in metadata
        const { data, error } = await supabase.auth.signInAnonymously({
            options: {
                data: {
                    username: randomUsername
                }
            }
        });
        
        if (error) throw error;
        
        // No need to manually create profile - database trigger will handle it
    };

    const updateUsername = async (username: string) => {
        if (!user) throw new Error("User not authenticated");
        
        // First check if the new username is already taken (unless it's the user's current username)
        if (username !== profile?.username) {
            const usernameExists = await checkUsernameExists(username);
            if (usernameExists) {
                throw new UsernameExistsError("Username already taken. Please choose another username.");
            }
        }
        
        const { error } = await supabase
            .from('profiles')
            .update({ username })
            .eq('id', user.id);
            
        if (error) throw error;
        
        setProfile(prev => ({
            ...prev!,
            username
        }));
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
        isGuest,
        updateUsername,
        checkUsernameExists
    };

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