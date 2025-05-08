import { Paper, Typography, Box } from '@mui/material';

interface CapturedPiecesProps {
    whitePieces: string[];
    blackPieces: string[];
}

export default function CapturedPieces({ whitePieces, blackPieces }: CapturedPiecesProps) {
    return (
        <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
                Captured Pieces
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" color="text.secondary">
                        White
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {whitePieces.map((piece, index) => (
                            <Typography
                                key={index}
                                sx={{
                                    fontSize: '1.2rem',
                                    fontFamily: 'serif',
                                    color: 'text.primary'
                                }}
                            >
                                {piece}
                            </Typography>
                        ))}
                    </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" color="text.secondary">
                        Black
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {blackPieces.map((piece, index) => (
                            <Typography
                                key={index}
                                sx={{
                                    fontSize: '1.2rem',
                                    fontFamily: 'serif',
                                    color: 'text.primary'
                                }}
                            >
                                {piece}
                            </Typography>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
}
