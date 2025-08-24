import { useCallback } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { handleAuthError } from '@/utils/auth-interceptor';

export function useAuthErrorHandler() {
    const { notify, notifyError, notifyWarning } = useNotification();

    const handleAuthErrorWithNotification = useCallback(async (error: unknown) => {
        // Custom notify function that uses our notification context
        const notifyFn = (message: string, severity?: 'error' | 'warning' | 'info' | 'success') => {
            switch (severity) {
                case 'error':
                    notifyError(message);
                    break;
                case 'warning':
                    notifyWarning(message);
                    break;
                default:
                    notify(message, severity || 'info');
            }
        };

        return handleAuthError(error, notifyFn);
    }, [notify, notifyError, notifyWarning]);

    return { handleAuthErrorWithNotification };
}