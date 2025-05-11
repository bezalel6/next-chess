import { Box, Paper, Typography, Chip, List, ListItem, ListItemText } from "@mui/material";
import { People, SportsEsports, History } from "@mui/icons-material";
import { useConnection } from "@/contexts/ConnectionContext";
import { useEffect, useRef } from "react";

function ServerStats() {
    const { isConnected, stats } = useConnection();
    const logEndRef = useRef<HTMLDivElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new logs are added
    useEffect(() => {
        if (logContainerRef.current && logEndRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [stats.log]);

    if (!isConnected) {
        return null;
    }

    return (
        <Paper
            elevation={2}
            sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                maxWidth: 'fit-content'
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                    icon={<People />}
                    label={`${stats.activeUsers} Active Users`}
                    color="primary"
                    variant="outlined"
                />
                <Chip
                    icon={<SportsEsports />}
                    label={`${stats.activeGames} Active Games`}
                    color="secondary"
                    variant="outlined"
                />
            </Box>

            <Box
                ref={logContainerRef}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    maxHeight: '200px',
                    overflow: 'auto'
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
                                        backgroundColor: 'rgba(25, 118, 210, 0.1)',
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
                                secondaryTypographyProps={{ variant: 'caption' }}
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