import {
    Box,
    Typography,
    Link,
    Button,
    useTheme,
    useMediaQuery,
    IconButton,
    Drawer,
    Fade,
    Slide,
    useScrollTrigger,
    AppBar,
    Toolbar
} from "@mui/material";
import {
    Menu as MenuIcon,
    Close as CloseIcon,
    PersonOutline as PersonIcon
} from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContext";
import React, { useState, useEffect } from "react";
import TabDialog from './TabDialog';
import UserLink from "./user-link";
import Logo from "./Logo";

// Hook for scroll-based header effects
function useScrollEffect() {
    const trigger = useScrollTrigger({
        disableHysteresis: true,
        threshold: 0,
    });

    return trigger;
}

// Mobile Navigation Component
const MobileNavigation = ({ open, onClose, items }: {
    open: boolean;
    onClose: () => void;
    items: React.ReactNode[];
}) => {
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

    const toggleExpanded = (index: number) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedItems(newExpanded);
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: '100vw',
                    maxWidth: 400,
                    bgcolor: 'rgba(18, 18, 18, 0.98)',
                    backdropFilter: 'blur(24px)',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundImage: 'none',
                }
            }}
            transitionDuration={{
                enter: 350,
                exit: 280
            }}
        >
            <Box
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        p: 3,
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <Logo size="medium" href="/" />
                    <IconButton
                        onClick={onClose}
                        sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.08)',
                                color: 'white',
                            },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Navigation Items */}
                <Box
                    sx={{
                        flex: 1,
                        py: 2,
                        px: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                    }}
                >
                    {items.map((item, index) => (
                        <Box
                            key={index}
                            sx={{
                                borderRadius: 2,
                                overflow: 'hidden',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                                },
                            }}
                        >
                            <Box sx={{ p: 2 }}>
                                {item}
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Drawer>
    );
};



