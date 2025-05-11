import { Box, Typography } from "@mui/material";
import styles from "../styles/index.module.css";
import { useGame } from "@/contexts/GameContext";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import Link from "next/link";

const GameHeader = () => {
  const { game, loading, myColor } = useGame();
  const { profile } = useAuth();

  // Display username or role
  const displayRole = () => {
    if (!game || loading) return null;

    if (myColor) {
      return `${profile?.username || 'You'} (${myColor})`;
    } else {
      return 'Spectator';
    }
  };

  return (
    <Box sx={{
      p: 1.5,
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
        <Image src="/logo.png" alt="Ban Chess Logo" width={48} height={48} style={{ marginRight: '12px' }} />
        <Typography className={styles.title} sx={{ fontSize: '1.5rem', m: 0 }}>
          Ban<span className={styles.pinkSpan}>Chess</span>
        </Typography>
      </Link>
      {game && !loading && (
        <Typography variant="body2" sx={{ color: 'white' }}>
          {displayRole()}
        </Typography>
      )}
    </Box>
  );
};

export default GameHeader; 