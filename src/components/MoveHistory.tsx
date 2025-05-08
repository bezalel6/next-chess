import { Paper, Typography, Box, List, ListItem, ListItemText } from '@mui/material';

interface MoveHistoryProps {
    moves: string[];
}

export function MoveHistory({ moves }: MoveHistoryProps) {
    // Group moves into pairs (white and black)
    const movePairs = moves.reduce<{ white: string; black: string | null }[]>((pairs, move, index) => {
        if (index % 2 === 0) {
            // White move
            pairs.push({ white: move, black: null });
        } else {
            // Black move
            const lastPair = pairs[pairs.length - 1];
            if (lastPair) {
                lastPair.black = move;
            }
        }
        return pairs;
    }, []);

    return (
        <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
                Move History
            </Typography>
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {movePairs.map((pair, index) => (
                    <ListItem key={index} dense>
                        <ListItemText
                            primary={
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Typography component="span" color="text.secondary" sx={{ minWidth: '2em' }}>
                                        {index + 1}.
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Typography component="span" sx={{ minWidth: '3em' }}>
                                            {pair.white}
                                        </Typography>
                                        {pair.black && (
                                            <Typography component="span" sx={{ minWidth: '3em' }}>
                                                {pair.black}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            }
                        />
                    </ListItem>
                ))}
            </List>
        </Paper>
    );
} 