import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Chip,
  Select,
  MenuItem,
} from "@mui/material";
import {
  People as PeopleIcon,
  SportsEsports as GamesIcon,
  TrendingUp as TrendingUpIcon,
  Email as EmailIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  BugReport as BugIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardStats {
  totalUsers: number;
  guestUsers: number;
  emailUsers: number;
  totalGames: number;
  activeGames: number;
  gamesLast24h: number;
  activeUsersToday: number;
}

interface AdminSetting {
  key: string;
  value: any;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingValues, setSettingValues] = useState<Record<string, any>>({});
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Bug reports state
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [bugLoading, setBugLoading] = useState(false);
  const [bugError, setBugError] = useState<string | null>(null);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadSettings(),
        loadBugReports()
      ]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        // Initialize setting values
        const values: Record<string, any> = {};
        data.forEach((setting: AdminSetting) => {
          values[setting.key] = setting.value;
        });
        setSettingValues(values);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadBugReports = async () => {
    setBugLoading(true);
    setBugError(null);
    try {
      const response = await fetch('/api/admin/bug-reports?limit=50');
      if (!response.ok) {
        throw new Error('Failed to load bug reports');
      }
      const data = await response.json();
      setBugReports(data);
    } catch (err: any) {
      console.error('Error loading bug reports:', err);
      setBugError(err.message || 'Failed to load bug reports');
    } finally {
      setBugLoading(false);
    }
  };

  const updateBugReportStatus = async (id: string, status: string) => {
    try {
      setUpdatingReportId(id);
      const res = await fetch('/api/admin/bug-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (!res.ok) {
        throw new Error('Failed to update status');
      }
      const updated = await res.json();
      setBugReports(prev => prev.map(r => (r.id === id ? updated : r)));
    } catch (e) {
      console.error('Error updating bug status:', e);
      setBugError('Failed to update bug status');
      setTimeout(() => setBugError(null), 4000);
    } finally {
      setUpdatingReportId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettingValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const changedSettings = settings.filter(setting => 
        settingValues[setting.key] !== setting.value
      );

      if (changedSettings.length === 0) {
        setSaveMessage({ type: 'success', text: 'No changes to save.' });
        setSaving(false);
        return;
      }

      const results = await Promise.allSettled(
        changedSettings.map(setting => 
          fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: setting.key,
              value: settingValues[setting.key]
            })
          }).then(res => {
            if (!res.ok) {
              throw new Error(`Failed to save ${setting.key}: ${res.statusText}`);
            }
            return res.json();
          })
        )
      );

      const failures = results.filter(result => result.status === 'rejected');
      
      if (failures.length === 0) {
        setSaveMessage({ 
          type: 'success', 
          text: `Successfully saved ${changedSettings.length} setting(s).` 
        });
        await loadSettings(); // Reload to get updated timestamps
      } else {
        setSaveMessage({ 
          type: 'error', 
          text: `Failed to save ${failures.length} of ${changedSettings.length} settings. Check console for details.` 
        });
        failures.forEach((failure, index) => {
          console.error(`Failed to save ${changedSettings[index].key}:`, failure.reason);
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveMessage({ 
        type: 'error', 
        text: 'Unexpected error occurred while saving settings.' 
      });
    } finally {
      setSaving(false);
      // Clear message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const renderSettingInput = (setting: AdminSetting) => {
    const value = settingValues[setting.key];
    
    // Special handling for time control settings
    if (setting.key.includes('time_control')) {
      const timeControl = value || { initial_time: 600000, increment: 0 };
      const minutes = Math.floor(timeControl.initial_time / 60000) || 10;
      const seconds = Math.floor(timeControl.increment / 1000) || 0;
      
      return (
        <Box>
          <TextField
            label="Initial Time (minutes)"
            size="small"
            type="number"
            value={minutes}
            onChange={(e) => {
              const newMinutes = Number(e.target.value) || 10;
              handleSettingChange(setting.key, {
                ...timeControl,
                initial_time: newMinutes * 60000
              });
            }}
            inputProps={{ min: 1, max: 180 }}
            sx={{ mb: 1, mr: 1, width: '140px' }}
          />
          <TextField
            label="Increment (seconds)"
            size="small"
            type="number"
            value={seconds}
            onChange={(e) => {
              const newSeconds = Number(e.target.value) || 0;
              handleSettingChange(setting.key, {
                ...timeControl,
                increment: newSeconds * 1000
              });
            }}
            inputProps={{ min: 0, max: 30 }}
            sx={{ width: '140px' }}
          />
          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {minutes}+{seconds} format
          </Typography>
        </Box>
      );
    }
    
    // Handle boolean values
    const isBooleanSetting = 
      typeof setting.value === 'boolean' ||
      setting.value === 'true' || setting.value === 'false' ||
      setting.value === true || setting.value === false;
    
    if (isBooleanSetting) {
      const boolValue = value === true || value === 'true' || value === '1';
      return (
        <FormControlLabel
          control={
            <Switch
              checked={boolValue}
              onChange={(e) => handleSettingChange(setting.key, e.target.checked)}
            />
          }
          label=""
        />
      );
    }

    // Handle numeric values
    const isNumericSetting = 
      typeof setting.value === 'number' ||
      (!isNaN(Number(setting.value)) && setting.value !== '');

    return (
      <TextField
        fullWidth
        size="small"
        value={value || ''}
        onChange={(e) => {
          const newValue = isNumericSetting ? 
            (e.target.value === '' ? '' : Number(e.target.value)) : 
            e.target.value;
          handleSettingChange(setting.key, newValue);
        }}
        type={isNumericSetting ? 'number' : 'text'}
        inputProps={isNumericSetting ? { min: 0 } : {}}
      />
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Admin Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          Refresh
        </Button>
      </Box>
      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Users
                  </Typography>
                  <Typography variant="h4">{stats?.totalUsers || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats?.activeUsersToday || 0} active today
                  </Typography>
                </Box>
                <PeopleIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Email Users
                  </Typography>
                  <Typography variant="h4">{stats?.emailUsers || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats?.guestUsers || 0} guests
                  </Typography>
                </Box>
                <EmailIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Games
                  </Typography>
                  <Typography variant="h4">{stats?.totalGames || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats?.activeGames || 0} active
                  </Typography>
                </Box>
                <GamesIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Games Today
                  </Typography>
                  <Typography variant="h4">{stats?.gamesLast24h || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Last 24 hours
                  </Typography>
                </Box>
                <TrendingUpIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      {/* Tabs for Stats, Settings, Bug Reports */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Statistics" />
          <Tab label="Settings" />
          <Tab label="Bug Reports" />
        </Tabs>
      </Paper>
      {/* Statistics Tab */}
      {tabValue === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              High-Level Statistics
            </Typography>
            <Box>
              <Typography>This is a simplified admin dashboard showing key metrics only.</Typography>
              <Typography>For detailed game and user management, use the full admin tools.</Typography>
            </Box>
          </CardContent>
        </Card>
      )}
      {/* Settings Tab */}
      {tabValue === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography variant="h6" display="flex" alignItems="center">
                <SettingsIcon sx={{ mr: 1 }} />
                Application Settings
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Configure time controls and gameplay settings for your chess application
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>

          {saveMessage && (
            <Alert severity={saveMessage.type} sx={{ mb: 2 }}>
              {saveMessage.text}
            </Alert>
          )}

          {settings.length === 0 ? (
            <Alert severity="info">No settings available. Please check your database configuration.</Alert>
          ) : (
            <Grid container spacing={2}>
              {settings.map((setting) => (
                <Grid item xs={12} key={setting.key}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" p={2} border={1} borderColor="grey.300" borderRadius={1}>
                    <Box flex={1}>
                      <Typography variant="subtitle2">{setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {setting.description}
                      </Typography>
                      {setting.key === 'default_time_control' && (
                        <Typography variant="caption" color="primary">
                          Sets the default time control for all new games
                        </Typography>
                      )}
                    </Box>
                    <Box ml={2}>
                      {renderSettingInput(setting)}
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}
      {/* Bug Reports Tab */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <BugIcon color="warning" />
              <Typography variant="h6">Recent Bug Reports</Typography>
            </Box>
            <Button variant="outlined" size="small" onClick={loadBugReports} disabled={bugLoading}>
              {bugLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Box>

          {bugError && (
            <Alert severity="error" sx={{ mb: 2 }}>{bugError}</Alert>
          )}

          {bugLoading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : bugReports.length === 0 ? (
            <Alert severity="info">No bug reports found.</Alert>
          ) : (
            <Grid container spacing={2}>
              {bugReports.map((report: any) => (
                <Grid item xs={12} key={report.id}>
                  <Box p={2} border={1} borderColor="grey.800" borderRadius={1}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <BugIcon fontSize="small" />
                        <Typography variant="subtitle1" fontWeight={600}>
                          {report.title || 'Untitled report'}
                        </Typography>
                        {report.status && (
                          <Chip
                            size="small"
                            label={report.status.replace(/_/g, ' ')}
                            color={report.status === 'resolved' || report.status === 'closed' ? 'success' : report.status === 'in_progress' ? 'warning' : 'default'}
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(report.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={8}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                          {report.description}
                        </Typography>
                        {report.steps_to_reproduce && (
                          <>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="subtitle2">Steps to reproduce</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                              {report.steps_to_reproduce}
                            </Typography>
                          </>
                        )}
                        {/* Screenshots */}
                        {(report?.additional_data?.screenshots?.length || 0) > 0 && (
                          <Box mt={1}>
                            <Typography variant="subtitle2" gutterBottom>
                              Screenshots
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1 }}>
                              {(report.additional_data.screenshots as string[]).map((url: string, idx: number) => (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                  <img
                                    src={url}
                                    alt={`Screenshot ${idx + 1}`}
                                    style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)' }}
                                  />
                                </a>
                              ))}
                            </Box>
                          </Box>
                        )}
                        {report.screenshot_url && (
                          <Box mt={1}>
                            <Button size="small" href={report.screenshot_url} target="_blank" rel="noopener noreferrer">
                              View Screenshot
                            </Button>
                          </Box>
                        )}
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box display="flex" flexDirection="column" gap={0.5}>
                          <Typography variant="caption" color="text.secondary">Severity: {report.severity}</Typography>
                          <Typography variant="caption" color="text.secondary">Category: {report.category}</Typography>
                          {report.user_email && (
                            <Typography variant="caption" color="text.secondary">Reporter: {report.user_email}</Typography>
                          )}
                          {report.page_url && (
                            <Typography variant="caption" color="text.secondary">Page: {report.page_url}</Typography>
                          )}
                          {report.game_id && (
                            <Typography variant="caption" color="text.secondary">Game: {report.game_id}</Typography>
                          )}
                          <Box display="flex" alignItems="center" gap={1} mt={1}>
                            <Select
                              size="small"
                              value={report.status || 'open'}
                              onChange={(e) => updateBugReportStatus(report.id, e.target.value as string)}
                              disabled={updatingReportId === report.id}
                              sx={{ minWidth: 160 }}
                            >
                              <MenuItem value="open">Open</MenuItem>
                              <MenuItem value="in_progress">In Progress</MenuItem>
                              <MenuItem value="resolved">Resolved</MenuItem>
                              <MenuItem value="closed">Closed</MenuItem>
                              <MenuItem value="duplicate">Duplicate</MenuItem>
                            </Select>
                            {updatingReportId === report.id && <CircularProgress size={20} />}
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}
    </Container>
  );
}
