/**
 * Alert List Widget
 * 
 * Displays system alerts with acknowledgment and resolution capabilities
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Collapse,
  Alert as MuiAlert,
  Badge,
  Tooltip,
  useTheme,
  alpha,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as ResolvedIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Visibility as ViewIcon,
  Done as AcknowledgeIcon,
  Close as ResolveIcon,
  Refresh as RefreshIcon,
  NotificationsActive as ActiveIcon
} from '@mui/icons-material';
import { Alert, getSeverityColor } from '../../../types/progress-tracking.types';
import { formatRelativeTime, formatTimestamp } from '../../../utils/time.utils';

interface AlertListProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string, resolution?: string) => void;
  onViewDetails?: (alertId: string) => void;
}

interface AlertItemProps {
  alert: Alert;
  onAcknowledge?: () => void;
  onResolve?: () => void;
  onViewDetails?: () => void;
}

const AlertItem: React.FC<AlertItemProps> = ({
  alert,
  onAcknowledge,
  onResolve,
  onViewDetails
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  const getSeverityIcon = () => {
    switch (alert.severity) {
      case 'critical':
      case 'high':
        return <ErrorIcon color="error" />;
      case 'medium':
        return <WarningIcon color="warning" />;
      case 'low':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  const isActive = !alert.resolvedAt && !alert.acknowledged;
  const isAcknowledged = alert.acknowledged && !alert.resolvedAt;
  const isResolved = !!alert.resolvedAt;

  const getStatusChip = () => {
    if (isResolved) {
      return <Chip label="Resolved" size="small" color="success" />;
    } else if (isAcknowledged) {
      return <Chip label="Acknowledged" size="small" color="warning" />;
    } else {
      return <Chip label="Active" size="small" color="error" />;
    }
  };

  const handleResolve = () => {
    if (onResolve) {
      onResolve();
      setResolveDialogOpen(false);
      setResolution('');
    }
  };

  return (
    <>
      <ListItem
        sx={{
          bgcolor: isActive 
            ? alpha(getSeverityColor(alert.severity), 0.1)
            : 'transparent',
          borderRadius: 1,
          mb: 1,
          borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
          opacity: isResolved ? 0.7 : 1,
          transition: 'all 0.2s ease'
        }}
      >
        <ListItemIcon>
          <Badge 
            variant="dot" 
            color="error" 
            invisible={!isActive}
            sx={{
              '& .MuiBadge-dot': {
                animation: isActive ? 'pulse 2s infinite' : 'none'
              }
            }}
          >
            {getSeverityIcon()}
          </Badge>
        </ListItemIcon>

        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                {alert.ruleName}
              </Typography>
              <Chip
                label={alert.severity}
                size="small"
                sx={{
                  bgcolor: alpha(getSeverityColor(alert.severity), 0.2),
                  color: getSeverityColor(alert.severity),
                  fontWeight: 'bold'
                }}
              />
              {getStatusChip()}
            </Box>
          }
          secondary={
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {alert.message}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Triggered: {formatRelativeTime(alert.triggeredAt)}
                </Typography>
                
                {alert.affectedCommands.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Affects: {alert.affectedCommands.length} command(s)
                  </Typography>
                )}
                
                {alert.acknowledgedBy && (
                  <Typography variant="caption" color="text.secondary">
                    Ack by: {alert.acknowledgedBy}
                  </Typography>
                )}
              </Box>

              <Collapse in={expanded}>
                <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.background.paper, 0.5), borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Alert Details
                  </Typography>
                  
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Rule ID:
                      </Typography>
                      <Typography variant="body2">
                        {alert.ruleId}
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Triggered At:
                      </Typography>
                      <Typography variant="body2">
                        {formatTimestamp(alert.triggeredAt, { 
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Typography>
                    </Box>
                    
                    {alert.resolvedAt && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Resolved At:
                        </Typography>
                        <Typography variant="body2">
                          {formatTimestamp(alert.resolvedAt, { 
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Typography>
                      </Box>
                    )}
                    
                    {alert.details && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Additional Details:
                        </Typography>
                        <Typography variant="body2" component="pre" sx={{ 
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          overflow: 'auto',
                          maxHeight: 200
                        }}>
                          {JSON.stringify(alert.details, null, 2)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Collapse>
            </>
          }
        />

        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={expanded ? "Collapse" : "Expand"}>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <CollapseIcon /> : <ExpandIcon />}
              </IconButton>
            </Tooltip>
            
            {onViewDetails && (
              <Tooltip title="View Details">
                <IconButton size="small" onClick={onViewDetails}>
                  <ViewIcon />
                </IconButton>
              </Tooltip>
            )}
            
            {!alert.acknowledged && onAcknowledge && (
              <Tooltip title="Acknowledge">
                <IconButton size="small" onClick={onAcknowledge} color="primary">
                  <AcknowledgeIcon />
                </IconButton>
              </Tooltip>
            )}
            
            {!alert.resolvedAt && onResolve && (
              <Tooltip title="Resolve">
                <IconButton 
                  size="small" 
                  onClick={() => setResolveDialogOpen(true)}
                  color="success"
                >
                  <ResolveIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </ListItemSecondaryAction>
      </ListItem>

      {/* Resolve Dialog */}
      <Dialog
        open={resolveDialogOpen}
        onClose={() => setResolveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Resolve Alert</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Are you sure you want to resolve this alert?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Resolution Notes (Optional)"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleResolve}
            variant="contained"
            color="success"
          >
            Resolve
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export const AlertList: React.FC<AlertListProps> = ({
  alerts,
  onAcknowledge,
  onResolve,
  onViewDetails
}) => {
  const theme = useTheme();
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);

  const filteredAlerts = useMemo(() => {
    let filtered = alerts;

    // Status filter
    switch (filter) {
      case 'active':
        filtered = filtered.filter(a => !a.acknowledged && !a.resolvedAt);
        break;
      case 'acknowledged':
        filtered = filtered.filter(a => a.acknowledged && !a.resolvedAt);
        break;
      case 'resolved':
        filtered = filtered.filter(a => !!a.resolvedAt);
        break;
    }

    // Severity filter
    if (severityFilter.length > 0) {
      filtered = filtered.filter(a => severityFilter.includes(a.severity));
    }

    // Sort by severity and time
    return filtered.sort((a, b) => {
      // Active alerts first
      if (!a.resolvedAt && b.resolvedAt) return -1;
      if (a.resolvedAt && !b.resolvedAt) return 1;
      
      // Then by severity
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity as keyof typeof severityOrder] - 
                           severityOrder[b.severity as keyof typeof severityOrder];
      if (severityDiff !== 0) return severityDiff;
      
      // Then by time
      return b.triggeredAt.getTime() - a.triggeredAt.getTime();
    });
  }, [alerts, filter, severityFilter]);

  const counts = useMemo(() => {
    const active = alerts.filter(a => !a.acknowledged && !a.resolvedAt).length;
    const acknowledged = alerts.filter(a => a.acknowledged && !a.resolvedAt).length;
    const resolved = alerts.filter(a => !!a.resolvedAt).length;
    return { active, acknowledged, resolved };
  }, [alerts]);

  if (alerts.length === 0) {
    return (
      <Box 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <ActiveIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        <Typography variant="h6" color="text.secondary">
          No alerts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          System is operating normally
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            System Alerts
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {counts.active > 0 && (
              <Chip
                icon={<ActiveIcon />}
                label={`${counts.active} Active`}
                color="error"
                size="small"
              />
            )}
            {counts.acknowledged > 0 && (
              <Chip
                label={`${counts.acknowledged} Acknowledged`}
                color="warning"
                size="small"
              />
            )}
            {counts.resolved > 0 && (
              <Chip
                label={`${counts.resolved} Resolved`}
                color="success"
                size="small"
              />
            )}
          </Box>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(_, value) => value && setFilter(value)}
            size="small"
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="active">Active</ToggleButton>
            <ToggleButton value="acknowledged">Acknowledged</ToggleButton>
            <ToggleButton value="resolved">Resolved</ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            value={severityFilter}
            onChange={(_, value) => setSeverityFilter(value || [])}
            size="small"
            multiple
          >
            <ToggleButton value="critical">Critical</ToggleButton>
            <ToggleButton value="high">High</ToggleButton>
            <ToggleButton value="medium">Medium</ToggleButton>
            <ToggleButton value="low">Low</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Alert List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredAlerts.length === 0 ? (
          <MuiAlert severity="info">
            No alerts match your filters
          </MuiAlert>
        ) : (
          <List disablePadding>
            {filteredAlerts.map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onAcknowledge={() => onAcknowledge?.(alert.id)}
                onResolve={() => onResolve?.(alert.id)}
                onViewDetails={() => onViewDetails?.(alert.id)}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};