const Header = () => {
    const { profile } = useAuth();
    const { game, loading, myColor } = useGame();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isScrolled = useScrollEffect();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Display user info - prioritize game context over general user info
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

    const handleMobileMenuToggle = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const navigationItems = [
        <HowToPlayDialog key="how-to-play" />,
        <AboutDialog key="about" />,
        <ContactDialog key="contact" />
    ];

    if (!mounted) return null;

    return (
        <>
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    bgcolor: isScrolled
                        ? 'rgba(18, 18, 18, 0.95)'
                        : 'rgba(18, 18, 18, 0.85)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: isScrolled
                        ? '1px solid rgba(255, 255, 255, 0.12)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    backgroundImage: 'none',
                    boxShadow: isScrolled
                        ? '0 8px 32px rgba(0, 0, 0, 0.12)'
                        : 'none',
                }}
            >
                <Toolbar
                    sx={{
                        minHeight: { xs: 64, md: 72 },
                        px: { xs: 2, sm: 3, md: 4 },
                        maxWidth: '1400px',
                        mx: 'auto',
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: isMobile
                            ? '1fr auto'
                            : '1fr 2fr 1fr',
                        alignItems: 'center',
                        gap: 2,
                    }}
                >
                    {/* Left Section - Logo */}
                    <Fade in={mounted} timeout={600}>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'flex-start',
                                alignItems: 'center',
                                transition: 'transform 0.3s ease',
                                '&:hover': {
                                    transform: 'scale(1.02)',
                                },
                            }}
                        >
                            <Logo size={isMobile ? "small" : "medium"} />
                        </Box>
                    </Fade>

                    {/* Center Section - Navigation (Desktop Only, Always Perfectly Centered) */}
                    {!isMobile && (
                        <Slide direction="down" in={mounted} timeout={800}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 1,
                                    width: '100%',
                                }}
                            >
                                {navigationItems.map((item, index) => (
                                    <Fade
                                        key={index}
                                        in={mounted}
                                        timeout={900 + index * 100}
                                    >
                                        <Box>{item}</Box>
                                    </Fade>
                                ))}
                            </Box>
                        </Slide>
                    )}

                    {/* Right Section - User Info & Mobile Menu */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 2,
                        }}
                    >
                        {/* User Info */}
                        {displayUserInfo() && (
                            <Fade in={mounted} timeout={1000}>
                                <Box
                                    sx={{
                                        display: { xs: myColor ? 'none' : 'flex', sm: 'flex' },
                                        alignItems: 'center',
                                        gap: 1,
                                        px: { xs: 1.5, sm: 2 },
                                        py: 1,
                                        borderRadius: 2,
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        backdropFilter: 'blur(8px)',
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            bgcolor: 'rgba(255, 255, 255, 0.08)',
                                            borderColor: 'rgba(255, 255, 255, 0.15)',
                                        },
                                    }}
                                >
                                    {profile?.username && myColor ? (
                                        <UserLink username={profile.username} />
                                    ) : (
                                        <>
                                            <PersonIcon
                                                sx={{
                                                    fontSize: '1.1rem',
                                                    color: 'rgba(255, 255, 255, 0.6)'
                                                }}
                                            />
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 500,
                                                    fontSize: '0.875rem',
                                                    color: 'rgba(255, 255, 255, 0.9)',
                                                }}
                                            >
                                                {displayUserInfo()}
                                            </Typography>
                                        </>
                                    )}
                                </Box>
                            </Fade>
                        )}

                        {/* Mobile Menu Button */}
                        {isMobile && (
                            <Fade in={mounted} timeout={1100}>
                                <IconButton
                                    onClick={handleMobileMenuToggle}
                                    sx={{
                                        color: 'rgba(255, 255, 255, 0.8)',
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: 2,
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        '&:hover': {
                                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                                            borderColor: 'rgba(255, 255, 255, 0.15)',
                                            color: 'white',
                                            transform: 'scale(1.05)',
                                        },
                                        '&:active': {
                                            transform: 'scale(0.98)',
                                        },
                                    }}
                                >
                                    <MenuIcon />
                                </IconButton>
                            </Fade>
                        )}
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Mobile Navigation Drawer */}
            <MobileNavigation
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                items={navigationItems}
            />
        </>
    );
};

// Enhanced Dialog Components with better button styling
const HowToPlayDialog = () => (
    <TabDialog
        title="How To Play"
        buttonProps={{
            variant: 'outlined',
            size: 'small',
            sx: {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.95rem',
                px: 2.5,
                py: 1,
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1))',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    zIndex: -1,
                },
                '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 20px rgba(168, 85, 247, 0.15)',
                    '&::before': {
                        opacity: 1,
                    },
                },
                '&:active': {
                    transform: 'translateY(0)',
                },
            },
        }}
    >
        <Typography variant="h6" gutterBottom sx={{
            color: 'primary.main',
            fontWeight: 600,
        }}>
            Welcome to BanChess!
        </Typography>
        <Typography variant="body1" paragraph sx={{
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.85)',
        }}>
            BanChess is an exciting variant of chess where strategy begins before the first move.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{
            fontWeight: 600,
            mt: 3,
            color: 'rgba(255, 255, 255, 0.95)',
        }}>
            Game Rules:
        </Typography>
        <Box
            component="ol"
            sx={{
                pl: 2,
                '& li': {
                    mb: 1.5,
                    '&::marker': {
                        color: 'primary.main',
                        fontWeight: 600,
                    }
                }
            }}
        >
            <li>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    <strong style={{ color: 'rgba(255, 255, 255, 0.95)' }}>Banning Phase:</strong> Each player takes turns banning pieces or moves from the board before the game begins.
                </Typography>
            </li>
            <li>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    <strong style={{ color: 'rgba(255, 255, 255, 0.95)' }}>Chess Phase:</strong> Once all bans are complete, play proceeds according to standard chess rules.
                </Typography>
            </li>
            <li>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    <strong style={{ color: 'rgba(255, 255, 255, 0.95)' }}>Victory:</strong> Checkmate your opponent to win!
                </Typography>
            </li>
        </Box>
        <Typography variant="body2" sx={{
            mt: 3,
            fontStyle: 'italic',
            color: 'primary.light',
            textAlign: 'center',
            p: 2,
            bgcolor: 'rgba(168, 85, 247, 0.1)',
            borderRadius: 2,
            border: '1px solid rgba(168, 85, 247, 0.2)',
        }}>
            Strategic banning can completely change the game dynamics!
        </Typography>
    </TabDialog>
);

