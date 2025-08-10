import React from "react";
import { Box, Container, Typography, Paper } from "@mui/material";
import FollowedUsersList from "@/components/FollowedUsersList";
import { withAuth } from "@/components/with-auth";
import Layout from "@/components/Layout";

const FollowingPage: React.FC = () => {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
            Following
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            View and spectate games from players you follow
          </Typography>
          <FollowedUsersList />
        </Paper>
      </Container>
    </Layout>
  );
};

export default withAuth(FollowingPage);