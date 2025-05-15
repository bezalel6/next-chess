import { Box, Typography, Button } from "@mui/material";
import { useRouter } from 'next/compat/router';

import { Home } from "@mui/icons-material";

interface NotFoundScreenProps {
  message?: string;
}

const NotFoundScreen = ({ message }: NotFoundScreenProps) => {
  const router = useRouter();

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 3
    }}>
      <Typography variant="h5" sx={{ color: 'white', textAlign: 'center' }}>
        Game Not Available
      </Typography>
      <Typography variant="body1" sx={{ color: 'white', textAlign: 'center', maxWidth: '500px' }}>
        {message || "This game may not exist, has been completed, or you don't have permission to view it."}
        <br />
        <br />
        Please return to the homepage to view your active games or start a new one.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        startIcon={<Home />}
        onClick={() => router.push('/')}
        sx={{ mt: 2 }}
      >
        Return to Home
      </Button>
    </Box>
  );
};

export default NotFoundScreen;