import { useState, useEffect, useRef } from "react";
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Tooltip,
  Stack
} from "@mui/material";
import {
  BugReport as BugReportIcon,
  Check,
  Close,
  OpenInNew,
  Refresh
} from "@mui/icons-material";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/router";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface BugReport {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  user_email?: string;
  created_at: string;
  page_url?: string;
}

export default function BugReportsDropdown() {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const open = Boolean(anchorEl);

  useEffect(() => {
    fetchBugReports();
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const setupRealtimeSubscription = () => {
    // Subscribe to changes in bug_reports table
    channelRef.current = supabase
      .channel('bug-reports-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bug_reports'
        },
        (payload) => {
          console.log('Bug report change:', payload);
          // Refresh the list when any change occurs
          fetchBugReports();
        }
      )
      .subscribe();
  };

  const fetchBugReports = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/bug-reports?limit=10&status=open');
      if (!response.ok) {
        throw new Error('Failed to fetch bug reports');
      }
      
      const data = await response.json();
      setBugReports(data);
      setOpenCount(data.length);

      // Also fetch total count of open reports
      const countResponse = await fetch('/api/admin/bug-reports-count');
      if (countResponse.ok) {
        const countData = await countResponse.json();
        setOpenCount(countData.count);
      }
    } catch (err) {
      console.error('Error fetching bug reports:', err);
      setError('Failed to load bug reports');
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    if (!open) {
      fetchBugReports(); // Refresh when opening
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/admin/bug-reports', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: reportId,
          status: newStatus
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Refresh the list
      fetchBugReports();
    } catch (err) {
      console.error('Error updating bug report status:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'logic': return '🧩';
      case 'visual': return '🎨';
      case 'performance': return '⚡';
      default: return '🔧';
    }
  };

  return (
    <>
      <Tooltip title={`${openCount} open bug reports`}>
        <IconButton
          onClick={handleClick}
          size="large"
          sx={{
            color: openCount > 0 ? 'error.main' : 'text.secondary'
          }}
        >
          <Badge 
            badgeContent={openCount} 
            color="error"
            max={99}
          >
            <BugReportIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 420,
            maxHeight: 600,
            overflow: 'auto'
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Bug Reports
            </Typography>
            <Box display="flex" gap={1}>
              <IconButton size="small" onClick={fetchBugReports}>
                <Refresh fontSize="small" />
              </IconButton>
              <Button
                size="small"
                variant="text"
                endIcon={<OpenInNew fontSize="small" />}
                onClick={() => {
                  router.push('/admin');
                  handleClose();
                }}
              >
                View All
              </Button>
            </Box>
          </Box>
          {openCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              {openCount} open {openCount === 1 ? 'report' : 'reports'}
            </Typography>
          )}
        </Box>

        <Divider />

        {loading && (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Box px={2} py={1}>
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Box>
        )}

        {!loading && !error && bugReports.length === 0 && (
          <Box px={2} py={3} textAlign="center">
            <BugReportIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              No open bug reports
            </Typography>
          </Box>
        )}

        {!loading && !error && bugReports.length > 0 && (
          <List sx={{ py: 0 }}>
            {bugReports.slice(0, 10).map((report, index) => (
              <Box key={report.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    py: 1.5,
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box flex={1}>
                      <Typography variant="subtitle2" fontWeight="medium">
                        {getCategoryIcon(report.category)} {report.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} mt={0.5}>
                        <Chip
                          label={report.severity}
                          size="small"
                          color={getSeverityColor(report.severity) as any}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        <Chip
                          label={report.category}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Stack>
                    </Box>
                    <Box display="flex" gap={0.5}>
                      <Tooltip title="Mark as resolved">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleStatusChange(report.id, 'resolved')}
                        >
                          <Check fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Close">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleStatusChange(report.id, 'closed')}
                        >
                          <Close fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      mb: 1
                    }}
                  >
                    {report.description}
                  </Typography>

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {report.user_email || 'Anonymous'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(report.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>

                  {report.page_url && (
                    <Typography 
                      variant="caption" 
                      color="primary"
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                        mt: 0.5
                      }}
                      onClick={() => {
                        window.open(report.page_url, '_blank');
                      }}
                    >
                      View page →
                    </Typography>
                  )}
                </ListItem>
              </Box>
            ))}
          </List>
        )}

        {!loading && !error && bugReports.length > 10 && (
          <>
            <Divider />
            <Box px={2} py={1}>
              <Button
                fullWidth
                variant="text"
                onClick={() => {
                  router.push('/admin');
                  handleClose();
                }}
              >
                View all {openCount} reports
              </Button>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
}