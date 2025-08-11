import { Box } from "@mui/material";
import AuthForm from "@/components/auth-form";
import { withAuth } from "@/components/with-auth";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useCallback } from "react";

/**
 * Catch-all auth page that handles all auth routes
 * /auth/login, /auth/signup, /auth/signin (legacy redirect)
 */
function AuthModePage() {
    const router = useRouter();
    const { mode } = router.query;
    
    // Extract the auth mode from the URL
    const authMode = Array.isArray(mode) ? mode[0] : mode;
    
    // Handle legacy signin redirect
    useEffect(() => {
        if (authMode === 'signin') {
            router.replace('/auth/login');
        }
    }, [authMode, router]);
    
    // Handle mode changes from the form
    const handleModeChange = useCallback((newMode: 'login' | 'signup') => {
        router.push(`/auth/${newMode}`, undefined, { shallow: true });
    }, [router]);
    
    // Determine if we're in signup or login mode
    const isSignUp = authMode === 'signup';
    
    const title = isSignUp ? "Ban Chess - Sign Up" : "Ban Chess - Log In";
    const description = isSignUp 
        ? "Sign up to play Ban Chess - the unique chess variant where you can ban one of your opponent's moves each turn"
        : "Log in to play Ban Chess - the unique chess variant where you can ban one of your opponent's moves each turn";
    
    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="description" content={description} />
                <link rel="icon" href="/logo.png" />
            </Head>
            <Box
                sx={{
                    minHeight: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2
                }}
            >
                <AuthForm 
                    mode={isSignUp ? 'signup' : 'login'} 
                    onModeChange={handleModeChange}
                />
            </Box>
        </>
    );
}

export default withAuth(AuthModePage, { requireAuth: false });