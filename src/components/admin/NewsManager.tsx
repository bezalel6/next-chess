import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  IconButton,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Announcement as AnnouncementIcon,
} from '@mui/icons-material';

interface NewsItem {
  id?: string;
  title: string;
  content: string;
  priority: number;
  category: string;
  is_active: boolean;
  expires_at?: string;
  created_at?: string;
  updated_at?: string;
}

export default function NewsManager() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState<NewsItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNewsItems();
  }, []);

  const loadNewsItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/news');
      if (!response.ok) throw new Error('Failed to load news items');
      const data = await response.json();
      setNewsItems(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item?: NewsItem) => {
    setCurrentItem(
      item || {
        title: '',
        content: '',
        priority: 5,
        category: 'general',
        is_active: true,
      }
    );
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!currentItem) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const method = currentItem.id ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/news', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentItem),
      });

      if (!response.ok) throw new Error('Failed to save news item');
      
      setSuccess(currentItem.id ? 'News item updated' : 'News item created');
      setEditDialog(false);
      loadNewsItems();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentItem?.id) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/news', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentItem.id }),
      });

      if (!response.ok) throw new Error('Failed to delete news item');
      
      setSuccess('News item deleted');
      setDeleteDialog(false);
      loadNewsItems();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: NewsItem) => {
    try {
      const response = await fetch('/api/admin/news', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, is_active: !item.is_active }),
      });

      if (!response.ok) throw new Error('Failed to update status');
      loadNewsItems();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <AnnouncementIcon color="primary" />
          <Typography variant="h6">News Management</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleEdit()}
        >
          Add News Item
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {newsItems.length === 0 ? (
        <Alert severity="info">No news items yet. Add your first announcement!</Alert>
      ) : (
        <Grid container spacing={2}>
          {newsItems.map((item) => (
            <Grid item xs={12} key={item.id}>
              <Box
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: item.is_active ? 'primary.main' : 'grey.600',
                  borderRadius: 1,
                  opacity: item.is_active ? 1 : 0.6,
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {item.title}
                      </Typography>
                      <Chip
                        label={item.category}
                        size="small"
                        color={
                          item.category === 'maintenance'
                            ? 'warning'
                            : item.category === 'feature'
                            ? 'primary'
                            : 'default'
                        }
                      />
                      <Chip
                        label={`Priority: ${item.priority}`}
                        size="small"
                        variant="outlined"
                      />
                      {!item.is_active && (
                        <Chip label="Inactive" size="small" color="error" />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {item.content}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Created: {new Date(item.created_at!).toLocaleString()}
                      {item.expires_at && (
                        <> | Expires: {new Date(item.expires_at).toLocaleString()}</>
                      )}
                    </Typography>
                  </Box>
                  <Box display="flex" gap={1}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={item.is_active}
                          onChange={() => handleToggleActive(item)}
                          size="small"
                        />
                      }
                      label="Active"
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(item)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setCurrentItem(item);
                        setDeleteDialog(true);
                      }}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {currentItem?.id ? 'Edit News Item' : 'Add News Item'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="Title"
              fullWidth
              value={currentItem?.title || ''}
              onChange={(e) =>
                setCurrentItem({ ...currentItem!, title: e.target.value })
              }
            />
            <TextField
              label="Content"
              fullWidth
              multiline
              rows={4}
              value={currentItem?.content || ''}
              onChange={(e) =>
                setCurrentItem({ ...currentItem!, content: e.target.value })
              }
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={currentItem?.category || 'general'}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem!, category: e.target.value })
                    }
                    label="Category"
                  >
                    <MenuItem value="general">General</MenuItem>
                    <MenuItem value="update">Update</MenuItem>
                    <MenuItem value="feature">Feature</MenuItem>
                    <MenuItem value="maintenance">Maintenance</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Priority (0-10)"
                  type="number"
                  fullWidth
                  value={currentItem?.priority || 5}
                  onChange={(e) =>
                    setCurrentItem({
                      ...currentItem!,
                      priority: Math.min(10, Math.max(0, parseInt(e.target.value) || 0)),
                    })
                  }
                  inputProps={{ min: 0, max: 10 }}
                />
              </Grid>
            </Grid>
            <TextField
              label="Expires At (Optional)"
              type="datetime-local"
              fullWidth
              value={currentItem?.expires_at?.slice(0, 16) || ''}
              onChange={(e) =>
                setCurrentItem({
                  ...currentItem!,
                  expires_at: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                })
              }
              InputLabelProps={{ shrink: true }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={currentItem?.is_active ?? true}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem!, is_active: e.target.checked })
                  }
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={saving || !currentItem?.title || !currentItem?.content}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{currentItem?.title}&quot;?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={saving}
          >
            {saving ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}