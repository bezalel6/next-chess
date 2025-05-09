import { Box, Typography, Button } from "@mui/material";
import { useRouter } from "next/router";
import { Home } from "@mui/icons-material";

const NotFoundScreen = () => {
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
        This game may not exist, has been completed, or you don&apos;t have permission to view it.
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