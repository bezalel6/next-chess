import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Custom404() {
  const router = useRouter();

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          gap: 3,
        }}
      >
        <Typography variant="h1" sx={{ fontSize: '6rem', fontWeight: 'bold' }}>
          404
        </Typography>
        <Typography variant="h4" gutterBottom>
          Page Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={() => router.back()}
          >
            Go Back
          </Button>
          <Link href="/" passHref legacyBehavior>
            <Button variant="outlined">
              Go Home
            </Button>
          </Link>
        </Box>
      </Box>
    </Container>
  );
}