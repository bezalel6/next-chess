import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Base /auth route redirects to /auth/login
 */
export default function AuthPage() {
    const router = useRouter();
    
    useEffect(() => {
        router.replace('/auth/login');
    }, [router]);
    
    return null;
} 