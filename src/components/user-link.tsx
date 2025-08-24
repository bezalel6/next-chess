import { Typography, Box } from "@mui/material";
import { PersonOutline } from "@mui/icons-material";
import { useRouter } from "next/router";

export default function UserLink({ username }: { username: string }) {
    const router = useRouter();

    const handleClick = () => {
        router.push(`/u/${username}`);
    };

    return (
        <Box
            onClick={handleClick}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                cursor: "pointer",
                color: "primary.main",
                "&:hover": {
                    textDecoration: "underline",
                },
            }}
            component="span"
        >
            <PersonOutline
                fontSize="small"
                sx={{ mr: 0.5 }}
            />
            <Typography component="span" variant="body2">
                {username}
            </Typography>
        </Box>
    );
}