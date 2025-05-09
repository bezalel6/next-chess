import { Box, Typography, CircularProgress } from "@mui/material";

const LoadingScreen = () => {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      width: '100%',
      height: '100%'
    }}>
      <CircularProgress />
      <Typography variant="body1" sx={{ mt: 2, color: 'white' }}>
        Loading game...
      </Typography>
    </Box>
  );
};

export default LoadingScreen; 