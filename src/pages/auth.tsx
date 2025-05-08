import { Box } from "@mui/material";
import AuthForm from "@/components/auth-form";
import { withAuth } from "@/components/with-auth";

function AuthPage() {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2
            }}
        >
            <AuthForm />
        </Box>
    );
}

export default withAuth(AuthPage, { requireAuth: false }); 