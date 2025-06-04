import { Box } from "@mui/material";
import Header from "./Header";
import type { ReactNode } from "react";

interface LayoutProps {
    children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            width: '100%'
        }}>
            <Header />
            <Box
                component="main"
                sx={{
                    flex: 1,
                    minHeight: 0,
                    width: '100%',
                    overflowY: 'auto',
                    bgcolor: 'background.default'
                }}
            >
                {children}
            </Box>
        </Box>
    );
};

export default Layout;
