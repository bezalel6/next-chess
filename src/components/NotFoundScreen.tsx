import { Box, Typography } from "@mui/material";

const NotFoundScreen = () => {
  return (
    <Box sx={{ 
      display: 'flex', 
      width: '100%', 
      height: '100%', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }}>
      <Typography variant="body1" sx={{ color: 'white' }}>
        Game not found or has been completed.
      </Typography>
    </Box>
  );
};

export default NotFoundScreen; 