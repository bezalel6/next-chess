import { Box } from "@mui/material";
import Header from "./Header";
import type { ReactNode } from "react";

interface LayoutProps {
    children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
    return (
        <>
            <Header />
            <Box
                component="main"
                sx={{
                    height: 'calc(100vh - 72px)', // Adjust height based on header height
                    width: '100%',
                    overflowY: 'auto',
                    bgcolor: 'background.default'
                }}
            >
                {children}
            </Box>
        </>
    );
};

export default Layout;
