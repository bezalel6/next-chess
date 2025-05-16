import { Box, Paper, Typography, Chip, List, ListItem, ListItemText } from "@mui/material";
import { People, SportsEsports, History } from "@mui/icons-material";
import { useConnection } from "@/contexts/ConnectionContext";
import { useEffect, useRef } from "react";

function ServerStats() {
    const { stats } = useConnection();
    const logEndRef = useRef<HTMLDivElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new logs are added
    useEffect(() => {
        if (logContainerRef.current && logEndRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [stats.log]);

    return (
        <Paper
            elevation={3}
            sx={{
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(8px)',
                borderRadius: 2
            }}
        >
            <Typography variant="h6" color="text.primary" sx={{ mb: 1 }}>
                Server Status
            </Typography>

            {/* <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Chip
                    icon={<People />}
                    label={`${stats.activeUsers} Active Users`}
                    color="primary"
                    sx={{ fontWeight: 'medium', px: 1 }}
                />
                <Chip
                    icon={<SportsEsports />}
                    label={`${stats.activeGames} Active Games`}
                    color="secondary"
                    sx={{ fontWeight: 'medium', px: 1 }}
                />
            </Box> */}

            <Box
                ref={logContainerRef}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    maxHeight: '200px',
                    overflow: 'auto',
                    mt: 1,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    p: 1
                }}
            >
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <History fontSize="small" /> Activity Log
                </Typography>
                <List dense sx={{ p: 0 }}>
                    {stats.log.map((entry, index) => (
                        <ListItem
                            key={index}
                            sx={{
                                py: 0.5,
                                animation: index === stats.log.length - 1 ? 'highlight 1s ease-out' : 'none',
                                '@keyframes highlight': {
                                    '0%': {
                                        backgroundColor: 'rgba(144, 202, 249, 0.1)',
                                    },
                                    '100%': {
                                        backgroundColor: 'transparent',
                                    },
                                },
                            }}
                        >
                            <ListItemText
                                primary={entry.message}
                                secondary={new Date(entry.timestamp).toLocaleTimeString()}
                                primaryTypographyProps={{ variant: 'body2' }}
                                secondaryTypographyProps={{ variant: 'caption', sx: { color: 'text.secondary' } }}
                            />
                        </ListItem>
                    ))}
                    <div ref={logEndRef} />
                </List>
            </Box>
        </Paper>
    );
}

export default ServerStats; 