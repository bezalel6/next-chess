import { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Chip, 
  Collapse,
  Switch,
  FormControlLabel,
  Tooltip,
  Paper,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  ContentCopy as CopyIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';
import { useDebugLogStore } from '@/stores/debugLogStore';
import { format } from 'date-fns';

export default function DebugLog() {
  const logs = useDebugLogStore(s => s.logs);
  const enabled = useDebugLogStore(s => s.enabled);
  const filter = useDebugLogStore(s => s.filter);
  const clearLogs = useDebugLogStore(s => s.clearLogs);
  const setEnabled = useDebugLogStore(s => s.setEnabled);
  const toggleTypeFilter = useDebugLogStore(s => s.toggleTypeFilter);
  const toggleCategoryFilter = useDebugLogStore(s => s.toggleCategoryFilter);
  
  const [expanded, setExpanded] = useState<boolean>(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (expanded && logs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, expanded]);
  
  // Filter logs based on active filters
  const filteredLogs = logs.filter(log => 
    filter.types.has(log.type) && filter.categories.has(log.category)
  );
  
  const copyLog = (log: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
  };
  
  const getLogColor = (type: string) => {
    switch (type) {
      case 'broadcast-sent': return '#4caf50';
      case 'broadcast-received': return '#2196f3';
      case 'api-call': return '#ff9800';
      case 'api-response': return '#8bc34a';
      case 'error': return '#f44336';
      case 'state-change': return '#9c27b0';
      default: return '#757575';
    }
  };
  
  const getLogIcon = (type: string, direction?: string) => {
    switch (type) {
      case 'broadcast-sent': return '📤';
      case 'broadcast-received': return '📥';
      case 'api-call': return '🔄';
      case 'api-response': return '✅';
      case 'error': return '❌';
      case 'state-change': return '🔧';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };
  
  return (
    <Paper
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight="bold">
            Debug Log
          </Typography>
          <Chip 
            label={filteredLogs.length} 
            size="small" 
            color={filteredLogs.length > 0 ? 'primary' : 'default'}
          />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            }
            label=""
            sx={{ m: 0 }}
          />
          
          <Tooltip title="Filters">
            <IconButton 
              size="small" 
              onClick={() => setShowFilters(!showFilters)}
              color={showFilters ? 'primary' : 'default'}
            >
              <FilterIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Clear logs">
            <IconButton size="small" onClick={clearLogs}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Filters */}
      <Collapse in={showFilters}>
        <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Event Types:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {(['broadcast-sent', 'broadcast-received', 'api-call', 'api-response', 'error', 'state-change'] as const).map(type => (
              <Chip
                key={type}
                label={type.replace('-', ' ')}
                size="small"
                onClick={() => toggleTypeFilter(type)}
                color={filter.types.has(type) ? 'primary' : 'default'}
                variant={filter.types.has(type) ? 'filled' : 'outlined'}
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            ))}
          </Box>
          
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Categories:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(['move', 'ban', 'game', 'connection', 'other'] as const).map(category => (
              <Chip
                key={category}
                label={category}
                size="small"
                onClick={() => toggleCategoryFilter(category)}
                color={filter.categories.has(category) ? 'secondary' : 'default'}
                variant={filter.categories.has(category) ? 'filled' : 'outlined'}
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            ))}
          </Box>
        </Box>
      </Collapse>
      
      {/* Logs */}
      <Collapse in={expanded} sx={{ flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            p: 1,
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'action.hover',
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'action.disabled',
              borderRadius: '3px',
            },
          }}
        >
          {filteredLogs.length === 0 ? (
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ display: 'block', textAlign: 'center', py: 2 }}
            >
              {enabled ? 'No logs yet...' : 'Logging disabled'}
            </Typography>
          ) : (
            filteredLogs.map((log) => (
              <Box
                key={log.id}
                sx={{
                  mb: 0.5,
                  p: 0.5,
                  borderLeft: 3,
                  borderColor: getLogColor(log.type),
                  bgcolor: selectedLog === log.id ? 'action.selected' : 'transparent',
                  borderRadius: 0.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                    {format(log.timestamp, 'HH:mm:ss.SSS')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem' }}>
                    {getLogIcon(log.type, log.direction)}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: '0.75rem', 
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {log.message}
                  </Typography>
                  {log.data && (
                    <Tooltip title="Copy data">
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          copyLog(log.data);
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <CopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                
                <Collapse in={selectedLog === log.id && Boolean(log.data)}>
                  <Box 
                    sx={{ 
                      mt: 0.5, 
                      p: 0.5, 
                      bgcolor: 'background.default',
                      borderRadius: 0.5,
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      '&::-webkit-scrollbar': {
                        height: '4px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'action.disabled',
                        borderRadius: '2px',
                      },
                    }}
                  >
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </Box>
                </Collapse>
              </Box>
            ))
          )}
          <div ref={logsEndRef} />
        </Box>
      </Collapse>
    </Paper>
  );
}