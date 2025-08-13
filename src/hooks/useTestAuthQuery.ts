import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

export function useTestAuthQuery() {
    const router = useRouter();
    const { signInWithTestUsername, resetTestAccount, user, profile, signOut } = useAuth();
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const lastAuthParam = useRef<string | null>(null);
    const hasReset = useRef(false);
    const hasCleanedSession = useRef(false);

    // Handle clean/logout query parameter first
    useEffect(() => {
        // Only run in test mode
        if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
            return;
        }

        // Check for clean query parameter (forces logout)
        const cleanParam = router.query.clean as string | undefined;
        
        // Skip if no clean param or already cleaned
        if (!cleanParam || hasCleanedSession.current) {
            return;
        }

        const cleanSession = async () => {
            hasCleanedSession.current = true;
            
            try {
                // Sign out if there's an existing session
                if (user) {
                    await signOut();
                }
                
                // Remove clean param from URL
                const { clean, ...restQuery } = router.query;
                await router.replace({
                    pathname: router.pathname,
                    query: restQuery
                }, undefined, { shallow: true });
            } catch (err) {
                console.error('Session cleanup failed:', err);
                // Still remove the clean param even on failure
                const { clean, ...restQuery } = router.query;
                await router.replace({
                    pathname: router.pathname,
                    query: restQuery
                }, undefined, { shallow: true });
            }
        };

        cleanSession();
    }, [router.query.clean, router, signOut, user]);

    useEffect(() => {
        // Only run in test mode
        if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
            return;
        }

        // Check for auth query parameter
        const authParam = router.query.auth as string | undefined;
        
        // Skip if:
        // 1. No auth param
        // 2. Currently authenticating
        // 3. Already authenticated with this exact param (prevents re-auth loop)
        if (!authParam || isAuthenticating || (authParam === lastAuthParam.current)) {
            return;
        }

        // Check if user is already signed in as this username
        if (profile?.username === authParam) {
            // Just remove the query param without any authentication
            const removeQueryParam = async () => {
                const { auth, ...restQuery } = router.query;
                await router.replace({
                    pathname: router.pathname,
                    query: restQuery
                }, undefined, { shallow: true });
            };
            removeQueryParam();
            return;
        }

        // Attempt authentication
        const authenticate = async () => {
            setIsAuthenticating(true);
            setError(null);
            lastAuthParam.current = authParam; // Remember this param

            try {
                await signInWithTestUsername(authParam);
                
                // Remove auth param from URL after successful auth
                const { auth, ...restQuery } = router.query;
                await router.replace({
                    pathname: router.pathname,
                    query: restQuery
                }, undefined, { shallow: true });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
                setError(errorMessage);
                console.error('Test auth query failed:', errorMessage);
                
                // Still remove the auth param even on failure
                const { auth, ...restQuery } = router.query;
                await router.replace({
                    pathname: router.pathname,
                    query: restQuery
                }, undefined, { shallow: true });
            } finally {
                setIsAuthenticating(false);
            }
        };

        authenticate();
    }, [router.query.auth, router, signInWithTestUsername, isAuthenticating, user, profile]);

    // Handle reset query parameter
    useEffect(() => {
        // Only run in test mode
        if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
            return;
        }

        const resetParam = router.query.reset as string | undefined;
        
        // Skip if no reset param, already resetting, or already reset
        if (!resetParam || isResetting || hasReset.current) {
            return;
        }

        const performReset = async () => {
            setIsResetting(true);
            hasReset.current = true;
            
            try {
                // Use the provided username or current user's username
                const username = resetParam === 'true' 
                    ? profile?.username 
                    : resetParam;
                    
                if (!username) {
                    throw new Error('No username available for reset');
                }
                
                await resetTestAccount(username);
                
                // Remove reset param from URL
                const { reset, ...restQuery } = router.query;
                await router.replace({
                    pathname: router.pathname,
                    query: restQuery
                }, undefined, { shallow: true });
                
                // Reload the page to reflect the reset
                window.location.reload();
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Reset failed';
                setError(errorMessage);
                console.error('Test account reset failed:', errorMessage);
                
                // Still remove the reset param even on failure
                const { reset, ...restQuery } = router.query;
                await router.replace({
                    pathname: router.pathname,
                    query: restQuery
                }, undefined, { shallow: true });
            } finally {
                setIsResetting(false);
            }
        };

        performReset();
    }, [router.query.reset, router, resetTestAccount, isResetting, user, profile]);

    return { isAuthenticating, error, isResetting };
}