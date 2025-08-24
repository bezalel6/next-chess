import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';

export default function LogoutPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        await signOut();
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        // Always redirect to home after logout attempt
        router.push('/');
      }
    };

    handleLogout();
  }, [signOut, router]);

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <CircularProgress />
    </Box>
  );
}