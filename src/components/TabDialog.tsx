import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface TabDialogProps {
    buttonLabel: React.ReactNode;
    title?: React.ReactNode;
    children: React.ReactNode;
    actions?: React.ReactNode;
    variant?: 'dialog' | 'panel';
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    buttonProps?: React.ComponentProps<typeof Button>;
}

const TabDialog: React.FC<TabDialogProps> = ({
    buttonLabel,
    title,
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
                <Button onClick={handleOpen} {...buttonProps}>{buttonLabel}</Button>
                <Dialog open={open} onClose={handleClose} maxWidth={maxWidth} fullWidth>
                    {title && (
                        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="h6">{title}</Typography>
                            <IconButton aria-label="close" onClick={handleClose} size="small">
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                    )}
                    <DialogContent>{children}</DialogContent>
                    {actions && <DialogActions>{actions}</DialogActions>}
                </Dialog>
            </>
        );
    }
    // Panel variant (inline, not modal)
    return (
        <>
            <Button onClick={handleOpen} {...buttonProps}>{buttonLabel}</Button>
            {open && (
                <Box
                    sx={{
                        borderRadius: 2,
                        boxShadow: 1,
                        bgcolor: 'background.paper',
                        p: 3,
                        maxWidth: 600,
                        mx: 'auto',
                        my: 2,
                        position: 'relative',
                    }}
                >
                    {title && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">{title}</Typography>
                            <IconButton aria-label="close" onClick={handleClose} size="small">
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    )}
                    <Box>{children}</Box>
                    {actions && <Box sx={{ mt: 3 }}>{actions}</Box>}
                </Box>
            )}
        </>
    );
};

export default TabDialog; 
