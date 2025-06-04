import { Typography, Link, Box } from "@mui/material";
import Image from "next/image";
import React from "react";

interface LogoProps {
    size?: 'small' | 'medium' | 'large';
    href?: string;
    showText?: boolean;
    className?: string;
}

const sizes = {
    small: { image: 32, text: '1rem' },
    medium: { image: 48, text: '1.5rem' },
    large: { image: 64, text: '2rem' },
};

const Logo: React.FC<LogoProps> = ({
    size = 'medium',
    href = "/",
    showText = true,
    className
}) => {
    const logoContent = (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                minWidth: 'fit-content',
            }}
        >
            <Image
                src="/logo.png"
                alt="Ban Chess Logo"
                width={sizes[size].image}
                height={sizes[size].image}
                style={{ marginRight: showText ? '12px' : '0' }}
            />
            {showText && (
                <Typography
                    className={className || "app-title-small"}
                    sx={{
                        m: 0,
                        fontSize: sizes[size].text,
                        fontWeight: 700,
                        lineHeight: 1,
                        letterSpacing: '-0.025em',
                    }}
                >
                    Ban<span className="pink-span">Chess</span>
                </Typography>
            )}
        </Box>
    );

    if (href) {
        return (
            <Link
                href={href}
                sx={{
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    '&:hover': {
                        opacity: 0.8,
                    },
                    transition: 'opacity 0.2s ease',
                }}
            >
                {logoContent}
            </Link>
        );
    }

    return logoContent;
};

export default Logo; 