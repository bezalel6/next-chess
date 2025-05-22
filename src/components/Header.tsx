import { Box, Typography, Link } from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import UserLink from "./user-link";

const Header = () => {
    const { profile } = useAuth();

    return (
        <Box sx={{
            p: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-evenly',
            alignItems: 'center',
            gap: { xs: 2, sm: 0 },
            bgcolor: 'background.paper',
        }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                <Image src="/logo.png" alt="Ban Chess Logo" width={64} height={64} style={{ marginRight: '12px' }} />
                <Typography className="app-title-small" sx={{ m: 0 }}>
                    Ban<span className="pink-span">Chess</span>
                </Typography>
            </Link>
            {profile?.username && <UserLink username={profile.username} />}
        </Box>
    );
};

export default Header; 