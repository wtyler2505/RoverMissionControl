import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Badge,
  Collapse,
  Divider,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  SignalCellularAlt as SignalIcon,
  SignalCellularConnectedNoInternet0Bar as NoSignalIcon
} from '@mui/icons-material';
import { TransitionGroup } from 'react-transition-group';
import { getAcknowledgmentService, CommandAcknowledgment } from '../../services/acknowledgment.service';
import { CommandStatusDisplay } from './CommandStatusDisplay';

interface CommandTrackerProps {
  autoTrack?: boolean;
  maxCommands?: number;
  showStats?: boolean;
  onCommandComplete?: (commandId: string, acknowledgment: CommandAcknowledgment) => void;
  onCommandFail?: (commandId: string, acknowledgment: CommandAcknowledgment) => void;
}

export const CommandTracker: React.FC<CommandTrackerProps> = ({
  autoTrack = true,
  maxCommands = 20,
  showStats = true,
  onCommandComplete,
  onCommandFail
}) => {
  const [acknowledgments, setAcknowledgments] = useState<Map<string, CommandAcknowledgment>>(new Map());
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalAcknowledged: 0,
    totalCompleted: 0,
    totalFailed: 0,
    totalTimeouts: 0,
    averageAcknowledgmentTime: 0,
    averageExecutionTime: 0
  });

  const acknowledgmentService = getAcknowledgmentService();

  useEffect(() => {
    // Initialize service
    const initService = async () => {
      try {
        await acknowledgmentService.initialize();
        setIsLoading(false);
      } catch (err) {
        setError('Failed to connect to acknowledgment service');
        setIsLoading(false);
      }
    };

    initService();

    // Subscribe to updates
    const acknowledgmentSub = acknowledgmentService.getAllAcknowledgments$().subscribe(acks => {
      setAcknowledgments(new Map(acks));
      
      // Check for completed/failed commands
      acks.forEach((ack, commandId) => {
        const prevAck = acknowledgments.get(commandId);
        if (prevAck && prevAck.status !== ack.status) {
          if (ack.status === 'completed' && onCommandComplete) {
            onCommandComplete(commandId, ack);
          } else if ((ack.status === 'failed' || ack.status === 'timeout') && onCommandFail) {
            onCommandFail(commandId, ack);
          }
        }
      });

      // Limit displayed commands
      if (acks.size > maxCommands) {
        const sortedAcks = Array.from(acks.entries())
          .sort((a, b) => new Date(b[1].createdAt).getTime() - new Date(a[1].createdAt).getTime())
          .slice(0, maxCommands);
        setAcknowledgments(new Map(sortedAcks));
      }
    });

    const connectionSub = acknowledgmentService.getConnectionStatus$().subscribe(setIsConnected);

    const errorSub = acknowledgmentService.getErrors$().subscribe(err => {
      setError(err.message);
    });

    // Update stats periodically
    const statsInterval = setInterval(() => {
      setStats(acknowledgmentService.getStats());
    }, 1000);

    return () => {
      acknowledgmentSub.unsubscribe();
      connectionSub.unsubscribe();
      errorSub.unsubscribe();
      clearInterval(statsInterval);
      acknowledgmentService.disconnect();
    };
  }, []);

  const toggleExpanded = useCallback((commandId: string) => {
    setExpandedCommands(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commandId)) {
        newSet.delete(commandId);
      } else {
        newSet.add(commandId);
      }
      return newSet;
    });
  }, []);

  const handleUntrack = useCallback((commandId: string) => {
    acknowledgmentService.untrackCommand(commandId);
  }, []);

  const handleRetry = useCallback((commandId: string) => {
    // This would typically trigger a command retry through your command service
    console.log('Retry command:', commandId);
  }, []);

  const handleClearCompleted = useCallback(() => {
    acknowledgments.forEach((ack, commandId) => {
      if (ack.status === 'completed' || ack.status === 'failed' || ack.status === 'timeout') {
        acknowledgmentService.untrackCommand(commandId);
      }
    });
  }, [acknowledgments]);

  const getActiveCommands = (): number => {
    let count = 0;
    acknowledgments.forEach(ack => {
      if (['pending', 'acknowledged', 'in_progress', 'retrying'].includes(ack.status)) {
        count++;
      }
    });
    return count;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Command Tracker</Typography>
            <Badge badgeContent={getActiveCommands()} color="primary" max={99}>
              <Box />
            </Badge>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={isConnected ? 'Connected' : 'Disconnected'}>
              <IconButton size="small">
                {isConnected ? (
                  <SignalIcon color="success" />
                ) : (
                  <NoSignalIcon color="error" />
                )}
              </IconButton>
            </Tooltip>
            
            {acknowledgments.size > 0 && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleClearCompleted}
                startIcon={<DeleteIcon />}
              >
                Clear Completed
              </Button>
            )}
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Stats */}
        {showStats && acknowledgments.size > 0 && (
          <Box sx={{ mb: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
              <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                <Typography variant="h6" color="primary">
                  {stats.totalCompleted}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Completed
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                <Typography variant="h6" color="error">
                  {stats.totalFailed}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Failed
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                <Typography variant="h6" color="warning.main">
                  {getActiveCommands()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active
                </Typography>
              </Box>
              {stats.averageExecutionTime > 0 && (
                <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                  <Typography variant="h6">
                    {(stats.averageExecutionTime / 1000).toFixed(1)}s
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg Time
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Command List */}
        {acknowledgments.size === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No commands being tracked
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            <TransitionGroup>
              {Array.from(acknowledgments.entries()).map(([commandId, acknowledgment], index) => (
                <Collapse key={commandId}>
                  <ListItem
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      py: 1,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <ListItemIcon>
                        <IconButton
                          size="small"
                          onClick={() => toggleExpanded(commandId)}
                        >
                          {expandedCommands.has(commandId) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {commandId.substring(0, 8)}...
                            </Typography>
                            <CommandStatusDisplay
                              acknowledgment={acknowledgment}
                              compact
                              showDetails={false}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {new Date(acknowledgment.createdAt).toLocaleTimeString()}
                          </Typography>
                        }
                      />
                      
                      <Tooltip title="Stop tracking">
                        <IconButton
                          size="small"
                          onClick={() => handleUntrack(commandId)}
                          edge="end"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <Collapse in={expandedCommands.has(commandId)}>
                      <Box sx={{ pl: 6, pr: 2, pt: 1 }}>
                        <CommandStatusDisplay
                          acknowledgment={acknowledgment}
                          showDetails
                          compact={false}
                          onRetry={handleRetry}
                        />
                      </Box>
                    </Collapse>
                  </ListItem>
                  {index < acknowledgments.size - 1 && <Divider />}
                </Collapse>
              ))}
            </TransitionGroup>
          </List>
        )}
      </CardContent>
    </Card>
  );
};