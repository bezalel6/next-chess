import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';

export default function SignoutPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    const handleSignout = async () => {
      try {
        await signOut();
      } catch (error) {
        console.error('Signout error:', error);
      } finally {
        // Always redirect to home after signout attempt
        router.push('/');
      }
    };

    handleSignout();
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