import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  BugReport as BugIcon,
  Image as ImageIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { BugReportService, type BugReport } from '@/services/bugReportService';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
// Uploadthing integration temporarily disabled for testing
// import { generateUploadButton } from '@uploadthing/react';
// import type { OurFileRouter } from '@/server/uploadthing';

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
  gameId?: string;
}

export const BugReportDialog: React.FC<BugReportDialogProps> = ({ open, onClose, gameId }) => {
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<BugReport>>({
    category: 'other',
    severity: 'medium',
    title: '',
    description: '',
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: '',
    user_email: user?.email || ''
  });

  const handleInputChange = (field: keyof BugReport) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSelectChange = (field: keyof BugReport) => (
    event: any
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleScreenshotSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (4MB max for Uploadthing)
      if (file.size > 4 * 1024 * 1024) {
        setError('Screenshot must be less than 4MB');
        return;
      }
      
      setScreenshotFile(file);
      
      // Create preview using FileReader (safe because we validated it's an image)
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Validate that it's a data URL
        if (result && result.startsWith('data:image/')) {
          setScreenshotPreview(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setUploadProgress(0);
  };

  const handleSubmit = async () => {
    setError(null);
    
    // Validate required fields
    if (!formData.title?.trim() || !formData.description?.trim()) {
      setError('Please provide a title and description');
      return;
    }

    // Additional validation
    if (formData.title.length > 200) {
      setError('Title must be less than 200 characters');
      return;
    }

    if (formData.description.length > 5000) {
      setError('Description must be less than 5000 characters');
      return;
    }

    setLoading(true);
    
    try {
      let screenshotUrl: string | undefined;
      
      // For now, skip actual upload - just use a placeholder
      // TODO: Implement Uploadthing properly
      if (screenshotFile) {
        screenshotUrl = "placeholder-for-testing";
      }
      
      const report: BugReport = {
        ...formData as BugReport,
        game_id: gameId,
        additional_data: {
          currentPath: router.pathname,
          query: router.query
        }
      };

      const result = await BugReportService.submitBugReport(report, screenshotUrl);
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setError(result.error || 'Failed to submit bug report');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      category: 'other',
      severity: 'medium',
      title: '',
      description: '',
      steps_to_reproduce: '',
      expected_behavior: '',
      actual_behavior: '',
      user_email: user?.email || ''
    });
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <BugIcon />
            <Typography variant="h6">Report a Bug</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" aria-label="Close dialog">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Bug report submitted successfully! Thank you for helping improve the game.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={handleSelectChange('category')}
                >
                  <MenuItem value="logic">Game Logic</MenuItem>
                  <MenuItem value="visual">Visual/UI</MenuItem>
                  <MenuItem value="performance">Performance</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={formData.severity}
                  label="Severity"
                  onChange={handleSelectChange('severity')}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <TextField
              label="Title"
              required
              fullWidth
              value={formData.title}
              onChange={handleInputChange('title')}
              placeholder="Brief description of the issue"
              inputProps={{ maxLength: 200 }}
              helperText={`${formData.title?.length || 0}/200`}
            />
            
            <TextField
              label="Description"
              required
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={handleInputChange('description')}
              placeholder="Detailed description of what went wrong"
              inputProps={{ maxLength: 5000 }}
              helperText={`${formData.description?.length || 0}/5000`}
            />
            
            <TextField
              label="Steps to Reproduce"
              fullWidth
              multiline
              rows={2}
              value={formData.steps_to_reproduce}
              onChange={handleInputChange('steps_to_reproduce')}
              placeholder="1. Go to...\n2. Click on...\n3. See error"
              inputProps={{ maxLength: 2000 }}
            />
            
            <TextField
              label="Expected Behavior"
              fullWidth
              multiline
              rows={2}
              value={formData.expected_behavior}
              onChange={handleInputChange('expected_behavior')}
              placeholder="What should have happened?"
              inputProps={{ maxLength: 1000 }}
            />
            
            <TextField
              label="Actual Behavior"
              fullWidth
              multiline
              rows={2}
              value={formData.actual_behavior}
              onChange={handleInputChange('actual_behavior')}
              placeholder="What actually happened?"
              inputProps={{ maxLength: 1000 }}
            />
            
            {!user && (
              <TextField
                label="Email (optional)"
                fullWidth
                type="email"
                value={formData.user_email}
                onChange={handleInputChange('user_email')}
                placeholder="your@email.com"
                helperText="Provide email if you'd like updates on this issue"
                inputProps={{ maxLength: 100 }}
              />
            )}
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Screenshot (optional)
              </Typography>
              
              <Button
                variant="outlined"
                component="label"
                startIcon={<ImageIcon />}
                disabled={loading || isUploading}
              >
                Select Screenshot
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleScreenshotSelect}
                />
              </Button>
              
              {screenshotPreview && (
                <Paper variant="outlined" sx={{ mt: 2, p: 1, position: 'relative' }}>
                  <IconButton
                    size="small"
                    onClick={handleRemoveScreenshot}
                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper' }}
                    aria-label="Remove screenshot"
                  >
                    <DeleteIcon />
                  </IconButton>
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    style={{ 
                      width: '100%', 
                      maxHeight: 200, 
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <Box sx={{ mt: 1 }}>
                      <CircularProgress variant="determinate" value={uploadProgress} size={20} />
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        Uploading... {uploadProgress}%
                      </Typography>
                    </Box>
                  )}
                </Paper>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`Page: ${router.pathname}`} size="small" variant="outlined" />
              {gameId && <Chip label={`Game: ${gameId}`} size="small" variant="outlined" />}
              <Chip 
                label={`Browser: ${navigator.userAgent.split(' ').slice(-2).join(' ')}`} 
                size="small" 
                variant="outlined" 
              />
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || success || !formData.title?.trim() || !formData.description?.trim() || isUploading}
          startIcon={loading ? <CircularProgress size={20} /> : <BugIcon />}
        >
          {loading ? 'Submitting...' : 'Submit Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};