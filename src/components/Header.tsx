import { Box, Typography, Link, Tabs, Tab } from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContext";
import Image from "next/image";
import React, { useEffect } from "react";
import { useRouter } from 'next/compat/router';

const tabLabels = ["Home", "How To Play", "About"];

const Header = () => {
    const { profile } = useAuth();
    const { game, loading, myColor } = useGame();
    const router = useRouter();
    const { tab } = router.query;
    // Determine tab index from query param
    const tabValue = typeof tab === 'string' ? tabLabels.findIndex(l => l.replace(/\s+/g, '').toLowerCase() === tab.toLowerCase()) : 0;

    // Set ?tab= in URL when tab changes
    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        const tabKey = tabLabels[newValue].replace(/\s+/g, '').toLowerCase();
        router.replace({
            pathname: router.pathname,
            query: { ...router.query, tab: tabKey },
        }, undefined, { shallow: true });
    };

    // Dynamic title based on tab
    const headerTitle = tabLabels[tabValue] || tabLabels[0];

    // Display username or role in game
    const displayUserInfo = () => {
        if (game && !loading) {
            if (myColor) {
                return `${profile?.username || 'You'} (${myColor})`;
            } else {
                return 'Spectator';
            }
        }
        return profile?.username || '';
    };

    return (
        <Box sx={{
            p: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'column', md: 'row' },
            justifyContent: { xs: 'center', sm: 'center', md: 'space-between' },
            alignItems: 'center',
            bgcolor: 'background.paper',
            gap: { xs: 1, sm: 1, md: 0 },
            textAlign: { xs: 'center', sm: 'center', md: 'left' },
            position: 'sticky',
            top: 0,
            zIndex: 1100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
            <LogoLink />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <Typography variant="h6" sx={{ mb: { xs: 0.5, md: 0 }, fontWeight: 600 }}>
                    {headerTitle}
                </Typography>
                <Tabs
                    value={tabValue === -1 ? 0 : tabValue}
                    onChange={handleTabChange}
                    centered
                    sx={{ minWidth: 200, mt: { xs: 1, sm: 1, md: 0 }, mb: { xs: 1, sm: 1, md: 0 } }}
                >
                    {tabLabels.map(label => (
                        <Tab key={label} label={label} />
                    ))}
                </Tabs>
            </Box>
            {displayUserInfo() && (
                <Typography
                    variant="body2"
                    color="text.primary"
                    sx={{ minWidth: 100, textAlign: { xs: 'center', sm: 'center', md: 'right' }, mt: { xs: 1, sm: 1, md: 0 } }}
                >
                    {displayUserInfo()}
                </Typography>
            )}
        </Box >
    );
};
const LogoLink = () => <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
    <Image src="/logo.png" alt="Ban Chess Logo" width={48} height={48} style={{ marginRight: '12px' }} />
    <Typography className="app-title-small" sx={{ m: 0 }}>
        Ban<span className="pink-span">Chess</span>
    </Typography>
</Link>
export default Header; 