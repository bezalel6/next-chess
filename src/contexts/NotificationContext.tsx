import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Snackbar, Alert } from '@mui/material';
import type { AlertColor } from '@mui/material';

interface Notification {
  message: string;
  severity: AlertColor;
  duration?: number;
}

interface NotificationContextType {
  notify: (message: string, severity?: AlertColor, duration?: number) => void;
  notifyError: (message: string) => void;
  notifySuccess: (message: string) => void;
  notifyWarning: (message: string) => void;
  notifyInfo: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [open, setOpen] = useState(false);

  const notify = useCallback((message: string, severity: AlertColor = 'info', duration: number = 4000) => {
    setNotification({ message, severity, duration });
    setOpen(true);
  }, []);

  const notifyError = useCallback((message: string) => {
    notify(message, 'error', 6000);
  }, [notify]);

  const notifySuccess = useCallback((message: string) => {
    notify(message, 'success', 3000);
  }, [notify]);

  const notifyWarning = useCallback((message: string) => {
    notify(message, 'warning', 5000);
  }, [notify]);

  const notifyInfo = useCallback((message: string) => {
    notify(message, 'info', 4000);
  }, [notify]);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <NotificationContext.Provider 
      value={{ 
        notify, 
        notifyError, 
        notifySuccess, 
        notifyWarning, 
        notifyInfo 
      }}
    >
      {children}
      <Snackbar
        open={open}
        autoHideDuration={notification?.duration || 4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleClose} 
          severity={notification?.severity || 'info'} 
          sx={{ width: '100%' }}
          variant="filled"
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}