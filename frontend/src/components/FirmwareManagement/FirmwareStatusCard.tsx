/**
 * Firmware Status Card Component
 * Displays current firmware version and update status for a device
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Alert,
  Button,
  Grid,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Update as UpdateIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  GetApp as DownloadIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface FirmwareVersion {
  major: number;
  minor: number;
  patch: number;
  build?: number;
  version: string;
}

interface FirmwareUpdate {
  update_available: boolean;
  current_version: string;
  latest_version: string;
  update_priority: 'critical' | 'high' | 'normal' | 'low' | 'optional';
  critical_update: boolean;
  release_date?: string;
  changelog?: string;
  size: number;
}

interface FirmwareUpdateSession {
  session_id: string;
  device_id: string;
  state: string;
  progress: number;
  source_version: string;
  target_version: string;
  start_time: string;
  elapsed_time: number;
  emergency_stop: boolean;
  errors: number;
}

interface FirmwareStatusCardProps {
  deviceId: string;
  deviceName: string;
  currentVersion?: FirmwareVersion;
  updateInfo?: FirmwareUpdate;
  updateSession?: FirmwareUpdateSession;
  onCheckUpdates: () => void;
  onStartUpdate: (version: string) => void;
  onCancelUpdate: (sessionId: string) => void;
  onEmergencyStop: () => void;
  loading?: boolean;
  error?: string;
}

const FirmwareStatusCard: React.FC<FirmwareStatusCardProps> = ({
  deviceId,
  deviceName,
  currentVersion,
  updateInfo,
  updateSession,
  onCheckUpdates,
  onStartUpdate,
  onCancelUpdate,
  onEmergencyStop,
  loading = false,
  error,
}) => {
  const getStatusIcon = () => {
    if (updateSession?.emergency_stop) {
      return <ErrorIcon color="error" />;
    }
    if (updateSession?.state === 'failed') {
      return <ErrorIcon color="error" />;
    }
    if (updateSession?.state === 'completed') {
      return <CheckCircleIcon color="success" />;
    }
    if (updateSession) {
      return <UpdateIcon color="primary" />;
    }
    if (updateInfo?.critical_update) {
      return <WarningIcon color="error" />;
    }
    if (updateInfo?.update_available) {
      return <WarningIcon color="warning" />;
    }
    return <CheckCircleIcon color="success" />;
  };

  const getStatusColor = () => {
    if (updateSession?.emergency_stop || updateSession?.state === 'failed') {
      return 'error';
    }
    if (updateSession?.state === 'completed') {
      return 'success';
    }
    if (updateSession) {
      return 'primary';
    }
    if (updateInfo?.critical_update) {
      return 'error';
    }
    if (updateInfo?.update_available) {
      return 'warning';
    }
    return 'success';
  };

  const getStatusText = () => {
    if (updateSession?.emergency_stop) {
      return 'Emergency Stop';
    }
    if (updateSession?.state) {
      return updateSession.state.replace(/_/g, ' ').toUpperCase();
    }
    if (updateInfo?.critical_update) {
      return 'Critical Update Available';
    }
    if (updateInfo?.update_available) {
      return 'Update Available';
    }
    return 'Up to Date';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'primary';
      case 'low':
        return 'info';
      case 'optional':
      default:
        return 'default';
    }
  };

  return (
    <Card elevation={3}>
      <CardHeader
        avatar={getStatusIcon()}
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6">{deviceName}</Typography>
            <Chip
              label={getStatusText()}
              color={getStatusColor()}
              size="small"
            />
          </Box>
        }
        subheader={`Device ID: ${deviceId}`}
        action={
          updateSession?.state === 'updating' && (
            <Tooltip title="Emergency Stop">
              <IconButton onClick={onEmergencyStop} color="error">
                <ErrorIcon />
              </IconButton>
            </Tooltip>
          )
        }
      />
      <CardContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <LinearProgress sx={{ width: '100%' }} />
          </Box>
        ) : (
          <>
            {/* Current Version */}
            <Box mb={2}>
              <Typography variant="subtitle2" color="textSecondary">
                Current Version
              </Typography>
              <Typography variant="h5">
                {currentVersion?.version || 'Unknown'}
              </Typography>
            </Box>

            {/* Update Session Progress */}
            {updateSession && (
              <Box mb={3}>
                <Alert 
                  severity={
                    updateSession.emergency_stop ? 'error' :
                    updateSession.state === 'failed' ? 'error' :
                    updateSession.state === 'completed' ? 'success' :
                    'info'
                  }
                  sx={{ mb: 2 }}
                >
                  <Typography variant="body2">
                    {updateSession.state === 'updating' 
                      ? `Updating from ${updateSession.source_version} to ${updateSession.target_version}`
                      : `Update ${updateSession.state}: ${updateSession.source_version} → ${updateSession.target_version}`
                    }
                  </Typography>
                </Alert>

                {updateSession.state !== 'completed' && updateSession.state !== 'failed' && (
                  <>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Box flex={1} mr={2}>
                        <LinearProgress 
                          variant="determinate" 
                          value={updateSession.progress} 
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {Math.round(updateSession.progress)}%
                      </Typography>
                    </Box>

                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <ScheduleIcon fontSize="small" color="action" />
                          <Typography variant="caption" color="textSecondary">
                            Elapsed: {Math.floor(updateSession.elapsed_time / 60)}m {Math.floor(updateSession.elapsed_time % 60)}s
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        {updateSession.errors > 0 && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <ErrorIcon fontSize="small" color="error" />
                            <Typography variant="caption" color="error">
                              {updateSession.errors} errors
                            </Typography>
                          </Box>
                        )}
                      </Grid>
                    </Grid>

                    <Box mt={2}>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => onCancelUpdate(updateSession.session_id)}
                        fullWidth
                      >
                        Cancel Update
                      </Button>
                    </Box>
                  </>
                )}
              </Box>
            )}

            {/* Update Information */}
            {updateInfo && !updateSession && (
              <Box>
                {updateInfo.update_available ? (
                  <>
                    <Alert 
                      severity={updateInfo.critical_update ? 'error' : 'warning'}
                      sx={{ mb: 2 }}
                      icon={updateInfo.critical_update ? <SecurityIcon /> : <UpdateIcon />}
                    >
                      <Typography variant="body2">
                        {updateInfo.critical_update 
                          ? 'Critical security update available'
                          : 'New version available'
                        }
                      </Typography>
                    </Alert>

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" color="textSecondary">
                          New Version
                        </Typography>
                        <Typography variant="h6">
                          {updateInfo.latest_version}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" color="textSecondary">
                          Priority
                        </Typography>
                        <Chip
                          label={updateInfo.update_priority.toUpperCase()}
                          color={getPriorityColor(updateInfo.update_priority)}
                          size="small"
                        />
                      </Grid>
                    </Grid>

                    {updateInfo.release_date && (
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        Released {formatDistanceToNow(new Date(updateInfo.release_date), { addSuffix: true })}
                      </Typography>
                    )}

                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      Size: {formatBytes(updateInfo.size)}
                    </Typography>

                    {updateInfo.changelog && (
                      <Box mb={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          What's New
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="textSecondary"
                          sx={{ 
                            maxHeight: 100, 
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {updateInfo.changelog}
                        </Typography>
                      </Box>
                    )}

                    <Button
                      variant="contained"
                      color={updateInfo.critical_update ? 'error' : 'primary'}
                      startIcon={<DownloadIcon />}
                      onClick={() => onStartUpdate(updateInfo.latest_version)}
                      fullWidth
                    >
                      {updateInfo.critical_update ? 'Install Critical Update' : 'Install Update'}
                    </Button>
                  </>
                ) : (
                  <Alert severity="success" icon={<CheckCircleIcon />}>
                    Device firmware is up to date
                  </Alert>
                )}
              </Box>
            )}

            {/* Check for Updates Button */}
            {!updateSession && !loading && (
              <Box mt={2}>
                <Button
                  variant="outlined"
                  onClick={onCheckUpdates}
                  fullWidth
                  disabled={loading}
                >
                  Check for Updates
                </Button>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FirmwareStatusCard;