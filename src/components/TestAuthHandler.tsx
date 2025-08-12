import { useTestAuthQuery } from '@/hooks/useTestAuthQuery';
import { Alert, Snackbar } from '@mui/material';

export function TestAuthHandler() {
    const { isAuthenticating, error } = useTestAuthQuery();

    // Only show in test mode
    if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
        return null;
    }

    return (
        <>
            {/* Show loading indicator when authenticating */}
            {isAuthenticating && (
                <Snackbar
                    open={true}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                >
                    <Alert severity="info">
                        Authenticating test user...
                    </Alert>
                </Snackbar>
            )}

            {/* Show error if authentication failed */}
            {error && (
                <Snackbar
                    open={true}
                    autoHideDuration={6000}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                >
                    <Alert severity="error">
                        Test auth failed: {error}
                    </Alert>
                </Snackbar>
            )}
        </>
    );
}