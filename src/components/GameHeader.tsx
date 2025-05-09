import { Box, Typography } from "@mui/material";
import styles from "../pages/index.module.css";
import { useGame } from "@/contexts/GameContext";

const GameHeader = () => {
  const { game, loading, myColor } = useGame();

  return (
    <Box sx={{ 
      p: 1.5, 
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <Typography className={styles.title} sx={{ fontSize: '1.5rem', m: 0 }}>
        Chess<span className={styles.pinkSpan}>2.0</span>
      </Typography>
      {game && !loading && (
        <Typography variant="body2" sx={{ color: 'white' }}>
          {myColor || 'Spectator'}
        </Typography>
      )}
    </Box>
  );
};

export default GameHeader; 