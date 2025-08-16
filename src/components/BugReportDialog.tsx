import React, { useState, useEffect, useRef } from 'react';
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
  Paper,
  Collapse,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  BugReport as BugIcon,
  Image as ImageIcon,
  Delete as DeleteIcon,
  Screenshot as ScreenshotIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { BugReportService, type BugReport } from '@/services/bugReportService';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import html2canvas from 'html2canvas';
import { ScreenshotOverlay } from './ScreenshotOverlay';
import { useUploadThing } from '@/utils/uploadthing';

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
  gameId?: string;
  errorDetails?: {
    message: string;
    stack?: string;
    componentStack?: string;
    timestamp: string;
  };
}

export const BugReportDialog: React.FC<BugReportDialogProps> = ({ open, onClose, gameId, errorDetails }) => {
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [takingScreenshot, setTakingScreenshot] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Track uploaded URLs aligned with screenshotPreviews/files by index
  const [uploadedUrls, setUploadedUrls] = useState<(string | null)[]>([]);

  const { startUpload, isUploading } = useUploadThing();
  
  // Uncontrolled refs for main text inputs
  const titleRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const descriptionRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

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

  // Populate form with error details if provided
  useEffect(() => {
    if (errorDetails && open) {
      const prefilledTitle = `Error: ${errorDetails.message.substring(0, 100)}`;
      const prefilledDesc = `An error occurred at ${errorDetails.timestamp}:\n\n${errorDetails.message}`;
      setFormData(prev => ({
        ...prev,
        category: 'other',
        severity: 'high',
        title: prefilledTitle,
        description: prefilledDesc,
        actual_behavior: `Error Stack:\n${errorDetails.stack || 'No stack trace available'}\n\n${errorDetails.componentStack ? `Component Stack:\n${errorDetails.componentStack}` : ''}`
      }));
      if (titleRef.current) titleRef.current.value = prefilledTitle;
      if (descriptionRef.current) descriptionRef.current.value = prefilledDesc;
    }
  }, [errorDetails, open]);

  // Cleanup on unmount (no-op, previews are simple data URLs)
  useEffect(() => {
    return () => {};
  }, []);

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
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const currentCount = screenshotFiles.length;
    const availableSlots = Math.max(0, 5 - currentCount);
    const selected = files.slice(0, availableSlots);

    const validFiles: File[] = [];

    for (const file of selected) {
      if (!file.type.startsWith('image/')) {
        setError('Please select image files only');
        continue;
      }
      if (file.size > 4 * 1024 * 1024) {
        setError('Each screenshot must be less than 4MB');
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const startIndex = screenshotPreviews.length;

    // Reserve preview slots and uploaded URL slots
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.startsWith('data:image/')) {
          setScreenshotPreviews((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });

    setScreenshotFiles((prev) => [...prev, ...validFiles]);
    setUploadedUrls((prev) => [...prev, ...Array(validFiles.length).fill(null)]);

    // Immediately upload selected files
    (async () => {
      try {
        setUploadProgress(10);
        const res = await startUpload(validFiles);
        if (res && res.length > 0) {
          setUploadedUrls((prev) => {
            const next = [...prev];
            res.forEach((r, idx) => {
              const i = startIndex + idx;
              next[i] = (r as any).ufsUrl || r.appUrl;
            });
            return next;
          });
          setUploadProgress(100);
        } else {
          setError('Failed to upload screenshots.');
        }
      } catch (e) {
        console.error('Upload error', e);
        setError('Failed to upload screenshots.');
      } finally {
        // reset progress shortly after completion
        setTimeout(() => setUploadProgress(0), 400);
      }
    })();
  };

  const handleRemoveScreenshot = (index: number) => {
    setScreenshotFiles((prev) => prev.filter((_, i) => i !== index));
    setScreenshotPreviews((prev) => prev.filter((_, i) => i !== index));
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index));
    setUploadProgress(0);
  };

  // Take a screenshot of the current page
  const handleTakeScreenshot = async () => {
    setTakingScreenshot(true);
    setError(null);
    
    try {
      // Hide the dialog and all backdrops temporarily
      const dialogElement = document.querySelector('[role="dialog"]');
      const backdropElements = document.querySelectorAll('.MuiBackdrop-root');
      
      if (dialogElement instanceof HTMLElement) {
        dialogElement.style.visibility = 'hidden';
      }
      
      // Hide all backdrops (dialog backdrop and screenshot overlay)
      backdropElements.forEach(backdrop => {
        if (backdrop instanceof HTMLElement) {
          backdrop.style.visibility = 'hidden';
        }
      });
      
      // Wait a moment for the dialog and backdrop to disappear
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Capture the screenshot with optimized settings
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2), // Limit scale for performance
        width: Math.min(window.innerWidth, 1920), // Max width
        height: Math.min(window.innerHeight, 1080), // Max height
        backgroundColor: '#ffffff',
        ignoreElements: (element) => {
          // Ignore the screenshot overlay
          if (element instanceof HTMLElement) {
            if (element.hasAttribute('data-screenshot-overlay')) {
              return true;
            }
            
            const style = window.getComputedStyle(element);
            // Check for unsupported color functions
            const colorProps = [style.color, style.backgroundColor, style.borderColor];
            for (const prop of colorProps) {
              if (prop && (prop.includes('oklch') || prop.includes('oklab') || prop.includes('color('))) {
                return true; // Skip this element
              }
            }
          }
          return false;
        }
      });
      
      // Show the dialog and backdrops again
      if (dialogElement instanceof HTMLElement) {
        dialogElement.style.visibility = 'visible';
      }
      
      // Restore all backdrops
      backdropElements.forEach(backdrop => {
        if (backdrop instanceof HTMLElement) {
          backdrop.style.visibility = 'visible';
        }
      });
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          // Check file size
          if (blob.size > 4 * 1024 * 1024) {
            setError('Screenshot is too large (over 4MB). The image will be compressed.');
            // Try with more compression
            canvas.toBlob((compressedBlob) => {
              if (compressedBlob && compressedBlob.size <= 4 * 1024 * 1024) {
            const file = new File([compressedBlob], 'screenshot.jpg', { type: 'image/jpeg' });
            setScreenshotFiles((prev) => [...prev, file]);
            setUploadedUrls((prev) => [...prev, null]);
            
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
              setScreenshotPreviews((prev) => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
            // Upload this screenshot immediately
            (async () => {
              try {
                setUploadProgress(10);
                const res = await startUpload([file]);
                if (res && res[0]?.url) {
                  setUploadedUrls((prev) => {
                    const next = [...prev];
                    next[next.length - 1] = (res[0] as any).ufsUrl || res[0].appUrl;
                    return next;
                  });
                  setUploadProgress(100);
                } else {
                  setError('Failed to upload screenshot.');
                }
              } catch (e) {
                console.error('Upload error', e);
                setError('Failed to upload screenshot.');
              } finally {
                setTimeout(() => setUploadProgress(0), 400);
              }
            })();
              } else {
                setError('Screenshot is too large even after compression. Please upload a smaller image.');
              }
            }, 'image/jpeg', 0.5);
          } else {
            const file = new File([blob], 'screenshot.jpg', { type: 'image/jpeg' });
            setScreenshotFiles((prev) => [...prev, file]);
            setUploadedUrls((prev) => [...prev, null]);
            
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
              setScreenshotPreviews((prev) => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
            // Upload this screenshot immediately
            (async () => {
              try {
                setUploadProgress(10);
                const res = await startUpload([file]);
                if (res && res[0]?.url) {
                  setUploadedUrls((prev) => {
                    const next = [...prev];
                    next[next.length - 1] = (res[0] as any).ufsUrl || res[0].appUrl;
                    return next;
                  });
                  setUploadProgress(100);
                } else {
                  setError('Failed to upload screenshot.');
                }
              } catch (e) {
                console.error('Upload error', e);
                setError('Failed to upload screenshot.');
              } finally {
                setTimeout(() => setUploadProgress(0), 400);
              }
            })();
          }
        } else {
          setError('Failed to process screenshot. Please try again.');
        }
      }, 'image/jpeg', 0.8);
      
    } catch (err) {
      console.error('Screenshot failed:', err);
      // Check if error is related to color parsing
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('oklch') || errorMessage.includes('color')) {
        setError('Screenshot failed due to unsupported CSS colors. Please try uploading an image file instead.');
      } else {
        setError('Failed to capture screenshot. Please try uploading an image instead.');
      }
    } finally {
      setTakingScreenshot(false);
    }
  };


  const handleSubmit = async () => {
    setError(null);

    const title = (titleRef.current?.value || '').trim();
    const description = (descriptionRef.current?.value || '').trim();

    // Validate required fields
    if (!title || !description) {
      setError('Please provide a subject and message');
      return;
    }

    if (title.length > 200) {
      setError('Subject must be less than 200 characters');
      return;
    }

    if (description.length > 5000) {
      setError('Message must be less than 5000 characters');
      return;
    }

    setLoading(true);
    
    try {
      const finalizedUrls = uploadedUrls.filter((u): u is string => Boolean(u));
      const screenshotUrl = finalizedUrls[0];
      
      const report: BugReport = {
        ...(formData as BugReport),
        title,
        description,
        game_id: gameId,
        additional_data: {
          currentPath: router.pathname,
          query: router.query,
          screenshots: finalizedUrls
        }
      };

      const result = await BugReportService.submitBugReport(report, screenshotUrl);
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError(result.error || 'Failed to submit');
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
    if (titleRef.current) titleRef.current.value = '';
    if (descriptionRef.current) descriptionRef.current.value = '';
    setScreenshotFiles([]);
    setScreenshotPreviews([]);
    setUploadedUrls([]);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
    onClose();
  };

  return (
    <>
      <ScreenshotOverlay open={takingScreenshot} />
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <BugIcon />
            <Typography variant="h6">Send feedback or report a bug</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" aria-label="Close dialog">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Thanks! Your message was sent. We’ll take a look soon.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Tell us what you noticed. A screenshot helps but isn’t required.
            </Typography>
            
            <TextField
              label="Subject"
              required
              fullWidth
              inputRef={titleRef}
              placeholder={'Quick summary (e.g., "Move validation looks wrong")'}
              inputProps={{ maxLength: 200 }}
            />
            
            <TextField
              label="Message"
              required
              fullWidth
              multiline
              rows={3}
              inputRef={descriptionRef}
              placeholder="What happened, and what did you expect instead?"
              inputProps={{ maxLength: 5000 }}
            />

            {!user && (
              <TextField
                label="Email (optional)"
                fullWidth
                type="email"
                value={formData.user_email}
                onChange={handleInputChange('user_email')}
                placeholder="We’ll only use this to follow up about your message"
                inputProps={{ maxLength: 100 }}
              />
            )}

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Screenshot (optional)
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<ImageIcon />}
                  disabled={loading || isUploading || takingScreenshot}
                >
                  Upload Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={handleScreenshotSelect}
                  />
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={takingScreenshot ? <CircularProgress size={16} /> : <ScreenshotIcon />}
                  onClick={handleTakeScreenshot}
                  disabled={loading || isUploading || takingScreenshot}
                >
                  {takingScreenshot ? 'Capturing...' : 'Take Screenshot'}
                </Button>
              </Box>
              
              {screenshotPreviews.length > 0 && (
                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1 }}>
                  {screenshotPreviews.map((preview, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 1, position: 'relative' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveScreenshot(idx)}
                        sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper' }}
                        aria-label="Remove screenshot"
                      >
                        <DeleteIcon />
                      </IconButton>
                      <img
                        src={preview}
                        alt={`Screenshot preview ${idx + 1}`}
                        style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block', opacity: uploadedUrls[idx] ? 1 : 0.7 }}
                      />
                      <Box sx={{ position: 'absolute', left: 8, bottom: 8, px: 0.5, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.5)' }}>
                        <Typography variant="caption" sx={{ color: '#fff' }}>
                          {uploadedUrls[idx] ? 'Ready' : 'Pending upload'}
                        </Typography>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
              {(screenshotPreviews.length > 0) && (
                <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.8 }}>
                  Uploaded {uploadedUrls.filter((u) => u).length}/{screenshotPreviews.length}
                </Typography>
              )}
              {(isUploading || (uploadProgress > 0 && uploadProgress < 100)) && (
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                  <CircularProgress variant={uploadProgress > 0 ? 'determinate' : 'indeterminate'} value={uploadProgress} size={20} />
                  <Typography variant="caption" sx={{ ml: 1 }}>
                    {isUploading ? 'Uploading…' : `Uploading... ${uploadProgress}%`}
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider />
            <Button
              size="small"
              onClick={() => setShowAdvanced(v => !v)}
              endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ alignSelf: 'flex-start' }}
            >
              {showAdvanced ? 'Hide advanced details' : 'Add advanced details (optional)'}
            </Button>
            <Collapse in={showAdvanced}>
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
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
                label="Steps to Reproduce"
                fullWidth
                multiline
                rows={2}
                value={formData.steps_to_reproduce}
                onChange={handleInputChange('steps_to_reproduce')}
                placeholder="1. Go to...\n2. Click on...\n3. See error"
                inputProps={{ maxLength: 2000 }}
                sx={{ mt: 2 }}
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
                sx={{ mt: 2 }}
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
                sx={{ mt: 2 }}
              />
            </Collapse>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
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
          disabled={
            loading ||
            success ||
            isUploading ||
            (screenshotFiles.length > 0 && uploadedUrls.some((u) => u === null))
          }
          startIcon={loading ? <CircularProgress size={20} /> : <BugIcon />}
        >
          {loading ? 'Submitting...' : 'Send'}
        </Button>
      </DialogActions>
      </Dialog>
    </>
  );
};
