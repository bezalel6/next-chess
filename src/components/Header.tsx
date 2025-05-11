import { Box, Typography } from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContext";
import Image from "next/image";
import Link from "next/link";

const Header = () => {
    const { profile } = useAuth();
    const { game, loading, myColor } = useGame();

    // Display username or role in game
    const displayUserInfo = () => {
        // If in a game, show the game-specific user info
        if (game && !loading) {
            if (myColor) {
                return `${profile?.username || 'You'} (${myColor})`;
            } else {
                return 'Spectator';
            }
        }

        // Otherwise just show the username if logged in
        return profile?.username || '';
    };

    return (
        <Box sx={{
            p: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            bgcolor: 'background.paper',
        }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                <Image src="/logo.png" alt="Ban Chess Logo" width={48} height={48} style={{ marginRight: '12px' }} />
                <Typography className="app-title-small" sx={{ m: 0 }}>
                    Ban<span className="pink-span">Chess</span>
                </Typography>
            </Link>
            {displayUserInfo() && (
                <Typography variant="body2" color="text.primary">
                    {displayUserInfo()}
                </Typography>
            )}
        </Box>
    );
};

export default Header; 