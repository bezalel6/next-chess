import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import type { ComponentType } from 'react';

export function withAuth<P extends object>(
    WrappedComponent: ComponentType<P>,
    options: {
        requireAuth?: boolean;
        redirectTo?: string;
    } = {}
) {
    const { requireAuth = true, redirectTo = '/auth' } = options;

    return function WithAuthComponent(props: P) {
        const { user, isLoading } = useAuth();
        const router = useRouter();

        useEffect(() => {
            if (!isLoading) {
                if (requireAuth && !user) {
                    router.replace(redirectTo);
                } else if (!requireAuth && user) {
                    router.replace('/');
                }
            }
        }, [user, isLoading, requireAuth, redirectTo, router]);

        if (isLoading) {
            return <div>Loading...</div>; // You might want to replace this with a proper loading component
        }

        if (requireAuth && !user) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };
} 