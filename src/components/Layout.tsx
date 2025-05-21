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
