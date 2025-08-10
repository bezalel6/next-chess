import { Alert, Box, IconButton, Collapse } from "@mui/material";
import { Warning, Close } from "@mui/icons-material";
import { useState, useEffect } from "react";

const DevelopmentNotice = () => {
    const [open, setOpen] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const dismissed = localStorage.getItem('dev-notice-dismissed');
        if (dismissed === 'true') {
            setOpen(false);
        }
        setMounted(true);
    }, []);

    const handleDismiss = () => {
        setOpen(false);
        localStorage.setItem('dev-notice-dismissed', 'true');
    };

    if (!mounted) return null;

    return (
        <Collapse in={open}>
            <Box
                sx={{
                    background: 'linear-gradient(90deg, rgba(255, 152, 0, 0.15) 0%, rgba(255, 193, 7, 0.15) 100%)',
                    borderBottom: '1px solid rgba(255, 152, 0, 0.3)',
                    backdropFilter: 'blur(10px)',
                    position: 'relative',
                    zIndex: 1200,
                }}
            >
                <Alert
                    severity="warning"
                    icon={<Warning sx={{ color: '#ff9800' }} />}
                    action={
                        <IconButton
                            aria-label="close"
                            color="inherit"
                            size="small"
                            onClick={handleDismiss}
                        >
                            <Close fontSize="inherit" />
                        </IconButton>
                    }
                    sx={{
                        background: 'transparent',
                        color: 'text.primary',
                        border: 'none',
                        borderRadius: 0,
                        '& .MuiAlert-message': {
                            width: '100%',
                            textAlign: 'center',
                            fontSize: { xs: '0.875rem', sm: '0.95rem' },
                            fontWeight: 500,
                        },
                        '& .MuiAlert-icon': {
                            opacity: 0.9,
                        },
                        py: { xs: 1, sm: 1.5 },
                    }}
                >
                    <strong>🚧 Active Development</strong> — This website is under active development. 
                    Expect bugs, visual quirks, and occasional disruptions. Thank you for your patience!
                </Alert>
            </Box>
        </Collapse>
    );
};

export default DevelopmentNotice;