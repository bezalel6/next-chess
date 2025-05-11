import { Box } from "@mui/material";
import AuthForm from "@/components/auth-form";
import { withAuth } from "@/components/with-auth";
import Head from "next/head";

function AuthPage() {
    return (
        <>
            <Head>
                <title>Ban Chess - Sign In</title>
                <meta name="description" content="Sign in to play Ban Chess - the unique chess variant where you can ban one of your opponent's moves each turn" />
                <link rel="icon" href="/logo.png" />
            </Head>
            <Box
                sx={{
                    minHeight: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2
                }}
            >
                <AuthForm />
            </Box>
        </>
    );
}

export default withAuth(AuthPage, { requireAuth: false }); 