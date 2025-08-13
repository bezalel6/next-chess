import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import Head from 'next/head';

export default function TestAuth() {
    const router = useRouter();
    const { signInWithTestUsername } = useAuth();
    const { username, redirect, as: asParam } = router.query;

    useEffect(() => {
        // Only handle in test mode
        if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
            router.push('/');
            return;
        }

        if (!username || !redirect) {
            router.push('/');
            return;
        }

        const authenticate = async () => {
            try {
                // Authenticate as the specified user
                await signInWithTestUsername(username as string);
                
                // Build redirect URL with ?as parameter if provided
                let redirectUrl = redirect as string;
                if (asParam) {
                    const separator = redirectUrl.includes('?') ? '&' : '?';
                    redirectUrl = `${redirectUrl}${separator}as=${asParam}`;
                }
                
                // Redirect to the target page
                router.push(redirectUrl);
            } catch (err) {
                console.error('Test auth failed:', err);
                router.push('/');
            }
        };

        authenticate();
    }, [router, signInWithTestUsername, username, redirect, asParam]);

    return (
        <>
            <Head>
                <title>Authenticating...</title>
            </Head>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    bgcolor: '#161512',
                    color: '#bababa',
                }}
            >
                <CircularProgress sx={{ mb: 2, color: '#81c784' }} />
                <Typography variant="h6">
                    Authenticating...
                </Typography>
            </Box>
        </>
    );
}