import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Type for components that have a title property
export interface TitledComponent extends React.FC {
    title: string;
}

interface TabDialogProps {
    title: React.ReactNode;
    buttonLabel?: React.ReactNode;
    children: React.ReactNode;
    actions?: React.ReactNode;
    variant?: 'dialog' | 'panel';
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    buttonProps?: React.ComponentProps<typeof Button>;
}

const TabDialog: React.FC<TabDialogProps> = ({
    title,
    buttonLabel = title,
    children,
    actions,
    variant = 'dialog',
    maxWidth = 'sm',
    buttonProps,
}) => {
    const [open, setOpen] = useState(false);

    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    if (variant === 'dialog') {
        return (
            <>
                <Button
                    onClick={handleOpen}
                    {...buttonProps}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 500,
                        '&:hover': {
                            bgcolor: 'primary.50',
                        },
                        ...buttonProps?.sx,
                    }}
                >
                    {buttonLabel}
                </Button>
                <Dialog
                    open={open}
                    onClose={handleClose}
                    maxWidth={maxWidth}
                    fullWidth
                    PaperProps={{
                        sx: {
                            borderRadius: 2,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        }
                    }}
                >
                    {title && (
                        <DialogTitle sx={{
                            m: 0,
                            p: 3,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}>
                            <Typography component="span" variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                {title}
                            </Typography>
                            <IconButton
                                aria-label="close"
                                onClick={handleClose}
                                size="small"
                                sx={{
                                    color: 'text.secondary',
                                    '&:hover': {
                                        bgcolor: 'grey.100',
                                    }
                                }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                    )}
                    <DialogContent
                        dividers={false}
                        sx={{
                            p: 3,
                            '&::-webkit-scrollbar': {
                                width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                                background: 'transparent',
                            },
                            '&::-webkit-scrollbar-thumb': {
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '4px',
                            },
                        }}
                    >
                        {children}
                    </DialogContent>
                    {actions && (
                        <DialogActions sx={{ p: 3, pt: 2 }}>
                            {actions}
                        </DialogActions>
                    )}
                </Dialog>
            </>
        );
    }

    // Panel variant (inline, not modal)
    return (
        <>
            <Button
                onClick={handleOpen}
                {...buttonProps}
                sx={{
                    textTransform: 'none',
                    fontWeight: 500,
                    '&:hover': {
                        bgcolor: 'primary.50',
                    },
                    ...buttonProps?.sx,
                }}
            >
                {buttonLabel}
            </Button>
            {open && (
                <Box
                    sx={{
                        borderRadius: 2,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        bgcolor: 'background.paper',
                        p: 3,
                        maxWidth: 600,
                        mx: 'auto',
                        my: 2,
                        position: 'relative',
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    {title && (
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 2,
                            pb: 2,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                {title}
                            </Typography>
                            <IconButton
                                aria-label="close"
                                onClick={handleClose}
                                size="small"
                                sx={{
                                    color: 'text.secondary',
                                    '&:hover': {
                                        bgcolor: 'grey.100',
                                    }
                                }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    )}
                    <Box>{children}</Box>
                    {actions && <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>{actions}</Box>}
                </Box>
            )}
        </>
    );
};

export default TabDialog;