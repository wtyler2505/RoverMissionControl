import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, LinearProgress, Alert, Collapse } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Refresh as RetryIcon,
  AccessTime as TimeoutIcon,
  PlayArrow as InProgressIcon,
  CheckCircleOutline as AcknowledgedIcon
} from '@mui/icons-material';
import { CommandAcknowledgment, AcknowledgmentStatus } from '../../services/acknowledgment.service';

interface CommandStatusDisplayProps {
  acknowledgment: CommandAcknowledgment;
  showDetails?: boolean;
  compact?: boolean;
  onRetry?: (commandId: string) => void;
}

const statusConfig = {
  pending: {
    color: 'default' as const,
    icon: <PendingIcon />,
    label: 'Pending'
  },
  acknowledged: {
    color: 'info' as const,
    icon: <AcknowledgedIcon />,
    label: 'Acknowledged'
  },
  in_progress: {
    color: 'primary' as const,
    icon: <InProgressIcon />,
    label: 'In Progress'
  },
  completed: {
    color: 'success' as const,
    icon: <CheckCircleIcon />,
    label: 'Completed'
  },
  failed: {
    color: 'error' as const,
    icon: <ErrorIcon />,
    label: 'Failed'
  },
  timeout: {
    color: 'warning' as const,
    icon: <TimeoutIcon />,
    label: 'Timeout'
  },
  retrying: {
    color: 'warning' as const,
    icon: <RetryIcon />,
    label: 'Retrying'
  }
};

export const CommandStatusDisplay: React.FC<CommandStatusDisplayProps> = ({
  acknowledgment,
  showDetails = true,
  compact = false,
  onRetry
}) => {
  const [elapsedTime, setElapsedTime] = useState<string>('');
  const config = statusConfig[acknowledgment.status as keyof typeof statusConfig];

  useEffect(() => {
    if (acknowledgment.status === 'in_progress' && acknowledgment.startedAt) {
      const updateElapsed = () => {
        const start = new Date(acknowledgment.startedAt!).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - start) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        setElapsedTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      };

      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [acknowledgment.status, acknowledgment.startedAt]);

  const getExecutionTime = (): string | null => {
    if (!acknowledgment.startedAt || !acknowledgment.completedAt) return null;
    
    const start = new Date(acknowledgment.startedAt).getTime();
    const end = new Date(acknowledgment.completedAt).getTime();
    const duration = end - start;
    
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  };

  const getAcknowledgmentTime = (): string | null => {
    if (!acknowledgment.createdAt || !acknowledgment.acknowledgedAt) return null;
    
    const created = new Date(acknowledgment.createdAt).getTime();
    const acked = new Date(acknowledgment.acknowledgedAt).getTime();
    const duration = acked - created;
    
    return `${duration}ms`;
  };

  if (compact) {
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant={acknowledgment.status === 'completed' ? 'filled' : 'outlined'}
      />
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Status Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip
          icon={config.icon}
          label={config.label}
          color={config.color}
          variant={acknowledgment.status === 'completed' ? 'filled' : 'outlined'}
        />
        
        {acknowledgment.status === 'in_progress' && elapsedTime && (
          <Typography variant="caption" color="text.secondary">
            {elapsedTime}
          </Typography>
        )}
        
        {acknowledgment.executionRetries > 0 && (
          <Chip
            size="small"
            label={`Retry ${acknowledgment.executionRetries}`}
            color="warning"
            variant="outlined"
          />
        )}
      </Box>

      {/* Progress Bar */}
      {acknowledgment.status === 'in_progress' && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress
                variant="determinate"
                value={acknowledgment.progress * 100}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>
              {Math.round(acknowledgment.progress * 100)}%
            </Typography>
          </Box>
          {acknowledgment.progressMessage && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {acknowledgment.progressMessage}
            </Typography>
          )}
        </Box>
      )}

      {/* Error Alert */}
      {acknowledgment.errorMessage && (
        <Alert 
          severity="error" 
          sx={{ mb: 1 }}
          action={
            onRetry && acknowledgment.status === 'failed' ? (
              <Chip
                size="small"
                label="Retry"
                onClick={() => onRetry(acknowledgment.commandId)}
                color="error"
                variant="outlined"
                sx={{ cursor: 'pointer' }}
              />
            ) : undefined
          }
        >
          {acknowledgment.errorMessage}
        </Alert>
      )}

      {/* Details Section */}
      <Collapse in={showDetails}>
        <Box sx={{ mt: 1 }}>
          {/* Timing Information */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {getAcknowledgmentTime() && (
              <Typography variant="caption" color="text.secondary">
                Acknowledgment: {getAcknowledgmentTime()}
              </Typography>
            )}
            
            {getExecutionTime() && (
              <Typography variant="caption" color="text.secondary">
                Execution: {getExecutionTime()}
              </Typography>
            )}
          </Box>

          {/* Metadata */}
          {Object.keys(acknowledgment.metadata).length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Metadata:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.entries(acknowledgment.metadata).map(([key, value]) => (
                  <Chip
                    key={key}
                    size="small"
                    label={`${key}: ${value}`}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};