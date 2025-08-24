import { supabaseBrowser } from './supabase-browser';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// We'll pass the notify function when needed, to avoid circular dependencies
type NotifyFunction = (message: string, severity?: 'error' | 'warning' | 'info' | 'success') => void;

export const handleAuthError = async (
    error: { status?: number; message?: string } | unknown, 
    notify?: NotifyFunction
): Promise<boolean> => {
    // Check if this is an auth error (401 or 406)
    if (typeof error === 'object' && error !== null && 'status' in error) {
        const err = error as { status?: number };
        if (err.status !== 401 && err.status !== 406) {
            return false;
        }
    } else {
        return false;
    }

    // Prevent multiple simultaneous refresh attempts
    if (isRefreshing) {
        return refreshPromise || Promise.resolve(false);
    }

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            console.log('[AuthInterceptor] Attempting to refresh session...');
            
            // Try to refresh the session
            const { data: { session }, error: refreshError } = 
                await supabaseBrowser().auth.refreshSession();
            
            if (refreshError || !session) {
                console.error('[AuthInterceptor] Session refresh failed:', refreshError);
                
                // Notify the user
                if (notify) {
                    notify('Your session has expired. Please sign in again.', 'error');
                }
                
                // Clear the session and redirect to login
                await supabaseBrowser().auth.signOut();
                
                // Only redirect if we're not already on the login page
                if (typeof window !== 'undefined' && 
                    !window.location.pathname.includes('/auth/login') &&
                    !window.location.pathname.includes('/auth/signup')) {
                    
                    // Small delay to allow the toast to show
                    setTimeout(() => {
                        window.location.href = '/auth/login?session_expired=true';
                    }, 1000);
                }
                
                return false;
            }

            console.log('[AuthInterceptor] Session refreshed successfully');
            
            // Notify successful refresh
            if (notify) {
                notify('Session refreshed successfully', 'info');
            }
            
            return true;
        } catch (error) {
            console.error('[AuthInterceptor] Unexpected error during refresh:', error);
            
            if (notify) {
                notify('An error occurred while refreshing your session. Please sign in again.', 'error');
            }
            
            return false;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

// Helper to make authenticated requests with automatic retry on auth errors
export const authenticatedFetch = async (
    url: string, 
    options: RequestInit = {}
): Promise<Response> => {
    // Get current session
    const { data: { session } } = await supabaseBrowser().auth.getSession();
    
    if (!session) {
        throw new Error('No active session');
    }

    // Add auth header
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${session.access_token}`,
    };

    // Make the request
    let response = await fetch(url, { ...options, headers });

    // If we get a 401/406, try to refresh and retry once
    if (response.status === 401 || response.status === 406) {
        const refreshed = await handleAuthError({ status: response.status });
        
        if (refreshed) {
            // Get the new session and retry
            const { data: { session: newSession } } = await supabaseBrowser().auth.getSession();
            
            if (newSession) {
                headers['Authorization'] = `Bearer ${newSession.access_token}`;
                response = await fetch(url, { ...options, headers });
            }
        }
    }

    return response;
};