const AboutDialog = () => (
    <TabDialog
        title="About BanChess"
        buttonProps={{
            variant: 'outlined',
            size: 'small',
            sx: {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.95rem',
                px: 2.5,
                py: 1,
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1))',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    zIndex: -1,
                },
                '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 20px rgba(168, 85, 247, 0.15)',
                    '&::before': {
                        opacity: 1,
                    },
                },
                '&:active': {
                    transform: 'translateY(0)',
                },
            },
        }}
    >
        <Typography variant="body1" paragraph sx={{
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.85)',
        }}>
            BanChess is an innovative chess variant that adds a strategic banning phase before traditional gameplay begins.
        </Typography>
        <Typography variant="body1" paragraph sx={{
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.85)',
        }}>
            Created for chess enthusiasts who love tactical thinking and want to experience chess in a completely new way.
        </Typography>
        <Box sx={{
            mt: 3,
            p: 3,
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 2,
            border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
            <Typography variant="subtitle2" gutterBottom sx={{
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.95)',
                mb: 2,
            }}>
                Key Features:
            </Typography>
            <Box
                component="ul"
                sx={{
                    pl: 2,
                    m: 0,
                    '& li': {
                        mb: 1,
                        '&::marker': {
                            color: 'primary.main',
                        }
                    }
                }}
            >
                <li><Typography variant="body2" sx={{ lineHeight: 1.5 }}>Strategic piece banning system</Typography></li>
                <li><Typography variant="body2" sx={{ lineHeight: 1.5 }}>Real-time multiplayer gameplay</Typography></li>
                <li><Typography variant="body2" sx={{ lineHeight: 1.5 }}>Spectator mode for watching games</Typography></li>
                <li><Typography variant="body2" sx={{ lineHeight: 1.5 }}>Modern, responsive interface</Typography></li>
            </Box>
        </Box>
    </TabDialog>
);

const ContactDialog = () => (
    <TabDialog
        title="Contact Us"
        buttonProps={{
            variant: 'outlined',
            size: 'small',
            sx: {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.95rem',
                px: 2.5,
                py: 1,
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1))',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    zIndex: -1,
                },
                '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 20px rgba(168, 85, 247, 0.15)',
                    '&::before': {
                        opacity: 1,
                    },
                },
                '&:active': {
                    transform: 'translateY(0)',
                },
            },
        }}
    >
        <Typography variant="body1" paragraph sx={{
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.85)',
        }}>
            We&apos;d love to hear from you! Whether you have feedback, questions, or suggestions for improving BanChess.
        </Typography>
        <Box sx={{
            mt: 3,
            p: 3,
            bgcolor: 'rgba(168, 85, 247, 0.08)',
            borderRadius: 2,
            border: '1px solid rgba(168, 85, 247, 0.2)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.8))',
            }
        }}>
            <Typography variant="subtitle2" gutterBottom sx={{
                fontWeight: 600,
                color: 'primary.light',
                mb: 2,
            }}>
                Get in Touch:
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.6 }}>
                Email us at{' '}
                <Link
                    href="mailto:support@banchess.com"
                    sx={{
                        fontWeight: 600,
                        color: 'primary.light',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            textDecoration: 'underline',
                            color: 'primary.main',
                        }
                    }}
                >
                    support@banchess.com
                </Link>
            </Typography>
            <Typography variant="body2" sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.85rem',
            }}>
                We typically respond within 24 hours!
            </Typography>
        </Box>
    </TabDialog>
);

export default Header; 