/**
 * AlertIndicator Component
 * Real-time alert status badges and notifications with severity-based styling
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Badge,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  Fade,
  Zoom
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  NotificationsActive as NotificationsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { AlertIndicatorProps, AlertInstance } from '../types/threshold-types';

const SEVERITY_COLORS = {
  info: '#2196f3',
  warning: '#ff9800',
  error: '#f44336',
  critical: '#9c27b0'
};

const SEVERITY_ICONS = {
  info: <InfoIcon />,
  warning: <WarningIcon />,
  error: <ErrorIcon />,
  critical: <ErrorIcon />
};

const POSITION_STYLES = {
  'top-left': { top: 16, left: 16 },
  'top-right': { top: 16, right: 16 },
  'bottom-left': { bottom: 16, left: 16 },
  'bottom-right': { bottom: 16, right: 16 }
};

export const AlertIndicator: React.FC<AlertIndicatorProps> = ({
  alerts,
  position = 'top-right',
  maxVisible = 5,
  showCount = true,
  showSeverityIcons = true,
  showTimestamp = true,
  onAlertClick,
  onAcknowledge,
  onResolve,
  className
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertInstance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Filter and sort alerts
  const sortedAlerts = useMemo(() => {
    const activeAlerts = alerts.filter(alert => !alert.resolved);
    return activeAlerts.sort((a, b) => {
      // Sort by severity first (critical > error > warning > info)
      const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Then by timestamp (newest first)
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [alerts]);
  
  // Calculate statistics
  const stats = useMemo(() => {
    const active = sortedAlerts.filter(a => !a.acknowledged);
    const acknowledged = sortedAlerts.filter(a => a.acknowledged && !a.resolved);
    const critical = sortedAlerts.filter(a => a.severity === 'critical' && !a.acknowledged);
    
    return {
      total: sortedAlerts.length,
      active: active.length,
      acknowledged: acknowledged.length,
      critical: critical.length
    };
  }, [sortedAlerts]);
  
  // Get display alerts (limited by maxVisible)
  const displayAlerts = useMemo(() => {
    return expanded ? sortedAlerts : sortedAlerts.slice(0, maxVisible);
  }, [sortedAlerts, maxVisible, expanded]);
  
  // Handle alert actions
  const handleAlertClick = useCallback((alert: AlertInstance) => {
    setSelectedAlert(alert);
    setDialogOpen(true);
    onAlertClick?.(alert);
  }, [onAlertClick]);
  
  const handleAcknowledge = useCallback((alertId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    onAcknowledge?.(alertId);
  }, [onAcknowledge]);
  
  const handleResolve = useCallback((alertId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    onResolve?.(alertId);
  }, [onResolve]);
  
  // Format timestamp
  const formatTimestamp = useCallback((timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }, []);
  
  // Get severity badge color
  const getSeverityColor = useCallback((severity: string) => {
    return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.info;
  }, []);
  
  if (sortedAlerts.length === 0) {
    return null;
  }
  
  return (
    <>
      <Box
        className={className}
        sx={{
          position: 'absolute',
          zIndex: 1000,
          ...POSITION_STYLES[position],
          maxWidth: 400,
          minWidth: 250
        }}
      >
        {/* Main indicator */}
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: theme.shadows[4],
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              padding: 1,
              backgroundColor: stats.critical > 0 ? 
                alpha(SEVERITY_COLORS.critical, 0.1) :
                stats.active > 0 ?
                alpha(SEVERITY_COLORS.error, 0.1) :
                alpha(theme.palette.primary.main, 0.1),
              cursor: 'pointer'
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <Badge
              badgeContent={stats.active}
              color={stats.critical > 0 ? 'error' : stats.active > 0 ? 'warning' : 'default'}
              max={99}
            >
              <NotificationsIcon 
                color={stats.critical > 0 ? 'error' : stats.active > 0 ? 'warning' : 'action'}
              />
            </Badge>
            
            <Box sx={{ ml: 1, flex: 1 }}>
              <Typography variant="body2" fontWeight="bold">
                {stats.active > 0 ? `${stats.active} Active Alert${stats.active !== 1 ? 's' : ''}` : 'No Active Alerts'}
              </Typography>
              {showCount && stats.total > stats.active && (
                <Typography variant="caption" color="textSecondary">
                  {stats.acknowledged} acknowledged, {alerts.filter(a => a.resolved).length} resolved
                </Typography>
              )}
            </Box>
            
            <IconButton size="small">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          {/* Alert list */}
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              <List dense disablePadding>
                {displayAlerts.map((alert, index) => (
                  <React.Fragment key={alert.id}>
                    <ListItem
                      button
                      onClick={() => handleAlertClick(alert)}
                      sx={{
                        backgroundColor: alert.acknowledged ? 
                          alpha(theme.palette.success.main, 0.05) :
                          alpha(getSeverityColor(alert.severity), 0.05),
                        '&:hover': {
                          backgroundColor: alert.acknowledged ? 
                            alpha(theme.palette.success.main, 0.1) :
                            alpha(getSeverityColor(alert.severity), 0.1)
                        }
                      }}
                    >
                      {showSeverityIcons && (
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Tooltip title={`${alert.severity.toUpperCase()} Alert`}>
                            <div style={{ color: getSeverityColor(alert.severity) }}>
                              {SEVERITY_ICONS[alert.severity]}
                            </div>
                          </Tooltip>
                        </ListItemIcon>
                      )}
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" noWrap>
                              {alert.message}
                            </Typography>
                            {alert.acknowledged && (
                              <Chip
                                label="ACK"
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '10px' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          showTimestamp && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ScheduleIcon sx={{ fontSize: 12 }} />
                              <Typography variant="caption">
                                {formatTimestamp(alert.timestamp)}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                Value: {alert.value.toFixed(2)}
                              </Typography>
                            </Box>
                          )
                        }
                      />
                      
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {!alert.acknowledged && (
                            <Tooltip title="Acknowledge">
                              <IconButton
                                size="small"
                                onClick={(e) => handleAcknowledge(alert.id, e)}
                                color="success"
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {!alert.resolved && (
                            <Tooltip title="Resolve">
                              <IconButton
                                size="small"
                                onClick={(e) => handleResolve(alert.id, e)}
                                color="error"
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    
                    {index < displayAlerts.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
                
                {sortedAlerts.length > maxVisible && !expanded && (
                  <ListItem>
                    <ListItemText
                      primary={
                        <Typography variant="caption" color="textSecondary" align="center">
                          +{sortedAlerts.length - maxVisible} more alerts
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          </Collapse>
        </Box>
        
        {/* Floating critical alerts */}
        {stats.critical > 0 && !expanded && (
          <Fade in timeout={500}>
            <Box
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                zIndex: 1001
              }}
            >
              <Zoom in timeout={300}>
                <Chip
                  label={`${stats.critical} CRITICAL`}
                  color="error"
                  size="small"
                  icon={<ErrorIcon />}
                  sx={{
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': { opacity: 1 },
                      '50%': { opacity: 0.7 },
                      '100%': { opacity: 1 }
                    }
                  }}
                />
              </Zoom>
            </Box>
          </Fade>
        )}
      </Box>
      
      {/* Alert detail dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Zoom}
      >
        {selectedAlert && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <div style={{ color: getSeverityColor(selectedAlert.severity) }}>
                  {SEVERITY_ICONS[selectedAlert.severity]}
                </div>
                <Typography variant="h6">
                  {selectedAlert.severity.toUpperCase()} Alert
                </Typography>
                <Chip
                  label={selectedAlert.acknowledged ? 'ACKNOWLEDGED' : 'ACTIVE'}
                  color={selectedAlert.acknowledged ? 'success' : 'error'}
                  size="small"
                />
                <IconButton
                  size="small"
                  onClick={() => setDialogOpen(false)}
                  sx={{ ml: 'auto' }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Message:</strong> {selectedAlert.message}
                </Typography>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Timestamp:</strong> {selectedAlert.timestamp.toLocaleString()}
                </Typography>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Value:</strong> {selectedAlert.value.toFixed(2)}
                  {selectedAlert.expectedValue && (
                    <> (Expected: {selectedAlert.expectedValue.toFixed(2)})</>
                  )}
                </Typography>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Threshold ID:</strong> {selectedAlert.thresholdId}
                </Typography>
                
                {selectedAlert.acknowledgedAt && selectedAlert.acknowledgedBy && (
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    <strong>Acknowledged:</strong> {selectedAlert.acknowledgedAt.toLocaleString()} by {selectedAlert.acknowledgedBy}
                  </Typography>
                )}
                
                {selectedAlert.resolvedAt && selectedAlert.resolvedBy && (
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    <strong>Resolved:</strong> {selectedAlert.resolvedAt.toLocaleString()} by {selectedAlert.resolvedBy}
                  </Typography>
                )}
              </Box>
              
              {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Additional Information:</strong>
                  </Typography>
                  <pre style={{ fontSize: '12px', marginTop: '8px' }}>
                    {JSON.stringify(selectedAlert.metadata, null, 2)}
                  </pre>
                </Alert>
              )}
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>
                Close
              </Button>
              
              {!selectedAlert.acknowledged && (
                <Button
                  onClick={() => {
                    handleAcknowledge(selectedAlert.id);
                    setDialogOpen(false);
                  }}
                  startIcon={<CheckCircleIcon />}
                  color="success"
                  variant="contained"
                >
                  Acknowledge
                </Button>
              )}
              
              {!selectedAlert.resolved && (
                <Button
                  onClick={() => {
                    handleResolve(selectedAlert.id);
                    setDialogOpen(false);
                  }}
                  startIcon={<CancelIcon />}
                  color="error"
                  variant="contained"
                >
                  Resolve
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default AlertIndicator;