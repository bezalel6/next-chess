import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

export function useTestAuthQuery() {
    const router = useRouter();
    const { signInWithTestUsername, user } = useAuth();
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastAuthParam = useRef<string | null>(null);

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
    }, [router.query.auth, router, signInWithTestUsername, isAuthenticating]);

    return { isAuthenticating, error };
}