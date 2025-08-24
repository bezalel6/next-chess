import { IconButton, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useState, useEffect } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface ConfirmActionButtonProps {
  icon: React.ReactElement;
  confirmIcon?: React.ReactElement;
  tooltip: string;
  confirmTooltip?: string;
  onConfirm: () => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  sx?: SxProps<Theme>;
  confirmSx?: SxProps<Theme>;
  autoResetDelay?: number;
  size?: 'small' | 'medium' | 'large';
}

export default function ConfirmActionButton({
  icon,
  confirmIcon = <CheckCircleIcon fontSize="small" />,
  tooltip,
  confirmTooltip = `Confirm ${tooltip.toLowerCase()}`,
  onConfirm,
  color = 'primary',
  sx = {},
  confirmSx,
  autoResetDelay = 3000,
  size = 'small',
}: ConfirmActionButtonProps) {
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  useEffect(() => {
    if (needsConfirmation && autoResetDelay > 0) {
      const timer = setTimeout(() => {
        setNeedsConfirmation(false);
      }, autoResetDelay);
      return () => clearTimeout(timer);
    }
  }, [needsConfirmation, autoResetDelay]);

  const handleClick = () => {
    if (needsConfirmation) {
      onConfirm();
      setNeedsConfirmation(false);
    } else {
      setNeedsConfirmation(true);
    }
  };

  const currentIcon = needsConfirmation ? confirmIcon : icon;
  const currentTooltip = needsConfirmation ? confirmTooltip : tooltip;
  
  // Build the sx prop based on state
  const finalSx = needsConfirmation 
    ? (confirmSx || {
        color: `${color}.dark`,
        bgcolor: color === 'error' ? 'rgba(255,0,0,0.15)' 
               : color === 'info' ? 'rgba(33,150,243,0.15)'
               : color === 'warning' ? 'rgba(255,152,0,0.15)'
               : 'rgba(156,39,176,0.15)',
        '&:hover': {
          bgcolor: color === 'error' ? 'rgba(255,0,0,0.25)' 
                 : color === 'info' ? 'rgba(33,150,243,0.25)'
                 : color === 'warning' ? 'rgba(255,152,0,0.25)'
                 : 'rgba(156,39,176,0.25)',
        }
      })
    : {
        color: `${color}.main`,
        '&:hover': {
          bgcolor: color === 'error' ? 'rgba(255,0,0,0.1)' 
                 : color === 'info' ? 'rgba(33,150,243,0.1)'
                 : color === 'warning' ? 'rgba(255,152,0,0.1)'
                 : 'rgba(156,39,176,0.1)',
        },
        ...sx
      };

  return (
    <Tooltip title={currentTooltip}>
      <IconButton 
        size={size}
        onClick={handleClick}
        sx={finalSx}
      >
        {currentIcon}
      </IconButton>
    </Tooltip>
  );
}